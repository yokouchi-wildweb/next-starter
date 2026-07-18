// src/lib/dbAgent/tools/runQuery.ts
//
// run_query: 単文 SELECT の実行。
//
// 多層防御:
//  1. アプリ層: validateSelect (単文 SELECT のみ・禁止キーワード)
//  2. 行数上限: cursor で maxRows+1 行まで読んだら打ち切り (転送量も抑制)
//  3. 列マスク: 機微カラム (password/token 等) の値をマスク
//  4. DB 層: 読取専用ロール + statement_timeout (readonlyDb.ts)
//
// 実行のたびに監査レコーダ (注入) へ admin.db_agent.query_executed を記録する。

import { z } from "zod";

import { DB_AGENT_CONFIG } from "@/config/app/ai-agent.config";
import type { AgentToolDefinition } from "@/lib/ai";

import {
  DB_AGENT_AUDIT_ACTIONS,
  DB_AGENT_AUDIT_TARGET,
  type DbAgentAuditRecorder,
} from "../audit";
import { getReadonlyDb } from "../readonlyDb";
import { maskSensitiveColumns } from "../safety/columnMask";
import { validateSelect } from "../safety/validateSelect";
import { clampResultText, safeJsonStringify } from "./shared";

const inputSchema = z.object({
  query: z.string(),
});

/** cursor の1回あたり取得行数 */
const CURSOR_BATCH_SIZE = 50;

export function createRunQueryTool(
  recorder?: DbAgentAuditRecorder,
): AgentToolDefinition {
  return {
    name: "run_query",
    label: "SQL の実行",
    description: `読取専用の SELECT 文を1文だけ実行する。結果は最大 ${DB_AGENT_CONFIG.maxRows} 行 (超過分は切り捨て)。集計・件数確認は必ず GROUP BY / COUNT 等で DB 側に寄せ、大量の生データを取得しないこと。書き込み・DDL は実行できない。`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "実行する SELECT 文 (1文のみ。セミコロン不要)",
        },
      },
      required: ["query"],
    },
    summarizeInput: (input) => {
      const parsed = inputSchema.safeParse(input);
      return parsed.success ? parsed.data.query : "(不正な入力)";
    },
    async run(input) {
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          content: "入力が不正です。{ query: string } を指定してください。",
          isError: true,
        };
      }

      const validated = validateSelect(parsed.data.query);
      if (!validated.ok) {
        return { content: validated.reason, isError: true };
      }

      const sql = getReadonlyDb();
      const startedAt = Date.now();

      const rows: Record<string, unknown>[] = [];
      let truncatedByRowCap = false;

      try {
        for await (const batch of sql
          .unsafe(validated.query)
          .cursor(CURSOR_BATCH_SIZE)) {
          for (const row of batch) {
            if (rows.length >= DB_AGENT_CONFIG.maxRows) {
              truncatedByRowCap = true;
              break;
            }
            rows.push(row as Record<string, unknown>);
          }
          if (truncatedByRowCap) break;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "クエリの実行に失敗しました";
        // 失敗も監査に残す (何を実行しようとしたかの記録)
        await recorder?.record({
          ...DB_AGENT_AUDIT_TARGET,
          action: DB_AGENT_AUDIT_ACTIONS.queryExecuted,
          metadata: {
            query: validated.query,
            ok: false,
            error: message,
            durationMs: Date.now() - startedAt,
          },
        });
        return {
          content: `クエリエラー: ${message}`,
          isError: true,
          summary: `エラー: ${message}`,
        };
      }

      const durationMs = Date.now() - startedAt;
      const masked = maskSensitiveColumns(rows);

      await recorder?.record({
        ...DB_AGENT_AUDIT_TARGET,
        action: DB_AGENT_AUDIT_ACTIONS.queryExecuted,
        metadata: {
          query: validated.query,
          ok: true,
          rowCount: rows.length,
          truncated: truncatedByRowCap,
          durationMs,
        },
      });

      const payload = {
        rowCount: rows.length,
        truncated: truncatedByRowCap,
        rows: masked,
      };
      const clamped = clampResultText(safeJsonStringify(payload));

      return {
        content: clamped.text,
        summary: truncatedByRowCap
          ? `${rows.length} 行取得 (上限で切り捨て)`
          : `${rows.length} 行取得`,
        meta: {
          rowCount: rows.length,
          truncated: truncatedByRowCap,
          durationMs,
        },
      };
    },
  };
}
