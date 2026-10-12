const fs = require('fs');
const cheerio = require('cheerio');
const h = fs.readFileSync('debug-episode.html', 'utf8');
const $ = cheerio.load(h);

console.log('Title:', $('h1.entry-title, .entry-title, h1').first().text().trim());
console.log('OG Image:', $('meta[property="og:image"]').attr('content') || 'none');
console.log('Entry img:', $('.entry-content img').first().attr('src') || 'none');
console.log('Featured img:', $('.post-thumbnail img, .featured-image img').first().attr('src') || 'none');

// teamstoday links
$('a[href*="teamstoday"]').each((i, e) => {
  console.log('TeamToday link:', $(e).attr('href'), '-', $(e).text().trim().substring(0, 60));
});

// iframes
$('iframe').each((i, e) => {
  const src = $(e).attr('src') || $(e).attr('data-src') || $(e).attr('data-lazy-src') || '';
  console.log('Iframe src:', src.substring(0, 120) || '(empty)');
});

// Any video-related element in entry-content
$('.entry-content a').each((i, e) => {
  const href = $(e).attr('href') || '';
  const text = $(e).text().trim();
  if (href && !href.includes('tamildhool.tech') && text.length > 0) {
    console.log('External link:', href.substring(0, 100), '-', text.substring(0, 50));
  }
});

// thumbnail / poster image
console.log('\nPost images:');
$('.entry-content img, .post-image img, article img').each((i, e) => {
  const src = $(e).attr('data-src') || $(e).attr('data-lazy-src') || $(e).attr('src') || '';
  if (src && i < 5) console.log(' img:', src.substring(0, 120));
});
