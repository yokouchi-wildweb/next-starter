// src/lib/defineConfig/defineConfig.ts
//
// 既定 + 規則 → 上書きを受けて合成する、lib の設定の共通の合成器(設定の議会 D15)。
// - オブジェクトは深く合成する。配列は規則(replace = 既定 | append | { by: id のキー })、関数・Date などは丸ごと置き換え
// - null = そのキーを消す(型では省略できるキーだけ)。undefined = 変えない
// - mergeById の配列: 同じ id の項目は深く合成、{ <id>: x, $delete: true } で消す(無い id を消そうとすると誤り)、知らない id は末尾に足す
// - 既定に無いキー(fork 独自のキー)はそのまま写す
// - schema(Standard Schema)で合成した値を確かめる。検査だけで、出力は使わない(zod の出力は fork 独自のキーを落とすため)

import type { ArrayRule, ConfigDefinition, ConfigRules, StandardSchemaIssue } from "./types";

/** 規則や上書きの形の誤り */
export class ConfigError extends Error {
  readonly label: string;
  constructor(label: string, message: string) {
    super(`[${label}] ${message}`);
    this.name = "ConfigError";
    this.label = label;
  }
}

/** schema の検査で問題が出た */
export class ConfigValidationError extends ConfigError {
  readonly issues: ReadonlyArray<{ message: string; path: string[] }>;
  constructor(label: string, issues: ReadonlyArray<StandardSchemaIssue>) {
    const list = issues.map((issue) => ({ message: issue.message, path: pathOfIssue(issue) }));
    super(label, `設定の値の検査に通りません:\n${list.map((i) => `- ${i.path.join(".") || "(根)"}: ${i.message}`).join("\n")}`);
    this.name = "ConfigValidationError";
    this.issues = list;
  }
}

function pathOfIssue(issue: StandardSchemaIssue): string[] {
  return (issue.path ?? []).map((segment) => String(typeof segment === "object" && segment !== null ? segment.key : segment));
}

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** 配列とプレーンなオブジェクトだけ写す(他は参照のまま) */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isPlainObject(value)) {
    const out: PlainObject = {};
    for (const [key, item] of Object.entries(value)) out[key] = clone(item);
    return out as T;
  }
  return value;
}

type RuleNode = ArrayRule<unknown> | { readonly [key: string]: RuleNode | undefined } | undefined;

const isArrayRule = (rule: RuleNode): rule is ArrayRule<unknown> =>
  rule === "replace" || rule === "append" || (isPlainObject(rule) && typeof (rule as { by?: unknown }).by === "string");

/** 規則が既定の形に合うか(配列の規則は配列のキーに、入れ子の規則はオブジェクトのキーに) */
function checkRules(label: string, defaults: unknown, rules: RuleNode, path: string[]): void {
  if (rules === undefined) return;
  if (!isPlainObject(rules)) throw new ConfigError(label, `arrays の ${path.join(".")} の規則の形が違います`);
  for (const [key, rule] of Object.entries(rules)) {
    const at = [...path, key];
    const value = isPlainObject(defaults) ? defaults[key] : undefined;
    if (rule === undefined) continue;
    if (isArrayRule(rule as RuleNode)) {
      if (!Array.isArray(value)) throw new ConfigError(label, `arrays.${at.join(".")} は配列の規則ですが、既定の ${at.join(".")} は配列ではありません`);
    } else if (isPlainObject(value)) {
      checkRules(label, value, rule as RuleNode, at);
    } else {
      throw new ConfigError(label, `arrays.${at.join(".")} の規則の形が違います("replace" / "append" / { by: "<id のキー>" })`);
    }
  }
}

function mergeArray(label: string, base: unknown[], override: unknown[], rule: RuleNode, path: string[]): unknown[] {
  if (rule === undefined || rule === "replace") return clone(override);
  if (rule === "append") return [...clone(base), ...clone(override)];
  const by = (rule as { by: string }).by;
  const result = base.map(clone);
  override.forEach((item, index) => {
    const at = `${path.join(".")}[${index}]`;
    if (!isPlainObject(item)) throw new ConfigError(label, `${at} はオブジェクトで書きます(id で合わせる配列)`);
    const id = item[by];
    if (id === undefined || id === null) throw new ConfigError(label, `${at} に id "${by}" がありません`);
    const found = result.findIndex((existing) => isPlainObject(existing) && existing[by] === id);
    const { $delete, ...rest } = item;
    if ($delete === true) {
      if (found < 0) throw new ConfigError(label, `${at}: 消す項目 ${by}=${String(id)} が既定にありません`);
      result.splice(found, 1);
      return;
    }
    if (found >= 0) result[found] = mergeObject(label, result[found] as PlainObject, rest, undefined, [...path, String(id)]);
    else result.push(clone(rest));
  });
  return result;
}

function mergeValue(label: string, base: unknown, override: unknown, rule: RuleNode, path: string[]): unknown {
  if (Array.isArray(base) && Array.isArray(override)) return mergeArray(label, base, override, rule, path);
  if (isPlainObject(base) && isPlainObject(override)) {
    return mergeObject(label, base, override, isArrayRule(rule) ? undefined : (rule as RuleNode), path);
  }
  return clone(override);
}

function mergeObject(label: string, base: PlainObject, override: PlainObject, rules: RuleNode, path: string[]): PlainObject {
  const out = clone(base);
  const nested = isPlainObject(rules) ? (rules as { readonly [key: string]: RuleNode }) : undefined;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    if (value === null) {
      delete out[key];
      continue;
    }
    out[key] = Object.hasOwn(base, key) ? mergeValue(label, base[key], value, nested?.[key], [...path, key]) : clone(value);
  }
  return out;
}

/**
 * lib の設定の定義を作る。defaults は lib の設定の型で注釈した値を渡す(`const defaults: ToastConfig = {...}`)
 * @example
 * const toastConfigDef = defineConfig(defaults, { label: "toast", arrays: { positions: { by: "key" } }, schema });
 * export type ToastOverride<E extends object = {}> = OverrideOf<typeof toastConfigDef, E>;
 * export const toastConfig = toastConfigDef.compose(override); // override = @lib-config/toast の default export
 */
export function defineConfig<D extends object, const R extends ConfigRules<D> = Record<never, never>>(
  defaults: D,
  rules?: R,
): ConfigDefinition<D, R> {
  const resolvedRules = (rules ?? {}) as R;
  const label = resolvedRules.label ?? "config";
  if (!isPlainObject(defaults)) throw new ConfigError(label, "既定はプレーンなオブジェクトで渡します");
  checkRules(label, defaults, resolvedRules.arrays as RuleNode, []);
  return {
    defaults,
    rules: resolvedRules,
    compose(override) {
      if (override !== undefined && !isPlainObject(override)) throw new ConfigError(label, "上書きはプレーンなオブジェクトで書きます");
      const value = mergeObject(label, defaults as PlainObject, (override ?? {}) as PlainObject, resolvedRules.arrays as RuleNode, []);
      const schema = resolvedRules.schema;
      if (schema) {
        const result = schema["~standard"].validate(value);
        if (result instanceof Promise || typeof (result as { then?: unknown }).then === "function") {
          throw new ConfigError(label, "設定の検査は同期で返す schema を使います(非同期の検査は使えません)");
        }
        if ("issues" in result && result.issues) throw new ConfigValidationError(label, result.issues);
      }
      return value as never;
    },
  };
}
