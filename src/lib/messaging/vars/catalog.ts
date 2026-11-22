// src/lib/messaging/vars/catalog.ts
//
// 埋め込み情報の一覧(1 つの連絡・テンプレートで書ける名前の全部): 共通 + 当たる enrichers の provides + 専用(テンプレートの宣言・コードの連絡の vars)。
// - 鍵と日本語の別名のどちらでも書ける。名前(鍵・別名)は一覧の中で重ならない(D126: 別名は専用どうしも共通・enrichers とも重ならない)
// - enrichers は足す値ごとに別名を宣言する(aliases、無い鍵は誤り)
// - collapsedCount は間引きのある連絡だけ(throttle: true)

import type { MessageEnricher } from "../receptacles/types";
import { MESSAGE_COMMON_VARS, type MessageNamedVar } from "./common";
import type { MessageVarDeclaration } from "./declaration";
import { VAR_ALIAS_PATTERN, VAR_KEY_PATTERN } from "./names";

export type MessageVarSource = "common" | "enricher" | "own";

/** 一覧の 1 つ(source = 共通 / enricher(鍵 = enricher の鍵)/ 専用 = テンプレートの宣言かコードの連絡の vars) */
export type MessageVarEntry = {
  key: string;
  alias: string;
  source: MessageVarSource;
  description?: string;
  /** enricher の鍵(source enricher だけ) */
  enricher?: string;
  /** 専用の宣言(source own だけ) */
  declaration?: MessageVarDeclaration;
};

export type MessageVarCatalog = readonly MessageVarEntry[];

export type MessageVarProblemCode =
  | "invalid_key"
  | "invalid_alias"
  | "duplicate_key"
  | "duplicate_alias"
  | "missing_enricher_alias";

export type MessageVarProblem = { code: MessageVarProblemCode; message: string };

/**
 * 一覧を組む。enrichers = その連絡・テンプレートに当たる enrichers(当て先で選んだ後)。own = 専用の宣言。
 * vars = コードの連絡の vars の名前(定義の varNames、D133。専用として並べる)
 */
export function varCatalog(input: {
  own?: readonly MessageVarDeclaration[];
  vars?: readonly MessageNamedVar[];
  enrichers?: readonly Pick<MessageEnricher, "key" | "provides" | "aliases">[];
  throttle?: boolean;
}): MessageVarEntry[] {
  const entries: MessageVarEntry[] = MESSAGE_COMMON_VARS.filter((item) => !item.throttleOnly || input.throttle).map(
    (item) => ({ key: item.key, alias: item.alias, source: "common", description: item.description }),
  );
  for (const enricher of input.enrichers ?? []) {
    for (const key of Object.keys(enricher.provides.shape)) {
      entries.push({ key, alias: enricher.aliases?.[key] ?? "", source: "enricher", enricher: enricher.key });
    }
  }
  for (const declaration of input.own ?? []) {
    entries.push({ key: declaration.key, alias: declaration.alias, source: "own", declaration });
  }
  for (const name of input.vars ?? []) {
    entries.push({ key: name.key, alias: name.alias, source: "own", description: name.description });
  }
  return entries;
}

const sourceLabel = (entry: MessageVarEntry) =>
  entry.source === "common" ? "共通" : entry.source === "enricher" ? `enricher ${entry.enricher}` : "専用";

/** 一覧の問題(空 = 通る): 鍵・別名の形、鍵の重なり、別名の重なり(ほかの鍵・別名と同じ名前)、enricher の別名の欠け */
export function checkVarCatalog(catalog: MessageVarCatalog): MessageVarProblem[] {
  const problems: MessageVarProblem[] = [];
  const names = new Map<string, MessageVarEntry>();
  const claim = (name: string, entry: MessageVarEntry, kind: "key" | "alias") => {
    const other = names.get(name);
    if (other) {
      problems.push({
        code: kind === "key" ? "duplicate_key" : "duplicate_alias",
        message: `${sourceLabel(entry)}の${kind === "key" ? "鍵" : "別名"} ${name} は${sourceLabel(other)}の ${other.key}(${other.alias || "別名なし"})と重なります`,
      });
      return;
    }
    names.set(name, entry);
  };
  for (const entry of catalog) {
    if (!VAR_KEY_PATTERN.test(entry.key)) {
      problems.push({ code: "invalid_key", message: `${sourceLabel(entry)}の鍵 ${entry.key} は英字で始まる英数字で書きます` });
    }
    claim(entry.key, entry, "key");
  }
  for (const entry of catalog) {
    if (!entry.alias) {
      if (entry.source === "enricher") {
        problems.push({ code: "missing_enricher_alias", message: `enricher ${entry.enricher} の ${entry.key} に別名(aliases)がありません` });
      } else {
        problems.push({ code: "invalid_alias", message: `${sourceLabel(entry)}の ${entry.key} に別名がありません` });
      }
      continue;
    }
    if (!VAR_ALIAS_PATTERN.test(entry.alias)) {
      problems.push({ code: "invalid_alias", message: `${sourceLabel(entry)}の別名 ${entry.alias} は空白・記号を含まず、英数字以外の字を含めます` });
      continue;
    }
    claim(entry.alias, entry, "alias");
  }
  return problems;
}

/** 名前(鍵か別名)→ 鍵(一覧に無ければ null) */
export function resolveVarName(catalog: MessageVarCatalog, name: string): string | null {
  return catalog.find((entry) => entry.key === name || entry.alias === name)?.key ?? null;
}
