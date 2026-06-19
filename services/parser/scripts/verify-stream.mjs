import { chromium } from 'playwright';
import { streamReviewsPage } from '../lib/extractors.mjs';

const URL = 'https://yandex.ru/maps/org/hatimaki/199612008855/reviews';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'ru-RU',
});
const page = await context.newPage();

let batchCount = 0;
let reviewCount = 0;
let sample = null;

const result = await streamReviewsPage(page, URL, {
  expectedTotal: 398,
  onBatch: async (reviews) => {
    batchCount++;
    reviewCount += reviews.length;
    if (!sample) sample = reviews[0];
  },
});

console.log(JSON.stringify({
  result,
  batchCount,
  reviewCount,
  sample: sample ? {
    yandex_review_id: sample.yandex_review_id,
    author: sample.author,
    date: sample.date,
    hasRawData: !!sample.raw_data?.reviewId,
  } : null,
}, null, 2));

await browser.close();
