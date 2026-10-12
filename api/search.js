const { searchSite } = require('./scraper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(200).json({ status: 'success', query: '', results: [] });
    }
    const results = await searchSite(q.trim());
    return res.status(200).json({ status: 'success', query: q, count: results.length, results });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
