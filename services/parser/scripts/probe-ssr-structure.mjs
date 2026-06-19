import { chromium } from 'playwright';

const URL = 'https://yandex.ru/maps/org/hatimaki/199612008855/reviews';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext()).newPage();
const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
const html = await resp.text();

// Find reviewResults structure
for (const key of ['reviewResults', 'businessReviews', '"reviews":[', '"params":{']) {
  const idx = html.indexOf(key);
  console.log(key, idx >= 0 ? html.slice(idx, idx + 300) : 'NOT FOUND');
}

await browser.close();
