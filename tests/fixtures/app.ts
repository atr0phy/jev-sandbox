import { test as base, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createApi } from '../../src/soup/server/api.js';
import { createViteConfig } from '../../vite.config.mjs';
import { createEvaluationMock } from './evaluation.js';
import { TEST_PUZZLE } from './puzzle.js';

type App = {
  url: string;
  evaluation: ReturnType<typeof createEvaluationMock>;
};

export const test = base.extend<{ app: App }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwrightはfixtureの依存関係を分割代入の引数で指定する。
  app: async ({}, use) => {
    const evaluation = createEvaluationMock();
    const api = createApi({ model: evaluation.model, puzzles: [TEST_PUZZLE], threshold: 0.7 });
    const config = createViteConfig(api);
    const server = await createServer({
      ...config,
      configFile: false,
      clearScreen: false,
      logLevel: 'error',
      server: { ...config.server, port: 0, hmr: false },
    });
    try {
      await server.listen();
      const url = server.resolvedUrls?.local[0];
      if (!url) throw new Error('テスト用サーバーのURLを取得できませんでした。');
      await use({ url, evaluation });
    } finally {
      await server.close();
    }
  },
  baseURL: async ({ app }, use) => {
    await use(app.url);
  },
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors, 'ブラウザーで未処理のエラーが発生していないこと').toEqual([]);
  },
});

export { expect } from '@playwright/test';
