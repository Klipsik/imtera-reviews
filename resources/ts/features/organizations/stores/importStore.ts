import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Organization } from '../types'

export const useImportStore = defineStore('import', () => {
  const phase = ref<string>('idle')
  const message = ref<string | null>(null)
  const totalSaved = ref(0)
  const error = ref<string | null>(null)

  function reset() {
    phase.value = 'idle'
    message.value = null
    totalSaved.value = 0
    error.value = null
  }

  function onPhaseChanged(payload: { phase: string; message?: string }) {
    phase.value = payload.phase
    message.value = payload.message ?? null
  }

  function onOrganizationReady(payload: { total_saved?: number; phase?: string }) {
    totalSaved.value = payload.total_saved ?? 0

    if (payload.phase) {
      phase.value = payload.phase
    }
  }

  function onReviewsAppended(payload: { total_saved: number }) {
    totalSaved.value = payload.total_saved
  }

  function onCompleted(payload: { total_saved: number }) {
    totalSaved.value = payload.total_saved
    phase.value = 'completed'
  }

  function onFailed(payload: { message: string }) {
    error.value = payload.message
    phase.value = 'failed'
  }

  function syncFromOrganization(org: Organization) {
    phase.value = org.sync_progress?.phase ?? org.sync_status
    totalSaved.value = org.sync_progress?.saved ?? 0
  }

  return {
    phase,
    message,
    totalSaved,
    error,
    reset,
    onPhaseChanged,
    onOrganizationReady,
    onReviewsAppended,
    onCompleted,
    onFailed,
    syncFromOrganization,
  }
})
