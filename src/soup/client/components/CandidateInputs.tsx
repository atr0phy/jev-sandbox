import { MAX_CANDIDATE_LENGTH, MAX_CANDIDATES } from '../../shared.js';

export type CandidateDraft = { id: string; text: string };

type CandidateInputsProps = {
  candidates: CandidateDraft[];
  disabled: boolean;
  onChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
};

const PLACEHOLDERS = ['職業', '場所', '持ち物', '人間関係', '時間'];

export const CandidateInputs = ({
  candidates,
  disabled,
  onChange,
  onRemove,
  onAdd,
}: CandidateInputsProps) => {
  return (
    <>
      <div className="form-label-row">
        <label className="form-label" htmlFor={candidates[0]?.id}>
          どの手掛かりを掘り下げますか？
        </label>
        <span>最大 {MAX_CANDIDATES} 個</span>
      </div>
      <p className="form-description">
        例：職業、天気、人間関係。候補が事実かどうかは、質問で確かめられます。
      </p>
      <div className="candidate-inputs">
        {candidates.map((candidate, index) => (
          <div className="candidate-input" key={candidate.id}>
            <span aria-hidden="true">{index + 1}</span>
            <input
              id={candidate.id}
              aria-label={`手掛かり ${index + 1}`}
              maxLength={MAX_CANDIDATE_LENGTH}
              placeholder={PLACEHOLDERS[index]}
              value={candidate.text}
              disabled={disabled}
              onChange={(event) => onChange(candidate.id, event.target.value)}
            />
            <button
              type="button"
              aria-label={`手掛かり ${index + 1} を削除`}
              disabled={disabled || candidates.length === 1}
              onClick={() => onRemove(candidate.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="text-button add-candidate"
        type="button"
        disabled={disabled || candidates.length >= MAX_CANDIDATES}
        onClick={onAdd}
      >
        ＋ 候補を追加
      </button>
      <p className="scale-note">関連度：0 関係なし → 3 核心に関係。正解の確率ではありません。</p>
    </>
  );
};
