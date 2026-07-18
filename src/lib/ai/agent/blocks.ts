// src/lib/ai/agent/blocks.ts
//
// 最終回答を構造化ブロック (AgentBlock[]) で提出させるための組み込みツール
// `present_result` の定義と、ブロックのバリデーション。
//
// モデルは調査完了時にこのツールを呼び、UI がレンダリング可能な型付き
// ブロックで回答を提出する。ランタイム (runtime.ts) はこのツール呼び出しを
// 検知して agent.blocks イベントを発火する。

import { z } from "zod";

import type { AgentBlock } from "./types";

/** present_result ツールの名前 (ランタイムが特別扱いする) */
export const PRESENT_RESULT_TOOL_NAME = "present_result";

const chartSeriesSchema = z.object({
  name: z.string(),
  data: z.array(z.number()),
});

const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** AgentBlock の zod スキーマ (モデル出力の検証用) */
export const agentBlockSchema: z.ZodType<AgentBlock> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("text"), markdown: z.string() }),
    z.object({
      type: z.literal("stat"),
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      unit: z.string().optional(),
    }),
    z.object({
      type: z.literal("table"),
      columns: z.array(z.string()),
      rows: z.array(z.array(cellSchema)),
      totalRows: z.number().optional(),
    }),
    z.object({
      type: z.literal("chart"),
      kind: z.enum(["bar", "line"]),
      series: z.array(chartSeriesSchema),
      xLabels: z.array(z.string()).optional(),
    }),
    z.object({
      type: z.literal("entity_link"),
      domain: z.string(),
      id: z.string(),
      label: z.string(),
    }),
    z.object({ type: z.literal("sql"), query: z.string() }),
  ],
);

export const presentResultInputSchema = z.object({
  blocks: z.array(agentBlockSchema).min(1),
});

/**
 * present_result ツールの JSON Schema (モデルに公開する入力スキーマ)。
 * zod スキーマと同期を保つこと。
 */
export const PRESENT_RESULT_INPUT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      minItems: 1,
      description:
        "回答を構成するブロックの配列。表示順に並べる。説明は text、集計値は stat、一覧は table、推移は chart、根拠 SQL は sql ブロックを使う。",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["text", "stat", "table", "chart", "entity_link", "sql"],
          },
          markdown: { type: "string", description: "text: 本文 (Markdown)" },
          label: { type: "string", description: "stat/entity_link: ラベル" },
          value: {
            type: ["string", "number"],
            description: "stat: 値",
          },
          unit: { type: "string", description: "stat: 単位 (任意)" },
          columns: {
            type: "array",
            items: { type: "string" },
            description: "table: 列名",
          },
          rows: {
            type: "array",
            items: {
              type: "array",
              items: { type: ["string", "number", "boolean", "null"] },
            },
            description: "table: 行データ (columns と同順)",
          },
          totalRows: {
            type: "number",
            description: "table: 切り捨て前の総行数 (任意)",
          },
          kind: {
            type: "string",
            enum: ["bar", "line"],
            description: "chart: 種別",
          },
          series: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                data: { type: "array", items: { type: "number" } },
              },
              required: ["name", "data"],
            },
            description: "chart: 系列",
          },
          xLabels: {
            type: "array",
            items: { type: "string" },
            description: "chart: X軸ラベル (任意)",
          },
          domain: { type: "string", description: "entity_link: ドメイン名" },
          id: { type: "string", description: "entity_link: エンティティID" },
          query: { type: "string", description: "sql: 実行した SQL" },
        },
        required: ["type"],
      },
    },
  },
  required: ["blocks"],
};

/**
 * present_result の入力を検証し、AgentBlock[] を返す。
 * 不正な場合は null (ランタイムはモデルにエラーを返して再提出させる)。
 */
export function parsePresentResultInput(input: unknown): AgentBlock[] | null {
  const parsed = presentResultInputSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data.blocks;
}
