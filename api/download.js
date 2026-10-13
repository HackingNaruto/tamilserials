// Direct Episode Video Download Endpoint
// Supports Vercel Serverless (no FFmpeg required) + Local FFmpeg remuxing
// Supports multi-quality direct MP4/TS stream and 1DM/VLC/ADM playlist downloads

const { spawn } = require('child_process');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { v: videoId, title, slug, format, quality } = req.query;

  if (!videoId) {
    return res.status(400).send('Missing video ID parameter v');
  }

  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const localHlsUrl = `${protocol}://${host}/api/hls?v=${encodeURIComponent(videoId)}`;

  const rawTitle = title || slug || `Episode-${videoId}`;
  const qualityTag = quality ? `_${quality}p` : '';
  const safeFilename = (rawTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'streamx_episode') + qualityTag;

  try {
    // Step 1: Fetch upstream/local playlist to inspect if Master Playlist or Media Playlist
    const upstreamRes = await fetch(localHlsUrl);
    if (!upstreamRes.ok) {
      return res.status(502).send('Stream not available');
    }

    let playlistText = await upstreamRes.text();
    let targetPlaylistUrl = localHlsUrl;
    let isMaster = playlistText.includes('#EXT-X-STREAM-INF');

    // Step 2: If Master Playlist, resolve to requested or best quality sub-playlist
    if (isMaster) {
      const lines = playlistText.split('\n');
      const variants = [];
      let currentVariant = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
          const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
          const height = resMatch ? parseInt(resMatch[2], 10) : 0;
          const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
          currentVariant = { height, bandwidth };
        } else if (line && !line.startsWith('#') && currentVariant) {
          variants.push({
            ...currentVariant,
            url: line
          });
          currentVariant = null;
        }
      }

      if (variants.length > 0) {
        // Sort highest resolution/bandwidth first
        variants.sort((a, b) => (b.height || b.bandwidth) - (a.height || a.bandwidth));

        let selected = variants[0];
        if (quality) {
          const reqH = parseInt(quality, 10);
          const match = variants.find(v => v.height === reqH);
          if (match) selected = match;
        }

        let subUrl = selected.url;
        if (!subUrl.startsWith('http')) {
          const parsedBase = new URL(localHlsUrl);
          if (subUrl.startsWith('/')) {
            subUrl = `${parsedBase.origin}${subUrl}`;
          } else {
            const p = parsedBase.pathname.split('/');
            p.pop();
            subUrl = `${parsedBase.origin}${p.join('/')}/${subUrl}`;
          }
        }

        targetPlaylistUrl = subUrl;
        const subRes = await fetch(targetPlaylistUrl);
        if (subRes.ok) {
          playlistText = await subRes.text();
        }
      }
    }

    // Step 3: Handle M3U8 Playlist download (for 1DM, ADM, VLC, MX Player)
    if (format === 'm3u8' || format === 'playlist') {
      const baseProxyUrl = `${protocol}://${host}/api/hls`;
      let m3u8Content = playlistText.replace(/\/api\/hls\?/g, `${baseProxyUrl}?`);

      res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.m3u8"`);
      return res.status(200).send(m3u8Content);
    }

    // Step 4: Handle Direct TS Stream (Binary segments concatenated)
    if (format === 'ts' || format === 'direct') {
      return streamDirectTs(targetPlaylistUrl, playlistText, safeFilename, res);
    }

    // Step 5: MP4 via FFmpeg if available, with direct TS fallback
    try {
      const ffmpeg = spawn('ffmpeg', [
        '-i', targetPlaylistUrl,
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
        console.warn('[Download] FFmpeg spawn error, streaming direct TS video:', err.message);
        if (!res.headersSent) {
          streamDirectTs(targetPlaylistUrl, playlistText, safeFilename, res);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0 && !res.headersSent) {
          console.warn('[Download] FFmpeg exited with code', code, 'falling back to direct TS');
          streamDirectTs(targetPlaylistUrl, playlistText, safeFilename, res);
        }
      });

      req.on('close', () => {
        try { ffmpeg.kill('SIGINT'); } catch (e) {}
      });
    } catch (err) {
      if (!res.headersSent) {
        streamDirectTs(targetPlaylistUrl, playlistText, safeFilename, res);
      }
    }

  } catch (err) {
    console.error('[Download] Master resolution error:', err);
    if (!res.headersSent) {
      return res.status(500).send('Stream download error: ' + err.message);
    }
  }
};

// Stream segments directly as a single playable .ts video file
async function streamDirectTs(playlistUrl, m3u8Text, safeFilename, res) {
  try {
    const lines = m3u8Text.split('\n');
    const segmentUrls = [];
    const mediaBaseUrl = new URL(playlistUrl);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        let segFull = trimmed;
        if (!segFull.startsWith('http')) {
          if (segFull.startsWith('/')) {
            segFull = `${mediaBaseUrl.origin}${segFull}`;
          } else {
            const p = mediaBaseUrl.pathname.split('/');
            p.pop();
            segFull = `${mediaBaseUrl.origin}${p.join('/')}/${segFull}`;
          }
        }
        segmentUrls.push(segFull);
      }
    }

    if (segmentUrls.length === 0) {
      return res.status(404).send('No video segments found in stream');
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
        // Continue downloading next segment
      }
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send('Direct stream download error: ' + err.message);
    }
  }
}
