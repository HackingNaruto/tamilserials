const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  // Track all requests and responses
  const history = [];
  page.on('response', res => {
    history.push({ url: res.url(), status: res.status(), type: res.request().resourceType() });
  });

  const epUrl = 'https://www.tamildhool.tech/vijay-tv/vijay-tv-serial/chinna-marumagal/chinna-marumagal-09-10-2026-vijay-tv-serial/';
  console.log('Opening episode page:', epUrl);
  await page.goto(epUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  console.log('Episode page loaded:', await page.title());

  // Find the teamstoday link and click it
  const linkHandle = await page.$('a[href*="teamstoday"]');
  if (linkHandle) {
    console.log('Found teamstoday link, clicking...');
    
    // Listen for new target / popup tab
    const newTargetPromise = new Promise(resolve => browser.once('targetcreated', target => resolve(target.page())));

    await linkHandle.click();

    // Check if opened in new tab or same page
    let activePage = page;
    const newPage = await Promise.race([
      newTargetPromise,
      new Promise(r => setTimeout(() => r(null), 5000))
    ]);

    if (newPage) {
      console.log('New tab opened!');
      activePage = newPage;
      await activePage.bringToFront();
    } else {
      console.log('Navigated in same tab or redirected.');
    }

    // Wait for the redirect chain
    console.log('Waiting for redirects to finish on active page...');
    await new Promise(r => setTimeout(r, 10000));

    console.log('Final URL:', activePage.url());
    console.log('Final Title:', await activePage.title());

    // Extract everything on final page
    const content = await activePage.content();
    fs.writeFileSync('final-redirect-page.html', content);

    const media = await activePage.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe')).map(i => ({ src: i.src, html: i.outerHTML }));
      const videos = Array.from(document.querySelectorAll('video, video source')).map(v => ({ src: v.src, html: v.outerHTML }));
      const allLinks = Array.from(document.querySelectorAll('a')).map(a => a.href);
      return { iframes, videos, linkCount: allLinks.length };
    });

    console.log('Final Page Media:', JSON.stringify(media, null, 2));
  } else {
    console.log('Could not find teamstoday link');
  }

  console.log('\nRelevant Network History:');
  history.filter(h => h.url.includes('lessonsfromanimals') || h.url.includes('teamstoday') || h.url.includes('video') || h.url.includes('stream') || h.url.includes('.m3u8'))
    .forEach(h => console.log(`[${h.status}] ${h.type} -> ${h.url}`));

  await browser.close();
})();
