// src/features/core/messaging/services/server/sendMessage/templateDefinition.ts
//
// 保存されたテンプレートの版 → 送る口の定義(D40・D41)。
// - 鍵は messaging.adminMessage(メールの描き方と宛名の enricher displayName を使う)。回は template_id + template_version で版を固定し、
//   cron もその版から組み直す(最新を引き直さない)
// - 中身・種類・経路は版から、種別は呼び手(回の kind)から。生成の一覧の上書き(fork の override)と管理画面の文言は重ねない
// - 変数: 版の変数の全部を vars にする(値は文字列にして差し込む)。型 number / boolean は形を確かめる、それ以外は文字列。
//   必須で値が無い・型が合わない = vars の検査で 400(送る時の再検査 = cron が回の vars をもう一度この zod に通す)
// - 受信者ごとの変数(source recipient)は送る口から受信者ごとに渡す口が無いので、既定値を全員に使う(既定値が無ければ 400)

import { z } from "zod";

import {
  applyMessageOverride,
  validateMessageDefinition,
  type MessageChannel,
  type MessageEnricher,
  type MessageKind,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { channelFieldSchemas, enricherKeysFor, type AnyMessageDefinition, type AnyResolvedMessageDefinition } from "./definition";
import type { MessageTemplateVersionSource } from "./types";

/** テンプレートで送る連絡の鍵 */
export const TEMPLATE_MESSAGE_KEY = "messaging.adminMessage";

type TemplateVariable = MessageTemplateVersionSource["variables"][number];

const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;

/** 値を差し込む文字列にする(型が合わなければ null) */
function toText(type: string, value: unknown): string | null {
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && NUMBER_TEXT.test(value.trim())) return value.trim();
    return null;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return String(value);
    if (value === "true" || value === "false") return value;
    return null;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function variableSchema(variable: TemplateVariable): z.ZodTypeAny {
  return z.unknown().transform((value, ctx) => {
    const empty = value === undefined || value === null || value === "";
    if (empty) {
      if (variable.default !== undefined && variable.default !== null) {
        const text = toText(variable.type, variable.default);
        if (text !== null) return text;
      }
      if (!variable.required) return "";
      ctx.addIssue({ code: "custom", message: `${variable.key} は必須です` });
      return z.NEVER;
    }
    const text = toText(variable.type, value);
    if (text === null) {
      ctx.addIssue({ code: "custom", message: `${variable.key} の型が ${variable.type} ではありません` });
      return z.NEVER;
    }
    return text;
  });
}

/**
 * 受信者ごとの変数で既定値の無い物(送る口からは値を渡せないので送れない)
 */
export function recipientVariablesWithoutDefault(version: MessageTemplateVersionSource): string[] {
  return version.variables
    .filter((variable) => variable.source === "recipient" && (variable.default === undefined || variable.default === null))
    .map((variable) => variable.key);
}

/** 版 → 定義(検査の前) */
export function templateDefinitionOf(version: MessageTemplateVersionSource, kind: MessageKind): AnyMessageDefinition {
  const shape = Object.fromEntries(
    version.variables.map((variable) => {
      // 受信者ごとの変数は既定値を全員に使う(値は渡させない)
      const fixed = variable.source === "recipient" ? { ...variable, required: false } : variable;
      return [variable.key, variableSchema(fixed)];
    }),
  );
  return {
    key: TEMPLATE_MESSAGE_KEY,
    kind,
    category: version.category,
    vars: z.object(shape),
    record: "vars",
    defaultChannels: [...version.channels],
    content: version.content,
  } as unknown as AnyMessageDefinition;
}

/**
 * 版を送れる定義にする(検査を通す。上書きは重ねない)。
 * @throws DomainError(500) 版の中身が今の経路・値の束に合わない(経路が消えた・provides が変わった など)
 */
export function resolveTemplateDefinition(
  version: MessageTemplateVersionSource,
  kind: MessageKind,
  channels: Readonly<Record<string, MessageChannel>>,
  enrichers: Readonly<Record<string, MessageEnricher>>,
): AnyResolvedMessageDefinition {
  const definition = templateDefinitionOf(version, kind);
  const problems = validateMessageDefinition(definition, {
    channels: channelFieldSchemas(channels),
    variableKeys: enricherKeysFor(TEMPLATE_MESSAGE_KEY, enrichers),
  });
  if (problems.length > 0) {
    throw new DomainError(
      `テンプレート ${version.templateKey} の版 ${version.version} を送れません: ${problems.map((problem) => problem.message).join(" / ")}`,
      { status: 500 },
    );
  }
  return applyMessageOverride(definition, undefined);
}
