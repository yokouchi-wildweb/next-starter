// src/lib/aiVision/client.ts
//
// Anthropic クライアントは @/lib/ai/client へ昇格した (aiVision / dbAgent 等で共有)。
// 既存 import の後方互換のため re-export のみ残す。

export { getAnthropicClient } from "@/lib/ai/client";
