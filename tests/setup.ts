// テストプロセスには実APIの認証情報を持たせない。
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.VERCEL_OIDC_TOKEN;

const originalFetch = globalThis.fetch;

// モックを設定し忘れても外部APIには到達させない。アプリ自身への通信だけ許可する。
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    return Promise.reject(new Error(`テスト中の外部通信は禁止されています: ${url.origin}`));
  }
  return originalFetch(input, init);
};
