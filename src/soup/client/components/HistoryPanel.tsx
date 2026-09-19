import { useEffect, useRef } from 'react';
import {
  type CandidateResult,
  type HistoryEntry,
  MAX_RELEVANCE_SCORE,
  QUESTION_LABELS,
  RELEVANCE_LABELS,
} from '../../shared.js';

const ENTRY_LABELS: Record<HistoryEntry['kind'], string> = {
  question: 'QUESTION',
  explore: 'EXPLORE',
  answer: 'ANSWER',
};

const CandidateResults = ({ candidates }: { candidates: CandidateResult[] }) => {
  return (
    <div className="candidate-results">
      {candidates.map((candidate) => (
        <div className="candidate-result" key={candidate.text}>
          <div className="candidate-caption">
            <strong>{candidate.text}</strong>
            <span>{RELEVANCE_LABELS[Math.round(candidate.score)]}</span>
            <b>
              {candidate.score.toFixed(1)}
              <small> / {MAX_RELEVANCE_SCORE}</small>
            </b>
          </div>
          <meter
            className="relevance-track"
            aria-label={`${candidate.text}の関連度`}
            value={candidate.score}
            min={0}
            max={MAX_RELEVANCE_SCORE}
          >
            {candidate.score.toFixed(1)} / {MAX_RELEVANCE_SCORE}
          </meter>
        </div>
      ))}
    </div>
  );
};

const EntryContent = ({ entry }: { entry: HistoryEntry }) => {
  switch (entry.kind) {
    case 'question':
      return (
        <>
          <p className="entry-text">{entry.text}</p>
          <span className={`verdict verdict-${entry.verdict}`}>
            {QUESTION_LABELS[entry.verdict]}
          </span>
          {entry.verdict === 'unknown' && (
            <p className="entry-note">この物語では、肯定・否定を判断する設定がありません。</p>
          )}
          {entry.verdict === 'invalid' && (
            <p className="entry-note">
              対象をはっきりさせて、はい・いいえで答えられる形にしてください。
            </p>
          )}
        </>
      );
    case 'explore':
      return <CandidateResults candidates={entry.candidates} />;
    case 'answer':
      return (
        <>
          <p className="entry-text">{entry.text}</p>
          <div className="answer-verdict">
            <span className={`verdict ${entry.correct ? 'verdict-yes' : 'verdict-unknown'}`}>
              {entry.correct ? '正解' : 'まだ解き明かせていません'}
            </span>
            <span>
              正解確率 <strong>{(entry.probability * 100).toFixed(1)}%</strong>
            </span>
          </div>
          {!entry.correct && (
            <p className="entry-note">
              出来事の理由や、手掛かり同士のつながりをもう一度考えてみましょう。
            </p>
          )}
        </>
      );
  }
};

const HistoryItem = ({ entry, index }: { entry: HistoryEntry; index: number }) => {
  return (
    <article className={`history-entry entry-${entry.kind}`}>
      <div className="entry-meta">
        <span className="entry-number">{String(index + 1).padStart(2, '0')}</span>
        <span>{ENTRY_LABELS[entry.kind]}</span>
        <span className="entry-time">判定 {(entry.elapsedMs / 1000).toFixed(2)} s</span>
      </div>
      <EntryContent entry={entry} />
    </article>
  );
};

export const HistoryPanel = ({ entries }: { entries: HistoryEntry[] }) => {
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = historyRef.current;
    if (element && entries.length > 0) element.scrollTop = element.scrollHeight;
  }, [entries]);

  return (
    <section className="notebook" aria-label="質問と回答の履歴">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR NOTES</span>
          <h2>推理の記録</h2>
        </div>
        <span className="count-badge">{entries.length} 件</span>
      </div>
      <div className="history-list" ref={historyRef} aria-live="polite" aria-relevant="additions">
        {entries.length === 0 ? (
          <div className="history-empty">
            <span className="empty-symbol" aria-hidden="true">
              ?
            </span>
            <h3>最初の問いが、糸口になる。</h3>
            <p>
              人物、場所、目的。気になったことから
              <br />
              ひとつずつ確かめてみましょう。
            </p>
          </div>
        ) : (
          entries.map((entry, index) => <HistoryItem key={entry.id} entry={entry} index={index} />)
        )}
      </div>
    </section>
  );
};
