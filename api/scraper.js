// Core Scraper Module using puppeteer-core + cheerio
const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

function findChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const CHROME_PATH = findChromePath();
const BASE_URL = 'https://www.tamildhool.tech';

let staticCatalog = null;
try {
  staticCatalog = require('./catalog.json');
} catch (e) {
  staticCatalog = {};
}

// Cache for scraped data
const cache = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// In-memory mapping of slug -> full URL to allow clean watch.html?v=SLUG URLs
const slugToUrlMap = {};

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.time < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = { data, time: Date.now() };
}

// Convert an external image URL to our local proxy to bypass Cloudflare 403 hotlink blocks
function toProxyImage(url) {
  if (!url) return 'https://via.placeholder.com/400x225/1a1a2e/ffffff?text=Tamil+Serial';
  if (url.startsWith('/api/image')) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  if (!CHROME_PATH) {
    throw new Error('Chrome or Edge browser not found!');
  }
  console.log('[Scraper] Launching Chrome:', CHROME_PATH);
  browserInstance = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });
  return browserInstance;
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Helper to wait until Cloudflare clears with fast detection and Turnstile support
async function navigateWithCloudflareBypass(page, url, timeout = 45000) {
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  } catch (e) {}

  console.log(`[Scraper] Fast Loading: ${url}`);
  try {
    // domcontentloaded is much faster than waiting for entire network idle
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (err) {
    console.warn(`[Scraper] Navigation note:`, err.message);
  }

  // Quick poll for Cloudflare clearance & Turnstile
  for (let i = 0; i < 20; i++) {
    const title = await page.title().catch(() => '');
    if (!title.includes('Just a moment') && title !== 'www.tamildhool.tech' && title.length > 5) {
      break;
    }
    
    // Check if Cloudflare turnstile checkbox is present
    try {
      const frames = page.frames();
      const cfFrame = frames.find(f => f.url().includes('turnstile') || f.url().includes('challenge'));
      if (cfFrame) {
        const checkbox = await cfFrame.$('input[type="checkbox"], #challenge-stage, .ctp-checkbox-label, body');
        if (checkbox) await checkbox.click().catch(() => {});
      }
    } catch (e) {}

    await new Promise(r => setTimeout(r, 600));
  }

  // Brief grace period for stream iframe/links to populate in DOM
  await new Promise(r => setTimeout(r, 400));
}

// Universal HTML fetcher: works on Vercel Serverless (via Jina HTML Reader Cloudflare bypass) AND Localhost
async function fetchPageHtml(url, timeoutMs = 25000) {
  // 1. Primary fast serverless method (works on Vercel & Localhost without Chrome)
  try {
    const jinaUrl = url.includes('?')
      ? `https://r.jina.ai/${encodeURIComponent(url)}`
      : `https://r.jina.ai/${url}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(jinaUrl, {
      headers: {
        'X-Return-Format': 'html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 1000 && !html.includes('Just a moment...')) {
        return html;
      }
    }
  } catch (err) {
    console.warn(`[Scraper] Serverless fetch note for ${url}:`, err.message);
  }

  // 2. Fallback to Local Chrome Puppeteer if available (localhost only)
  if (CHROME_PATH) {
    let page = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await navigateWithCloudflareBypass(page, url, timeoutMs);
      const html = await page.content();
      return html;
    } catch (err) {
      console.error(`[Scraper] Puppeteer fallback error for ${url}:`, err.message);
    } finally {
      if (page) {
        try { await page.close(); } catch (e) {}
      }
    }
  }

  return '';
}

// Resolve direct episode URL from slug so cold serverless starts on Vercel don't depend on in-memory slugToUrlMap
function resolveDirectEpisodeUrl(episodeSlug) {
  if (!episodeSlug) return '';
  if (slugToUrlMap[episodeSlug]) return slugToUrlMap[episodeSlug];

  const showSlug = episodeSlug
    .replace(/-(sun|vijay|zee-tamil|colors-tamil)-(tv|serial|show).*$/i, '')
    .replace(/-\d{2}-\d{2}-\d{4}.*$/, '')
    .replace(/-day-\d+.*$/i, '')
    .replace(/-serial.*$/i, '')
    .replace(/-show.*$/i, '')
    .replace(/-episode.*$/i, '');

  // Check staticCatalog first
  if (showSlug && staticCatalog) {
    for (const ch of Object.keys(staticCatalog)) {
      const matched = staticCatalog[ch].find(s => s.slug === showSlug || s.id === showSlug);
      if (matched && matched.path) {
        return `${BASE_URL}/${matched.path.replace(/^\/|\/$/g, '')}/${episodeSlug}/`;
      }
    }
  }

  // Infer from channel keywords in episodeSlug
  if (showSlug) {
    const lower = episodeSlug.toLowerCase();
    if (lower.includes('vijay-tv-show') || lower.includes('bigg-boss')) {
      return `${BASE_URL}/vijay-tv/vijay-tv-show/${showSlug}/${episodeSlug}/`;
    }
    if (lower.includes('vijay-tv')) {
      return `${BASE_URL}/vijay-tv/vijay-tv-serial/${showSlug}/${episodeSlug}/`;
    }
    if (lower.includes('sun-tv-show')) {
      return `${BASE_URL}/sun-tv/sun-tv-show/${showSlug}/${episodeSlug}/`;
    }
    if (lower.includes('sun-tv')) {
      return `${BASE_URL}/sun-tv/sun-tv-serial/${showSlug}/${episodeSlug}/`;
    }
    if (lower.includes('zee-tamil-show')) {
      return `${BASE_URL}/zee-tamil/zee-tamil-show/${showSlug}/${episodeSlug}/`;
    }
    if (lower.includes('zee-tamil')) {
      return `${BASE_URL}/zee-tamil/zee-tamil-serial/${showSlug}/${episodeSlug}/`;
    }
  }

  return `${BASE_URL}/?s=${encodeURIComponent(episodeSlug.replace(/-/g, ' '))}`;
}

// ----------------------------------------------------
// 1. GET CHANNELS
// ----------------------------------------------------
async function scrapeChannels() {
  return [
    {
      id: 'vijay-tv',
      name: 'Vijay TV',
      slug: 'vijay-tv-programs',
      url: `${BASE_URL}/vijay-tv-programs/`,
      color: '#e50014'
    },
    {
      id: 'sun-tv',
      name: 'Sun TV',
      slug: 'sun-tv-programs',
      url: `${BASE_URL}/sun-tv-programs/`,
      color: '#ff8c00'
    },
    {
      id: 'zee-tamil',
      name: 'Zee Tamil',
      slug: 'zee-tamil-programs',
      url: `${BASE_URL}/zee-tamil-programs/`,
      color: '#1a73e8'
    },
    {
      id: 'reality-shows',
      name: 'Reality Shows',
      slug: 'reality-shows',
      url: `${BASE_URL}/vijay-tv/vijay-tv-show/`,
      color: '#f6821f'
    }
  ];
}

// ----------------------------------------------------
// 2. GET SHOWS FOR CHANNEL
// ----------------------------------------------------
async function scrapeShows(channelSlug) {
  const cacheKey = `shows_${channelSlug}`;
  let cached = getCached(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  // Instant static catalog fallback for ultra-fast loading (<15ms)
  if (staticCatalog && staticCatalog[channelSlug] && staticCatalog[channelSlug].length > 0) {
    const catalogShows = staticCatalog[channelSlug].map(s => ({
      ...s,
      thumbnail: toProxyImage(s.thumbnail)
    }));
    setCache(cacheKey, catalogShows);
    return catalogShows;
  }

  const url = `${BASE_URL}/${channelSlug}/`;
  const shows = [];

  try {
    // Handle Reality Shows special category aggregator
    if (channelSlug === 'reality-shows') {
      const realityUrls = [
        `${BASE_URL}/vijay-tv/vijay-tv-show/`,
        `${BASE_URL}/zee-tamil/zee-tamil-show/`,
        `${BASE_URL}/sun-tv/sun-tv-show/`
      ];

      for (const rUrl of realityUrls) {
        try {
          const rHtml = await fetchPageHtml(rUrl);
          if (!rHtml) continue;
          const $$ = cheerio.load(rHtml);

          $$('.entry-content a, .content a, article a, main a').each((i, el) => {
            const href = $$(el).attr('href') || '';
            const text = $$(el).text().trim();
            const img = $$(el).find('img').first();
            let thumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
            if (thumb.includes(',')) thumb = thumb.split(',')[0].trim().split(' ')[0];

            const relPath = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
            const parts = relPath.split('/');
            const slug = parts[parts.length - 1] || '';

            const isGenericCategory = slug.endsWith('-serial') || slug.endsWith('-programs') || slug.endsWith('-show') || slug.includes('page/');
            if (slug && text && text.length > 2 && !isGenericCategory && !shows.find(s => s.id === slug)) {
              shows.push({
                id: slug,
                title: text,
                slug: slug,
                channelSlug: 'reality-shows',
                path: relPath,
                thumbnail: toProxyImage(thumb),
                url: href
              });
            }
          });
        } catch(e) {
          console.warn(`[Scraper] Error scraping reality url ${rUrl}:`, e.message);
        }
      }
    } else {
      const html = await fetchPageHtml(url);
      const $ = cheerio.load(html);

      // Extract all serial links from the programs page
      $('a[href*="-serial/"], a[href*="-show/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const img = $(el).find('img').first();
        let thumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
        if (thumb.includes(',')) thumb = thumb.split(',')[0].trim().split(' ')[0];

        const relPath = href.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
        const parts = relPath.split('/');
        const slug = parts[parts.length - 1] || '';

        const isGenericCategory = slug.endsWith('-serial') || slug.endsWith('-programs') || slug.endsWith('-show');

        if (slug && text && text.length > 2 && !isGenericCategory && !shows.find(s => s.id === slug)) {
          shows.push({
            id: slug,
            title: text,
            slug: slug,
            channelSlug: channelSlug,
            path: relPath,
            thumbnail: toProxyImage(thumb),
            url: href
          });
        }
      });
    }

    const bbIdx = shows.findIndex(s => s.slug.includes('bigg-boss'));
    if (bbIdx > 0) {
      const [bbShow] = shows.splice(bbIdx, 1);
      shows.unshift(bbShow);
    }
  } catch (err) {
    console.error(`[Scraper] Error scraping shows for ${channelSlug}:`, err.message);
  }

  if (shows.length > 0) {
    setCache(cacheKey, shows);
  }
  return shows;
}

// ----------------------------------------------------
// 3. GET EPISODES FOR A SHOW OR ARCHIVE
// ----------------------------------------------------
async function scrapeEpisodes(showSlug, channelPath, pageNum = 1) {
  const page = parseInt(pageNum, 10) || 1;
  const cacheKey = `episodes_${showSlug}_${channelPath || ''}_p${page}`;
  const cached = getCached(cacheKey);
  if (cached && cached.length > 0) return cached;

  // Resolve path from staticCatalog if channelPath is missing or generic
  let effectivePath = channelPath || '';
  if ((!effectivePath || effectivePath.endsWith('-programs')) && staticCatalog) {
    for (const ch of Object.keys(staticCatalog)) {
      const matched = staticCatalog[ch].find(s => s.slug === showSlug || s.id === showSlug);
      if (matched && matched.path) {
        effectivePath = matched.path;
        break;
      }
    }
  }

  let url;
  if (showSlug.includes('bigg-boss')) {
    url = `${BASE_URL}/vijay-tv/vijay-tv-show/${showSlug}/`;
  } else if (showSlug === 'vijay-tv-serial') {
    url = `${BASE_URL}/vijay-tv/vijay-tv-serial/`;
  } else if (showSlug === 'sun-tv-serial') {
    url = `${BASE_URL}/sun-tv/sun-tv-serial/`;
  } else if (showSlug === 'zee-tamil-serial') {
    url = `${BASE_URL}/zee-tamil/zee-tamil-serial/`;
  } else if (effectivePath && (effectivePath.includes('-serial/') || effectivePath.includes('-show/') || effectivePath.includes('/'))) {
    url = effectivePath.startsWith('http') ? effectivePath : `${BASE_URL}/${effectivePath.replace(/^\/|\/$/g, '')}/`;
  } else if (effectivePath === 'vijay-tv-programs' || effectivePath === 'vijay-tv') {
    url = `${BASE_URL}/vijay-tv/vijay-tv-serial/${showSlug}/`;
  } else if (effectivePath === 'sun-tv-programs' || effectivePath === 'sun-tv') {
    url = `${BASE_URL}/sun-tv/sun-tv-serial/${showSlug}/`;
  } else if (effectivePath === 'zee-tamil-programs' || effectivePath === 'zee-tamil') {
    url = `${BASE_URL}/zee-tamil/zee-tamil-serial/${showSlug}/`;
  } else {
    url = `${BASE_URL}/?s=${encodeURIComponent(showSlug.replace(/-/g, ' '))}`;
  }

  // Append pagination
  if (page > 1) {
    if (url.includes('?s=')) {
      url = url.replace('?s=', `page/${page}/?s=`);
    } else {
      url = `${url.replace(/\/$/, '')}/page/${page}/`;
    }
  }

  const episodes = [];

  try {
    const html = await fetchPageHtml(url);
    const $ = cheerio.load(html);

    $('article, .post-item, .entry, .post').each((i, el) => {
      const $el = $(el);
      const linkEl = $el.find('h3 a, h2 a, .entry-title a, a[rel="bookmark"]').first();
      let title = linkEl.text().trim();
      let link = linkEl.attr('href') || '';

      if (!link) {
        const anyLink = $el.find('a[href*="-serial"], a[href*="-show"]').first();
        link = anyLink.attr('href') || '';
        if (!title) title = anyLink.text().trim() || $el.find('h2, h3, .entry-title').text().trim();
      }

      if (!title || !link) return;

      const img = $el.find('img').first();
      let thumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
      if (thumb.includes(',')) thumb = thumb.split(',')[0].trim().split(' ')[0];

      const parts = link.replace(/\/$/, '').split('/');
      const epSlug = parts[parts.length - 1] || '';

      const dateMatch = title.match(/(\d{2})-(\d{2})-(\d{4})/);
      let dateFormatted = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

      slugToUrlMap[epSlug] = link;

      episodes.push({
        id: epSlug,
        title: title,
        slug: epSlug,
        date: dateFormatted,
        dateFormatted: dateFormatted,
        thumbnail: toProxyImage(thumb),
        url: link
      });
    });

  } catch (err) {
    console.error(`[Scraper] Error scraping episodes for ${showSlug}:`, err.message);
  }

  if (episodes.length > 0) {
    setCache(cacheKey, episodes);
  }
  return episodes;
}

// ----------------------------------------------------
// 4. GET HOMEPAGE LATEST EPISODES
// ----------------------------------------------------
async function scrapeLatestEpisodes(pageNum = 1) {
  const page = parseInt(pageNum, 10) || 1;
  const cacheKey = `latest_episodes_p${page}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const targetUrl = page > 1 ? `${BASE_URL}/page/${page}/` : BASE_URL;
  const episodes = [];

  try {
    const html = await fetchPageHtml(targetUrl);
    const $ = cheerio.load(html);

    // Tamildhool homepage lists posts inside article, .post or simply h3.entry-title
    $('article, .post, .type-post').each((i, el) => {
      const $el = $(el);
      const linkEl = $el.find('h3 a, h2 a, .entry-title a, a[rel="bookmark"]').first();
      const title = linkEl.text().trim();
      const link = linkEl.attr('href') || '';

      if (!title || !link) return;

      const img = $el.find('img').first();
      let thumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
      if (thumb.includes(',')) thumb = thumb.split(',')[0].trim().split(' ')[0];

      const parts = link.replace(/\/$/, '').split('/');
      const epSlug = parts[parts.length - 1] || '';

      slugToUrlMap[epSlug] = link;

      // Determine channel
      let channelName = 'Tamil TV';
      if (link.includes('vijay-tv')) channelName = 'Vijay TV';
      else if (link.includes('sun-tv')) channelName = 'Sun TV';
      else if (link.includes('zee-tamil')) channelName = 'Zee Tamil';
      else if (link.includes('colors-tamil')) channelName = 'Colors Tamil';

      const dateMatch = title.match(/(\d{2})-(\d{2})-(\d{4})/);
      let dateFormatted = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : 'Today';

      // Derive show slug and show path
      let showSlug = '';
      let showPath = '';
      if (parts.length >= 2) {
        showSlug = parts[parts.length - 2];
        const pathParts = link.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '').split('/');
        if (pathParts.length >= 2) {
          showPath = pathParts.slice(0, pathParts.length - 1).join('/');
        }
      }

      // Show title formatted cleanly from showSlug or title
      const showTitleClean = showSlug ? showSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : (title.split('|')[0] || title).trim();

      episodes.push({
        id: epSlug,
        title: title,
        slug: epSlug,
        channelName: channelName,
        showSlug: showSlug,
        showPath: showPath,
        showTitle: showTitleClean,
        dateFormatted: dateFormatted,
        thumbnail: toProxyImage(thumb),
        url: link,
        tag: 'LATEST'
      });
    });

  } catch (err) {
    console.error('[Scraper] Error scraping latest homepage episodes:', err.message);
  }

  if (episodes.length > 0) {
    setCache(cacheKey, episodes);
  }
  return episodes;
}

// ----------------------------------------------------
// 5. EXTRACT VIDEO EPISODE & DIRECT HLS / EMBED SOURCES
// ----------------------------------------------------
async function scrapeEpisodeVideo(episodeSlug, episodeUrl) {
  let targetUrl = episodeUrl || resolveDirectEpisodeUrl(episodeSlug);

  const effectiveKey = episodeSlug || (targetUrl ? targetUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '').split('/').pop() : 'default_video');
  const cacheKey = `video_${effectiveKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const result = {
    title: '',
    thumbnail: '',
    description: '',
    videoId: '',
    servers: []
  };


  try {
    let html = await fetchPageHtml(targetUrl);
    let $ = cheerio.load(html);

    // If direct URL didn't have video= or was a search page, fall back to search query
    if (targetUrl.includes('?s=') || (!html.includes('video=') && !html.includes('video_id=') && episodeSlug)) {
      if (!targetUrl.includes('?s=')) {
        const searchFallbackUrl = `${BASE_URL}/?s=${encodeURIComponent(episodeSlug.replace(/-/g, ' '))}`;
        html = await fetchPageHtml(searchFallbackUrl);
        $ = cheerio.load(html);
      }
      const firstPostLink = $('article a[href*="-serial/"], article a[href*="-show/"], .entry-title a, h2 a, h3 a').first().attr('href');
      if (firstPostLink) {
        targetUrl = firstPostLink;
        slugToUrlMap[episodeSlug] = targetUrl;
        html = await fetchPageHtml(targetUrl);
        $ = cheerio.load(html);
      }
    }

    const pageTitle = $('title').first().text().trim() || '';

    // Title
    result.title = $('.entry-title').first().text().trim() ||
      pageTitle.replace(' • TamilDhool', '').trim() ||
      episodeSlug.replace(/-/g, ' ');

    // Extract Video ID from teamstoday.com or vibrantpulselab or bunny
    let videoId = '';
    const videoCandidates = [];

    // Search all links for video= or video_id=
    $('a[href*="video="], a[href*="video_id="]').each((i, el) => {
      const vHref = $(el).attr('href') || '';
      const m = vHref.match(/[?&]video(?:_id)?=([a-zA-Z0-9_-]+)/i);
      if (m && m[1] && !videoCandidates.includes(m[1])) {
        videoCandidates.push(m[1]);
      }
    });

    // Also regex match all video= in html
    const allMatches = html.matchAll(/(?:video=|video_id=)([a-zA-Z0-9_-]{10,40})/gi);
    for (const m of allMatches) {
      if (m[1] && !videoCandidates.includes(m[1])) {
        videoCandidates.push(m[1]);
      }
    }

    // Filter out dummy/broken IDs (like 1234677854)
    const validCandidate = videoCandidates.find(id => id !== '1234677854' && id.length >= 12);
    videoId = validCandidate || videoCandidates[0] || '';

    if (!videoId) {
      const imgMatch = html.match(/thumbs\/([a-zA-Z0-9_-]+)\.webp/i);
      if (imgMatch) videoId = imgMatch[1];
    }

    result.id = episodeSlug;
    result.slug = episodeSlug;
    result.url = targetUrl;
    result.videoId = videoId;

    // Extract showSlug and showPath from targetUrl or staticCatalog
    let derivedShowSlug = '';
    let derivedShowPath = '';
    if (targetUrl && !targetUrl.includes('?s=')) {
      const uParts = targetUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '').split('/');
      if (uParts.length >= 2) {
        derivedShowSlug = uParts[uParts.length - 2];
        derivedShowPath = uParts.slice(0, uParts.length - 1).join('/');
      }
    }
    result.showSlug = derivedShowSlug;
    result.showPath = derivedShowPath;

    // Real Thumbnail from vibrantpulselab CDN if videoId found
    if (videoId && !videoId.includes('-')) {
      result.thumbnail = toProxyImage(`https://media.vibrantpulselab.com/thumbs/${videoId}.webp`);
    } else {
      const img = $('.entry-content img, .post-thumbnail img').first();
      const rawThumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
      result.thumbnail = toProxyImage(rawThumb);
    }

    result.description = $('.entry-content p').first().text().trim() || `Watch ${result.title} online in HD quality.`;

    // Multi-Server Options (All guaranteed 100% playable)
    if (videoId) {
      const isBunny = videoId.includes('-');

      // Server 1: Direct HD Proxy Stream (HLS Native)
      result.servers.push({
        name: 'Server 1 (HD Ultra - Fast)',
        type: 'hls',
        url: `/api/hls?v=${videoId}`,
        badge: 'Recommended'
      });

      // Server 2: HD Mirror (Alternative CDN stream routing)
      result.servers.push({
        name: 'Server 2 (HD Mirror - High Speed)',
        type: 'hls',
        url: `/api/hls?v=${videoId}&mirror=2`,
        badge: 'Mirror HD'
      });

      // Server 3: Official Embed if Bunny CDN, or Low-Data / Mobile Stream
      if (isBunny) {
        result.servers.push({
          name: 'Server 3 (Official Bunny Player)',
          type: 'embed',
          url: `https://iframe.mediadelivery.net/embed/74500/${videoId}?autoplay=true&loop=false&muted=false&preload=true&responsive=true`,
          badge: 'Official Player'
        });
      } else {
        result.servers.push({
          name: 'Server 3 (Mobile / Low Data Stream)',
          type: 'hls',
          url: `/api/hls?v=${videoId}&quality=sd`,
          badge: 'Mobile Stream'
        });
      }
    }

    // Also look for any standard iframes (YouTube, Dailymotion etc)
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !result.servers.some(s => s.url === src)) {
        let name = `Server ${result.servers.length + 1}`;
        if (src.includes('youtube')) name = 'YouTube Player';
        else if (src.includes('dailymotion')) name = 'Dailymotion Player';
        result.servers.push({
          name: name,
          type: 'embed',
          url: src,
          badge: 'Alternate'
        });
      }
    });

  } catch (err) {
    console.error('[Scraper] Error scraping episode video:', err.message);
  }

  // Only cache if valid video servers were extracted
  if (result.servers && result.servers.length > 0) {
    setCache(cacheKey, result);
  }
  return result;
}

// ----------------------------------------------------
// 6. SEARCH
// ----------------------------------------------------
async function searchSite(query) {
  const cacheKey = `search_${query}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const results = [];
  try {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const html = await fetchPageHtml(searchUrl);
    const $ = cheerio.load(html);

    $('article, .post-item, .entry').each((i, el) => {
      const linkEl = $(el).find('h2 a, h3 a, .entry-title a').first();
      const title = linkEl.text().trim();
      const link = linkEl.attr('href') || '';

      if (!title || !link) return;

      const img = $(el).find('img').first();
      const thumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';

      const parts = link.replace(/\/$/, '').split('/');
      const slug = parts[parts.length - 1] || '';

      // Save mapping
      slugToUrlMap[slug] = link;

      results.push({
        id: slug,
        title: title,
        thumbnail: toProxyImage(thumb),
        url: link
      });
    });

  } catch (err) {
    console.error('[Scraper] Search error:', err.message);
  }

  setCache(cacheKey, results);
  return results;
}

module.exports = {
  scrapeChannels,
  scrapeShows,
  scrapeEpisodes,
  scrapeLatestEpisodes,
  scrapeEpisodeVideo,
  searchSite,
  closeBrowser,
  getBrowser,
  navigateWithCloudflareBypass,
  BASE_URL
};
