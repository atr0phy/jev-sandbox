const STORAGE_KEY = 'soup-room.game-id';

export function readSavedGameId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveGameId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ストレージを使えないブラウザーでも、そのまま遊べる。
  }
}

export function clearSavedGameId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ストレージを使えないブラウザーでも、開始画面へ戻れるようにする。
  }
}
