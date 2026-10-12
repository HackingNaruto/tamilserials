const { scrapeChannels } = require('./scraper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const channels = await scrapeChannels();
    return res.status(200).json({ status: 'success', totalChannels: channels.length, data: channels });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
