import type { Page } from '@playwright/test';
import { APICallError } from 'ai';
import { expect, test } from './fixtures/app.js';
import { answerReply, questionReply, scoreReply } from './fixtures/evaluation.js';
import { TEST_PUZZLE } from './fixtures/puzzle.js';

const startGame = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: '謎をはじめる' }).click();
  await expect(page.getByRole('heading', { name: TEST_PUZZLE.title, exact: true })).toBeVisible();
};

test('質問、候補比較、再読み込み、解答まで実際のゲームAPIで進められる', async ({ page, app }) => {
  app.evaluation.enqueue(
    questionReply(),
    scoreReply(2.8, 0.2, 2.1, 1.4, 3),
    answerReply(0.699),
    answerReply(0.7),
  );

  await test.step('質問の回答を履歴に表示する', async () => {
    await startGame(page);
    await expect(page.getByText(TEST_PUZZLE.solution, { exact: true })).toHaveCount(0);
    await page.getByLabel('何を確かめますか？').fill('確認できますか？');
    await page.getByRole('button', { name: '質問を送る' }).click();
    await expect(page.getByText('設定上不明', { exact: true })).toBeVisible();
  });

  await test.step('5候補を比較し、再読み込み後も履歴を保持する', async () => {
    await page.getByRole('button', { name: '手掛かりを比べる', exact: true }).click();
    await page.getByRole('button', { name: '候補を追加' }).click();
    await page.getByRole('button', { name: '候補を追加' }).click();
    await expect(page.getByRole('button', { name: '候補を追加' })).toBeDisabled();
    for (const [index, value] of ['職業', '場所', '道具', '人間関係', '目的'].entries()) {
      await page.getByLabel(`手掛かり ${index + 1}`, { exact: true }).fill(value);
    }
    await page.getByRole('button', { name: '関連度を調べる' }).click();
    await expect(page.getByRole('meter')).toHaveCount(5);
    await expect(page.getByRole('meter', { name: '職業の関連度' })).toHaveAttribute('value', '2.8');
    await page.reload();
    await expect(page.getByRole('meter')).toHaveCount(5);
    await expect(page.getByText('確認できますか？', { exact: true })).toBeVisible();
  });

  await test.step('70%未満は続行し、70%で解答を公開する', async () => {
    await page.getByRole('button', { name: '解答する', exact: true }).click();
    const answer = page.getByLabel('出来事の理由を説明してください。');
    await answer.fill('最初のテスト解答');
    await page.getByRole('button', { name: 'この解答で挑戦' }).click();
    await expect(page.getByText('まだ解き明かせていません')).toBeVisible();
    await expect(page.getByText(TEST_PUZZLE.solution, { exact: true })).toHaveCount(0);
    await answer.fill('次のテスト解答');
    await page.getByRole('button', { name: 'この解答で挑戦' }).click();
    await expect(page.getByRole('heading', { name: '謎が、ほどけました。' })).toBeVisible();
    await expect(page.getByText(TEST_PUZZLE.solution, { exact: true })).toBeVisible();
    expect(app.evaluation.calls).toHaveLength(4);
  });

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

for (const status of [429, 502]) {
  test(`判定APIの${status}で入力を失わず、手動で再送できる`, async ({ page, app }) => {
    app.evaluation.enqueue(
      new APICallError({
        message: 'テスト用の判定エラー',
        url: 'https://mock.invalid/evaluate',
        requestBodyValues: {},
        statusCode: status,
        isRetryable: true,
      }),
      questionReply(),
    );
    await startGame(page);
    const question = page.getByLabel('何を確かめますか？');
    await question.fill('再送する質問ですか？');

    await page.getByRole('button', { name: '質問を送る' }).click();

    await expect(page.getByRole('alert')).toContainText(status === 429 ? '利用制限' : '判定に失敗');
    await expect(question).toHaveValue('再送する質問ですか？');
    expect(app.evaluation.calls).toHaveLength(1);
    await page.getByRole('button', { name: '質問を送る' }).click();
    await expect(page.getByText('設定上不明', { exact: true })).toBeVisible();
    await expect(question).toHaveValue('');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(app.evaluation.calls).toHaveLength(2);
  });
}

test('明示的に解答を公開し、次のゲームを始められる', async ({ page, app }) => {
  await startGame(page);

  await page.getByRole('button', { name: '行き詰まったら、答えを見る' }).click();
  await expect(page.getByText(TEST_PUZZLE.solution, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '解答を開く' }).click();

  await expect(page.getByRole('heading', { name: '物語の裏側。', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '謎が、ほどけました。' })).toHaveCount(0);
  await expect(page.getByText(TEST_PUZZLE.solution, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '次の謎へ' }).click();
  await expect(page.getByLabel('何を確かめますか？')).toHaveValue('');
  await expect(page.getByText(TEST_PUZZLE.solution, { exact: true })).toHaveCount(0);
  expect(app.evaluation.calls).toHaveLength(0);
});

test('保存済みのゲームが消えていたら、案内エラーを出さず開始画面に戻る', async ({ page, app }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('soup-room.game-id', 'expired-game'));

  await page.reload();

  await expect(page.getByRole('button', { name: '謎をはじめる' })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('soup-room.game-id')))
    .toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: '謎をはじめる' })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(app.evaluation.calls).toHaveLength(0);
});

test('新しい謎に切り替えると入力の下書きをリセットする', async ({ page }) => {
  await startGame(page);
  await page.getByLabel('何を確かめますか？').fill('前のゲームの下書き');
  const previousId = await page.evaluate(() => localStorage.getItem('soup-room.game-id'));

  await page.getByRole('button', { name: '新しい謎' }).click();

  await expect(page.getByLabel('何を確かめますか？')).toHaveValue('');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('soup-room.game-id')))
    .not.toBe(previousId);
});
