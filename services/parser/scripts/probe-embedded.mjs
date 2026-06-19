import { chromium } from 'playwright';

const URL = 'https://yandex.ru/maps/org/hatimaki/199612008855/reviews';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'ru-RU',
});
const page = await context.newPage();

const allResponses = [];

page.on('response', async (response) => {
  const url = response.url();
  if (!url.includes('yandex')) return;
  try {
    const ct = response.headers()['content-type'] || '';
    if (!/json|javascript|html|text\/plain/i.test(ct)) return;
    const body = await response.text();
    if (body.includes('reviewId') || (body.includes('"reviews"') && body.includes('businessId'))) {
      allResponses.push({ url, ct, len: body.length, preview: body.slice(0, 500) });
    }
  } catch {}
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3000);

// Check embedded state in page
const embedded = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll('script')];
  const hits = [];
  for (const s of scripts) {
    const t = s.textContent || '';
    if (t.includes('reviewId') || (t.includes('"reviews"') && t.includes('businessId'))) {
      hits.push({ type: 'script', len: t.length, preview: t.slice(0, 800) });
    }
  }
  const html = document.documentElement.innerHTML;
  const idx = html.indexOf('reviewId');
  if (idx >= 0) {
    hits.push({ type: 'html', idx, preview: html.slice(Math.max(0, idx - 100), idx + 500) });
  }
  return hits;
});

console.log('EMBEDDED:', JSON.stringify(embedded, null, 2));
console.log('RESPONSES:', JSON.stringify(allResponses, null, 2));

// Also list all yandex.ru/maps/api URLs
const apiUrls = [];
page.on('response', r => {
  const u = r.url();
  if (u.includes('/maps/api/')) apiUrls.push(u.split('?')[0]);
});

await browser.close();
