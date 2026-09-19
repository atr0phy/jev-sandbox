import { apiErrorSchema, type GameCommand, type PublicGame, publicGameSchema } from '../shared.js';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path: string, signal: AbortSignal, body?: unknown): Promise<PublicGame> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const value: unknown = await response.json();

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(value);
    throw new ApiError(
      response.status,
      error.success ? error.data.error : '通信に失敗しました。もう一度お試しください。',
    );
  }

  const game = publicGameSchema.safeParse(value);
  if (!game.success) {
    throw new Error('サーバーからの応答を読み取れませんでした。もう一度お試しください。');
  }
  return game.data;
}

export const gameApi = {
  create: (signal: AbortSignal) => request('/games', signal, {}),
  restore: (id: string, signal: AbortSignal) => request(`/games/${encodeURIComponent(id)}`, signal),
  act: (id: string, command: GameCommand, signal: AbortSignal) =>
    request(`/games/${encodeURIComponent(id)}/${command.action}`, signal, command.body),
};
