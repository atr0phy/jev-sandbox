import { MAX_CANDIDATES } from '../../shared.js';
import { SoupArt } from './SoupArt.js';

type WelcomeScreenProps = {
  busy: boolean;
  onStart: () => void;
};

export const WelcomeScreen = ({ busy, onStart }: WelcomeScreenProps) => {
  return (
    <main className="welcome">
      <div className="welcome-copy">
        <span className="eyebrow">A LITTLE MYSTERY, A DIFFERENT PERSPECTIVE</span>
        <h1>
          見えているのは、
          <br />
          物語の<span className="welcome-title-accent">半分。</span>
        </h1>
        <p>
          ふたつの言葉から生まれた、不思議な出来事。
          <br />
          質問を重ね、手掛かりをつなげて、その理由を解き明かそう。
        </p>
        <button
          type="button"
          className="button button-primary button-large"
          onClick={onStart}
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="spinner" /> 謎を準備しています
            </>
          ) : (
            <>
              謎をはじめる <span aria-hidden="true">↗</span>
            </>
          )}
        </button>
        <span className="welcome-note">10の物語から、ランダムにひとつ。</span>
      </div>
      <div className="welcome-visual">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <SoupArt />
        <span className="floating-word word-one">なぜ？</span>
        <span className="floating-word word-two">もしも。</span>
        <span className="visual-caption">SOMETHING IS HIDDEN IN THE SOUP.</span>
      </div>
      <div className="how-to">
        <div>
          <span>01 / ASK</span>
          <h2>問いかける</h2>
          <p>「はい・いいえ」で答えられる質問で、事実を確かめる。</p>
        </div>
        <div>
          <span>02 / EXPLORE</span>
          <h2>手掛かりを比べる</h2>
          <p>気になる話題を最大{MAX_CANDIDATES}つ。核心との関連度をまとめて調べる。</p>
        </div>
        <div>
          <span>03 / SOLVE</span>
          <h2>物語をつなぐ</h2>
          <p>なぜそうなったのか、自分の言葉で解答する。</p>
        </div>
      </div>
    </main>
  );
};
