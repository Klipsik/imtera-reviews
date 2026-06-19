import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components/VBtn'
import { ru } from 'vuetify/locale'
import { getStoredTheme } from '@/shared/theme'
import defaults from './defaults'
import { themes } from './theme'

export default createVuetify({
  aliases: {
    IconBtn: VBtn,
  },
  defaults,
  locale: {
    locale: 'ru',
    fallback: 'ru',
    messages: { ru },
  },
  date: {
    locale: {
      ru: 'ru-RU',
    },
  },
  theme: {
    defaultTheme: getStoredTheme(),
    themes,
  },
})
