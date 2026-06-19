import { createReviewsNetworkCollector } from './reviews-network.mjs';

const CONFIRM_SCROLL_ATTEMPTS = 3;
const STAGNANT_ROUNDS_BEFORE_CONFIRM = 2;
const BATCH_SIZE = 25;
const GOTO_RETRIES = 3;
const REVIEWS_TIMEOUT = 120000;

export function normalizeAuthorName(author) {
  return (author || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeReviewDateString(date) {
  const trimmed = (date || '').trim();
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoMatch) {
    return isoMatch[1];
  }

  return trimmed;
}

export function buildReviewId(author, date) {
  return `${normalizeAuthorName(author)}|${normalizeReviewDateString(date)}`;
}

export function normalizeAddress(address) {
  if (!address) {
    return address;
  }

  return address
    .replace(/(\S)(этаж)/giu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRatingsCount(text) {
  if (!text) {
    return null;
  }

  const matches = [...text.matchAll(/(\d[\d\s\u00a0]*)\s+оцен(?:ок|ки|ка|ков)?/giu)];

  for (const match of matches) {
    const index = match.index ?? 0;
    const charBefore = index > 0 ? text[index - 1] : '';

    if (charBefore === ',') {
      continue;
    }

    return parseInt(match[1].replace(/[\s\u00a0]/g, ''), 10);
  }

  return null;
}

export function parseReviewsCount(text) {
  if (!text) {
    return null;
  }

  const showAllMatch = text.match(/Посмотреть\s+все\s+(\d+)\s+отзыв/iu);
  if (showAllMatch) {
    return parseInt(showAllMatch[1], 10);
  }

  const tabMatch = text.match(/Отзывы\s*[\n\s]+(\d+)/iu);
  if (tabMatch) {
    return parseInt(tabMatch[1], 10);
  }

  const matches = [...text.matchAll(/(\d+)\s+отзыв(?:ов|а|ы)\b/giu)];

  for (const match of matches) {
    const index = match.index ?? 0;
    const snippet = text.slice(Math.max(0, index - 8), index).toLowerCase();

    if (snippet.includes('отзывы')) {
      continue;
    }

    return parseInt(match[1], 10);
  }

  return null;
}

export function parseRatingValue(text) {
  if (!text) {
    return null;
  }

  const normalized = text.replace(',', '.').trim();
  const value = parseFloat(normalized);

  return Number.isFinite(value) ? value : null;
}

export function extractOrgMetadata(documentLike) {
  const title = documentLike.title || '';
  const nameFromTitle = title.replace(/ — Яндекс Карты$/, '').replace(/,.*$/, '').trim();
  let rating = null;
  let ratingsCount = null;
  let reviewsCount = null;
  let address = null;
  let phone = null;
  let category = null;
  let city = null;

  const ratingEl = documentLike.querySelector?.('.business-rating-badge-view__rating-text');
  if (ratingEl?.textContent) {
    rating = parseRatingValue(ratingEl.textContent);
  }

  const ratingsCountEl = documentLike.querySelector?.('.business-header-rating-view__text');
  if (ratingsCountEl?.textContent) {
    ratingsCount = parseRatingsCount(ratingsCountEl.textContent);
  }

  const allText = documentLike.body?.innerText || '';

  if (rating === null) {
    const ratingMatch = allText.match(/Рейтинг\s*([\d,\.]+)/iu)
      || allText.match(/([\d,\.]+)\s+[Ии]з\s+5/u);
    if (ratingMatch) {
      rating = parseRatingValue(ratingMatch[1]);
    }
  }

  if (ratingsCount === null) {
    ratingsCount = parseRatingsCount(allText);
  }

  reviewsCount = parseReviewsCount(allText);

  const addressLink = documentLike.querySelector?.('a[href*="/house/"]');
  if (addressLink) {
    address = addressLink.textContent?.trim();
  }

  const phoneLink = documentLike.querySelector?.('a[href^="tel:"]');
  if (phoneLink) {
    phone = phoneLink.textContent?.trim() || phoneLink.getAttribute('href')?.replace('tel:', '');
  }

  const categoryEl = documentLike.querySelector?.('[class*="business-card-title"]')?.nextElementSibling
    || documentLike.querySelector?.('[class*="business-categories"]');
  if (categoryEl) {
    category = categoryEl.textContent?.trim();
  }

  const cityMatch = title.match(/,\s*([^,—]+)\s*—\s*Яндекс/i);
  if (cityMatch) {
    city = cityMatch[1].trim();
  }

  return {
    name: nameFromTitle,
    rating,
    ratingsCount,
    reviewsCount,
    address: normalizeAddress(address),
    phone,
    category,
    city,
  };
}

function mergeReviews(target, incoming) {
  const seen = new Set(target.map(review => review.yandex_review_id));

  for (const review of incoming) {
    if (!seen.has(review.yandex_review_id)) {
      seen.add(review.yandex_review_id);
      target.push(review);
    }
  }
}

function reviewAuthorDateKey(review) {
  return buildReviewId(review.author, review.date);
}

function enrichAuthorsFromDom(collector, domReviews) {
  const domByText = new Map();

  for (const review of domReviews) {
    const textKey = (review.text || '').slice(0, 120).trim();

    if (textKey && review.author?.trim()) {
      domByText.set(textKey, review.author.trim());
    }
  }

  for (const review of collector.reviews) {
    if (review.author?.trim()) {
      continue;
    }

    const textKey = (review.text || '').slice(0, 120).trim();
    review.author = domByText.get(textKey) || 'Анонимный отзыв';
  }
}

function mergeMissingDomReviews(collector, domReviews) {
  const seenIds = new Set(collector.reviews.map((review) => review.yandex_review_id));
  const seenAuthorDates = new Set(collector.reviews.map(reviewAuthorDateKey));

  for (const review of domReviews) {
    const authorDateKey = reviewAuthorDateKey(review);

    if (seenIds.has(review.yandex_review_id) || seenAuthorDates.has(authorDateKey)) {
      continue;
    }

    seenIds.add(review.yandex_review_id);
    seenAuthorDates.add(authorDateKey);
    collector.seenIds.add(review.yandex_review_id);
    collector.reviews.push(review);
  }
}

function capReviews(reviews, targetCount) {
  if (targetCount && reviews.length > targetCount) {
    reviews.splice(targetCount);
  }
}

async function extractReviewsFromPage(page) {
  return page.evaluate(() => {
    const items = [];

    const normalizeAuthorName = (author) => (author || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const normalizeReviewDateString = (date) => {
      const trimmed = (date || '').trim();
      const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);

      if (isoMatch) {
        return isoMatch[1];
      }

      return trimmed;
    };

    const buildReviewId = (author, date) => `${normalizeAuthorName(author)}|${normalizeReviewDateString(date)}`;

    const cleanReviewText = (raw) => {
      return (raw || '')
        .replace(/\s*…\s*$/u, '')
        .replace(/\s*ещё\s*$/iu, '')
        .replace(/\s*Посмотреть ответ организации\s*$/iu, '')
        .replace(/\s*Скрыть ответ организации\s*$/iu, '')
        .trim();
    };

    const extractReviewText = (reviewEl) => {
      const body = reviewEl.querySelector('.business-review-view__body[itemprop="reviewBody"], .business-review-view__body');
      if (!body) return '';

      const clone = body.cloneNode(true);
      clone.querySelectorAll(
        '.business-review-view__expand, .spoiler-view__button, .business-review-comment__comment, .business-review-view__comment-expand',
      ).forEach(el => el.remove());

      const textContainer = clone.querySelector('.spoiler-view__text-container, [data-original-size]');
      return cleanReviewText(textContainer?.innerText || clone.innerText);
    };

    const extractReviewDate = (reviewEl) => {
      const meta = reviewEl.querySelector('meta[itemprop="datePublished"]');
      if (meta?.content) {
        return meta.content;
      }

      const time = reviewEl.querySelector('time[datetime]');
      if (time?.dateTime) {
        return time.dateTime;
      }

      const dateSpan = reviewEl.querySelector('.business-review-view__date span');
      return dateSpan?.textContent?.trim() || null;
    };

    for (const reviewEl of document.querySelectorAll('[itemprop="review"]')) {
      const authorInfo = reviewEl.querySelector('.business-review-view__author-info');
      let author = null;
      let avatar = null;

      if (authorInfo) {
        const nameLink = authorInfo.querySelector('a[href*="/maps/user/"]');
        if (nameLink) author = nameLink.textContent?.trim();
        if (!author) {
          const firstChild = authorInfo.firstElementChild;
          if (firstChild) author = firstChild.textContent?.trim();
        }
        const img = authorInfo.querySelector('img');
        if (img?.src) avatar = img.src;
      }

      if (!author) continue;

      let rating = null;
      for (const el of reviewEl.querySelectorAll('[aria-label]')) {
        const label = el.getAttribute('aria-label');
        if (label && /Оценка\s+\d+/.test(label)) {
          const m = label.match(/(\d+)/);
          if (m) { rating = parseInt(m[1], 10); break; }
        }
      }

      const date = extractReviewDate(reviewEl);
      const text = extractReviewText(reviewEl);

      if (author && date && text) {
        items.push({
          author,
          rating,
          date,
          text: text.substring(0, 2000),
          avatar,
          yandex_review_id: buildReviewId(author, date),
        });
      }
    }

    return items;
  });
}

async function scrollReviewsContainer(page, { aggressive = false } = {}) {
  await page.evaluate(({ aggressive }) => {
    const reviews = document.querySelectorAll('[itemprop="review"]');
    const lastReview = reviews.length ? reviews[reviews.length - 1] : null;

    const findScrollParent = (el) => {
      let parent = el?.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        const scrollable = style.overflowY === 'auto'
          || style.overflowY === 'scroll'
          || style.overflowY === 'overlay';
        if (scrollable && parent.scrollHeight > parent.clientHeight + 20) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return null;
    };

    const container = findScrollParent(lastReview)
      || document.querySelector('[class*="scroll"]')
      || document.scrollingElement
      || document.documentElement;

    const step = aggressive
      ? Math.max(container.clientHeight || 800, 1200)
      : Math.max((container.clientHeight || 800) * 0.85, 600);

    if (lastReview) {
      lastReview.scrollIntoView({ block: 'end', behavior: aggressive ? 'auto' : 'smooth' });
    }

    if (container === document.scrollingElement || container === document.documentElement) {
      window.scrollBy(0, step);
    } else {
      container.scrollTop += step;
    }
  }, { aggressive });
}

async function waitForReviewsLoad(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

async function confirmNoMoreReviews(page, reviews, previousCount) {
  for (let attempt = 0; attempt < CONFIRM_SCROLL_ATTEMPTS; attempt++) {
    await scrollReviewsContainer(page, { aggressive: true });
    await waitForReviewsLoad(page, 2000);

    const current = await extractReviewsFromPage(page);
    mergeReviews(reviews, current);

    if (reviews.length > previousCount) {
      return false;
    }
  }

  return true;
}

export async function scrollUntilCount(page, targetCount, options = {}) {
  const { maxAttempts = 300 } = options;
  const reviews = [];
  let previousCount = 0;
  let stagnantRounds = 0;
  let scrollAttempts = 0;
  let exhausted = false;

  while (scrollAttempts < maxAttempts) {
    const current = await extractReviewsFromPage(page);
    mergeReviews(reviews, current);

    if (reviews.length >= targetCount) {
      capReviews(reviews, targetCount);
      break;
    }

    if (reviews.length === previousCount) {
      stagnantRounds++;

      if (stagnantRounds >= STAGNANT_ROUNDS_BEFORE_CONFIRM) {
        const noMore = await confirmNoMoreReviews(page, reviews, previousCount);
        if (noMore) {
          exhausted = true;
          break;
        }
        stagnantRounds = 0;
        previousCount = reviews.length;
        continue;
      }
    } else {
      stagnantRounds = 0;
    }

    previousCount = reviews.length;
    await scrollReviewsContainer(page);
    await waitForReviewsLoad(page);
    scrollAttempts++;
  }

  if (scrollAttempts >= maxAttempts) {
    exhausted = true;
  }

  return { reviews, exhausted };
}

function buildReviewsUrl(baseUrl) {
  if (baseUrl.includes('/reviews')) {
    return baseUrl;
  }
  return baseUrl.replace(/\/?(\?.*)?$/, '/reviews/');
}

async function activateReviewsTab(page) {
  const reviewsTab = page.locator(
    '[role="tab"][aria-label*="Отзывы"], .tabs-select-view__title._name_reviews, button:has-text("Отзывы")',
  ).first();

  if (await reviewsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reviewsTab.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}

export async function gotoWithRetry(page, url, timeout = REVIEWS_TIMEOUT) {
  let lastError;
  for (let attempt = 0; attempt < GOTO_RETRIES; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return;
    } catch (e) {
      lastError = e;
      await page.waitForTimeout(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function navigateToReviews(page, url) {
  await gotoWithRetry(page, url);
  await page.waitForTimeout(2000);

  let finalUrl = page.url();

  if (!finalUrl.includes('/reviews')) {
    const showMoreLink = page.locator('a[href*="/reviews"]').filter({
      hasText: /Показать\s+(ещё|еще)/i,
    }).first();

    const clickedShowMore = await showMoreLink.click({ timeout: 5000 }).then(() => true).catch(() => false);

    if (clickedShowMore) {
      await page.waitForTimeout(2500);
      finalUrl = page.url();
    }

    if (!finalUrl.includes('/reviews')) {
      await gotoWithRetry(page, buildReviewsUrl(finalUrl));
      await page.waitForTimeout(2000);
      finalUrl = page.url();
    }
  }

  await activateReviewsTab(page);
  await page.locator('[itemprop="review"]').first().waitFor({ timeout: 15000 }).catch(() => {});

  return page.url();
}

export async function parseOrgPage(page, url) {
  await gotoWithRetry(page, url, 30000);
  await page.waitForTimeout(3000);

  const finalUrl = page.url();

  const data = await page.evaluate(() => {
    const title = document.title || '';
    const nameFromTitle = title.replace(/ — Яндекс Карты$/, '').replace(/,.*$/, '').trim();
    let rating = null;
    let ratingsCount = null;
    let reviewsCount = null;
    let address = null;
    let phone = null;
    let category = null;
    let city = null;

    const ratingEl = document.querySelector('.business-rating-badge-view__rating-text');
    if (ratingEl?.textContent) {
      const value = parseFloat(ratingEl.textContent.replace(',', '.').trim());
      if (Number.isFinite(value)) {
        rating = value;
      }
    }

    const ratingsCountEl = document.querySelector('.business-header-rating-view__text');
    if (ratingsCountEl?.textContent) {
      const match = ratingsCountEl.textContent.match(/(\d[\d\s\u00a0]*)\s+оцен(?:ок|ки|ка|ков)?/iu);
      if (match) {
        ratingsCount = parseInt(match[1].replace(/[\s\u00a0]/g, ''), 10);
      }
    }

    const allText = document.body.innerText;

    if (rating === null) {
      const ratingMatch = allText.match(/Рейтинг\s*([\d,\.]+)/iu)
        || allText.match(/([\d,\.]+)\s+[Ии]з\s+5/u);
      if (ratingMatch) {
        const value = parseFloat(ratingMatch[1].replace(',', '.'));
        if (Number.isFinite(value)) {
          rating = value;
        }
      }
    }

    if (ratingsCount === null) {
      const matches = [...allText.matchAll(/(\d[\d\s\u00a0]*)\s+оцен(?:ок|ки|ка|ков)?/giu)];

      for (const match of matches) {
        const index = match.index ?? 0;
        const charBefore = index > 0 ? allText[index - 1] : '';

        if (charBefore === ',') {
          continue;
        }

        ratingsCount = parseInt(match[1].replace(/[\s\u00a0]/g, ''), 10);
        break;
      }
    }

    const reviewsMatch = allText.match(/Посмотреть\s+все\s+(\d+)\s+отзыв/iu)
      || allText.match(/Отзывы\s*[\n\s]+(\d+)/iu);
    if (reviewsMatch) {
      reviewsCount = parseInt(reviewsMatch[1], 10);
    }

    if (reviewsCount === null) {
      const matches = [...allText.matchAll(/(\d+)\s+отзыв(?:ов|а|ы)\b/giu)];

      for (const match of matches) {
        const index = match.index ?? 0;
        const snippet = allText.slice(Math.max(0, index - 8), index).toLowerCase();

        if (snippet.includes('отзывы')) {
          continue;
        }

        reviewsCount = parseInt(match[1], 10);
        break;
      }
    }

    const addressLink = document.querySelector('a[href*="/house/"]');
    if (addressLink) address = addressLink.textContent?.trim();

    const phoneLink = document.querySelector('a[href^="tel:"]');
    if (phoneLink) phone = phoneLink.textContent?.trim() || phoneLink.getAttribute('href')?.replace('tel:', '');

    const categoryEl = document.querySelector('[class*="business-card-title"]')?.nextElementSibling
      || document.querySelector('[class*="business-categories"]');
    if (categoryEl) category = categoryEl.textContent?.trim();

    const cityMatch = title.match(/,\s*([^,—]+)\s*—\s*Яндекс/i);
    if (cityMatch) city = cityMatch[1].trim();

    return { name: nameFromTitle, rating, ratingsCount, reviewsCount, address, phone, category, city };
  });

  data.address = normalizeAddress(data.address);
  data.resolved_url = finalUrl;
  data.org_id = finalUrl.match(/\/org\/[^\/]+\/(\d+)/)?.[1]
    || finalUrl.match(/oid[=:](\d+)/)?.[1]
    || null;

  return data;
}

async function streamViaDom(page, target, onBatch) {
  const allReviews = [];
  let previousSent = 0;
  let previousCount = 0;
  let stagnantRounds = 0;
  let scrollAttempts = 0;
  const maxAttempts = target ? Math.max(300, target * 2) : 300;

  const emitNew = async () => {
    if (target && allReviews.length > target) {
      capReviews(allReviews, target);
    }

    if (allReviews.length <= previousSent) {
      return;
    }

    const batch = allReviews.slice(previousSent);
    previousSent = allReviews.length;
    await onBatch(batch);
  };

  while (scrollAttempts < maxAttempts) {
    const current = await extractReviewsFromPage(page);
    mergeReviews(allReviews, current);

    if (target && allReviews.length > target) {
      capReviews(allReviews, target);
    }

    if (allReviews.length - previousSent >= BATCH_SIZE) {
      await emitNew();
    }

    if (allReviews.length >= target) {
      await emitNew();
      break;
    }

    if (allReviews.length === previousCount) {
      stagnantRounds++;
      if (stagnantRounds >= STAGNANT_ROUNDS_BEFORE_CONFIRM) {
        const before = allReviews.length;
        const noMore = await confirmNoMoreReviews(page, allReviews, before);
        await emitNew();
        if (noMore) break;
        stagnantRounds = 0;
        previousCount = allReviews.length;
        continue;
      }
    } else {
      stagnantRounds = 0;
    }

    previousCount = allReviews.length;
    await scrollReviewsContainer(page);
    await waitForReviewsLoad(page);
    scrollAttempts++;
  }

  await emitNew();
  return allReviews.length;
}

async function streamViaNetworkIntercept(page, collector, target, onBatch, onProgress) {
  let previousSent = 0;
  let previousCount = collector.reviews.length;
  let stagnantRounds = 0;
  let scrollAttempts = 0;
  const maxAttempts = target ? Math.max(300, target * 2) : 300;

  const emitProgress = async () => {
    if (onProgress) {
      await onProgress(collector.reviews.length, target);
    }
  };

  const emitNew = async () => {
    if (target && collector.reviews.length > target) {
      capReviews(collector.reviews, target);
    }

    if (collector.reviews.length <= previousSent) {
      return;
    }

    const batch = collector.reviews.slice(previousSent);
    previousSent = collector.reviews.length;
    await onBatch(batch);
    await emitProgress();
  };

  await emitNew();
  await emitProgress();

  while (scrollAttempts < maxAttempts) {
    if (target && collector.reviews.length > target) {
      capReviews(collector.reviews, target);
    }

    if (collector.reviews.length - previousSent >= BATCH_SIZE) {
      await emitNew();
    }

    if (collector.isComplete() || (target && collector.reviews.length >= target)) {
      await emitNew();
      break;
    }

    if (collector.reviews.length === previousCount) {
      stagnantRounds++;
      if (stagnantRounds >= STAGNANT_ROUNDS_BEFORE_CONFIRM) {
        await scrollReviewsContainer(page, { aggressive: true });
        await waitForReviewsLoad(page, 2000);

        if (collector.reviews.length === previousCount) {
          await emitNew();
          break;
        }

        stagnantRounds = 0;
        previousCount = collector.reviews.length;
        continue;
      }
    } else {
      stagnantRounds = 0;
      await emitProgress();
    }

    previousCount = collector.reviews.length;
    await scrollReviewsContainer(page);
    await waitForReviewsLoad(page, 1500);
    scrollAttempts++;
  }

  await emitNew();
  return collector.reviews.length;
}

/**
 * Stream reviews in one browser session, calling onBatch for each chunk.
 * Primary source: network intercept of /maps/api/business/fetchReviews (+ SSR page 1).
 * Fallback: DOM scraping when intercept yields no reviews.
 */
export async function streamReviewsPage(page, url, { expectedTotal = null, onBatch, onProgress }) {
  const collector = createReviewsNetworkCollector();
  collector.attach(page);

  await navigateToReviews(page, url);
  await page.waitForTimeout(2000);

  if (collector.reviews.length === 0) {
    collector.ingestHtml(await page.content());
  }

  const target = collector.totalCount ?? expectedTotal ?? 600;
  const useNetwork = collector.reviews.length > 0;
  const expectedFirstPageCount = Math.min(50, target);

  if (
    useNetwork
    && (
      !collector.loadedPages.has(1)
      || collector.reviews.length < expectedFirstPageCount
    )
  ) {
    collector.ingestHtml(await page.content());
  }

  const total = useNetwork
    ? await streamViaNetworkIntercept(page, collector, target, onBatch, onProgress)
    : await streamViaDom(page, target, onBatch);

  if (useNetwork) {
    const needsDomMerge = collector.reviews.length < target;
    const needsAuthorEnrich = collector.reviews.some((review) => !review.author?.trim());

    if (needsDomMerge || needsAuthorEnrich) {
      const domReviews = await extractReviewsFromPage(page);
      enrichAuthorsFromDom(collector, domReviews);

      if (needsDomMerge) {
        const before = collector.reviews.length;
        mergeMissingDomReviews(collector, domReviews);

        if (collector.reviews.length > before) {
          const batch = collector.reviews.slice(before);
          await onBatch(batch);
        }
      }
    }
  }

  return {
    total: useNetwork ? collector.reviews.length : total,
    expectedTotal: collector.totalCount ?? expectedTotal ?? null,
    source: useNetwork ? 'network' : 'dom',
  };
}

export { BATCH_SIZE, REVIEWS_TIMEOUT };
