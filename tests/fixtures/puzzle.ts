import type { Puzzle } from '../../src/soup/server/puzzles.js';

// 本番の10問とは無関係なデータ。失敗ログや画面キャプチャにも本番の解答を出さない。
export const TEST_PUZZLE: Puzzle = {
  id: 'test-puzzle',
  title: 'テスト用の謎',
  words: ['テスト', '確認'],
  problem: 'これは画面とゲーム進行の検証に使う架空の問題です。',
  solution: 'これはテスト専用の解答です。',
  facts: ['テスト専用の確定事実です。'],
  requiredFacts: ['テスト専用の正解条件です。'],
};
