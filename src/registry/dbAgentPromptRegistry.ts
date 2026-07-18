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

import type { DbAgentSystemSuffixProvider } from "@/lib/dbAgent/prompt";

/**
 * 登録済みのプロンプト断片一覧 (登録順に結合される)。
 */
export const dbAgentPromptFragments: string[] = [
  // --- CORE (upstream-provided): なし ---

  // --- DOWNSTREAM (downstream で追加) ---
  // 例: GACHA_DOMAIN_KNOWLEDGE, WALLET_DOMAIN_KNOWLEDGE, ...
];

/**
 * 実行時サフィックス (運営追加指示) のプロバイダ一覧。
 *
 * 上記 dbAgentPromptFragments が「コードで管理する安定知識」なのに対し、
 * こちらは「管理者が管理画面で編集する準静的テキスト」をリクエストごとに
 * 取得する経路。返り値はシステムプロンプトの最後 (安定部分の後ろ) に
 * 「## 運営からの追加指示」として結合される。複数登録時は登録順に結合。
 *
 * downstream での追加例 (setting ドメインの拡張フィールドから読む):
 *   1. setting.extended.ts に dbAgentCustomInstruction: z.string() を追加
 *   2. ここに登録:
 *        async () => {
 *          const { settingService } = await import("@/features/setting/services/server/settingService");
 *          const setting = await settingService.get("global");
 *          return setting?.dbAgentCustomInstruction ?? null;
 *        }
 *      (setting は requestMemo 有効のため同一リクエスト内の読取コストは実質ゼロ)
 *
 * 制約:
 *   - 返すテキストは運営 (管理者) 作成の信頼テキストに限定。
 *     エンドユーザー生成テキストを流し込まないこと (プロンプトインジェクション経路)
 *   - プロバイダの throw はエージェント側で握り潰されてスキップされる
 *     (追加指示の欠落は機能停止より軽微とみなす。最終防衛線は read-only ツール境界)
 */
export const dbAgentSystemSuffixProviders: DbAgentSystemSuffixProvider[] = [
  // --- CORE (upstream-provided): なし ---

  // --- DOWNSTREAM (downstream で追加) ---
];
