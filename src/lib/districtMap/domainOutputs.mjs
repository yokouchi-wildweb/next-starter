// pnpm generate domain の出力の種類のデータ(scripts/structure/domain/outputs.json)をパスに当てる純関数の .mjs。
// データは JSON(src から scripts を import しない: 読み手が本文を渡す)。生成器の実際の書き込みとの照合は scripts/structure/domain/tests/outputs.test.mjs、
// パスの答えは pnpm workflow ownership who(src/lib/forkOwnership/explain.mjs)。
// glob の置き換え: {dir} = ドメインのフォルダ・{camel} = フォルダ名・{Pascal} = その PascalCase・{route} = 管理画面のルートのフォルダ。
// [ と ] は字そのもの([id] のルート。glob の文字の組には使わない)、* と ** は glob。

import { matchesGlob } from "node:path";

import { toPascalCase, toSnakeCase } from "../../utils/stringCase.mjs";
import { adminRouteFolderOf } from "./domainNames.mjs";

/** 出力の種類(毎回書き直す / 無いときだけ書く) */
export const OUTPUT_KINDS = ["every-run", "write-once"];
/** データの置き場(リポジトリ直下からの相対) */
export const DOMAIN_OUTPUTS_FILE = "scripts/structure/domain/outputs.json";

/**
 * データの本文を読む
 * @param {string} text outputs.json の本文
 * @returns {{ outputs: { glob: string, kind: "every-run" | "write-once", source?: string }[], problems: string[] }}
 */
export function parseDomainOutputs(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { outputs: [], problems: [`${DOMAIN_OUTPUTS_FILE}: JSON でない(${error.message})`] };
  }
  const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
  const problems = [];
  if (!Array.isArray(data?.outputs)) problems.push(`${DOMAIN_OUTPUTS_FILE}: outputs は配列`);
  outputs.forEach((entry, index) => {
    if (typeof entry?.glob !== "string" || entry.glob === "") problems.push(`${DOMAIN_OUTPUTS_FILE}: outputs[${index}] の glob が無い`);
    if (!OUTPUT_KINDS.includes(entry?.kind)) problems.push(`${DOMAIN_OUTPUTS_FILE}: outputs[${index}] の kind は ${OUTPUT_KINDS.join(" | ")}`);
    if (entry?.source !== undefined && typeof entry.source !== "string") problems.push(`${DOMAIN_OUTPUTS_FILE}: outputs[${index}] の source は文字列`);
  });
  return { outputs: problems.length > 0 ? [] : outputs, problems };
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
