import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: '**/*.spec.ts',
  timeout: 15000,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'scripts/evaluate_report.json' }],
  ],
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 8000 --directory src',
    port: 8000,
    reuseExistingServer: true,
  },
});
