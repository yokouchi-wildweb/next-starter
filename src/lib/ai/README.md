# AI エージェント基盤 (`@/lib/ai`)

Claude API を使う機能の共通基盤。**ドメイン知識を一切持たない**汎用レイヤであり、
「system プロンプト + ツール群 + 会話履歴」を渡すとツール実行ループを回しながら
型付きイベントをストリーミングする、という契約だけを提供する。

DB調査エージェント (`@/lib/dbAgent`) はこの基盤の最初の搭載例。CS応対支援・
コンテンツ生成・ユーザー向けガイド等、将来のエージェントも同じ構造で載せる。

## 構成

| ファイル | 環境 | 役割 |
|---|---|---|
| `client.ts` | server | 共有 Anthropic クライアント (遅延初期化)。AI 利用機能は必ずこれを共有する |
| `agent/types.ts` | 共用 | **型契約** (versioned)。`AgentEvent` / `AgentBlock` / `AgentToolDefinition` |
| `agent/runtime.ts` | server | `runAgent()` — ツール実行ループ本体。`AsyncGenerator<AgentEvent>` を返す |
| `agent/blocks.ts` | 共用 | `present_result` ツール (最終回答のブロック提出) + zod 検証 |
| `agent/sse.ts` | server | `createAgentSSEResponse()` — ジェネレータ → SSE レスポンス変換 |
| `agent/sseClient.ts` | client | `parseAgentEventStream()` — SSE レスポンス → `AgentEvent` パーサー |
| `index.ts` | client | クライアント安全なエクスポートのみのバレル |

設定は `src/config/app/ai-agent.config.ts` (`AI_AGENT_CONFIG`: model / maxIterations / maxTokensPerStep)。

## 型契約とバージョニング

`AgentEvent` / `AgentBlock` は **downstream の UI が直接バインドする安定契約**。

- 全イベントに `v: 1` (`AGENT_PROTOCOL_VERSION`) が付く
- UI は「未知の type / 未知の v を無視する」前方互換実装にすること
- upstream 側の変更ルール: optional フィールド追加は同一バージョン内で可。
  意味変更・削除はバージョンを上げて旧型を残す

### イベントフロー (1ターン)

```
agent.text_delta*            … 本文の逐次差分
agent.tool_call_started      … ツール実行開始 {tool, label, inputSummary}
agent.tool_result            … ツール実行完了 {tool, ok, summary, durationMs, meta?}
(上記2つがツール実行のたびに繰り返し)
agent.blocks                 … 構造化された最終回答 {blocks: AgentBlock[]}
agent.done                   … 終了 (累計 usage)。異常時は直前に agent.error
```

**必ず最後に `agent.done` が届く**。`agent.error` はターン中断ではなく
「エラーを報告した上での終了」を意味し、その後にも `agent.done` が来る。

## 新しいエージェントの作り方

1. **ツールを定義する** (`AgentToolDefinition[]`)。`run` に渡る input はモデル出力
   (= 信頼できない入力) なので必ず zod で検証する。ツールの安全境界
   (何ができて何ができないか) はエージェントごとに設計する — 基盤が保証するのは
   「渡したツール以外何もできない」ことまで。
2. **system プロンプトを書く**。安定部分 (役割・ツール使用方針) を先頭、
   可変部分 (レジストリ断片等) を後方に置く (プロンプトキャッシュはプレフィックス一致)。
   運営が編集できる実行時指示が必要なら「安定プロンプト + 末尾サフィックス
   (プロバイダレジストリでリクエストごとに解決)」のパターンを使う —
   実装例: `@/lib/dbAgent` の `dbAgentSystemSuffixProviders`。
3. **サービス関数**で `runAgent({system, tools, messages, signal})` を呼ぶ。
4. **API ルート** (routeFactory 必須・認可を宣言) でサービスを呼び、
   `createAgentSSEResponse(generator, {abortController})` を返す。
5. **ClientService** で fetch + `parseAgentEventStream()` を使いイベントを UI へ流す
   (ストリーミング ClientService に限り axios ではなく fetch を使ってよい —
   CLAUDE.md の例外規約)。

実装例は `@/lib/dbAgent` を参照 (route: `src/app/api/admin/db-agent/route.ts`)。

## ランタイムの挙動

- モデル既定 `claude-opus-4-8`・adaptive thinking・サンプリングパラメータ不使用
  (Opus 4.7+ では temperature 等は 400)
- `maxIterations` 超過時は `agent.error` を報告して終了 (暴走防止)
- ツールの throw はモデルに `is_error` として返し、自律リカバリさせる
- `present_result` はランタイム組み込み。モデルが呼ぶと `agent.blocks` が発火する
- クライアント切断 → SSE の cancel → `AbortSignal` がツールまで伝播
- usage (トークン・往復数) は全イテレーション累計で `agent.done` に載る

## 注意

- SDK (0.71.x) の型が adaptive thinking 未対応のためランタイム内でキャストしている。
  SDK アップグレード時に `ADAPTIVE_THINKING` のキャストを外すこと
- 会話はステートレス (クライアントが履歴保持)。永続化・セッション管理は
  必要になった時点でこの基盤への拡張として設計する
