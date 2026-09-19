import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { MAX_CANDIDATE_LENGTH, MAX_CANDIDATES, MAX_TEXT_LENGTH } from '../shared.js';
import { GameError } from './game.js';

const MAX_BODY_BYTES = 16_384;

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new GameError(415, 'JSON形式で送信してください。');
  }

  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const buffer: unknown = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    if (!Buffer.isBuffer(buffer)) throw new GameError(400, '入力を読み取れませんでした。');
    length += buffer.length;
    if (length > MAX_BODY_BYTES) throw new GameError(413, '入力が長すぎます。');
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    throw new GameError(400, '入力を読み取れませんでした。');
  }
}

function getUpstreamStatus(error: unknown): number | undefined {
  for (let depth = 0; depth < 5 && error && typeof error === 'object'; depth++) {
    const details = error as Record<string, unknown>;
    if (typeof details.statusCode === 'number') return details.statusCode;
    error = details.lastError ?? details.cause;
  }
}

function describeError(error: unknown): { status: number; message: string } {
  if (error instanceof GameError) return { status: error.status, message: error.message };
  if (error instanceof ZodError) {
    return {
      status: 400,
      message: `入力を確認してください。質問・解答は1〜${MAX_TEXT_LENGTH}文字、候補は重複なしで1〜${MAX_CANDIDATES}個（各${MAX_CANDIDATE_LENGTH}文字まで）です。`,
    };
  }
  if (error instanceof Error && error.message === 'MISSING_API_KEY') {
    return {
      status: 503,
      message: 'サーバーの環境変数AI_GATEWAY_API_KEYを設定し、再起動してください。',
    };
  }

  const upstreamStatus = getUpstreamStatus(error);
  if (upstreamStatus === 429) {
    return {
      status: 429,
      message:
        '判定サービスの利用制限に達しました。少し時間をおいて再送してください。入力と履歴は保持されています。',
    };
  }
  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return {
      status: 503,
      message:
        '判定サービスの認証に失敗しました。サーバーのAPIキーとモデルの利用権限を確認してください。',
    };
  }

  // 解答やAPIの生レスポンス・認証情報をブラウザーやログへ出さない。
  console.error('[soup] 判定に失敗:', error instanceof Error ? error.name : 'UnknownError');
  return {
    status: 502,
    message: '判定サービスに接続できないか、判定に失敗しました。時間をおいて再送してください。',
  };
}

export function sendError(res: ServerResponse, error: unknown): void {
  const { status, message } = describeError(error);
  sendJson(res, status, { error: message });
}
