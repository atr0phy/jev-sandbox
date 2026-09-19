import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZodError } from 'zod';
import {
  answerReply,
  createEvaluationMock,
  type EvaluationReply,
  questionReply,
  scoreReply,
} from '../../../tests/fixtures/evaluation.js';
import { TEST_PUZZLE } from '../../../tests/fixtures/puzzle.js';
import { createGameService, GameError } from './game.js';
import { createJudge } from './judge.js';

const setup = () => {
  const evaluation = createEvaluationMock();
  const service = createGameService(createJudge(evaluation.model), { puzzles: [TEST_PUZZLE] });
  const game = service.create();
  return { evaluation, service, game };
};

describe('ゲームの進行', () => {
  it('問題を一巡するまで重複させず、次の一巡も開始できる', () => {
    const evaluation = createEvaluationMock();
    const puzzles = Array.from({ length: 10 }, (_, index) => ({
      ...TEST_PUZZLE,
      id: `test-${index}`,
      title: `テスト用の謎 ${index}`,
    }));
    const service = createGameService(createJudge(evaluation.model), { puzzles });
    const games = Array.from({ length: puzzles.length }, () => service.create());

    assert.equal(new Set(games.map((game) => game.title)).size, puzzles.length);
    assert.equal(new Set(games.map((game) => game.id)).size, puzzles.length);
    assert.ok(service.create().id);
    assert.equal(evaluation.calls.length, 0);
  });

  it('プレイ中の公開データに解答や確定事実を含めない', async () => {
    const { evaluation, service, game } = setup();
    evaluation.enqueue(questionReply());

    const result = await service.act(game.id, 'question', { text: '確認できますか？' });

    assert.equal(result.reveal, undefined);
    for (const secret of [
      TEST_PUZZLE.solution,
      ...TEST_PUZZLE.facts,
      ...TEST_PUZZLE.requiredFacts,
    ]) {
      assert.equal(JSON.stringify(result).includes(secret), false);
    }
    assert.equal('puzzle' in result, false);
  });

  for (const [probability, status] of [
    [0.699, 'playing'],
    [0.7, 'solved'],
    [1, 'solved'],
  ] as const) {
    it(`正解確率${probability}では状態が${status}になる`, async () => {
      const { evaluation, service, game } = setup();
      evaluation.enqueue(answerReply(probability));

      const result = await service.act(game.id, 'answer', { text: 'テスト用の解答' });

      assert.equal(game.threshold, 0.7);
      assert.equal(result.status, status);
      assert.equal(result.reveal?.solution, status === 'solved' ? TEST_PUZZLE.solution : undefined);
      assert.equal(result.history.length, 1);
    });
  }

  it('解答公開はモデルを呼ばず、公開後は質問を受け付けない', async () => {
    const { evaluation, service, game } = setup();

    const revealed = await service.act(game.id, 'reveal', {});

    assert.equal(revealed.status, 'revealed');
    assert.equal(revealed.reveal?.solution, TEST_PUZZLE.solution);
    assert.equal(evaluation.calls.length, 0);
    await assert.rejects(
      service.act(game.id, 'question', { text: '確認できますか？' }),
      (error) => error instanceof GameError && error.status === 409,
    );
  });

  it('返した履歴が書き換えられても、保存済みの履歴には影響しない', async () => {
    const { evaluation, service, game } = setup();
    evaluation.enqueue(questionReply());
    const result = await service.act(game.id, 'question', { text: '確認できますか？' });

    result.history.length = 0;

    assert.equal(service.get(game.id).history.length, 1);
  });
});

describe('入力検証とモデル呼び出し', () => {
  const invalidCandidates = [
    { name: '空の候補', values: [] },
    { name: '空白だけの候補', values: [' '] },
    { name: '前後の空白を除くと重複する候補', values: ['重複', ' 重複 '] },
    { name: '6個の候補', values: ['1', '2', '3', '4', '5', '6'] },
  ];

  for (const { name, values } of invalidCandidates) {
    it(`${name}はモデルに送らない`, async () => {
      const { evaluation, service, game } = setup();

      await assert.rejects(service.act(game.id, 'explore', { candidates: values }), ZodError);

      assert.equal(evaluation.calls.length, 0);
      assert.equal(service.get(game.id).history.length, 0);
    });
  }

  it('空白だけの質問はモデルに送らない', async () => {
    const { evaluation, service, game } = setup();

    await assert.rejects(service.act(game.id, 'question', { text: '   ' }), ZodError);

    assert.equal(evaluation.calls.length, 0);
  });

  it('5候補を1回のモデル呼び出しで評価し、小数のスコアを保持する', async () => {
    const { evaluation, service, game } = setup();
    const candidates = ['職業', '場所', '道具', '人間関係', '目的'];
    const scores = [2.8, 0.2, 2.1, 1.4, 3];
    evaluation.enqueue(scoreReply(...scores));

    const result = await service.act(game.id, 'explore', { candidates });

    assert.equal(evaluation.calls.length, 1);
    assert.equal(Object.keys(evaluation.calls[0].questions).length, 5);
    const entry = result.history[0];
    assert.equal(entry.kind, 'explore');
    assert.ok(entry.kind === 'explore');
    assert.deepEqual(
      entry.candidates,
      candidates.map((text, index) => ({ text, score: scores[index] })),
    );
  });

  it('モデルの不正な応答を履歴に保存せず、再送できる', async () => {
    const { evaluation, service, game } = setup();
    evaluation.enqueue(questionReply('選択肢にない回答'), questionReply());

    await assert.rejects(service.act(game.id, 'question', { text: '確認できますか？' }));
    assert.equal(service.get(game.id).history.length, 0);

    const retry = await service.act(game.id, 'question', { text: '確認できますか？' });
    assert.equal(retry.history.length, 1);
  });
});

describe('競合と失敗からの復旧', () => {
  it('判定中の別操作を拒否し、判定失敗後にはロックを解除する', async () => {
    const { evaluation, service, game } = setup();
    let rejectPending!: (error: Error) => void;
    const pending = new Promise<EvaluationReply>((_resolve, reject) => {
      rejectPending = reject;
    });
    evaluation.enqueue(() => pending, questionReply());
    const first = service.act(game.id, 'question', { text: '確認できますか？' });
    const rejection = assert.rejects(first, /モデル接続エラー/);

    await assert.rejects(
      service.act(game.id, 'reveal', {}),
      (error) => error instanceof GameError && error.status === 409,
    );
    rejectPending(new Error('モデル接続エラー'));
    await rejection;

    assert.equal(service.get(game.id).history.length, 0);
    const retry = await service.act(game.id, 'question', { text: '確認できますか？' });
    assert.equal(retry.history.length, 1);
    assert.equal(evaluation.calls.length, 2);
  });
});
