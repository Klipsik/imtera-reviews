import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { onUnmounted } from 'vue'
import { useImportStore } from '../stores/importStore'
import { useReviewsStore } from '../stores/reviewsStore'

declare global {
  interface Window {
    Pusher: typeof Pusher
    Echo?: Echo<'reverb'>
  }
}

window.Pusher = Pusher

function getEcho(): Echo<'reverb'> {
  if (!window.Echo) {
    window.Echo = new Echo({
      broadcaster: 'reverb',
      key: import.meta.env.VITE_REVERB_APP_KEY,
      wsHost: import.meta.env.VITE_REVERB_HOST,
      wsPort: Number(import.meta.env.VITE_REVERB_PORT),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT),
      forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: '/broadcasting/auth',
    })
  }

  return window.Echo
}

type ImportChannelHandlers = {
  onOrganizationReady?: () => void | Promise<void>
}

export function useImportChannel(organizationId: number, handlers: ImportChannelHandlers = {}) {
  const importStore = useImportStore()
  const reviewsStore = useReviewsStore()
  const echo = getEcho()

  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleReviewsRefresh() {
    if (refreshTimer)
      clearTimeout(refreshTimer)

    refreshTimer = setTimeout(() => {
      void reviewsStore.fetchAll(organizationId)
    }, 400)
  }

  const channel = echo.private(`org.${organizationId}`)

  channel
    .listen('.ImportPhaseChanged', (payload: { phase: string; message?: string }) => {
      importStore.onPhaseChanged(payload)
    })
    .listen('.OrganizationReady', (payload: { total_saved?: number; phase?: string }) => {
      importStore.onOrganizationReady(payload)
      void handlers.onOrganizationReady?.()
      scheduleReviewsRefresh()
    })
    .listen('.ReviewsAppended', (payload: { total_saved: number; batch_saved?: number }) => {
      importStore.onReviewsAppended(payload)
      scheduleReviewsRefresh()
    })
    .listen('.ImportCompleted', (payload: { total_saved: number }) => {
      if (refreshTimer) {
        clearTimeout(refreshTimer)
        refreshTimer = null
      }

      importStore.onCompleted(payload)
      void reviewsStore.fetchAll(organizationId)
      void handlers.onOrganizationReady?.()
    })
    .listen('.ImportFailed', (payload: { message: string }) => {
      importStore.onFailed(payload)
    })

  onUnmounted(() => {
    if (refreshTimer)
      clearTimeout(refreshTimer)

    echo.leave(`org.${organizationId}`)
  })
}
