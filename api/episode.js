const { scrapeEpisodeVideo } = require('./scraper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { slug, url } = req.query;
    if (!slug && !url) {
      return res.status(400).json({ status: 'error', message: 'slug or url query param required' });
    }
    const episodeData = await scrapeEpisodeVideo(slug || '', url || '');
    return res.status(200).json({ status: 'success', data: episodeData });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
