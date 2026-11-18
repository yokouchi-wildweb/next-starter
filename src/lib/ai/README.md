# AI エージェント基盤 (`@/lib/ai`)

## Overview

- Claude API を使う機能の共通基盤。ドメイン知識を一切持たない汎用レイヤであり、「system プロンプト + ツール群 + 会話履歴」を渡すとツール実行ループを回しながら型付きイベントをストリーミングする、という契約だけを提供する
- 使う時・直す時の決まりは札 .claude/rules/items/lib/ai.md にある。この README は使い方と仕組み
- DB調査エージェント (`@/lib/dbAgent`) はこの基盤の最初の搭載例。CS応対支援・コンテンツ生成・ユーザー向けガイド等、将来のエージェントも同じ構造で載せる
- 閉じた lib: 入口は `@/lib/ai`(クライアント安全な物と設定 `aiConfig`)と `@/lib/ai/server`(`getAnthropicClient` / `runAgent` / `createAgentSSEResponse`)

## Usage

新しいエージェントの作り方:

1. ツールを定義する (`AgentToolDefinition[]`)。`run` に渡る input はモデル出力。ツールの安全境界 (何ができて何ができないか) はエージェントごとに設計する
2. system プロンプトを書く。運営が編集できる実行時指示の実装例: `src/wiring/dbAgent/suffixProviders/`
3. サービス関数で `runAgent({system, tools, messages, signal})` を呼ぶ
4. API ルート (routeFactory、認可を宣言) でサービスを呼び、`createAgentSSEResponse(generator, {abortController})` を返す
5. ClientService で fetch + `parseAgentEventStream()` を使いイベントを UI へ流す (ストリーミング ClientService に限り axios ではなく fetch を使ってよい — CLAUDE.md の例外規約)

実装例は `@/lib/dbAgent` を参照 (route: `src/app/api/admin/db-agent/route.ts`)。

## API

- 共有 Anthropic クライアント `getAnthropicClient()`(server、遅延初期化)
- 型契約 (versioned): `AgentEvent` / `AgentBlock` / `AgentToolDefinition`。`AgentEvent` / `AgentBlock` は downstream の UI が直接バインドする安定契約で、全イベントに `v: 1` (`AGENT_PROTOCOL_VERSION`) が付く
- `runAgent()`(server): ツール実行ループ本体。`AsyncGenerator<AgentEvent>` を返す
- `present_result` ツール: 最終回答のブロック提出 + zod 検証。ランタイム組み込みで、モデルが呼ぶと `agent.blocks` が発火する
- `createAgentSSEResponse()`(server): ジェネレータ → SSE レスポンス変換
- `parseAgentEventStream()`(client): SSE レスポンス → `AgentEvent` パーサー

イベントフロー (1ターン):

```
agent.text_delta*            … 本文の逐次差分
agent.tool_call_started      … ツール実行開始 {tool, label, inputSummary}
agent.tool_result            … ツール実行完了 {tool, ok, summary, durationMs, meta?}
(上記2つがツール実行のたびに繰り返し)
agent.blocks                 … 構造化された最終回答 {blocks: AgentBlock[]}
agent.done                   … 終了 (累計 usage)。異常時は直前に agent.error
```

## Extension

- 設定 (model / maxIterations / maxTokensPerStep) は `config.ts` が既定を持ち、fork は上書き `src/config/lib/ai.config.ts` (`@lib-config/ai`) に書く。読み手は合成済みの `aiConfig` (`@/lib/ai`) を読む
- `runAgent` の options は呼び出しごとにこの値より優先する

## Internals

- モデル既定 `claude-opus-4-8`・adaptive thinking・サンプリングパラメータ不使用 (Opus 4.7+ では temperature 等は 400)
- `maxIterations` 超過時は `agent.error` を報告して終了 (暴走防止)
- ツールの throw はモデルに `is_error` として返し、自律リカバリさせる
- クライアント切断 → SSE の cancel → `AbortSignal` がツールまで伝播
- usage (トークン・往復数) は全イテレーション累計で `agent.done` に載る
- SDK (0.71.x) の型が adaptive thinking 未対応のため、ランタイム内で `ADAPTIVE_THINKING` をキャストしている
- 会話はステートレス (クライアントが履歴保持)
