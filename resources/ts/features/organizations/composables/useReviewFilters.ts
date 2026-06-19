import { computed, ref, type Ref } from 'vue'
import { parseDateRange } from '@/shared/parseDateRange'
import type { Review } from '../types'

export function useReviewFilters(items: Ref<Review[]>) {
  const search = ref('')
  const rating = ref<number | null>(null)
  const dateRange = ref('')

  const ratingItems = [
    { title: '5 ★', value: 5 },
    { title: '4 ★', value: 4 },
    { title: '3 ★', value: 3 },
    { title: '2 ★', value: 2 },
    { title: '1 ★', value: 1 },
  ]

  const hasActiveFilters = computed(() =>
    search.value.trim() !== ''
    || rating.value != null
    || dateRange.value !== '',
  )

  const filteredItems = computed(() => {
    let result = items.value
    const query = search.value.trim().toLowerCase()
    const { from: dateFrom, to: dateTo } = parseDateRange(dateRange.value)

    if (query) {
      result = result.filter(review =>
        review.author_name.toLowerCase().includes(query)
        || (review.text?.toLowerCase().includes(query) ?? false),
      )
    }

    if (rating.value != null) {
      result = result.filter(review => Number(review.rating) === rating.value)
    }

    if (dateFrom) {
      const from = startOfDay(parseIsoDate(dateFrom))

      if (from) {
        result = result.filter(review => {
          const date = new Date(review.review_date)

          return !Number.isNaN(date.getTime()) && date >= from
        })
      }
    }

    if (dateTo) {
      const to = endOfDay(parseIsoDate(dateTo))

      if (to) {
        result = result.filter(review => {
          const date = new Date(review.review_date)

          return !Number.isNaN(date.getTime()) && date <= to
        })
      }
    }

    return result
  })

  function reset() {
    search.value = ''
    rating.value = null
    dateRange.value = ''
  }

  return {
    search,
    rating,
    dateRange,
    ratingItems,
    hasActiveFilters,
    filteredItems,
    reset,
  }
}

function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function startOfDay(date: Date | null): Date | null {
  if (!date) {
    return null
  }

  date.setHours(0, 0, 0, 0)

  return date
}

function endOfDay(date: Date | null): Date | null {
  if (!date) {
    return null
  }

  date.setHours(23, 59, 59, 999)

  return date
}
