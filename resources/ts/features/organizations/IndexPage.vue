<template>
  <AppLayout>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="headers"
            :items="organizations"
            :loading="loading"
            item-value="id"
            @click:row="goToOrg"
          >
            <template #top>
              <v-text-field
                v-model="url"
                class="pa-2"
                label="Ссылка на Яндекс.Карты"
                placeholder="https://yandex.ru/maps/org/..."
                :error-messages="formError"
                hide-details="auto"
                @keyup.enter="submit"
              >
                <template #prepend-inner>
                  <IconBtn
                    title="Вставить"
                    @click.stop="pasteFromClipboard"
                  >
                    <VIcon icon="mdi-content-paste" />
                  </IconBtn>
                </template>
                <template #append-inner>
                  <IconBtn
                    title="Импортировать"
                    :loading="submitting"
                    @click.stop="submit"
                  >
                    <VIcon icon="mdi-magnify" />
                  </IconBtn>
                </template>
              </v-text-field>
            </template>

            <template #item.sync_status="{ item }">
              <v-chip size="small" :color="statusColor(item.sync_status)">
                {{ item.sync_status }}
              </v-chip>
            </template>
            <template #item.average_rating="{ item }">
              {{ item.average_rating || '-' }}
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="duplicateDialog" max-width="480">
      <v-card>
        <v-card-title>Организация уже добавлена</v-card-title>
        <v-card-text>
          <p class="mb-2">
            «{{ duplicateOrg?.name }}» уже есть в списке.
          </p>
          <p class="text-medium-emphasis">
            Обновить отзывы с Яндекс.Карт?
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="duplicateDialog = false">
            Отмена
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="resyncing"
            @click="resyncExisting"
          >
            Обновить отзывы
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import api from '@/shared/api'
import type { Organization } from './types'

const router = useRouter()
const organizations = ref<Organization[]>([])
const loading = ref(false)
const submitting = ref(false)
const resyncing = ref(false)
const url = ref('')
const formError = ref<string | null>(null)
const duplicateDialog = ref(false)
const duplicateOrg = ref<Organization | null>(null)

const headers = [
  { title: 'Название', key: 'name' },
  { title: 'Рейтинг', key: 'average_rating' },
  { title: 'Оценок', key: 'ratings_count' },
  { title: 'Отзывов', key: 'reviews_count' },
  { title: 'Статус', key: 'sync_status' },
]

function statusColor(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'pending') return 'grey'
  return 'info'
}

function unwrapOrganization(payload: unknown): Organization {
  const wrapped = payload as { data?: Organization }

  return wrapped.data ?? payload as Organization
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get<{ data: Organization[] }>('/organizations')
    organizations.value = data.data ?? data as unknown as Organization[]
  } finally {
    loading.value = false
  }
}

async function pasteFromClipboard() {
  formError.value = null

  try {
    url.value = await navigator.clipboard.readText()
  } catch {
    formError.value = 'Не удалось вставить из буфера обмена'
  }
}

async function submit() {
  if (!url.value.trim()) {
    formError.value = 'Введите ссылку на Яндекс.Карты'

    return
  }

  submitting.value = true
  formError.value = null

  try {
    const { data } = await api.post<{ data: Organization }>('/organizations', { url: url.value })
    const org = unwrapOrganization(data)
    url.value = ''
    await load()
    router.push({ name: 'organizations.show', params: { id: org.id } })
  } catch (e: unknown) {
    const err = e as {
      response?: {
        status?: number
        data?: {
          message?: string
          code?: string
          organization?: Organization
        }
      }
    }

    if (err.response?.status === 409 && err.response.data?.code === 'organization_exists') {
      duplicateOrg.value = unwrapOrganization(err.response.data.organization)
      duplicateDialog.value = true
      formError.value = null

      return
    }

    formError.value = err.response?.data?.message ?? 'Ошибка сохранения'
  } finally {
    submitting.value = false
  }
}

async function resyncExisting() {
  if (!duplicateOrg.value) {
    return
  }

  resyncing.value = true

  try {
    await api.post(`/organizations/${duplicateOrg.value.id}/resync`)
    duplicateDialog.value = false
    url.value = ''
    await load()
    router.push({ name: 'organizations.show', params: { id: duplicateOrg.value.id } })
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    formError.value = err.response?.data?.message ?? 'Не удалось обновить отзывы'
    duplicateDialog.value = false
  } finally {
    resyncing.value = false
  }
}

function goToOrg(_: Event, { item }: { item: Organization }) {
  router.push({ name: 'organizations.show', params: { id: item.id } })
}

onMounted(load)
</script>
