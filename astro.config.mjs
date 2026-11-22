// @ts-check
import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/',
  integrations: [preact()],
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: ({ names }) => names.includes('pdf.worker.min.mjs')
            ? '_astro/[name].[hash].js'
            : '_astro/[name].[hash][extname]',
        },
      },
    },
    resolve: {
      alias: {
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
  },
})
