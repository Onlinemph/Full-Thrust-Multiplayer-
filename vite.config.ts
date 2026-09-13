import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * A static single-page build with no server and no router, so it can be served
 * from any file host. `BASE_PATH` exists for project-scoped hosting such as
 * GitHub Pages, where the site lives under `/<repo-name>/`; leave it unset for
 * a domain root, a local preview, or a container.
 *
 * Normalised rather than used as given, because the value arrives from three
 * places that disagree about slashes: a person types `Full-Thrust-Multiplayer-`,
 * `actions/configure-pages` reports `/Full-Thrust-Multiplayer-` with no trailing
 * slash, and Vite wants both. Getting it wrong does not fail the build — it
 * ships a page whose every asset 404s, which is a much slower thing to notice.
 */
function normaliseBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '' || trimmed === '/') return '/'
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`
}

const base = normaliseBase(process.env.BASE_PATH)

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
