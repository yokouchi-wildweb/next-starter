// scripts/structure/message/scaffold.mjs
// 新しい連絡の定義 plugs/messages/<名前>.ts を無い時だけ書く(pnpm generate message の中身)。描き方はレイアウト(messaging/layouts)が持つ。
// 引数: <domain> <name> --category <key> --label <名前> [--var <鍵>:<別名>:<説明> ...] [--core](名前 = 管理画面に出す連絡の名前、必須 D46。
//   --var = vars の値 1 つの鍵・日本語の別名・説明、繰り返せる・任意 D133。無ければ vars は空)
//(種別と送信チャンネルはカテゴリーから引く D81・D86。カテゴリー = 利用者から見て 1 つの出来事 D79)
// - 引数なし = 何もしない(pnpm generate の一括でも回る)。質問はしない
// - exit 2(書かない): 知らない引数・domain が domains の地区(src/domains の下のフォルダ、地区の地図の読み手で読む)に無い・名前が camelCase でない・
//   core のドメインに --core が無い(fork の持ち場の外)・--category が無い・category が受け口に無い・カテゴリーの送信チャンネルが送信チャンネルの受け口に無い・
//   --var の形が違う(鍵が camelCase でない・別名の形・説明が空・鍵か別名の重なり)
// - 既にあるファイルは触らない(理由を出す)。書いた時だけ呼び手が src/registry を作り直す
// 雛形: ./templates.mjs

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";
import { CATEGORY_POINT, readCategories } from "../extensions/derive/messageGuards.mjs";
import { listSrcFiles } from "../extensions/orphans.mjs";
import { definitionTemplate } from "./templates.mjs";

const NAME = /^[a-z][A-Za-z0-9]*$/;
/** 埋め込み情報の別名の形(lib/messaging vars/names.ts の VAR_ALIAS_PATTERN と同じ。scripts は src の lib を読まない) */
const ALIAS = /^(?=.*[^A-Za-z0-9_])[\p{L}\p{N}_]+$/u;
const USAGE = "使い方: pnpm generate message -- <domain> <name> --category <key> --label <名前> [--var <鍵>:<別名>:<説明> ...] [--core]";
/** カテゴリーの名前の付け方の案内(D79) */
const NAMING =
  "カテゴリー = 利用者から見て 1 つの出来事(「〜した時」と言える単位: 例 likeReceived・itemSold・passwordReset・pointExpiring)。" +
  "ドメイン・機能の単位(shop・account・wallet)にはしない。無ければ先にその出来事のドメインの plugs/messagingCategories/<名前>.ts を足す(種別と送信チャンネルを持つ)";

/** plugs の点の項目の名前(全部のドメイン・lib の <…>/plugs/<点>/<名前>.ts(x) か <名前>/index.ts(x)。.test・.override は除く) */
function plugItemNames(files, point) {
  const pattern = new RegExp(`^src/(?:domains|lib)/.+/plugs/${point}/([^/.]+)(?:\\.tsx?|/index\\.tsx?)$`);
  return [...new Set(files.flatMap((file) => pattern.exec(file)?.[1] ?? []))].sort();
}

/** 点 messagingCategories の項目(字面。鍵 → { kind, channels }) */
function categoriesOf(repoRoot, files) {
  return readCategories(repoRoot, [{ ...CATEGORY_POINT, spec: { plugs: true, export: "category" } }], files) ?? new Map();
}

/**
 * --var の値 <鍵>:<別名>:<説明>(説明は : を含んでよい)
 * @returns {{ key: string, alias: string, description: string } | null}
 */
function parseVar(value) {
  const [key, alias, ...rest] = value.split(":");
  const description = rest.join(":").trim();
  if (!key || !alias || !description) return null;
  return { key: key.trim(), alias: alias.trim(), description };
}

/** @returns {{ ok: true, value: { domain, name, category, label, vars, core } } | { ok: false, reason: string } | null} null = 引数なし */
export function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  if (args.length === 0) return null;
  const positional = [];
  const options = { category: null, label: null, vars: [], core: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--core") options.core = true;
    else if (arg === "--var") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) return { ok: false, reason: "--var に値が要ります(<鍵>:<別名>:<説明>)" };
      i += 1;
      const parsedVar = parseVar(value);
      if (!parsedVar) return { ok: false, reason: `--var ${value} は <鍵>:<別名>:<説明> で書く(例 --var orderId:注文番号:受け付けた注文の番号)` };
      options.vars.push(parsedVar);
    } else if (arg === "--category" || arg === "--label") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) return { ok: false, reason: `${arg} に値が要ります` };
      i += 1;
      if (arg === "--category") options.category = value;
      else options.label = value;
    } else if (arg === "--kind" || arg === "--channels") {
      return { ok: false, reason: `${arg} は無くなりました(種別と送信チャンネルはカテゴリー --category から引く)` };
    } else if (arg.startsWith("-")) return { ok: false, reason: `知らない引数です: ${arg}` };
    else positional.push(arg);
  }
  if (positional.length !== 2) return { ok: false, reason: "<domain> と <name> の 2 つを渡してください" };
  return { ok: true, value: { domain: positional[0], name: positional[1], ...options } };
}

/**
 * @param {string} repoRoot
 * @param {string[]} argv
 * @returns {{ code: 0 | 2, lines: string[], written: string[] }}
 */
export function runMessageScaffold(repoRoot, argv) {
  const parsed = parseArgs(argv);
  if (parsed === null) return { code: 0, lines: [`[generate message] 引数が無いので何もしません(${USAGE})`], written: [] };
  const fail = (reason) => ({ code: 2, lines: [`✗ ${reason}`, USAGE], written: [] });
  if (!parsed.ok) return fail(parsed.reason);
  const { domain, name, category, label, vars, core } = parsed.value;

  if (!NAME.test(name)) return fail(`名前 ${name} は英小文字始まりの camelCase で書く(連絡の鍵 <domain>.<name> の後ろ)`);
  const district = readDistrictMapAt(repoRoot).districts.find((d) => d.kind === "domains" && d.dir.split("/").at(-1) === domain);
  if (!district) {
    return fail(`ドメイン ${domain} は domains の地区(src/domains/<domain> か src/domains/core/<domain>)に無い`);
  }
  if (district.dir.startsWith("src/domains/core/") && !core) {
    return fail(`${district.dir} は core のドメイン(fork は足せない: pnpm workflow ownership check が落ちる)。上流が足す時だけ --core`);
  }
  const srcFiles = listSrcFiles(repoRoot);
  const categories = categoriesOf(repoRoot, srcFiles);
  const keys = [...categories.keys()].sort().join(" / ") || "項目なし";
  if (category === null) return fail(`--category が要る(${keys})。${NAMING}`);
  if (label === null || label.trim() === "") return fail("--label が要る(管理画面に出す連絡の名前。例 --label 注文の受付)");
  for (const [index, item] of vars.entries()) {
    if (!NAME.test(item.key)) return fail(`--var の鍵 ${item.key} は英小文字始まりの camelCase で書く`);
    if (!ALIAS.test(item.alias)) return fail(`--var の別名 ${item.alias} は空白・記号を含まず、英数字以外の字を含めて書く(例 注文番号)`);
    if (vars.findIndex((other) => other.key === item.key) !== index) return fail(`--var の鍵 ${item.key} が 2 回あります`);
    if (vars.findIndex((other) => other.alias === item.alias) !== index) return fail(`--var の別名 ${item.alias} が 2 回あります`);
  }
  const item = categories.get(category);
  if (!item) return fail(`category ${category} は点 messagingCategories に無い(${keys})。${NAMING}`);
  const channels = item.channels ?? [];
  const known = plugItemNames(srcFiles, "messagingChannels");
  const unknown = channels.filter((channel) => !known.includes(channel));
  if (channels.length === 0 || unknown.length > 0) {
    return fail(`カテゴリー ${category} の送信チャンネル ${unknown.join(", ") || "(空)"} は点 messagingChannels に無い(${known.join(" / ")})`);
  }

  const key = `${domain}.${name}`;
  const dir = `${district.dir}/plugs/messages`;
  const files = [{ path: `${dir}/${name}.ts`, content: (path) => definitionTemplate({ path, key, label, category, kind: item.kind, channels, vars }) }];
  const lines = [];
  const written = [];
  for (const file of files) {
    const abs = join(repoRoot, file.path);
    if (existsSync(abs)) {
      lines.push(`- 残しました(既にある。書き出しは無い時だけ): ${file.path}`);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.content(file.path));
    written.push(file.path);
    lines.push(`✓ 書きました: ${file.path}`);
  }
  if (written.length > 0) lines.push(`次: 文面と vars を直し、送り手から messagingService.sendMessage(message, …) で送る(連絡の鍵 ${key})`);
  return { code: 0, lines, written };
}
