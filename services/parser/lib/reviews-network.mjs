/**
 * Yandex Maps reviews batch API (intercepted in Playwright):
 * GET https://yandex.ru/maps/api/business/fetchReviews
 *   ?ajax=1
 *   &businessId={orgId}
 *   &page={page}
 *   &pageSize=50
 *   &ranking=by_relevance_org
 *   &locale=ru_RU
 *   &csrfToken=...
 *   &sessionId=...
 *   &reqId=...
 *   &s=...
 *
 * Page 1 is SSR-embedded in the /reviews HTML; pages 2+ are loaded via this endpoint on scroll.
 * Response: { data: { reviews: [...], params: { count, page, totalPages, ... } } }
 */

/** @type {RegExp} */
export const REVIEWS_API_URL_PATTERN = /\/maps\/api\/business\/fetchReviews(?:\?|$)/;

/** Yandex label for reviews without a public author in the batch API. */
export const ANONYMOUS_REVIEW_AUTHOR = 'Анонимный отзыв';

export function resolveApiReviewAuthor(apiReview) {
  const name = apiReview?.author?.name?.trim();

  return name || ANONYMOUS_REVIEW_AUTHOR;
}

export function isReviewsApiUrl(url) {
  return REVIEWS_API_URL_PATTERN.test(url);
}

function extractJsonArray(source, startIndex) {
  if (source[startIndex] !== '[') {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) {
        return source.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * @param {string} html
 * @param {string} marker
 * @param {number} [fromIndex=0]
 * @returns {{ reviews: object[], params: object|null } | null}
 */
function extractReviewsBlockAtMarker(html, marker, fromIndex = 0) {
  const idx = html.indexOf(marker, fromIndex);
  if (idx === -1) {
    return null;
  }

  const arrayStart = idx + marker.length;
  const arrayJson = extractJsonArray(html, arrayStart);
  if (!arrayJson) {
    return null;
  }

  let reviews;
  try {
    reviews = JSON.parse(arrayJson);
  } catch {
    return null;
  }

  if (!Array.isArray(reviews) || reviews.length === 0) {
    return null;
  }

  const after = html.slice(arrayStart + arrayJson.length, arrayStart + arrayJson.length + 1200);
  const paramsMatch = after.match(/"params"\s*:\s*(\{[^}]*\})/);
  let params = null;

  if (paramsMatch) {
    try {
      params = JSON.parse(paramsMatch[1]);
    } catch {
      params = null;
    }
  }

  return { reviews, params };
}

function isValidGenericReviewsBlock({ reviews, params }) {
  if (!params) {
    return false;
  }

  if (params.loadedReviewsCount != null && params.loadedReviewsCount === reviews.length) {
    return true;
  }

  if (params.limit != null && reviews.length >= params.limit) {
    return true;
  }

  return reviews.length >= 50;
}

/**
 * @param {string} html
 * @returns {{ reviews: object[], params: object|null } | null}
 */
export function extractReviewsFromEmbeddedHtml(html) {
  const reviewResultsMarker = '"reviewResults":{"reviews":';
  const primary = extractReviewsBlockAtMarker(html, reviewResultsMarker);
  if (primary) {
    return primary;
  }

  const genericMarker = '"reviews":';
  const reviewResultsIdx = html.indexOf(reviewResultsMarker);
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const idx = html.indexOf(genericMarker, searchFrom);
    if (idx === -1) {
      break;
    }

    searchFrom = idx + genericMarker.length;

    if (reviewResultsIdx !== -1 && idx === reviewResultsIdx + '"reviewResults":{'.length) {
      continue;
    }

    const candidate = extractReviewsBlockAtMarker(html, genericMarker, idx);
    if (candidate && isValidGenericReviewsBlock(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * @param {object} apiReview
 */
export function mapApiReviewToParserReview(apiReview) {
  const author = resolveApiReviewAuthor(apiReview);
  const avatarTemplate = apiReview.author?.avatarUrl || null;
  const avatar = avatarTemplate
    ? avatarTemplate.replace('{size}', 'islands-200')
    : null;

  return {
    yandex_review_id: apiReview.reviewId,
    author,
    date: apiReview.updatedTime,
    rating: apiReview.rating ?? null,
    text: (apiReview.text || '').substring(0, 2000),
    avatar,
    raw_data: {
      reviewId: apiReview.reviewId,
      updatedTime: apiReview.updatedTime,
      author: apiReview.author,
      rating: apiReview.rating,
      text: apiReview.text,
      businessComment: apiReview.businessComment ?? null,
      photos: apiReview.photos ?? [],
      videos: apiReview.videos ?? [],
      reactions: apiReview.reactions ?? null,
      businessId: apiReview.businessId ?? null,
    },
  };
}

/**
 * @param {unknown} payload
 * @returns {{ reviews: object[], params: object|null }}
 */
export function parseReviewsApiPayload(payload) {
  const data = payload?.data;
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  const params = data?.params && typeof data.params === 'object' ? data.params : null;

  return { reviews, params };
}

export function createReviewsNetworkCollector() {
  return {
    reviews: [],
    seenIds: new Set(),
    totalCount: null,
    totalPages: null,
    loadedPages: new Set(),

    ingestPayload(payload) {
      const { reviews, params } = parseReviewsApiPayload(payload);

      if (params?.count != null) {
        this.totalCount = params.count;
      }

      if (params?.totalPages != null) {
        this.totalPages = params.totalPages;
      }

      if (params?.page != null) {
        this.loadedPages.add(params.page);
      }

      for (const apiReview of reviews) {
        this.addApiReview(apiReview);
      }
    },

    ingestHtml(html) {
      const extracted = extractReviewsFromEmbeddedHtml(html);
      if (!extracted) {
        return false;
      }

      if (extracted.params?.count != null) {
        this.totalCount = extracted.params.count;
      }

      if (extracted.params?.totalPages != null) {
        this.totalPages = extracted.params.totalPages;
      }

      if (extracted.params?.page != null) {
        this.loadedPages.add(extracted.params.page);
      }

      for (const apiReview of extracted.reviews) {
        this.addApiReview(apiReview);
      }

      return this.reviews.length > 0;
    },

    addApiReview(apiReview) {
      const reviewId = apiReview?.reviewId;
      if (!reviewId || this.seenIds.has(reviewId)) {
        return;
      }

      this.seenIds.add(reviewId);
      this.reviews.push(mapApiReviewToParserReview(apiReview));
    },

    isComplete() {
      if (this.totalCount != null) {
        return this.reviews.length >= this.totalCount;
      }

      if (this.totalPages != null && this.loadedPages.size >= this.totalPages) {
        return true;
      }

      return false;
    },

    attach(page) {
      page.on('response', async (response) => {
        const url = response.url();

        if (isReviewsApiUrl(url)) {
          try {
            const payload = await response.json();
            this.ingestPayload(payload);
          } catch {
            // ignore malformed API responses
          }
          return;
        }

        if (url.includes('/reviews') && response.request().resourceType() === 'document') {
          try {
            const html = await response.text();
            this.ingestHtml(html);
          } catch {
            // ignore document parse errors
          }
        }
      });
    },
  };
}
