const { scrapeEpisodes, scrapeLatestEpisodes } = require('./scraper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { show, path: channelPath, page: pageParam } = req.query;
    const page = parseInt(pageParam, 10) || 1;

    // If no show specified, get latest episodes from homepage
    if (!show) {
      const episodes = await scrapeLatestEpisodes(page);
      return res.status(200).json({ status: 'success', page, count: episodes.length, data: episodes });
    }

    const episodes = await scrapeEpisodes(show, channelPath || '', page);
    return res.status(200).json({ status: 'success', show, page, count: episodes.length, data: episodes });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
