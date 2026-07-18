// src/registry/dbAgentToolRegistry.ts
// DB調査エージェントに追加する「ドメイン固有ツール」のレジストリ。
//
// upstream は組み込みツール (list_tables / describe_table / run_query) のみを提供し、
// ここには何も登録しない。SQL では表現しにくいドメインロジック
// (例: 外部APIの状態照会、複雑な集計サービスの呼び出し) を downstream が
// AgentToolDefinition としてぶら下げる。
//
// downstream でツールを追加する手順:
//   1. src/features/<domain>/dbAgent/tools/<name>.ts に AgentToolDefinition を定義する
//      - run に渡る input はモデル出力なので必ず zod で検証する
//      - 読取専用の操作に限定する (書き込み系ツールを登録しないこと)
//   2. このファイルにインポートと配列追加を 1 行ずつ加える
//
// 契約の詳細は src/lib/ai/README.md (AgentToolDefinition) を参照。

import type { AgentToolDefinition } from "@/lib/ai";

/**
 * 登録済みの追加ツール一覧。
 * name は組み込みツール・レジストリ内で一意であること。
 */
export const dbAgentExtraTools: AgentToolDefinition[] = [
  // --- CORE (upstream-provided): なし (組み込みは @/lib/dbAgent 側) ---

  // --- DOWNSTREAM (downstream で追加) ---
  // 例: lookupPaymentStatusTool, ...
];
