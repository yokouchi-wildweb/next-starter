// src/lib/ai/client.ts

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

/**
 * 共有 Anthropic クライアントを取得します（遅延初期化）。
 *
 * ANTHROPIC_API_KEY 環境変数が必須。未設定時は明示的なエラーを投げます。
 * モジュールトップでの初期化を避けることで、ビルド時に環境変数が
 * 揃っていなくても import 自体は失敗しないようにしています。
 *
 * AI を利用する全機能 (aiVision / dbAgent / 将来のエージェント) はこの
 * クライアントを共有すること。個別に new Anthropic() しない。
 */
export function getAnthropicClient(): Anthropic {
  if (cachedClient) {
    return cachedClient;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY が未設定です。.env.development に設定してください。",
    );
  }
  cachedClient = new Anthropic();
  return cachedClient;
}
