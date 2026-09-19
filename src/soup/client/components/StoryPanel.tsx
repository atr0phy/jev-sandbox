import { useState } from 'react';
import type { PublicGame } from '../../shared.js';

type StoryPanelProps = {
  game: PublicGame;
  busy: boolean;
  onReveal: () => void;
};

const STATUS_LABELS: Record<PublicGame['status'], string> = {
  playing: '推理中',
  solved: '解決',
  revealed: '解答公開',
};

const RevealControl = ({ busy, onReveal }: Pick<StoryPanelProps, 'busy' | 'onReveal'>) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="reveal-control">
      {confirming ? (
        <div className="reveal-confirm">
          <p>この謎を終了して、解答を表示します。</p>
          <div>
            <button
              type="button"
              className="button button-quiet"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              戻る
            </button>
            <button type="button" className="button button-dark" disabled={busy} onClick={onReveal}>
              解答を開く
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          行き詰まったら、答えを見る <span aria-hidden="true">↗</span>
        </button>
      )}
    </div>
  );
};

export const StoryPanel = ({ game, busy, onReveal }: StoryPanelProps) => {
  const questionCount = game.history.filter((entry) => entry.kind === 'question').length;
  const candidateCount = game.history.reduce(
    (total, entry) => total + (entry.kind === 'explore' ? entry.candidates.length : 0),
    0,
  );

  return (
    <aside className="story-column">
      <section className="story-card">
        <div className="story-topline">
          <span className="eyebrow">THE MYSTERY</span>
          <span className={`status-dot ${game.status !== 'playing' ? 'finished' : ''}`}>
            {STATUS_LABELS[game.status]}
          </span>
        </div>
        <div className="word-pair">
          <span>{game.words[0]}</span>
          <b>×</b>
          <span>{game.words[1]}</span>
        </div>
        <h1>{game.title}</h1>
        <p className="story-text">{game.problem}</p>
        <div className="story-rule" />
        <p className="story-prompt">
          この出来事の、
          <br />
          <strong>見えていない理由は？</strong>
        </p>
        <div className="story-decoration" aria-hidden="true">
          ?
        </div>
      </section>
      <div className="session-stats">
        <div>
          <strong>{String(questionCount).padStart(2, '0')}</strong>
          <span>質問</span>
        </div>
        <div>
          <strong>{String(candidateCount).padStart(2, '0')}</strong>
          <span>調べた手掛かり</span>
        </div>
        <span className="session-label">YOUR INVESTIGATION</span>
      </div>
      {game.status === 'playing' && (
        // 質問や解答の送信に成功したら、公開の確認を閉じる。
        <RevealControl key={game.history.length} busy={busy} onReveal={onReveal} />
      )}
    </aside>
  );
};
