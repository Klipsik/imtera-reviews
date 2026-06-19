import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from './api'

export interface AuthUser {
  id: number
  name: string
  email: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUser() {
    try {
      const { data } = await api.get<{ user: AuthUser }>('/user')
      user.value = data.user
    } catch {
      user.value = null
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      await api.get('/sanctum/csrf-cookie')
      const { data } = await api.post<{ user: AuthUser }>('/login', { email, password })
      user.value = data.user
    } catch (e: unknown) {
      error.value = 'Неверный email или пароль'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await api.post('/logout')
    user.value = null
  }

  return { user, loading, error, fetchUser, login, logout }
})
