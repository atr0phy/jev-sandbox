import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, it, type TestContext } from 'node:test';
import { APICallError } from 'ai';
import { createEvaluationMock, questionReply } from '../../../tests/fixtures/evaluation.js';
import { TEST_PUZZLE } from '../../../tests/fixtures/puzzle.js';
import { publicGameSchema } from '../shared.js';
import { createApi } from './api.js';

const setup = async (context: TestContext) => {
  const evaluation = createEvaluationMock();
  const api = createApi({ model: evaluation.model, puzzles: [TEST_PUZZLE], threshold: 0.7 });
  const server = createServer((request, response) =>
    api(request, response, () => {
      response.writeHead(404).end();
    }),
  );
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown) =>
    fetch(`${url}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const response = await post('/games', {});
  assert.equal(response.status, 201);
  const game = publicGameSchema.parse(await response.json());
  return { evaluation, game, post, url };
};

describe('ゲームAPIのHTTP通信', () => {
  it('作成したゲームを取得でき、プレイ中の解答を公開しない', async (context) => {
    const { game, url, evaluation } = await setup(context);

    const response = await fetch(`${url}/api/games/${game.id}`);
    const body: unknown = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, game);
    assert.equal(JSON.stringify(body).includes(TEST_PUZZLE.solution), false);
    assert.equal(evaluation.calls.length, 0);
  });

  it('存在しないゲームの復元は404を返す', async (context) => {
    const { url, evaluation } = await setup(context);

    const response = await fetch(`${url}/api/games/expired-game`);

    assert.equal(response.status, 404);
    assert.equal(evaluation.calls.length, 0);
  });

  it('入力が不正なら400を返し、モデルを呼び出さない', async (context) => {
    const { game, post, evaluation } = await setup(context);

    const response = await post(`/games/${game.id}/question`, { text: ' ' });

    assert.equal(response.status, 400);
    assert.equal(evaluation.calls.length, 0);
  });

  it('JSON以外のリクエストは415を返す', async (context) => {
    const { game, url, evaluation } = await setup(context);

    const response = await fetch(`${url}/api/games/${game.id}/question`, {
      method: 'POST',
      body: 'not json',
    });

    assert.equal(response.status, 415);
    assert.equal(evaluation.calls.length, 0);
  });

  it('モデルの429を自動再試行せず、次のリクエストで再送できる', async (context) => {
    const { game, post, url, evaluation } = await setup(context);
    evaluation.enqueue(
      new APICallError({
        message: 'mock rate limit',
        url: 'https://mock.invalid/evaluate',
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      }),
      questionReply(),
    );

    const failed = await post(`/games/${game.id}/question`, { text: '確認できますか？' });

    assert.equal(failed.status, 429);
    assert.equal(evaluation.calls.length, 1);
    const current = publicGameSchema.parse(
      await (await fetch(`${url}/api/games/${game.id}`)).json(),
    );
    assert.equal(current.history.length, 0);
    const retry = await post(`/games/${game.id}/question`, { text: '確認できますか？' });
    assert.equal(retry.status, 200);
    assert.equal(publicGameSchema.parse(await retry.json()).history.length, 1);
    assert.equal(evaluation.calls.length, 2);
  });

  it('モデルのエラー詳細を利用者への応答に含めない', async (context) => {
    const { game, post, evaluation } = await setup(context);
    evaluation.enqueue(new Error('公開してはいけないテスト用の内部情報'));
    const log = context.mock.method(console, 'error', () => {});

    const response = await post(`/games/${game.id}/question`, { text: '確認できますか？' });
    const body = await response.text();

    assert.equal(response.status, 502);
    assert.equal(body.includes('公開してはいけない'), false);
    assert.equal(log.mock.callCount(), 1);
    assert.deepEqual(log.mock.calls[0].arguments, ['[soup] 判定に失敗:', 'Error']);
  });
});
