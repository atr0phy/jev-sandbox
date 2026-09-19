import { EndingCard } from './components/EndingCard.js';
import { GameComposer } from './components/GameComposer.js';
import { HistoryPanel } from './components/HistoryPanel.js';
import { SoupArt } from './components/SoupArt.js';
import { StoryPanel } from './components/StoryPanel.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { useGame } from './use-game.js';

const App = () => {
  const { game, pending, error, busy, startGame, sendCommand, dismissError } = useGame();

  function handleStart() {
    void startGame();
  }

  function handleReveal() {
    void sendCommand({ action: 'reveal', body: {} });
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <SoupArt small />
          <div>
            <span className="brand-name">
              SOUP ROOM<span className="brand-dot">.</span>
            </span>
            <span className="brand-sub">物語の裏側を見つける、水平思考ゲーム</span>
          </div>
        </div>
        {game && (
          <button
            type="button"
            className="button button-quiet"
            disabled={busy}
            onClick={handleStart}
          >
            <span aria-hidden="true">↻</span> 新しい謎
          </button>
        )}
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="エラー表示を閉じる" onClick={dismissError}>
            ×
          </button>
        </div>
      )}

      {game ? (
        // 新しいゲームでは、子コンポーネントの下書きや確認状態も作り直す。
        <main className="game-layout" key={game.id}>
          <StoryPanel game={game} busy={busy} onReveal={handleReveal} />
          <div className="investigation-column">
            <HistoryPanel entries={game.history} />
            {game.reveal ? (
              <EndingCard
                reveal={game.reveal}
                solved={game.status === 'solved'}
                busy={busy}
                onNext={handleStart}
              />
            ) : (
              <GameComposer threshold={game.threshold} pending={pending} onSubmit={sendCommand} />
            )}
          </div>
        </main>
      ) : (
        <WelcomeScreen busy={busy} onStart={handleStart} />
      )}

      <footer className="site-footer">
        <span>SOUP ROOM — STAY CURIOUS.</span>
        <span>思い込みを、ひとさじほどいて。</span>
      </footer>
    </div>
  );
};

export default App;
