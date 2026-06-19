import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'https://yandex.ru/maps/org/hatimaki/199612008855/reviews';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'ru-RU',
});
const page = await context.newPage();

const apiCalls = [];

page.on('response', async (response) => {
  const url = response.url();
  if (!url.includes('/maps/api/') && !url.includes('api-maps')) return;
  try {
    const body = await response.text();
    apiCalls.push({
      url,
      method: response.request().method(),
      status: response.status(),
      hasReviews: body.includes('"reviews"'),
      hasReviewId: body.includes('reviewId'),
      bodyLen: body.length,
      bodyPreview: body.slice(0, 1500),
    });
  } catch {}
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(2000);

// Parse SSR data from HTML
const ssr = await page.evaluate(() => {
  const html = document.documentElement.innerHTML;
  const match = html.match(/"reviews"\s*:\s*\[/);
  if (!match) return null;

  // Find params.count nearby
  const paramsMatch = html.match(/"params"\s*:\s*\{[^}]*"count"\s*:\s*(\d+)/);
  const countMatch = html.match(/"count"\s*:\s*(\d+)/g);

  const reviewCount = document.querySelectorAll('[itemprop="review"]').length;

  return {
    hasReviewsInHtml: !!match,
    paramsCount: paramsMatch?.[1],
    domReviewCount: reviewCount,
    countMatches: countMatch?.slice(0, 5),
  };
});

console.log('SSR:', ssr);

// Scroll aggressively
for (let i = 0; i < 15; i++) {
  await page.evaluate(() => {
    const reviews = document.querySelectorAll('[itemprop="review"]');
    reviews[reviews.length - 1]?.scrollIntoView({ block: 'end' });
    const scrollables = [...document.querySelectorAll('*')].filter(el => {
      const s = getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 50;
    });
    for (const el of scrollables) el.scrollTop = el.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1500);
}

const afterScroll = await page.evaluate(() => document.querySelectorAll('[itemprop="review"]').length);
console.log('DOM reviews after scroll:', afterScroll);
console.log('\n=== MAPS API CALLS ===');
console.log(JSON.stringify(apiCalls, null, 2));

writeFileSync('/tmp/yandex-api-calls.json', JSON.stringify({ ssr, afterScroll, apiCalls }, null, 2));
await browser.close();
