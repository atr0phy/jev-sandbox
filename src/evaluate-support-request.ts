import {experimental_evaluate as evaluate } from "ai";

const escalate = async (
    department: string,
    severityScore: number,
): Promise<void> => {
    console.log(department, severityScore);
}

(async () => {
    const result = await evaluate({
        model: 'typesafe-ai/jev',
        // string以外にもObjectも渡せる
        state: {
            inquiry: {
                subject: '決済エラーが発生している',
                message: 'エラーコード107が表示されています。リクエストIDは`1687847f-cde9-4e02-922a-a817fc1f5105`です。',
            },
            customer: {
                plan: 'enterprise',
                previousContactsForSameIssue: 2,
            }
        },
        questions: {
            department: {
                // 選ばれたcriteriaのいずれかが返される
                type: 'choice',
                instructions: 'この問い合わせを担当するべき部署は？',
                criteria: {
                    billing: '支払い・請求・返金に関する問い合わせ',
                    technical: 'システムの不具合・障害に関する問い合わせ',
                    sales: '料金プラン・新規契約に関する問い合わせ',
                },
            },
            severity: {
                // 評価基準に基づいて算出されたスコアが返される(なので少数を含む)
                type: 'score',
                instructions: 'この問い合わせの深刻度は？',
                criteria: [
                    '影響なし',           // 0
                    '軽微な影響',         // 1
                    '業務に支障がある',    // 2
                    '業務を継続できない',  // 3
                ],
            },
            requiresHumanEscalation: {
                // trueである確率を返す
                type: 'boolean',
                instructions: 'この問い合わせは人間の担当者へエスカレーションすべきか？',
            },
        },
    });

    console.dir(result.answers, { depth: null });
    if (result.answers.requiresHumanEscalation.probability > 0.6) {
        await escalate(
            result.answers.department.choice,
            result.answers.severity.score,
        )
    }
})();