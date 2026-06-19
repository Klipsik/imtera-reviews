<template>
  <AppLayout>
    <v-btn variant="text" class="mb-4" :to="{ name: 'organizations.index' }">
      ← Назад
    </v-btn>

    <v-row v-if="organization">
      <v-col cols="12">
        <v-card>
          <v-card-item>
            <v-card-title class="text-h5">
              {{ organization.name }}
            </v-card-title>

            <v-card-subtitle
              v-if="organization.address"
              class="d-flex align-start ga-1 mt-1 opacity-100"
            >
              <VIcon
                icon="mdi-map-marker-outline"
                size="small"
                class="mt-1 flex-shrink-0"
              />
              <span>{{ organization.address }}</span>
            </v-card-subtitle>
          </v-card-item>

          <v-card-text class="pt-2">
            <div class="d-flex align-center flex-wrap ga-4 mb-4">
              <div
                v-if="organization.average_rating"
                class="d-flex align-center ga-2"
              >
                <VRating
                  :model-value="organization.average_rating"
                  readonly
                  half-increments
                  density="compact"
                  class="org-rating"
                />
                <span class="text-h6 font-weight-medium">
                  {{ organization.average_rating }}
                </span>
              </div>
              <span v-else class="text-medium-emphasis">Рейтинг не указан</span>
            </div>

            <div class="d-flex flex-wrap ga-3">
              <v-chip
                variant="tonal"
                prepend-icon="mdi-star-outline"
              >
                Оценок: {{ organization.ratings_count }}
              </v-chip>
              <v-chip
                variant="tonal"
                prepend-icon="mdi-comment-text-outline"
              >
                Яндекс: {{ organization.reviews_count }}
              </v-chip>
              <v-chip
                variant="tonal"
                :color="savedCount >= organization.reviews_count ? 'success' : undefined"
                prepend-icon="mdi-database-check-outline"
              >
                Сохранено: {{ savedCount }}
              </v-chip>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-4 flex-column flex-sm-row align-stretch align-sm-center ga-3">
            <div class="d-flex flex-wrap ga-2">
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-refresh"
                :loading="resyncing"
                @click="resync"
              >
                Обновить
              </v-btn>
              <v-btn
                color="error"
                variant="tonal"
                prepend-icon="mdi-delete-outline"
                :loading="deleting"
                @click="remove"
              >
                Удалить
              </v-btn>
            </div>

            <v-spacer class="d-none d-sm-block" />

            <div
              v-if="importStatusLabel"
              class="d-flex align-center ga-2 text-caption text-medium-emphasis"
            >
              <v-progress-circular
                v-if="isImporting"
                indeterminate
                size="16"
                width="2"
                color="primary"
              />
              <span>{{ importStatusLabel }}</span>
            </div>
          </v-card-actions>
        </v-card>

        <v-alert
          v-if="importStore.error"
          type="error"
          density="compact"
          class="mt-4"
        >
          {{ importStore.error }}
        </v-alert>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title class="pb-2">
            <div class="d-flex align-center flex-wrap ga-3">
              <span>Отзывы</span>
              <v-chip
                v-if="hasActiveFilters"
                size="small"
                variant="tonal"
              >
                {{ filteredReviews.length }} из {{ reviewsStore.items.length }}
              </v-chip>
            </div>
          </v-card-title>

          <v-card-text class="pt-0 pb-4">
            <div class="d-flex flex-column flex-md-row flex-wrap ga-2">
              <v-text-field
                v-model="reviewSearch"
                hide-details
                placeholder="Автор или текст"
                prepend-inner-icon="mdi-magnify"
                clearable
                class="reviews-filter-field flex-grow-1"
              />

              <v-select
                v-model="ratingFilter"
                :items="ratingItems"
                item-title="title"
                item-value="value"
                hide-details
                placeholder="Оценка"
                clearable
                class="reviews-filter-field reviews-filter-field--rating"
              />

              <AppDatePicker
                v-model="dateRange"
                label="Период"
                placeholder="Диапазон дат"
                range
                class="reviews-filter-field reviews-filter-field--date"
              />

              <IconBtn
                v-if="hasActiveFilters"
                title="Сбросить фильтры"
                class="align-self-center"
                @click="resetReviewFilters"
              >
                <VIcon icon="mdi-filter-off-outline" />
              </IconBtn>
            </div>
          </v-card-text>

          <v-divider />

          <div class="d-none d-md-block">
            <v-data-table
              :headers="headers"
              :items="filteredReviews"
              :loading="tableLoading"
              :items-per-page="50"
              item-value="yandex_review_id"
            >
              <template #item.author_name="{ item }">
                <div class="d-flex align-center ga-3 py-1">
                  <v-avatar
                    v-if="item.author_avatar"
                    :image="item.author_avatar"
                    size="36"
                  />
                  <v-avatar
                    v-else
                    color="surface-variant"
                    size="36"
                  >
                    <VIcon
                      icon="mdi-account-outline"
                      size="small"
                    />
                  </v-avatar>
                  <span class="text-truncate">{{ item.author_name }}</span>
                </div>
              </template>
              <template #item.review_date="{ item }">
                {{ formatDate(item.review_date) }}
              </template>
              <template #item.rating="{ item }">
                <VRating
                  v-if="item.rating"
                  :model-value="item.rating"
                  readonly
                  half-increments
                  density="compact"
                  size="small"
                  class="reviews-table-rating"
                />
                <span v-else>-</span>
              </template>
            </v-data-table>
          </div>

          <div class="d-md-none pa-3">
            <ReviewCardsList
              :items="paginatedMobileReviews"
              :loading="tableLoading"
            />

            <v-pagination
              v-if="mobilePageCount > 1"
              v-model="mobilePage"
              :length="mobilePageCount"
              :total-visible="5"
              density="comfortable"
              class="mt-4"
            />
          </div>
        </v-card>
      </v-col>
    </v-row>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AppDatePicker from '@/shared/AppDatePicker.vue'
import api from '@/shared/api'
import ReviewCardsList from './components/ReviewCardsList.vue'
import { useImportChannel } from './composables/useImportChannel'
import { useReviewFilters } from './composables/useReviewFilters'
import { importPhaseLabel } from './importPhases'
import { useImportStore } from './stores/importStore'
import { useReviewsStore } from './stores/reviewsStore'
import type { Organization } from './types'

const route = useRoute()
const router = useRouter()
const organization = ref<Organization | null>(null)
const resyncing = ref(false)
const deleting = ref(false)
const mobilePage = ref(1)
const mobileItemsPerPage = 20

const importStore = useImportStore()
const reviewsStore = useReviewsStore()
const { items: reviewItems } = storeToRefs(reviewsStore)

const {
  search: reviewSearch,
  rating: ratingFilter,
  dateRange,
  ratingItems,
  hasActiveFilters,
  filteredItems: filteredReviews,
  reset: resetReviewFilters,
} = useReviewFilters(reviewItems)

const orgId = computed(() => Number(route.params.id))

const isImporting = computed(() =>
  ['pending', 'parsing_org', 'parsing_reviews', 'saving'].includes(importStore.phase)
  || ['pending', 'parsing_org', 'parsing_reviews', 'saving'].includes(organization.value?.sync_status ?? ''),
)

const savedCount = computed(() => {
  const expected = organization.value?.reviews_count ?? 0

  if (reviewsStore.items.length > 0) {
    if (expected > 0 && reviewsStore.items.length > expected) {
      return expected
    }

    return reviewsStore.items.length
  }

  const saved = importStore.totalSaved || organization.value?.sync_progress?.saved || 0

  if (expected > 0 && saved > expected) {
    return expected
  }

  return saved
})

const tableLoading = computed(() => reviewsStore.loading)

const importStatusLabel = computed(() => {
  if (!isImporting.value) {
    return null
  }

  return importPhaseLabel(importStore.phase, importStore.message)
})

const mobilePageCount = computed(() =>
  Math.max(1, Math.ceil(filteredReviews.value.length / mobileItemsPerPage)),
)

const paginatedMobileReviews = computed(() => {
  const start = (mobilePage.value - 1) * mobileItemsPerPage

  return filteredReviews.value.slice(start, start + mobileItemsPerPage)
})

watch([filteredReviews, reviewSearch, ratingFilter, dateRange], () => {
  mobilePage.value = 1
})

const headers = [
  { title: 'Автор', key: 'author_name', sortable: false, minWidth: 200 },
  { title: 'Дата', key: 'review_date' },
  { title: 'Оценка', key: 'rating', width: 140 },
  { title: 'Текст', key: 'text' },
]

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('ru-RU')
  } catch {
    return value
  }
}

async function loadOrganization() {
  const { data } = await api.get<{ data: Organization }>(`/organizations/${orgId.value}`)
  organization.value = data.data ?? data as unknown as Organization
  importStore.syncFromOrganization(organization.value)
}

async function loadReviews() {
  const status = organization.value?.sync_status

  if (
    status === 'completed'
    || status === 'failed'
    || ['pending', 'parsing_org', 'parsing_reviews', 'saving'].includes(status ?? '')
  ) {
    await reviewsStore.fetchAll(orgId.value)
  }
}

async function resync() {
  resyncing.value = true
  importStore.reset()
  reviewsStore.reset()
  try {
    const { data } = await api.post<{ data: Organization }>(`/organizations/${orgId.value}/resync`)
    organization.value = data.data ?? data as unknown as Organization
    importStore.syncFromOrganization(organization.value)
  } finally {
    resyncing.value = false
  }
}

async function remove() {
  deleting.value = true
  try {
    await api.delete(`/organizations/${orgId.value}`)
    router.push({ name: 'organizations.index' })
  } finally {
    deleting.value = false
  }
}

watch(orgId, async () => {
  importStore.reset()
  reviewsStore.reset()
  await loadOrganization()
  await loadReviews()
})

onMounted(async () => {
  useImportChannel(orgId.value, {
    onOrganizationReady: loadOrganization,
  })
  await loadOrganization()
  await loadReviews()
})

watch(() => importStore.phase, async (phase) => {
  if (phase === 'completed' || phase === 'failed') {
    await loadOrganization()
    await loadReviews()
  }
})

let importPollTimer: ReturnType<typeof setInterval> | null = null

watch(isImporting, (importing) => {
  if (importPollTimer) {
    clearInterval(importPollTimer)
    importPollTimer = null
  }

  if (!importing) {
    return
  }

  importPollTimer = setInterval(async () => {
    await loadOrganization()

    const status = organization.value?.sync_status

    if (status === 'completed' || status === 'failed') {
      if (importPollTimer) {
        clearInterval(importPollTimer)
        importPollTimer = null
      }

      await loadReviews()
    }
  }, 5000)
})

onUnmounted(() => {
  if (importPollTimer) {
    clearInterval(importPollTimer)
  }
})
</script>

<style scoped>
.reviews-filter-field {
  min-width: 0;
  width: 100%;
}

@media (min-width: 960px) {
  .reviews-filter-field {
    flex: 1 1 180px;
    max-width: 280px;
  }

  .reviews-filter-field--rating {
    flex: 0 1 120px;
    max-width: 140px;
  }

  .reviews-filter-field--date {
    flex: 0 1 220px;
    max-width: 240px;
  }
}

.reviews-table-rating :deep(.v-rating__hidden) {
  display: none;
}

.org-rating :deep(.v-rating__hidden) {
  display: none;
}
</style>
