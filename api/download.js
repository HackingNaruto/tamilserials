// Direct Episode Video (.MP4) Download Endpoint
// Remuxes HLS stream on-the-fly to MP4 format using FFmpeg
// so users get a single playable .mp4 video file instead of .m3u8 playlist

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

  // If user explicitly asks for m3u8 playlist file
  if (format === 'm3u8') {
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
      return res.status(500).send('Playlist error');
    }
  }

  // Stream full .MP4 video on-the-fly using FFmpeg remuxing
  console.log(`[Download] Starting MP4 remux stream for: ${safeFilename}`);

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp4"`);
  res.setHeader('Cache-Control', 'no-cache');

  const ffmpeg = spawn('ffmpeg', [
    '-i', localHlsUrl,
    '-c', 'copy',
    '-bsf:a', 'aac_adtstoasc',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  ]);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on('data', (d) => {
    // optional debug logging
  });

  ffmpeg.on('error', (err) => {
    console.error('[Download] FFmpeg spawn error:', err.message);
    if (!res.headersSent) res.status(500).send('Download conversion error');
  });

  req.on('close', () => {
    console.log(`[Download] Client cancelled download: ${safeFilename}`);
    ffmpeg.kill('SIGINT');
  });
};
