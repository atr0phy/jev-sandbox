import { z } from 'zod';

export const MAX_CANDIDATES = 5;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_CANDIDATE_LENGTH = 120;
export const MAX_RELEVANCE_SCORE = 3;
export const DEFAULT_SOLVE_THRESHOLD = 0.7;

const verdictSchema = z.enum(['yes', 'no', 'unknown', 'invalid']);
export type Verdict = z.infer<typeof verdictSchema>;

export const QUESTION_LABELS: Record<Verdict, string> = {
  yes: 'はい',
  no: 'いいえ',
  unknown: '設定上不明',
  invalid: '質問を言い換えてください',
};

export const RELEVANCE_LABELS = ['関係なし', '背景に関係', '重要な要素', '核心に関係'] as const;

export const gameActionSchema = z.enum(['question', 'explore', 'answer', 'reveal']);
export type GameAction = z.infer<typeof gameActionSchema>;

export const textInputSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});

export const candidatesInputSchema = z.object({
  candidates: z
    .array(z.string().trim().min(1).max(MAX_CANDIDATE_LENGTH))
    .min(1)
    .max(MAX_CANDIDATES)
    .refine((values) => new Set(values).size === values.length, '候補が重複しています'),
});

// 操作名と、その操作が受け取る入力を一組として扱う。
export type GameCommand =
  | { action: 'question' | 'answer'; body: z.infer<typeof textInputSchema> }
  | { action: 'explore'; body: z.infer<typeof candidatesInputSchema> }
  | { action: 'reveal'; body: Record<string, never> };

const candidateResultSchema = z.object({
  text: z.string(),
  score: z.number().min(0).max(MAX_RELEVANCE_SCORE),
});
export type CandidateResult = z.infer<typeof candidateResultSchema>;

const entryBase = {
  id: z.string(),
  createdAt: z.string(),
  elapsedMs: z.number().nonnegative(),
};

const questionEntrySchema = z.object({
  ...entryBase,
  kind: z.literal('question'),
  text: z.string(),
  verdict: verdictSchema,
});
export type QuestionEntry = z.infer<typeof questionEntrySchema>;

const historyEntrySchema = z.discriminatedUnion('kind', [
  questionEntrySchema,
  z.object({
    ...entryBase,
    kind: z.literal('explore'),
    candidates: z.array(candidateResultSchema),
  }),
  z.object({
    ...entryBase,
    kind: z.literal('answer'),
    text: z.string(),
    probability: z.number().min(0).max(1),
    correct: z.boolean(),
  }),
]);
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

// 通信境界で検証する公開データ。問題の確定事実や非公開の正解条件は含めない。
export const publicGameSchema = z.object({
  id: z.string(),
  title: z.string(),
  words: z.tuple([z.string(), z.string()]),
  problem: z.string(),
  createdAt: z.string(),
  status: z.enum(['playing', 'solved', 'revealed']),
  threshold: z.number().gt(0).max(1),
  history: z.array(historyEntrySchema),
  reveal: z
    .object({
      solution: z.string(),
      requiredFacts: z.array(z.string()),
    })
    .optional(),
});
export type PublicGame = z.infer<typeof publicGameSchema>;

export const apiErrorSchema = z.object({ error: z.string() });
