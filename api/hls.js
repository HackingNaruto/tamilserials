const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { v: videoId, file, source } = req.query;

  if (!videoId) {
    return res.status(400).send('Missing video ID parameter v');
  }

  // Detect whether this is Bunny CDN (GUID format with dashes, e.g. 180889b8-9532-4f6c-b47a-b73cd3116eee)
  // or VibrantPulseLab (16-char hex, e.g. 1b4671403c7fff75)
  const isBunny = source === 'bunny' || videoId.includes('-');

  if (isBunny) {
    // Bunny CDN stream proxy
    // Base URL: https://vz-8cf4325c-bc5.b-cdn.net/VIDEO_ID/
    const baseUrl = `https://vz-8cf4325c-bc5.b-cdn.net/${videoId}`;
    const targetUrl = file ? `${baseUrl}/${file}` : `${baseUrl}/playlist.m3u8`;

    const headers = {
      'Referer': 'https://iframe.mediadelivery.net/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    try {
      if (!file || file.endsWith('.m3u8')) {
        const response = await fetch(targetUrl, { headers });
        if (!response.ok) {
          // If 404, fallback to vibrantpulselab attempt
          return proxyVibrantPulse(videoId, file, res);
        }

        let m3u8Text = await response.text();

        // Rewrite sub-playlist or segments to proxy through /api/hls
        // e.g., 360p/video.m3u8 -> /api/hls?v=VIDEO_ID&source=bunny&file=360p/video.m3u8
        // and video0.dts -> /api/hls?v=VIDEO_ID&source=bunny&file=360p/video0.dts
        const currentFolder = file && file.includes('/') ? file.substring(0, file.lastIndexOf('/') + 1) : '';

        // Rewrite AES key URI
        m3u8Text = m3u8Text.replace(/URI="\/([^"]+)"/g, (match, p1) => {
          return `URI="/api/hls?v=${videoId}&source=bunny&file=${p1.replace(videoId + '/', '')}"`;
        });

        // Rewrite video.m3u8 and ts/dts files
        m3u8Text = m3u8Text.replace(/^([a-zA-Z0-9_\-\.\/]+\.(?:m3u8|dts|ts))/gm, (match, p1) => {
          const filePath = p1.startsWith('/') ? p1.slice(1) : currentFolder + p1;
          return `/api/hls?v=${videoId}&source=bunny&file=${filePath}`;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(m3u8Text);
      } else {
        // Binary segment or key file: pipe upstream
        https.get(targetUrl, { headers }, (upstreamRes) => {
          res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'video/mp2t');
          if (upstreamRes.headers['content-length']) {
            res.setHeader('Content-Length', upstreamRes.headers['content-length']);
          }
          res.setHeader('Cache-Control', 'public, max-age=86400');
          upstreamRes.pipe(res);
        }).on('error', (err) => {
          res.status(502).send(err.message);
        });
      }
    } catch (err) {
      console.error('Bunny HLS Proxy error:', err);
      if (!res.headersSent) res.status(500).send(err.message);
    }
  } else {
    // VibrantPulseLab stream proxy
    return proxyVibrantPulse(videoId, file, res);
  }
};

async function proxyVibrantPulse(videoId, file, res) {
  const targetPath = file ? `${videoId}/${file}` : `${videoId}/playlist.m3u8`;
  const targetUrl = `https://media.vibrantpulselab.com/${targetPath}`;

  const headers = {
    'Referer': 'https://futuregentrends.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    if (!file) {
      const response = await fetch(targetUrl, { headers });
      if (!response.ok) {
        return res.status(response.status).send(`Upstream error: ${response.statusText}`);
      }

      let m3u8Text = await response.text();
      m3u8Text = m3u8Text.replace(/(segment_\d+\.ts)/g, `/api/hls?v=${videoId}&file=$1`);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(m3u8Text);
    } else {
      https.get(targetUrl, { headers }, (upstreamRes) => {
        res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'video/mp2t');
        if (upstreamRes.headers['content-length']) {
          res.setHeader('Content-Length', upstreamRes.headers['content-length']);
        }
        res.setHeader('Cache-Control', 'public, max-age=86400');
        upstreamRes.pipe(res);
      }).on('error', (err) => {
        res.status(502).send(err.message);
      });
    }
  } catch (err) {
    console.error('Vibrant HLS Proxy error:', err);
    if (!res.headersSent) res.status(500).send(err.message);
  }
}
