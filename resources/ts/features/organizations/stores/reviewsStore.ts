import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/shared/api'
import type { Review } from '../types'

export const useReviewsStore = defineStore('reviews', () => {
  const items = ref<Review[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function reset() {
    items.value = []
    error.value = null
  }

  async function fetchAll(organizationId: number) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<{ data: Review[] }>(`/organizations/${organizationId}/reviews`)
      items.value = data.data ?? data as unknown as Review[]
    } catch {
      error.value = 'Не удалось загрузить отзывы'
    } finally {
      loading.value = false
    }
  }

  function appendBatch(reviews: Review[]) {
    for (const review of reviews) {
      const key = review.yandex_review_id ?? `${review.author_name}|${review.review_date}`
      const exists = items.value.some(r =>
        (r.yandex_review_id ?? `${r.author_name}|${r.review_date}`) === key,
      )
      if (!exists) {
        items.value.unshift(mapIncomingReview(review))
      }
    }
  }

  function mapIncomingReview(review: Review): Review {
    return {
      author_name: review.author_name ?? (review as unknown as { author?: string }).author ?? '',
      author_avatar: review.author_avatar ?? (review as unknown as { avatar?: string }).avatar,
      review_date: review.review_date ?? (review as unknown as { date?: string }).date ?? '',
      text: review.text ?? null,
      rating: review.rating ?? null,
      yandex_review_id: review.yandex_review_id,
    }
  }

  return { items, loading, error, reset, fetchAll, appendBatch }
})
