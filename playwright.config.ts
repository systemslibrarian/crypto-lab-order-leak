import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

/**
 * Three projects, because the runtime coverage rule (brief D6) needs an order.
 *
 * `verdict-coverage` asserts that every recorded mutation's `(test title,
 * marker)` pair was actually executed by one of the helpers in
 * `expect-marker.ts`. Those pairs do not exist until `claims` has run, and
 * Playwright runs tests in separate worker PROCESSES, so the pairs are
 * appended to a file under `test-results/` rather than collected in memory.
 * `dependencies: ['claims']` is what puts the check after the run it judges;
 * `globalSetup` clears the sink first, so a file left by an earlier run can
 * never answer for this one.
 *
 * `a11y` is a project of its own rather than part of `claims` so that
 * `npm run test:verdicts` -- which is the required check, and runs
 * `--project=verdict-coverage` -- pulls in the claims run it depends on
 * without also re-running the axe sweep that the build job already runs.
 */
export default defineConfig({
  testDir: './e2e',
  // Absolute: a relative globalSetup is resolved against the resolver's idea
  // of the config directory, which is not the config directory when the tree is
  // an archived copy with a symlinked node_modules -- the exact shape the lane's
  // isolation protocol requires for any mutation run.
  globalSetup: fileURLToPath(new URL('./e2e/global-setup.ts', import.meta.url)),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4201/crypto-lab-order-leak/', colorScheme: 'dark' },
  projects: [
    { name: 'claims', testMatch: /claims\.spec\.ts/ },
    { name: 'a11y', testMatch: /a11y\.spec\.ts/ },
    { name: 'verdict-coverage', testMatch: /verdict-coverage\.spec\.ts/, dependencies: ['claims'] },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4201 --strictPort',
    url: 'http://localhost:4201/crypto-lab-order-leak/',
    reuseExistingServer: !process.env.CI,
  },
})
