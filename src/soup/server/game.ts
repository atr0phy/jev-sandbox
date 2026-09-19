import { randomInt, randomUUID } from 'node:crypto';
import {
  candidatesInputSchema,
  DEFAULT_SOLVE_THRESHOLD,
  gameActionSchema,
  type HistoryEntry,
  type PublicGame,
  textInputSchema,
} from '../shared.js';
import type { Judge } from './judge.js';
import { PUZZLES, type Puzzle } from './puzzles.js';

export class GameError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Game = {
  id: string;
  puzzle: Puzzle;
  createdAt: string;
  status: PublicGame['status'];
  history: HistoryEntry[];
  busy: boolean;
};

export type GameOptions = {
  threshold?: number;
  puzzles?: readonly Puzzle[];
};

function toPublicGame(game: Game, threshold: number): PublicGame {
  const result: PublicGame = {
    id: game.id,
    title: game.puzzle.title,
    words: [...game.puzzle.words],
    problem: game.puzzle.problem,
    createdAt: game.createdAt,
    status: game.status,
    threshold,
    history: structuredClone(game.history),
  };
  if (game.status !== 'playing') {
    result.reveal = {
      solution: game.puzzle.solution,
      requiredFacts: [...game.puzzle.requiredFacts],
    };
  }
  return result;
}

export function createGameService(
  judge: Judge,
  { threshold = DEFAULT_SOLVE_THRESHOLD, puzzles = PUZZLES }: GameOptions = {},
) {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error('SOLVE_THRESHOLDは0より大きく1以下の数値にしてください。');
  }
  if (puzzles.length === 0) throw new Error('問題を1問以上用意してください。');

  const games = new Map<string, Game>();
  let remaining: Puzzle[] = [];

  function getGame(id: string): Game {
    const game = games.get(id);
    if (!game) {
      throw new GameError(
        404,
        'ゲームが見つかりません。サーバーを再起動した場合は、新しい謎を始めてください。',
      );
    }
    return game;
  }

  function nextPuzzle(): Puzzle {
    // 一巡するまで重複させない。物語と履歴はサーバーのメモリに保持する。
    if (remaining.length === 0) remaining = [...puzzles];
    return remaining.splice(randomInt(remaining.length), 1)[0];
  }

  return {
    create(): PublicGame {
      const game: Game = {
        id: randomUUID(),
        puzzle: nextPuzzle(),
        createdAt: new Date().toISOString(),
        status: 'playing',
        history: [],
        busy: false,
      };
      games.set(game.id, game);
      return toPublicGame(game, threshold);
    },

    get(id: string): PublicGame {
      return toPublicGame(getGame(id), threshold);
    },

    async act(id: string, action: string, body: unknown): Promise<PublicGame> {
      const game = getGame(id);
      if (game.busy) throw new GameError(409, '前の判定が終わるまでお待ちください。');
      if (game.status !== 'playing') {
        throw new GameError(409, 'このゲームは終了しています。新しい謎を始めてください。');
      }
      const parsedAction = gameActionSchema.safeParse(action);
      if (!parsedAction.success) throw new GameError(404, '操作が見つかりません。');

      game.busy = true;
      const startedAt = performance.now();
      const entryMetadata = () => ({
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        elapsedMs: Math.round(performance.now() - startedAt),
      });

      try {
        switch (parsedAction.data) {
          case 'reveal':
            game.status = 'revealed';
            break;
          case 'explore': {
            const { candidates } = candidatesInputSchema.parse(body);
            const results = await judge.explore(game.puzzle, candidates);
            game.history.push({ ...entryMetadata(), kind: 'explore', candidates: results });
            break;
          }
          case 'question': {
            const { text } = textInputSchema.parse(body);
            const context = game.history.filter((entry) => entry.kind === 'question');
            const verdict = await judge.question(game.puzzle, text, context);
            game.history.push({ ...entryMetadata(), kind: 'question', text, verdict });
            break;
          }
          case 'answer': {
            const { text } = textInputSchema.parse(body);
            const probability = await judge.solve(game.puzzle, text);
            const correct = probability >= threshold;
            game.history.push({ ...entryMetadata(), kind: 'answer', text, probability, correct });
            if (correct) game.status = 'solved';
            break;
          }
        }
        return toPublicGame(game, threshold);
      } finally {
        game.busy = false;
      }
    },
  };
}
