import { describe, expect, test } from 'bun:test';
import {
  buildReviewId,
  extractOrgMetadata,
  normalizeAddress,
  normalizeReviewDateString,
  parseRatingsCount,
  parseReviewsCount,
} from './extractors.mjs';

describe('parseRatingsCount', () => {
  test('parses standalone ratings count text', () => {
    expect(parseRatingsCount('780 оценок')).toBe(780);
  });

  test('ignores ratings count glued to rating value in plain text', () => {
    expect(parseRatingsCount('Рейтинг 4,5780 оценок')).toBeNull();
  });

  test('parses thousands separator in ratings count', () => {
    expect(parseRatingsCount('4 512 оценок')).toBe(4512);
  });
});

describe('parseReviewsCount', () => {
  test('parses tab label count', () => {
    expect(parseReviewsCount('Отзывы 398')).toBe(398);
  });

  test('parses pluralized reviews label', () => {
    expect(parseReviewsCount('Посмотреть все 398 отзывов')).toBe(398);
  });

  test('does not confuse photo tab count with reviews tab count', () => {
    expect(parseReviewsCount('Фото\n38\nОтзывы\n398')).toBe(398);
  });
});

describe('buildReviewId', () => {
  test('normalizes author case and iso date prefix', () => {
    expect(buildReviewId('Ivan', '2024-01-11T16:35:52.043Z')).toBe('ivan|2024-01-11');
  });

  test('deduplicates same review with different iso timestamps', () => {
    const first = buildReviewId('Гость', '2024-01-11T16:35:52.043Z');
    const second = buildReviewId('Гость', '2024-01-11T22:00:00.000Z');

    expect(first).toBe(second);
  });
});

describe('normalizeReviewDateString', () => {
  test('returns date-only part for iso datetime', () => {
    expect(normalizeReviewDateString('2025-06-18T15:09:37.122Z')).toBe('2025-06-18');
  });
});

describe('normalizeAddress', () => {
  test('inserts space before этаж when glued to city', () => {
    expect(normalizeAddress('ул. Стройкова, 67А, Рязаньэтаж 2')).toBe('ул. Стройкова, 67А, Рязань этаж 2');
  });

  test('collapses multiple spaces', () => {
    expect(normalizeAddress('ул.  Test,   1 этаж  2')).toBe('ул. Test, 1 этаж 2');
  });
});

describe('extractOrgMetadata', () => {
  test('extracts rating and ratings count from business header nodes', () => {
    const metadata = extractOrgMetadata({
      title: 'Hatimaki, суши-бар, Рязань — Яндекс Карты',
      body: { innerText: 'Рейтинг 4,5780 оценок\nОтзывы 398' },
      querySelector(selector) {
        if (selector === '.business-rating-badge-view__rating-text') {
          return { textContent: '4,5' };
        }

        if (selector === '.business-header-rating-view__text') {
          return { textContent: '780 оценок' };
        }

        return null;
      },
    });

    expect(metadata.rating).toBe(4.5);
    expect(metadata.ratingsCount).toBe(780);
    expect(metadata.reviewsCount).toBe(398);
  });
});
