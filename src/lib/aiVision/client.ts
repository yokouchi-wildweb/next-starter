// src/lib/aiVision/client.ts

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

/**
 * Anthropic クライアントを取得します（遅延初期化）。
 *
 * ANTHROPIC_API_KEY 環境変数が必須。未設定時は明示的なエラーを投げます。
 * モジュールトップでの初期化を避けることで、ビルド時に環境変数が
 * 揃っていなくても import 自体は失敗しないようにしています。
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
