// 生成器の gate.json の outputs(生成器が出力を宣言する唯一の場所)を読み、pnpm generate domain の出力の種類をパスに当てる純関数の .mjs。
// outputs の 1 行 = glob の文字列(= every-run)か { glob, kind?, source? }(kind 省略 = every-run)。
// データは JSON(src から scripts を import しない: 読み手が本文を渡す)。生成器の実際の書き込みとの照合は scripts/structure/domain/tests/outputs.test.mjs、
// パスの答えは pnpm workflow ownership who(src/lib/forkOwnership/explain.mjs)、受け口の一覧の generated の行は scripts/structure/extensions/intake.mjs。
// glob の置き換え: {dir} = ドメインのフォルダ・{camel} = フォルダ名・{Pascal} = その PascalCase・{route} = 管理画面のルートのフォルダ。
// [ と ] は字そのもの([id] のルート。glob の文字の組には使わない)、* と ** は glob。

import { matchesGlob } from "node:path";

import { toPascalCase, toSnakeCase } from "../../utils/stringCase.mjs";
import { adminRouteFolderOf } from "./domainNames.mjs";

/** 出力の種類(毎回書き直す / 無いときだけ書く) */
export const OUTPUT_KINDS = ["every-run", "write-once"];
/** pnpm generate domain の出力の宣言の置き場(リポジトリ直下からの相対) */
export const DOMAIN_OUTPUTS_FILE = "scripts/structure/domain/gate.json";

/**
 * gate.json の outputs を { glob, kind, source? } の並びにそろえる(文字列 = every-run)
 * @param {unknown} outputs gate.json の outputs(undefined = 宣言なし)
 * @returns {{ entries: { glob: string, kind: "every-run" | "write-once", source?: string }[], problems: string[] }} problems は「outputs ...」で始まる理由
 */
export function normalizeGateOutputs(outputs) {
  if (outputs === undefined) return { entries: [], problems: [] };
  if (!Array.isArray(outputs)) return { entries: [], problems: ["outputs は配列(1 行 = glob の文字列か { glob, kind?, source? })"] };
  const problems = [];
  const entries = outputs.map((entry, index) => {
    if (typeof entry === "string") {
      if (entry === "") problems.push(`outputs[${index}] の glob が空`);
      return { glob: entry, kind: "every-run" };
    }
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      problems.push(`outputs[${index}] は glob の文字列か { glob, kind?, source? }`);
      return null;
    }
    for (const key of Object.keys(entry)) if (!["glob", "kind", "source"].includes(key)) problems.push(`outputs[${index}] の知らない欄 ${key}`);
    if (typeof entry.glob !== "string" || entry.glob === "") problems.push(`outputs[${index}] の glob が無い`);
    if (entry.kind !== undefined && !OUTPUT_KINDS.includes(entry.kind)) problems.push(`outputs[${index}] の kind は ${OUTPUT_KINDS.join(" | ")}`);
    if (entry.source !== undefined && typeof entry.source !== "string") problems.push(`outputs[${index}] の source は文字列`);
    return { ...entry, kind: entry.kind ?? "every-run" };
  });
  return { entries: problems.length > 0 ? [] : entries, problems };
}

/** ドメインごとの置き換え({dir} など)を持つ glob か(ドメインに当てて初めてパスになる) */
export const isDomainTemplateGlob = (glob) => /\{(dir|camel|Pascal|route)\}/.test(glob);

/**
 * 受け口の一覧の generated の行になる glob: every-run で、ドメインの置き換えを持たない物(write-once は持ち主の手書き、
 * 置き換えを持つ物はドメインに当てて pnpm workflow ownership who が答える)
 * @param {unknown} outputs gate.json の outputs
 * @returns {string[]}
 */
export function intakeOutputGlobs(outputs) {
  return normalizeGateOutputs(outputs)
    .entries.filter((entry) => entry.kind === "every-run" && !isDomainTemplateGlob(entry.glob))
    .map((entry) => entry.glob);
}

/**
 * pnpm generate domain の gate.json の本文から出力の宣言を読む
 * @param {string} text scripts/structure/domain/gate.json の本文
 * @returns {{ outputs: { glob: string, kind: "every-run" | "write-once", source?: string }[], problems: string[] }}
 */
export function parseDomainOutputs(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { outputs: [], problems: [`${DOMAIN_OUTPUTS_FILE}: JSON でない(${error.message})`] };
  }
  if (!Array.isArray(data?.outputs)) return { outputs: [], problems: [`${DOMAIN_OUTPUTS_FILE}: outputs は配列`] };
  const { entries, problems } = normalizeGateOutputs(data.outputs);
  return { outputs: entries, problems: problems.map((problem) => `${DOMAIN_OUTPUTS_FILE}: ${problem}`) };
}

/**
 * 1 ドメインの置き換えの値
 * @param {{ dir: string, plural?: string }} domain dir = リポジトリ直下からのドメインのフォルダ、plural = domain.json の plural
 */
export function domainNamesOf({ dir, plural }) {
  const camel = dir.slice(dir.lastIndexOf("/") + 1);
  return { dir, camel, Pascal: toPascalCase(toSnakeCase(camel)), route: adminRouteFolderOf(camel, plural) };
}

const fill = (text, names) => text.replace(/\{(dir|camel|Pascal|route)\}/g, (_, key) => names[key]);
const literalBrackets = (glob) => glob.replace(/[[\]]/g, (ch) => `[${ch}]`);

/**
 * パスに当たる出力(最初に当たった物)。domains の順に、置き換えた glob と照らす
 * @param {string} path リポジトリ直下からの相対
 * @param {{ glob: string, kind: string, source?: string }[]} outputs
 * @param {{ dir: string, plural?: string }[]} domains 生成器が通るドメイン(generate: false を除くのは呼び手)
 * @returns {{ entry: object, domain: object, glob: string, source: string | null } | null} glob / source = 置き換え済み
 */
export function matchDomainOutput(path, outputs, domains) {
  for (const domain of domains) {
    const names = domainNamesOf(domain);
    for (const entry of outputs) {
      const glob = fill(entry.glob, names);
      if (matchesGlob(path, literalBrackets(glob))) return { entry, domain, glob, source: entry.source ? fill(entry.source, names) : null };
    }
  }
  return null;
}
