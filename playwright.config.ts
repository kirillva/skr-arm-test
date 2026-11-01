import { defineConfig, devices } from '@playwright/test';
import { ENV } from './config/env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1, // одна учётка manager на dev — параллельные прогоны конфликтуют по сессии
  retries: 1,
  forbidOnly: !!process.env.CI,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: ENV.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
