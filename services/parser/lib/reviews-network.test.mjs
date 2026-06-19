import { describe, expect, test } from 'bun:test';
import {
  REVIEWS_API_URL_PATTERN,
  createReviewsNetworkCollector,
  extractReviewsFromEmbeddedHtml,
  isReviewsApiUrl,
  mapApiReviewToParserReview,
  parseReviewsApiPayload,
} from './reviews-network.mjs';

const sampleApiReview = {
  reviewId: 'IQ0AdwIX1p9E4kZyf_vonf-8cmlVmtOq',
  businessId: '199612008855',
  author: {
    name: 'Виктория',
    avatarUrl: 'https://avatars.mds.yandex.net/get-yapic/37154/0t-1/{size}',
  },
  text: 'Долго думала, заказывать или нет',
  rating: 5,
  updatedTime: '2025-12-08T05:30:32.142Z',
  businessComment: {
    text: 'Спасибо за отзыв',
    updatedTime: '2025-12-09T11:43:48.527Z',
  },
  photos: [{ url: 'https://example.com/photo.jpg' }],
};

const samplePayload = {
  data: {
    reviews: [sampleApiReview],
    params: {
      offset: 0,
      limit: 50,
      count: 398,
      loadedReviewsCount: 50,
      page: 1,
      totalPages: 8,
      reviewsRemained: 348,
    },
  },
};

describe('isReviewsApiUrl', () => {
  test('matches fetchReviews batch endpoint', () => {
    expect(isReviewsApiUrl('https://yandex.ru/maps/api/business/fetchReviews?ajax=1&page=2')).toBe(true);
    expect(REVIEWS_API_URL_PATTERN.test('/maps/api/business/fetchReviews?ajax=1')).toBe(true);
  });

  test('does not match unrelated endpoints', () => {
    expect(isReviewsApiUrl('https://yandex.ru/maps/api/location-info/get?ajax=1')).toBe(false);
  });
});

describe('parseReviewsApiPayload', () => {
  test('extracts reviews and params.count', () => {
    const { reviews, params } = parseReviewsApiPayload(samplePayload);

    expect(reviews).toHaveLength(1);
    expect(params.count).toBe(398);
    expect(params.totalPages).toBe(8);
  });
});

describe('mapApiReviewToParserReview', () => {
  test('maps reviewId and raw_data fields', () => {
    const mapped = mapApiReviewToParserReview(sampleApiReview);

    expect(mapped.yandex_review_id).toBe('IQ0AdwIX1p9E4kZyf_vonf-8cmlVmtOq');
    expect(mapped.author).toBe('Виктория');
    expect(mapped.date).toBe('2025-12-08T05:30:32.142Z');
    expect(mapped.rating).toBe(5);
    expect(mapped.avatar).toContain('islands-200');
    expect(mapped.raw_data.reviewId).toBe(sampleApiReview.reviewId);
    expect(mapped.raw_data.businessComment.text).toBe('Спасибо за отзыв');
    expect(mapped.raw_data.photos).toHaveLength(1);
  });

  test('uses anonymous label when API author is missing', () => {
    const mapped = mapApiReviewToParserReview({
      ...sampleApiReview,
      reviewId: 'anon-review-id',
      author: undefined,
    });

    expect(mapped.author).toBe('Анонимный отзыв');
    expect(mapped.yandex_review_id).toBe('anon-review-id');
  });
});

describe('extractReviewsFromEmbeddedHtml', () => {
  test('parses SSR reviewResults block', () => {
    const html = `<script>{"reviewResults":{"reviews":${JSON.stringify([sampleApiReview])},"params":{"offset":0,"limit":50,"count":398,"page":1,"totalPages":8}}}</script>`;
    const extracted = extractReviewsFromEmbeddedHtml(html);

    expect(extracted?.reviews).toHaveLength(1);
    expect(extracted?.params?.count).toBe(398);
  });

  test('prefers reviewResults over smaller generic reviews preview', () => {
    const previewReviews = Array.from({ length: 10 }, (_, index) => ({
      ...sampleApiReview,
      reviewId: `preview-${index}`,
    }));
    const fullReviews = Array.from({ length: 50 }, (_, index) => ({
      ...sampleApiReview,
      reviewId: `full-${index}`,
    }));

    const html = `<script>{
      "widgetPreview":{"reviews":${JSON.stringify(previewReviews)}},
      "reviewResults":{"reviews":${JSON.stringify(fullReviews)},"params":{"offset":0,"limit":50,"count":398,"loadedReviewsCount":50,"page":1,"totalPages":8}}
    }</script>`;
    const extracted = extractReviewsFromEmbeddedHtml(html);

    expect(extracted?.reviews).toHaveLength(50);
    expect(extracted?.params?.count).toBe(398);
    expect(extracted?.reviews[0].reviewId).toBe('full-0');
  });
});

describe('createReviewsNetworkCollector', () => {
  test('deduplicates by reviewId and tracks total count', () => {
    const collector = createReviewsNetworkCollector();

    collector.ingestPayload(samplePayload);
    collector.ingestPayload(samplePayload);

    expect(collector.reviews).toHaveLength(1);
    expect(collector.totalCount).toBe(398);
    expect(collector.totalPages).toBe(8);
    expect(collector.loadedPages.has(1)).toBe(true);
    expect(collector.isComplete()).toBe(false);
  });

  test('does not mark complete when all pages loaded but count mismatch', () => {
    const collector = createReviewsNetworkCollector();

    for (let page = 1; page <= 8; page++) {
      collector.ingestPayload({
        data: {
          reviews: [{ ...sampleApiReview, reviewId: `id-${page}` }],
          params: { count: 398, page, totalPages: 8 },
        },
      });
    }

    expect(collector.reviews).toHaveLength(8);
    expect(collector.loadedPages.size).toBe(8);
    expect(collector.isComplete()).toBe(false);
  });

  test('marks complete when totalCount reached', () => {
    const collector = createReviewsNetworkCollector();

    for (let page = 1; page <= 7; page++) {
      collector.ingestPayload({
        data: {
          reviews: Array.from({ length: 50 }, (_, index) => ({
            ...sampleApiReview,
            reviewId: `id-${page}-${index}`,
          })),
          params: { count: 398, page, totalPages: 8 },
        },
      });
    }

    collector.ingestPayload({
      data: {
        reviews: Array.from({ length: 48 }, (_, index) => ({
          ...sampleApiReview,
          reviewId: `id-8-${index}`,
        })),
        params: { count: 398, page: 8, totalPages: 8 },
      },
    });

    expect(collector.reviews).toHaveLength(398);
    expect(collector.isComplete()).toBe(true);
  });

  test('marks complete when all pages loaded without totalCount', () => {
    const collector = createReviewsNetworkCollector();

    for (let page = 1; page <= 8; page++) {
      collector.ingestPayload({
        data: {
          reviews: [{ ...sampleApiReview, reviewId: `id-${page}` }],
          params: { page, totalPages: 8 },
        },
      });
    }

    expect(collector.reviews).toHaveLength(8);
    expect(collector.isComplete()).toBe(true);
  });
});
