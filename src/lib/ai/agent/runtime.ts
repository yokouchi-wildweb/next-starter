// src/lib/ai/agent/runtime.ts
//
// 汎用エージェントランタイム。
//
// 「system プロンプト + ツール群 + 会話履歴」を渡すと、ツール実行ループを
// 回しながら AgentEvent を逐次 yield する AsyncGenerator を返す。
// ドメイン知識 (DB・CS等) はここに一切持たない。エージェントの種類は
// 呼び出し側 (例: @/lib/dbAgent) がツールとプロンプトの組で定義する。
//
// 実装ノート:
// - SDK の beta Tool Runner ではなく手動ループを採用している。理由は
//   「各ツール実行の前後に型付きイベント (tool_call_started / tool_result) を
//   SSE ストリームへ割り込ませる」制御が Tool Runner のフックでは素直に
//   書けないため (実行タイミングがイテレータ内部に隠蔽される)。
// - Opus 4.7 以降の仕様に準拠: adaptive thinking / サンプリングパラメータ不使用。
//   thinking ブロックはループ継続時にそのまま assistant 履歴へ戻す (API 要件)。
// - プロンプトキャッシュ: system 末尾に cache_control を置く。system は
//   安定部分を先頭に置くこと (呼び出し側の責務、プレフィックス一致のため)。

import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { AI_AGENT_CONFIG } from "@/config/app/ai-agent.config";
import { getAnthropicClient } from "@/lib/ai/client";

import {
  PRESENT_RESULT_TOOL_NAME,
  PRESENT_RESULT_INPUT_JSON_SCHEMA,
  parsePresentResultInput,
} from "./blocks";
import type {
  AgentEvent,
  AgentToolDefinition,
  AgentUsage,
  RunAgentOptions,
} from "./types";

/** inputSummary / summary の既定生成で使う最大文字数 */
const SUMMARY_MAX_CHARS = 300;

/**
 * adaptive thinking 設定。
 * 現行の @anthropic-ai/sdk (0.71.x) は型定義が adaptive に未対応だが、
 * ワイヤ API は GA パラメータとして受理する (Opus 4.6+ / beta ヘッダ不要)。
 * SDK アップグレード後はこのキャストを外して型を通すこと。
 * Opus 4.7+ では thinking 省略時は「思考なし」で動作するため明示指定が必要。
 */
const ADAPTIVE_THINKING = {
  type: "adaptive",
} as unknown as Anthropic.ThinkingConfigParam;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function defaultInputSummary(input: unknown): string {
  try {
    return truncate(JSON.stringify(input), SUMMARY_MAX_CHARS);
  } catch {
    return "(input)";
  }
}

/** AgentToolDefinition → Messages API のツール定義へ変換する */
function toApiTool(def: AgentToolDefinition): Anthropic.Tool {
  return {
    name: def.name,
    description: def.description,
    input_schema: def.inputSchema as Anthropic.Tool.InputSchema,
  };
}

/** present_result を組み込みツールとして注入する (run はランタイムが特別扱い) */
const PRESENT_RESULT_API_TOOL: Anthropic.Tool = {
  name: PRESENT_RESULT_TOOL_NAME,
  description:
    "調査が完了したら、必ず最後にこのツールで回答を提出する。回答は型付きブロックの配列で構成する。ユーザーに見せる最終回答はこのツール経由でのみ提示できる。",
  input_schema:
    PRESENT_RESULT_INPUT_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

/**
 * エージェントを実行し、AgentEvent を逐次 yield する。
 *
 * 終了規約:
 * - 正常終了・異常終了を問わず、最後に必ず agent.done (累計 usage) を yield する
 * - 異常時は agent.done の直前に agent.error を yield する
 * - 呼び出し側の signal abort 時は静かに終了する (イベント配信先が既に居ないため)
 */
export async function* runAgent(
  options: RunAgentOptions,
): AsyncGenerator<AgentEvent, void, undefined> {
  const model = options.model ?? AI_AGENT_CONFIG.model;
  const maxIterations = options.maxIterations ?? AI_AGENT_CONFIG.maxIterations;
  const maxTokensPerStep =
    options.maxTokensPerStep ?? AI_AGENT_CONFIG.maxTokensPerStep;

  const client = getAnthropicClient();
  const toolByName = new Map(options.tools.map((t) => [t.name, t]));
  const apiTools: Anthropic.Tool[] = [
    ...options.tools.map(toApiTool),
    PRESENT_RESULT_API_TOOL,
  ];

  const messages: Anthropic.MessageParam[] = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const usage: AgentUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    iterations: 0,
  };

  let presented = false;

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      usage.iterations = iteration + 1;

      const stream = client.messages.stream(
        {
          model,
          max_tokens: maxTokensPerStep,
          thinking: ADAPTIVE_THINKING,
          system: [
            {
              type: "text",
              text: options.system,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: apiTools,
          messages,
        },
        { signal: options.signal },
      );

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { v: 1, type: "agent.text_delta", delta: event.delta.text };
        }
      }

      const message = await stream.finalMessage();

      usage.inputTokens += message.usage.input_tokens;
      usage.outputTokens += message.usage.output_tokens;
      usage.cacheReadInputTokens += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheCreationInputTokens +=
        message.usage.cache_creation_input_tokens ?? 0;

      const toolUses = message.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
        if (message.stop_reason === "max_tokens") {
          yield {
            v: 1,
            type: "agent.error",
            message:
              "回答が長すぎて途中で打ち切られました。質問を分割して再度お試しください。",
          };
        }
        break;
      }

      // thinking ブロックを含む assistant 応答全体を履歴へ戻す (API 要件)
      messages.push({ role: "assistant", content: message.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        // 最終回答の提出 (present_result) はランタイムが処理する
        if (toolUse.name === PRESENT_RESULT_TOOL_NAME) {
          const blocks = parsePresentResultInput(toolUse.input);
          if (blocks) {
            presented = true;
            yield { v: 1, type: "agent.blocks", blocks };
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content:
                "回答を提示しました。追加の説明が不要ならこのままターンを終了してください。",
            });
          } else {
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content:
                "blocks の形式が不正です。スキーマに従って再提出してください。",
              is_error: true,
            });
          }
          continue;
        }

        const def = toolByName.get(toolUse.name);
        if (!def) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `不明なツールです: ${toolUse.name}`,
            is_error: true,
          });
          continue;
        }

        yield {
          v: 1,
          type: "agent.tool_call_started",
          tool: def.name,
          label: def.label,
          inputSummary: def.summarizeInput
            ? def.summarizeInput(toolUse.input)
            : defaultInputSummary(toolUse.input),
        };

        const startedAt = Date.now();
        try {
          const result = await def.run(toolUse.input, {
            signal: options.signal,
          });
          const durationMs = Date.now() - startedAt;

          yield {
            v: 1,
            type: "agent.tool_result",
            tool: def.name,
            ok: !result.isError,
            summary:
              result.summary ?? truncate(result.content, SUMMARY_MAX_CHARS),
            durationMs,
            ...(result.meta ? { meta: result.meta } : {}),
          };

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result.content,
            ...(result.isError ? { is_error: true } : {}),
          });
        } catch (error) {
          // ツールの想定外エラー。モデルに返してリカバリさせる
          const durationMs = Date.now() - startedAt;
          const messageText =
            error instanceof Error ? error.message : "ツール実行に失敗しました";

          yield {
            v: 1,
            type: "agent.tool_result",
            tool: def.name,
            ok: false,
            summary: truncate(messageText, SUMMARY_MAX_CHARS),
            durationMs,
          };

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `ツール実行エラー: ${messageText}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });

      if (iteration === maxIterations - 1) {
        yield {
          v: 1,
          type: "agent.error",
          message:
            "調査ステップ数が上限に達しました。質問を絞り込んで再度お試しください。",
        };
      }
    }

    // present_result 無しの終了も契約上は正常終了
    // (テキストは text_delta で配信済み。UI はテキストのみ表示すればよい)
    void presented;
    yield { v: 1, type: "agent.done", usage };
  } catch (error) {
    if (options.signal?.aborted) {
      return;
    }
    console.error("[ai/agent] runAgent failed:", error);
    yield {
      v: 1,
      type: "agent.error",
      message: "AIエージェントの実行中にエラーが発生しました。",
    };
    yield { v: 1, type: "agent.done", usage };
  }
}
