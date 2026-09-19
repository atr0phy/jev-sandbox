import type { PublicGame } from '../../shared.js';

type EndingCardProps = {
  reveal: NonNullable<PublicGame['reveal']>;
  solved: boolean;
  busy: boolean;
  onNext: () => void;
};

export const EndingCard = ({ reveal, solved, busy, onNext }: EndingCardProps) => {
  return (
    <section className={`ending-card ${solved ? 'solved' : ''}`} aria-live="polite">
      <span className="eyebrow">{solved ? 'MYSTERY SOLVED' : 'BEHIND THE STORY'}</span>
      <h2>{solved ? '謎が、ほどけました。' : '物語の裏側。'}</h2>
      <p>{reveal.solution}</p>
      <div className="key-facts">
        <h3>解答のポイント</h3>
        <ul>
          {reveal.requiredFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>
      <button type="button" className="button button-primary" onClick={onNext} disabled={busy}>
        次の謎へ <span aria-hidden="true">↗</span>
      </button>
    </section>
  );
};
