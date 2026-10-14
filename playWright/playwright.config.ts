import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

if (existsSync('.env.local')) {
  process.loadEnvFile?.('.env.local');
}

const systemChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browserExecutablePath =
  process.env.PLAYWRIGHT_BROWSER_PATH ??
  (existsSync(systemChromePath) ? systemChromePath : undefined);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for the parent feedback persistence E2E');
}

export default defineConfig({
  testDir: '.',
  outputDir: '../output/playwright',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: browserExecutablePath
      ? {
          executablePath: browserExecutablePath,
        }
      : undefined,
  },
  webServer: [
    {
      command: 'npm run dev --prefix Backend',
      cwd: '..',
      url: 'http://localhost:3000/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
        CORS_ORIGIN: 'http://localhost:5173',
        TEST_DATABASE_URL: testDatabaseUrl,
        // The Backend runtime only reads POSTGRESQL_URL. This value is scoped
        // to the E2E child process and never changes the product environment.
        POSTGRESQL_URL: testDatabaseUrl,
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1',
        OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? 'llama3.1:latest',
      },
    },
    {
      command: 'npm run dev --prefix Frontend',
      cwd: '..',
      url: 'http://localhost:5173/parent/feedback',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
