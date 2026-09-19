import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  answerReply,
  createEvaluationMock,
  questionReply,
  scoreReply,
} from '../../../tests/fixtures/evaluation.js';
import { TEST_PUZZLE } from '../../../tests/fixtures/puzzle.js';
import type { QuestionEntry } from '../shared.js';
import { createJudge } from './judge.js';

describe('JEVへの評価依頼', () => {
  it('固定した問題と解答をstateに保ち、直近4件だけを質問の文脈に渡す', async () => {
    const evaluation = createEvaluationMock();
    evaluation.enqueue(questionReply('yes'));
    const judge = createJudge(evaluation.model);
    const context: QuestionEntry[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index),
      kind: 'question',
      text: `過去の質問${index}`,
      verdict: 'unknown',
      createdAt: '2026-01-01T00:00:00.000Z',
      elapsedMs: 10,
    }));

    const verdict = await judge.question(TEST_PUZZLE, '今回の質問ですか？', context);

    assert.equal(verdict, 'yes');
    const call = evaluation.calls[0];
    assert.deepEqual(call.state, {
      problem: TEST_PUZZLE.problem,
      solution: TEST_PUZZLE.solution,
      facts: TEST_PUZZLE.facts,
      requiredFacts: TEST_PUZZLE.requiredFacts,
    });
    const instructions = call.questions.reply.instructions;
    assert.ok(
      typeof instructions === 'object' &&
        instructions !== null &&
        'question' in instructions &&
        'recentQuestions' in instructions,
    );
    assert.equal(instructions.question, '今回の質問ですか？');
    assert.deepEqual(
      instructions.recentQuestions,
      context.slice(-4).map((entry) => ({
        question: entry.text,
        answer: entry.verdict,
      })),
    );
  });

  it('候補を独立したscoreの質問として送り、結果を元の順番に対応付ける', async () => {
    const evaluation = createEvaluationMock();
    evaluation.enqueue(scoreReply(0.2, 2.8));
    const judge = createJudge(evaluation.model);

    const result = await judge.explore(TEST_PUZZLE, ['候補A', '候補B']);

    assert.deepEqual(result, [
      { text: '候補A', score: 0.2 },
      { text: '候補B', score: 2.8 },
    ]);
    assert.deepEqual(
      Object.values(evaluation.calls[0].questions).map((question) => question.type),
      ['score', 'score'],
    );
  });

  it('正解判定にはbooleanの確率をそのまま使う', async () => {
    const evaluation = createEvaluationMock();
    evaluation.enqueue(answerReply(0.725));
    const judge = createJudge(evaluation.model);

    assert.equal(await judge.solve(TEST_PUZZLE, 'テスト用の解答'), 0.725);
    assert.equal(evaluation.calls[0].questions.isSolved.type, 'boolean');
  });
});
