import { useEffect, useRef, useState } from 'react';
import type { GameAction, GameCommand, PublicGame } from '../shared.js';
import { ApiError, gameApi } from './api.js';
import { clearSavedGameId, readSavedGameId, saveGameId } from './game-storage.js';

export type PendingOperation = GameAction | 'create' | 'restore';

type SessionState = {
  game: PublicGame | null;
  pending: PendingOperation | null;
  error: string | null;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useGame() {
  const [savedGameId] = useState(readSavedGameId);
  const [session, setSession] = useState<SessionState>({
    game: null,
    pending: savedGameId ? 'restore' : null,
    error: null,
  });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!savedGameId) return;
    const controller = new AbortController();
    activeRequest.current = controller;

    async function restoreGame(id: string) {
      try {
        const game = await gameApi.restore(id, controller.signal);
        if (!controller.signal.aborted) {
          setSession({ game, pending: null, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const missingGame = error instanceof ApiError && error.status === 404;
          // 消えたゲームのIDだけ削除する。通信失敗時は再試行のために残す。
          if (missingGame) clearSavedGameId();
          setSession({
            game: null,
            pending: null,
            error: missingGame ? null : errorMessage(error, 'ゲームを復元できませんでした。'),
          });
        }
      } finally {
        if (activeRequest.current === controller) activeRequest.current = null;
      }
    }

    void restoreGame(savedGameId);
    return () => controller.abort();
  }, [savedGameId]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function runRequest(
    pending: Exclude<PendingOperation, 'restore'>,
    loadGame: (signal: AbortSignal) => Promise<PublicGame>,
  ): Promise<boolean> {
    // stateの再描画より前に続けて操作された場合も、二重送信を防ぐ。
    if (activeRequest.current || session.pending) return false;
    const controller = new AbortController();
    activeRequest.current = controller;
    setSession((current) => ({ ...current, pending, error: null }));

    try {
      const game = await loadGame(controller.signal);
      if (controller.signal.aborted) return false;
      saveGameId(game.id);
      setSession({ game, pending: null, error: null });
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        setSession((current) => ({
          ...current,
          pending: null,
          error: errorMessage(error, '通信に失敗しました。'),
        }));
      }
      return false;
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  function startGame() {
    return runRequest('create', gameApi.create);
  }

  function sendCommand(command: GameCommand): Promise<boolean> {
    const game = session.game;
    if (game?.status !== 'playing') return Promise.resolve(false);
    return runRequest(command.action, (signal) => gameApi.act(game.id, command, signal));
  }

  function dismissError() {
    setSession((current) => ({ ...current, error: null }));
  }

  return { ...session, busy: session.pending !== null, startGame, sendCommand, dismissError };
}
