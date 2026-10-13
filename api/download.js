// Direct Episode Video Download Endpoint
// Supports Vercel Serverless (no FFmpeg required) + Local FFmpeg remuxing
// Supports direct MP4/TS stream and 1DM/VLC/ADM playlist downloads

const { spawn } = require('child_process');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { v: videoId, title, slug, format } = req.query;

  if (!videoId) {
    return res.status(400).send('Missing video ID parameter v');
  }

  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const localHlsUrl = `${protocol}://${host}/api/hls?v=${encodeURIComponent(videoId)}`;

  const rawTitle = title || slug || `Episode-${videoId}`;
  const safeFilename = rawTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'streamx_episode';

  // 1. M3U8 Playlist download (for 1DM, ADM, VLC, MX Player on Android / iOS)
  if (format === 'm3u8' || format === 'playlist') {
    try {
      const upstreamRes = await fetch(localHlsUrl);
      if (!upstreamRes.ok) return res.status(502).send('Stream not available');
      let m3u8Content = await upstreamRes.text();
      const baseProxyUrl = `${protocol}://${host}/api/hls`;
      m3u8Content = m3u8Content.replace(/\/api\/hls\?/g, `${baseProxyUrl}?`);

      res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.m3u8"`);
      return res.status(200).send(m3u8Content);
    } catch (e) {
      return res.status(500).send('Playlist fetch error');
    }
  }

  // 2. Direct MPEG-TS Stream (Plays natively on VLC, Android, iPhone, Windows Media Player)
  if (format === 'ts' || format === 'direct') {
    return streamDirectTs(localHlsUrl, safeFilename, res);
  }

  // 3. Default: Try FFmpeg if available, otherwise fallback to direct TS stream
  try {
    const ffmpeg = spawn('ffmpeg', [
      '-i', localHlsUrl,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    ]);

    let spawned = false;

    ffmpeg.stdout.once('data', () => {
      spawned = true;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp4"`);
      res.setHeader('Cache-Control', 'no-cache');
    });

    ffmpeg.stdout.pipe(res);

    ffmpeg.on('error', (err) => {
      console.warn('[Download] FFmpeg unavailable on host/serverless, streaming direct TS video:', err.message);
      if (!res.headersSent) {
        streamDirectTs(localHlsUrl, safeFilename, res);
      }
    });

    req.on('close', () => {
      try { ffmpeg.kill('SIGINT'); } catch (e) {}
    });
  } catch (err) {
    if (!res.headersSent) {
      streamDirectTs(localHlsUrl, safeFilename, res);
    }
  }
};

// Stream segments directly as a single .ts video file
async function streamDirectTs(playlistUrl, safeFilename, res) {
  try {
    const plRes = await fetch(playlistUrl);
    if (!plRes.ok) return res.status(502).send('Stream unavailable');

    const m3u8Text = await plRes.text();
    const lines = m3u8Text.split('\n');
    const segmentUrls = [];

    const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const fullUrl = trimmed.startsWith('http') ? trimmed : `${baseUrl}${trimmed}`;
        segmentUrls.push(fullUrl);
      }
    }

    if (segmentUrls.length === 0) {
      return res.status(404).send('No video segments found');
    }

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.ts"`);
    res.setHeader('Cache-Control', 'no-cache');

    for (const segUrl of segmentUrls) {
      if (res.writableEnded || res.destroyed) break;
      try {
        const segRes = await fetch(segUrl);
        if (segRes.ok) {
          const buf = await segRes.arrayBuffer();
          res.write(Buffer.from(buf));
        }
      } catch (e) {
        // continue with next segment
      }
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send('Stream download error');
    }
  }
}
