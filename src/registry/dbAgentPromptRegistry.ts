// src/registry/dbAgentPromptRegistry.ts
// DB調査エージェントのシステムプロンプトに合成する「ドメイン知識断片」のレジストリ。
//
// upstream は何も登録しない (スキーマ知識はドメイン固有のため)。
// フレームワーク (エージェントループ・SQL安全層・SSE配信) が upstream、
// ドメイン知識の定義は downstream の責務。
//
// downstream で断片を追加する手順:
//   1. src/features/<domain>/dbAgent/knowledge.ts 等に文字列定数を定義する
//   2. このファイルにインポートと配列追加を 1 行ずつ加える
//
// 書き方の指針:
//   - テーブルの意味・主要カラムの解釈・よくある集計の定石を書く
//     (例: 「users.status='withdrawn' が退会。集計時は is_demo=true を除外する」)
//   - 長大なスキーマ全文は書かない (エージェントは list_tables / describe_table で
//     自力でスキーマを引ける。ここには「読み方」だけを書く)
//   - 断片はシステムプロンプトの安定部分としてキャッシュされるため、
//     動的な値 (日付等) を含めないこと

/**
 * 登録済みのプロンプト断片一覧 (登録順に結合される)。
 */
export const dbAgentPromptFragments: string[] = [
  // --- CORE (upstream-provided): なし ---

  // --- DOWNSTREAM (downstream で追加) ---
  // 例: GACHA_DOMAIN_KNOWLEDGE, WALLET_DOMAIN_KNOWLEDGE, ...
];
