<template>
  <div>
    <div
      v-if="loading"
      class="d-flex justify-center pa-8"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </div>

    <div
      v-else-if="items.length === 0"
      class="pa-6 text-center text-medium-emphasis"
    >
      Нет отзывов
    </div>

    <template v-else>
      <v-card
        v-for="review in items"
        :key="review.yandex_review_id ?? `${review.author_name}-${review.review_date}`"
        variant="outlined"
        class="review-card mb-3"
      >
        <div class="review-card__body">
          <v-avatar
            v-if="review.author_avatar"
            :image="review.author_avatar"
            size="44"
            class="flex-shrink-0"
          />
          <v-avatar
            v-else
            color="surface-variant"
            size="44"
            class="flex-shrink-0"
          >
            <VIcon
              icon="mdi-account-outline"
              size="small"
            />
          </v-avatar>

          <div class="review-card__content min-width-0">
            <div class="review-card__meta">
              <span class="review-card__author text-truncate">
                {{ review.author_name }}
              </span>
              <VRating
                v-if="review.rating"
                :model-value="review.rating"
                readonly
                half-increments
                density="compact"
                size="x-small"
                class="review-card__rating flex-shrink-0"
              />
            </div>

            <div class="text-caption text-medium-emphasis mb-2">
              {{ formatDate(review.review_date) }}
            </div>

            <p
              v-if="review.text"
              class="text-body-2 mb-0 review-card__text"
            >
              {{ review.text }}
            </p>
            <p
              v-else
              class="text-body-2 text-medium-emphasis mb-0"
            >
              Без текста
            </p>
          </div>
        </div>
      </v-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Review } from '../types'

defineProps<{
  items: Review[]
  loading?: boolean
}>()

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('ru-RU')
  } catch {
    return value
  }
}
</script>

<style scoped>
.review-card__body {
  display: flex;
  gap: 12px;
  padding: 12px;
}

.review-card__content {
  flex: 1;
  min-width: 0;
}

.review-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
}

.review-card__author {
  font-weight: 500;
}

.review-card__text {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.45;
}

.review-card__rating :deep(.v-rating__hidden) {
  display: none;
}
</style>
