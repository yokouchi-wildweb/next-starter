// 生成器の phase.json の outputs(生成器が出力を宣言する唯一の場所)を読み、pnpm generate domain の出力の種類をパスに当てる純関数の .mjs。
// outputs の 1 行 = { glob, kind, source, part? }(全部の生成器で 1 つの形、D318)。kind = every-run | write-once、source = 変えたい時に直す物、
// part = ファイルの中で生成器が持つ部分(区画の名前・JSON の鍵。無い = ファイル丸ごと)。このリポの phase.json は strict で読む(短い形は止める)。
// 古い木(遅れた fork の区間の木、D313)の短い形(glob の文字列 = every-run、kind・source の省略)は strict でない読みでそろえる。
// データは JSON(src から scripts を import しない: 読み手が本文を渡す)。生成器の実際の書き込みとの照合は scripts/structure/domain/tests/outputs.test.mjs、
// パスの答えは pnpm workflow ownership who(src/lib/forkOwnership/explain.mjs)、受け口の一覧の generated の行は src/lib/districtMap/intakeRows.mjs(入力を集めるのは scripts/structure/extensions/intake.mjs)。
// glob の置き換え: {dir} = ドメインのフォルダ・{camel} = 登録名(生成の単位 = ドメインの中の登録 1 件、D336。省略 = フォルダ名)・{Pascal} = その PascalCase・
// {route} = 管理画面のルートのフォルダ。ドメインの並びは生成する登録 1 件ごとに 1 行(同じ dir が登録の数だけ並ぶ)。
// [ と ] は字そのもの([id] のルート。glob の文字の組には使わない)、* と ** は glob。

import { matchesGlob } from "node:path";

import { toPascalCase, toSnakeCase } from "../stringCase/index.mjs";
import { adminRouteFolderOf } from "./domainNames.mjs";

/** 出力の種類(毎回書き直す / 無いときだけ書く) */
export const OUTPUT_KINDS = ["every-run", "write-once"];
/** pnpm generate domain の出力の宣言の置き場(リポジトリ直下からの相対) */
export const DOMAIN_OUTPUTS_FILE = "scripts/structure/domain/phase.json";

/**
 * phase.json の outputs を { glob, kind, source?, part? } の並びにそろえる
 * @param {unknown} outputs phase.json の outputs(undefined = 宣言なし)
 * @param {{ strict?: boolean }} [options] strict = このリポの phase.json の検査(scripts/runner/phases/scan.mjs): 1 つの形
 *   { glob, kind, source, part? } だけを通す。省略 = 読むだけ(古い木の短い形 = glob の文字列・kind や source の省略もそろえる)
 * @returns {{ entries: { glob: string, kind: "every-run" | "write-once", source?: string, part?: string }[], problems: string[] }} problems は「outputs ...」で始まる理由
 */
export function normalizeGateOutputs(outputs, { strict = false } = {}) {
  if (outputs === undefined) return { entries: [], problems: [] };
  const form = strict ? "{ glob, kind, source, part? }" : "glob の文字列か { glob, kind?, source?, part? }";
  if (!Array.isArray(outputs)) return { entries: [], problems: [`outputs は配列(1 行 = ${form})`] };
  /** @type {string[]} */
  const problems = [];
  const entries = outputs.map((entry, index) => {
    if (typeof entry === "string") {
      if (strict) problems.push(`outputs[${index}] は ${form}(glob の文字列の略記は古い形: .notices/20261124-033209-flux-rebuild.outputs-form.mjs で書き換える)`);
      else if (entry === "") problems.push(`outputs[${index}] の glob が空`);
      return { glob: entry, kind: "every-run" };
    }
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      problems.push(`outputs[${index}] は ${form}`);
      return null;
    }
    for (const key of Object.keys(entry)) if (!["glob", "kind", "source", "part"].includes(key)) problems.push(`outputs[${index}] の知らない欄 ${key}`);
    if (typeof entry.glob !== "string" || entry.glob === "") problems.push(`outputs[${index}] の glob が無い`);
    if (strict && entry.kind === undefined) problems.push(`outputs[${index}] の kind が無い(${OUTPUT_KINDS.join(" | ")})`);
    if (entry.kind !== undefined && !OUTPUT_KINDS.includes(entry.kind)) problems.push(`outputs[${index}] の kind は ${OUTPUT_KINDS.join(" | ")}`);
    if (strict && entry.source === undefined) problems.push(`outputs[${index}] の source が無い(変えたい時に直す物)`);
    if (entry.source !== undefined && (typeof entry.source !== "string" || entry.source === "")) problems.push(`outputs[${index}] の source は空でない文字列`);
    if (entry.part !== undefined && (typeof entry.part !== "string" || entry.part === "")) problems.push(`outputs[${index}] の part は空でない文字列(区画の名前か JSON の鍵)`);
    return { ...entry, kind: entry.kind ?? "every-run" };
  });
  return { entries: problems.length > 0 ? [] : entries, problems };
}

/** ドメインごとの置き換え({dir} など)を持つ glob か(ドメインに当てて初めてパスになる) */
export const isDomainTemplateGlob = (/** @type {string} */ glob) => /\{(dir|camel|Pascal|route)\}/.test(glob);

/**
 * 受け口の一覧の generated の行になる glob: every-run で、part の無い、ドメインの置き換えを持たない物(write-once は持ち主の手書き、
 * part のある行はファイルの中の持ち分でファイルの種類は別の行が決める、置き換えを持つ物はドメインに当てて pnpm workflow ownership who が答える)
 * @param {unknown} outputs phase.json の outputs
 * @returns {string[]}
 */
export function intakeOutputGlobs(outputs) {
  return normalizeGateOutputs(outputs)
    // core の生成物(.claude/rules/core/terms.md)は Tier1 の物: fork は書かない(fork で作り直しても同じ中身)ので書き場所に載せない
    // part のある行 = ファイルの中の持ち分だけ(vercel.json の crons): ファイルの種類はそのファイルの行(self など)が決めるので generated の行にしない
    .entries.filter((entry) => entry.kind === "every-run" && !entry.part && !isDomainTemplateGlob(entry.glob) && !entry.glob.startsWith(".claude/rules/core/"))
    .map((entry) => entry.glob);
}

/**
 * pnpm generate domain の phase.json の本文から出力の宣言を読む
 * @param {string} text scripts/structure/domain/phase.json の本文
 * @returns {{ outputs: { glob: string, kind: "every-run" | "write-once", source?: string }[], problems: string[] }}
 */
export function parseDomainOutputs(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { outputs: [], problems: [`${DOMAIN_OUTPUTS_FILE}: JSON でない(${error instanceof Error ? error.message : String(error)})`] };
  }
  if (!Array.isArray(data?.outputs)) return { outputs: [], problems: [`${DOMAIN_OUTPUTS_FILE}: outputs は配列`] };
  const { entries, problems } = normalizeGateOutputs(data.outputs);
  return { outputs: entries, problems: problems.map((problem) => `${DOMAIN_OUTPUTS_FILE}: ${problem}`) };
}

/**
 * 1 つの生成の単位(ドメインの中の登録 1 件)の置き換えの値
 * @param {{ dir: string, plural?: string, registration?: string }} domain dir = リポジトリ直下からのドメインのフォルダ、plural = その登録の entity.json の plural、
 *   registration = 登録名(省略 = フォルダ名 = 表 1 つのドメイン)
 */
export function domainNamesOf({ dir, plural, registration }) {
  const camel = registration ?? dir.slice(dir.lastIndexOf("/") + 1);
  return { dir, camel, Pascal: toPascalCase(toSnakeCase(camel)), route: adminRouteFolderOf(camel, plural) };
}

/**
 * glob の置き換え({dir} など)をドメインの値で埋める
 * @param {string} text
 * @param {ReturnType<typeof domainNamesOf>} names
 */
const fill = (text, names) => text.replace(/\{(dir|camel|Pascal|route)\}/g, (_, /** @type {"dir" | "camel" | "Pascal" | "route"} */ key) => names[key]);
/** @param {string} glob */
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
