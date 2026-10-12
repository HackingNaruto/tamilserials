const express = require('express');
const path = require('path');
const cors = require('cors');
const { closeBrowser } = require('./api/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Wrap Vercel-style serverless handlers for Express
function wrapHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('API Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ status: 'error', message: err.message });
      }
    }
  };
}

// API Routes
app.get('/api/channels', wrapHandler(require('./api/channels')));
app.get('/api/shows', wrapHandler(require('./api/shows')));
app.get('/api/episodes', wrapHandler(require('./api/episodes')));
app.get('/api/episode', wrapHandler(require('./api/episode')));
app.get('/api/search', wrapHandler(require('./api/search')));
app.get('/api/hls', wrapHandler(require('./api/hls')));
app.get('/api/download', wrapHandler(require('./api/download')));
app.get('/api/image', wrapHandler(require('./api/image')));

// Serve Frontend Static Files (No-Cache in dev so updates reflect immediately)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Catch-all route for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎬 Tamildhool Real Scraper & Streaming Server`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   - http://localhost:${PORT}/api/episodes (Latest)`);
  console.log(`   - http://localhost:${PORT}/api/shows?channel=vijay-tv-programs`);
  console.log(`   - http://localhost:${PORT}/api/episode?slug=chinna-marumagal-09-10-2026`);
  console.log(`   - http://localhost:${PORT}/api/hls?v=1b4671403c7fff75 (Direct Stream)`);
  console.log(`===============================================`);
});
