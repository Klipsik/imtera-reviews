<script setup lang="ts">
import flatpickr from 'flatpickr'
import { Russian } from 'flatpickr/dist/l10n/ru.js'
import FlatPickr from 'vue-flatpickr-component'
import { computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { parseDateRange } from './parseDateRange'
import 'flatpickr/dist/flatpickr.css'

const model = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{
  label?: string
  placeholder?: string
  density?: 'default' | 'comfortable' | 'compact'
  hideDetails?: boolean | 'auto'
  clearable?: boolean
  disabled?: boolean
  minWidth?: string | number
  range?: boolean
}>(), {
  hideDetails: true,
  clearable: true,
})

const fpRef = ref<{ fp?: flatpickr.Instance } | null>(null)
const theme = useTheme()

function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Date(year, month - 1, day).toLocaleDateString('ru-RU')
}

const displayValue = computed(() => {
  if (!model.value) {
    return ''
  }

  if (props.range) {
    const { from, to } = parseDateRange(model.value)

    if (from && to) {
      return `${formatIsoDate(from)} - ${formatIsoDate(to)}`
    }

    if (from) {
      return formatIsoDate(from)
    }

    return model.value
  }

  return formatIsoDate(model.value)
})

const fpConfig = computed(() => ({
  dateFormat: 'Y-m-d',
  locale: Russian,
  allowInput: false,
  disableMobile: true,
  ...(props.range ? { mode: 'range' as const } : {}),
}))

function syncCalendarTheme() {
  const container = fpRef.value?.fp?.calendarContainer

  if (!container) {
    return
  }

  container.classList.forEach(className => {
    if (className.startsWith('v-theme--')) {
      container.classList.remove(className)
    }
  })

  container.classList.add(`v-theme--${theme.global.name.value}`)
}

watch(() => theme.global.name.value, syncCalendarTheme)

function clearDate() {
  model.value = ''
  fpRef.value?.fp?.clear()
}
</script>

<template>
  <div
    class="app-date-picker position-relative"
    :style="minWidth ? { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth } : undefined"
  >
    <v-text-field
      :model-value="displayValue"
      :label="label"
      :placeholder="placeholder"
      :density="density"
      :hide-details="hideDetails"
      :disabled="disabled"
      readonly
      :prepend-inner-icon="range ? 'mdi-calendar-range' : 'mdi-calendar-outline'"
      :clearable="clearable && !!model"
      @click:clear="clearDate"
    />

    <FlatPickr
      ref="fpRef"
      :model-value="model || null"
      :config="fpConfig"
      class="app-date-picker__input"
      :disabled="disabled"
      @on-open="syncCalendarTheme"
      @update:model-value="model = $event ?? ''"
    />
  </div>
</template>

<style scoped lang="scss">
.app-date-picker__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  inline-size: 100%;
  block-size: 100%;
  cursor: pointer;

  :deep(input) {
    inline-size: 100%;
    block-size: 100%;
    cursor: pointer;
  }
}
</style>

<style lang="scss">
.flatpickr-calendar {
  background-color: rgb(var(--v-theme-surface));
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);

  &.open {
    z-index: 2401;
  }

  .flatpickr-day {
    color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));

    &.selected,
    &.selected:hover {
      background: rgb(var(--v-theme-primary));
      border-color: rgb(var(--v-theme-primary));
      color: rgb(var(--v-theme-on-primary));
    }

    &.today:not(.selected) {
      border-color: rgb(var(--v-theme-primary));
      color: rgb(var(--v-theme-primary));
    }

    &.inRange,
    &.inRange:hover {
      background: rgba(var(--v-theme-primary), var(--v-activated-opacity));
      border-color: transparent;
      box-shadow: none;
      color: rgb(var(--v-theme-primary));
    }

    &.startRange,
    &.endRange,
    &.startRange:hover,
    &.endRange:hover {
      background: rgb(var(--v-theme-primary));
      border-color: rgb(var(--v-theme-primary));
      color: rgb(var(--v-theme-on-primary));
    }

    &:hover {
      background: rgba(var(--v-theme-on-surface), 0.08);
    }
  }

  .flatpickr-months .flatpickr-prev-month,
  .flatpickr-months .flatpickr-next-month {
    fill: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  }
}
</style>
