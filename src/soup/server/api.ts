import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Experimental_EvaluationModel as EvaluationModel } from 'ai';
import { DEFAULT_SOLVE_THRESHOLD } from '../shared.js';
import { createGameService, GameError, type GameOptions } from './game.js';
import { readJsonBody, sendError, sendJson } from './http.js';
import { createJudge } from './judge.js';

type ApiOptions = GameOptions & { model?: EvaluationModel };

export function createApi({ model, puzzles, threshold: providedThreshold }: ApiOptions = {}) {
  const threshold =
    providedThreshold ??
    (process.env.SOLVE_THRESHOLD === undefined
      ? DEFAULT_SOLVE_THRESHOLD
      : Number(process.env.SOLVE_THRESHOLD));
  const service = createGameService(createJudge(model), { threshold, puzzles });

  async function handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string) {
    if (pathname === '/api/games' && req.method === 'POST') {
      await readJsonBody(req);
      sendJson(res, 201, service.create());
      return;
    }

    const match = /^\/api\/games\/([a-zA-Z0-9-]+)(?:\/(question|explore|answer|reveal))?$/.exec(
      pathname,
    );
    if (!match) throw new GameError(404, '操作が見つかりません。');
    const [, id, action] = match;

    if (req.method === 'GET' && !action) {
      sendJson(res, 200, service.get(id));
      return;
    }
    if (req.method === 'POST' && action) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.act(id, action, body));
      return;
    }
    throw new GameError(405, 'この操作には対応していません。');
  }

  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!pathname.startsWith('/api/')) {
      next();
      return;
    }
    void handleRequest(req, res, pathname).catch((error) => sendError(res, error));
  };
}
