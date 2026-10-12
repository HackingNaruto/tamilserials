const { scrapeShows } = require('./scraper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { channel } = req.query;
    if (!channel) {
      return res.status(400).json({ status: 'error', message: 'channel query param required (e.g. vijay-tv-programs)' });
    }
    const slug = (channel === 'reality-shows' || channel.includes('-programs')) ? channel : `${channel}-programs`;
    const shows = await scrapeShows(slug);
    return res.status(200).json({ status: 'success', channel: slug, count: shows.length, data: shows });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
