import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import { type GameCommand, MAX_CANDIDATES, MAX_TEXT_LENGTH } from '../../shared.js';
import type { PendingOperation } from '../use-game.js';
import { type CandidateDraft, CandidateInputs } from './CandidateInputs.js';

type Mode = Exclude<GameCommand['action'], 'reveal'>;
type GameComposerProps = {
  threshold: number;
  pending: PendingOperation | null;
  onSubmit: (command: GameCommand) => Promise<boolean>;
};

const MODES: { id: Mode; label: string; symbol: string }[] = [
  { id: 'question', label: '質問する', symbol: '?' },
  { id: 'explore', label: '手掛かりを比べる', symbol: '≋' },
  { id: 'answer', label: '解答する', symbol: '↗' },
];

const SUBMIT_LABELS: Record<Mode, string> = {
  question: '質問を送る',
  explore: '関連度を調べる',
  answer: 'この解答で挑戦',
};

const PENDING_LABELS: Record<PendingOperation, string> = {
  question: '確かめています',
  explore: '手掛かりをまとめて評価中',
  answer: '真相と照らし合わせています',
  reveal: '確かめています',
  create: '謎を準備しています',
  restore: '謎を復元しています',
};

const PendingStatus = ({ operation }: { operation: PendingOperation }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed((performance.now() - started) / 1000), 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <span className="spinner" /> {PENDING_LABELS[operation]}
      <span className="elapsed">{elapsed.toFixed(1)}s</span>
    </>
  );
};

function newCandidate(): CandidateDraft {
  return { id: crypto.randomUUID(), text: '' };
}

function initialCandidates(): CandidateDraft[] {
  return Array.from({ length: 3 }, newCandidate);
}

export const GameComposer = ({ threshold, pending, onSubmit }: GameComposerProps) => {
  const [mode, setMode] = useState<Mode>('question');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [candidates, setCandidates] = useState(initialCandidates);
  const busy = pending !== null;
  const hasInput = {
    question: question.trim().length > 0,
    answer: answer.trim().length > 0,
    explore: candidates.some((candidate) => candidate.text.trim().length > 0),
  };
  const canSubmit = !busy && hasInput[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    // 成功した入力だけを消す。通信失敗や利用制限時には下書きを残す。
    switch (mode) {
      case 'question':
        if (await onSubmit({ action: 'question', body: { text: question } })) setQuestion('');
        break;
      case 'answer':
        if (await onSubmit({ action: 'answer', body: { text: answer } })) setAnswer('');
        break;
      case 'explore': {
        const values = candidates.map((candidate) => candidate.text.trim()).filter(Boolean);
        if (await onSubmit({ action: 'explore', body: { candidates: values } })) {
          setCandidates(initialCandidates());
        }
        break;
      }
    }
  }

  function handleShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key !== 'Enter' ||
      (!event.ctrlKey && !event.metaKey) ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (canSubmit) event.currentTarget.requestSubmit();
  }

  function updateCandidate(id: string, text: string) {
    setCandidates((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, text } : candidate)),
    );
  }

  function removeCandidate(id: string) {
    setCandidates((current) =>
      current.length > 1 ? current.filter((candidate) => candidate.id !== id) : current,
    );
  }

  function addCandidate() {
    const candidate = newCandidate();
    setCandidates((current) =>
      current.length < MAX_CANDIDATES ? [...current, candidate] : current,
    );
  }

  return (
    <section className="composer" aria-label="推理を進める">
      <fieldset className="mode-switch" aria-label="入力の種類">
        {MODES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={mode === item.id ? 'active' : ''}
            aria-pressed={mode === item.id}
            disabled={busy}
            onClick={() => setMode(item.id)}
          >
            <span aria-hidden="true">{item.symbol}</span>
            {item.label}
          </button>
        ))}
      </fieldset>
      <form onSubmit={(event) => void submit(event)} onKeyDown={handleShortcut}>
        {mode === 'question' && (
          <>
            <label className="form-label" htmlFor="question">
              何を確かめますか？
            </label>
            <p className="form-description">はい・いいえで答えられる質問を、ひとつずつ。</p>
            <textarea
              id="question"
              placeholder="例：その人は仕事中でしたか？"
              maxLength={MAX_TEXT_LENGTH}
              rows={3}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={busy}
            />
          </>
        )}
        {mode === 'explore' && (
          <CandidateInputs
            candidates={candidates}
            disabled={busy}
            onChange={updateCandidate}
            onRemove={removeCandidate}
            onAdd={addCandidate}
          />
        )}
        {mode === 'answer' && (
          <>
            <label className="form-label" htmlFor="answer">
              出来事の理由を説明してください。
            </label>
            <p className="form-description">
              手掛かりをつなげて、自分の言葉で。言い回しが同じでなくても大丈夫。
            </p>
            <textarea
              id="answer"
              placeholder="私の考えた真相は…"
              maxLength={MAX_TEXT_LENGTH}
              rows={4}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={busy}
            />
            <p className="scale-note">
              正解と見込む確率が{Math.round(threshold * 100)}
              %以上でクリア。文章の一致率ではありません。
            </p>
          </>
        )}
        <div className="form-footer">
          <span className="send-status" role="status">
            {pending ? (
              <PendingStatus key={pending} operation={pending} />
            ) : (
              <span className="shortcut">Ctrl / ⌘ ＋ Enter で送信</span>
            )}
          </span>
          <button
            className={`button ${mode === 'answer' ? 'button-primary' : 'button-dark'}`}
            type="submit"
            disabled={!canSubmit}
          >
            {SUBMIT_LABELS[mode]}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
    </section>
  );
};
