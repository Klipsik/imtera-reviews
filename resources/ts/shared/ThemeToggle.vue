<template>
  <IconBtn
    :title="isDark ? 'Светлая тема' : 'Тёмная тема'"
    @click="toggle"
  >
    <VIcon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" />
  </IconBtn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { storeTheme, type AppTheme } from './theme'

const theme = useTheme()

const isDark = computed(() => theme.global.current.value.dark)

function toggle() {
  const next: AppTheme = isDark.value ? 'light' : 'dark'

  theme.change(next)
  storeTheme(next)
}
</script>
