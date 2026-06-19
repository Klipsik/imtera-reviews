import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'https://yandex.ru/maps/org/hatimaki/199612008855/reviews';

const captured = [];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'ru-RU',
});
const page = await context.newPage();

page.on('request', (request) => {
  const url = request.url();
  const rt = request.resourceType();
  if (rt === 'fetch' || rt === 'xhr') {
    captured.push({ phase: 'request', url, method: request.method(), rt });
  }
});

page.on('response', async (response) => {
  const url = response.url();
  const rt = response.request().resourceType();
  if (rt !== 'fetch' && rt !== 'xhr') return;

  let body = '';
  try {
    body = await response.text();
  } catch {
    return;
  }

  if (body.includes('reviewId') || body.includes('"reviews"') || /\/reviews/i.test(url)) {
    captured.push({
      phase: 'response',
      url,
      method: response.request().method(),
      status: response.status(),
      bodyLen: body.length,
      hasReviews: body.includes('"reviews"'),
      hasReviewId: body.includes('reviewId'),
      bodyPreview: body.slice(0, 3000),
    });
  }
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3000);

for (let i = 0; i < 8; i++) {
  await page.evaluate(() => {
    const reviews = document.querySelectorAll('[itemprop="review"]');
    const last = reviews[reviews.length - 1];
    last?.scrollIntoView({ block: 'end' });
    const container = document.querySelector('[class*="scroll"]');
    if (container) container.scrollTop += 1000;
    window.scrollBy(0, 1000);
  });
  await page.waitForTimeout(2500);
}

const allFetch = captured.filter(c => c.phase === 'request').map(c => c.url);
const uniqueFetch = [...new Set(allFetch)];

console.log('=== UNIQUE FETCH/XHR URLs ===');
uniqueFetch.forEach(u => console.log(u));
console.log('\n=== REVIEWS-LIKE RESPONSES ===');
console.log(JSON.stringify(captured.filter(c => c.phase === 'response'), null, 2));

writeFileSync('/tmp/yandex-reviews-capture.json', JSON.stringify({ uniqueFetch, captured }, null, 2));
await browser.close();
