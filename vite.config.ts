import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/ts/main.ts'],
      refresh: true,
    }),
    vue(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./resources/ts', import.meta.url)),
    },
  },
  server: {
    watch: {
      ignored: ['**/storage/framework/views/**'],
    },
  },
})
