// Debug: dump what puppeteer sees on the episode page
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const url = 'https://www.tamildhool.tech/vijay-tv/vijay-tv-serial/chinna-marumagal/chinna-marumagal-09-10-2026-vijay-tv-serial/';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

  // Check if Cloudflare challenge page
  const title1 = await page.title();
  console.log('Title after initial load:', title1);

  // If still on CF challenge, wait for it to resolve
  if (title1.includes('Just a moment') || title1 === 'www.tamildhool.tech') {
    console.log('Cloudflare challenge detected, waiting up to 15s...');
    try {
      await page.waitForFunction(() => {
        return !document.title.includes('Just a moment') && document.title !== 'www.tamildhool.tech';
      }, { timeout: 15000 });
    } catch (e) {
      console.log('Still on CF challenge after 15s');
    }
  }

  await new Promise(r => setTimeout(r, 3000));
  const title2 = await page.title();
  console.log('Title after wait:', title2);

  const html = await page.content();
  console.log('HTML length:', html.length);
  
  // Look for key elements
  const hasArticle = html.includes('<article');
  const hasEntryContent = html.includes('entry-content');
  const hasIframe = html.includes('<iframe');
  const hasTeamstoday = html.includes('teamstoday');
  const hasVideoId = html.includes('video_id') || html.includes('video=');
  
  console.log('Has <article>:', hasArticle);
  console.log('Has entry-content:', hasEntryContent);
  console.log('Has <iframe>:', hasIframe);
  console.log('Has teamstoday:', hasTeamstoday);
  console.log('Has video_id/video=:', hasVideoId);

  // Extract all links with "video" or "teamstoday"
  const links = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (href.includes('teamstoday') || href.includes('video') || href.includes('dailymotion') || href.includes('youtube')) {
        results.push({ href, text: a.textContent.trim().substring(0, 50) });
      }
    });
    document.querySelectorAll('iframe').forEach(f => {
      results.push({ href: f.src, text: '[IFRAME]' });
    });
    return results;
  });
  
  console.log('\nVideo-related links/iframes:');
  links.forEach(l => console.log(' ', l.text, '->', l.href));

  // Save full HTML for analysis
  fs.writeFileSync('debug-episode.html', html);
  console.log('\nFull HTML saved to debug-episode.html');

  await browser.close();
})().catch(e => console.error('Error:', e.message));
