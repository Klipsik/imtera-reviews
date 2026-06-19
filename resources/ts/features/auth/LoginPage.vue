<template>
  <v-app-bar color="primary" density="comfortable" flat>
    <v-app-bar-title>Imtera Reviews</v-app-bar-title>
    <v-spacer />
    <ThemeToggle />
  </v-app-bar>

  <v-main class="d-flex align-center">
    <v-container class="py-8">
      <v-row justify="center">
        <v-col cols="12" sm="8" md="5" lg="4">
          <v-card class="login-card" elevation="2">
            <v-card-title class="text-h5 font-weight-medium pa-6 pb-2">
              Вход
            </v-card-title>

            <v-card-text class="pa-6 pt-4">
              <v-form class="d-flex flex-column ga-4" @submit.prevent="submit">
                <v-text-field
                  v-model="email"
                  label="Email"
                  type="email"
                  autocomplete="username"
                  required
                  hide-details="auto"
                />

                <v-text-field
                  v-model="password"
                  label="Пароль"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  required
                  hide-details="auto"
                >
                  <template #append-inner>
                    <IconBtn
                      :title="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
                      @click.stop="showPassword = !showPassword"
                    >
                      <VIcon :icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" />
                    </IconBtn>
                  </template>
                </v-text-field>

                <v-alert
                  v-if="auth.error"
                  type="error"
                  density="compact"
                  variant="tonal"
                >
                  {{ auth.error }}
                </v-alert>

                <v-btn
                  type="submit"
                  color="primary"
                  size="large"
                  block
                  :loading="auth.loading"
                >
                  Войти
                </v-btn>
              </v-form>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ThemeToggle from '@/shared/ThemeToggle.vue'
import { useAuthStore } from '@/shared/auth'

const auth = useAuthStore()
const router = useRouter()
const email = ref('admin@imtera.local')
const password = ref('password')
const showPassword = ref(false)

async function submit() {
  await auth.login(email.value, password.value)
  router.push({ name: 'organizations.index' })
}
</script>

<style scoped>
.login-card {
  border-radius: 12px;
}
</style>
