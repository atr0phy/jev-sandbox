import { Experimental_EvaluationMockModelV4 as EvaluationMockModel } from 'ai/test';

export type EvaluationCall = Parameters<EvaluationMockModel['doEvaluate']>[0];
export type EvaluationReply = Awaited<ReturnType<EvaluationMockModel['doEvaluate']>>;
type EvaluationStep = (call: EvaluationCall) => EvaluationReply | Promise<EvaluationReply>;

// 差し替えるのはモデル呼び出しだけ。judge・AI SDKの入力/出力検証は本物を通す。
export const createEvaluationMock = () => {
  const calls: EvaluationCall[] = [];
  const steps: EvaluationStep[] = [];
  const model = new EvaluationMockModel({
    doEvaluate: async (call) => {
      calls.push(structuredClone({ ...call, abortSignal: undefined }));
      const step = steps.shift();
      if (!step) throw new Error('このモデル呼び出しのモック応答が設定されていません。');
      return step(call);
    },
  });

  return {
    model,
    calls,
    enqueue: (...next: (EvaluationReply | Error | EvaluationStep)[]) => {
      for (const item of next) {
        steps.push(async (call) => {
          if (item instanceof Error) throw item;
          return typeof item === 'function' ? item(call) : item;
        });
      }
    },
  };
};

export const questionReply = (choice = 'unknown'): EvaluationReply => ({
  answers: { reply: { type: 'choice', choice } },
  warnings: [],
});

export const scoreReply = (...scores: number[]): EvaluationReply => ({
  answers: Object.fromEntries(
    scores.map((score, index) => [`candidate_${index}`, { type: 'score', score }]),
  ),
  warnings: [],
});

export const answerReply = (probability: number): EvaluationReply => ({
  answers: { isSolved: { type: 'boolean', probability } },
  warnings: [],
});
