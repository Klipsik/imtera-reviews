import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/shared/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/',
      redirect: '/organizations',
    },
    {
      path: '/organizations',
      name: 'organizations.index',
      component: () => import('@/features/organizations/IndexPage.vue'),
      meta: { auth: true },
    },
    {
      path: '/organizations/:id',
      name: 'organizations.show',
      component: () => import('@/features/organizations/ShowPage.vue'),
      meta: { auth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.user) {
    await auth.fetchUser()
  }

  if (to.meta.auth && !auth.user) {
    return { name: 'login' }
  }

  if (to.meta.guest && auth.user) {
    return { name: 'organizations.index' }
  }
})

export default router
