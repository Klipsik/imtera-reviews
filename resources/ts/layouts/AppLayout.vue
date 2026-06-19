<template>
  <v-app-bar color="primary" density="comfortable">
    <v-app-bar-title>Imtera Reviews</v-app-bar-title>
    <v-spacer />
    <ThemeToggle />
    <v-btn v-if="auth.user" variant="text" @click="logout">Выход</v-btn>
  </v-app-bar>

  <v-main>
    <v-container>
      <slot />
    </v-container>
  </v-main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import ThemeToggle from '@/shared/ThemeToggle.vue'
import { useAuthStore } from '@/shared/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>
