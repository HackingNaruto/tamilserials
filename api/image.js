// Universal High-Performance Image Proxy with In-Memory SVG Fallback
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let { url } = req.query;
  if (!url) return sendFallbackSvg(res);

  try {
    if (!url.startsWith('http')) {
      url = Buffer.from(url, 'base64url').toString('utf8');
    }
  } catch (e) {}

  if (!url.startsWith('http')) return sendFallbackSvg(res);

  // Dynamic Referer selection based on image CDN source
  let referer = 'https://www.tamildhool.tech/';
  if (url.includes('vibrantpulse') || url.includes('walletcanvas')) {
    referer = 'https://futuregentrends.com/';
  } else if (url.includes('lessonsfromanimals') || url.includes('teamstoday')) {
    referer = 'https://lessonsfromanimals.com/';
  }

  const headers = {
    'Referer': referer,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  try {
    const upstreamRes = await fetch(url, { headers, redirect: 'follow' });
    if (!upstreamRes.ok) {
      // Retry without referer (some CDNs reject referer)
      const retryRes = await fetch(url, {
        headers: { 'User-Agent': headers['User-Agent'] },
        redirect: 'follow'
      });
      if (!retryRes.ok) return sendFallbackSvg(res);

      const contentType = retryRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      const arrayBuffer = await retryRes.arrayBuffer();
      return res.status(200).send(Buffer.from(arrayBuffer));
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    return sendFallbackSvg(res);
  }
};

function sendFallbackSvg(res) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225">
    <rect width="400" height="225" fill="#14161f"/>
    <rect x="1" y="1" width="398" height="223" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
    <circle cx="200" cy="95" r="28" fill="#e50914" opacity="0.9"/>
    <polygon points="193,82 213,95 193,108" fill="#ffffff"/>
    <text x="50%" y="150" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700">StreamX Tamil</text>
    <text x="50%" y="172" dominant-baseline="middle" text-anchor="middle" fill="#8d94a5" font-family="system-ui, -apple-system, sans-serif" font-size="12">HD Serial Stream</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).send(svg);
}
