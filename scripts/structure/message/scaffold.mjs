// scripts/structure/message/scaffold.mjs
// 新しい連絡の 3 本(定義 messages/<名前>.ts・描き方 views/<名前>.tsx と views/<名前>.default.tsx)を無い時だけ書く(pnpm generate message の中身)。
// 引数: <domain> <name> --category <key> --label <名前> [--core](名前 = 管理画面に出す連絡の名前、必須 D46)
//(種別と経路は種類から引く D81・D86。種類 = 利用者から見て 1 つの出来事 D79)
// - 引数なし = 何もしない(pnpm generate の一括でも回る)。質問はしない
// - exit 2(書かない): 知らない引数・domain が features の地区(src/features の下のフォルダ、地区の地図の読み手で読む)に無い・名前が camelCase でない・
//   core のドメインに --core が無い(fork の持ち場の外)・--category が無い・category が受け口に無い・種類の経路が経路の受け口に無い
// - 既にあるファイルは触らない(理由を出す)。書いた時だけ呼び手が src/registry を作り直す
// 雛形: ./templates.mjs

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";
import { CATEGORY_POINT, readCategories } from "../extensions/derive/messageGuards.mjs";
import { definitionTemplate, viewDefaultTemplate, viewSwitchTemplate } from "./templates.mjs";

const NAME = /^[a-z][A-Za-z0-9]*$/;
const MESSAGING_DIR = "src/features/core/messaging";
const USAGE = "使い方: pnpm generate message -- <domain> <name> --category <key> --label <名前> [--core]";
/** 種類の名前の付け方の案内(D79) */
const NAMING =
  "種類 = 利用者から見て 1 つの出来事(「〜した時」と言える単位: 例 likeReceived・itemSold・passwordReset・pointExpiring)。" +
  "ドメイン・機能の単位(shop・account・wallet)にはしない。無ければ先に src/features/core/messaging/categories/<名前>.ts を足す(種別と経路を持つ)";

/** 受け口の項目の名前(<dir>/<名前>.ts(x) か <名前>/index.ts(x)) */
function receptacleItemNames(repoRoot, dir) {
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile()) {
      const match = /^([^.]+)\.tsx?$/.exec(entry.name);
      return match && !/\.test\./.test(entry.name) ? [match[1]] : [];
    }
    if (entry.isDirectory() && ["index.ts", "index.tsx"].some((file) => existsSync(join(abs, entry.name, file)))) return [entry.name];
    return [];
  });
}

/** categories の受け口の項目(字面。鍵 → { kind, channels }) */
function categoriesOf(repoRoot) {
  const dir = `${MESSAGING_DIR}/categories`;
  const files = receptacleItemNames(repoRoot, dir).flatMap((name) =>
    [`${dir}/${name}.ts`, `${dir}/${name}.tsx`, `${dir}/${name}/index.ts`, `${dir}/${name}/index.tsx`].filter((path) => existsSync(join(repoRoot, path))),
  );
  return readCategories(repoRoot, [{ ...CATEGORY_POINT, spec: { dir: "categories", export: "category" } }], files) ?? new Map();
}

/** @returns {{ ok: true, value: { domain, name, category, label, core } } | { ok: false, reason: string } | null} null = 引数なし */
export function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  if (args.length === 0) return null;
  const positional = [];
  const options = { category: null, label: null, core: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--core") options.core = true;
    else if (arg === "--category" || arg === "--label") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) return { ok: false, reason: `${arg} に値が要ります` };
      i += 1;
      if (arg === "--category") options.category = value;
      else options.label = value;
    } else if (arg === "--kind" || arg === "--channels") {
      return { ok: false, reason: `${arg} は無くなりました(種別と経路は種類 --category から引く)` };
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
  const { domain, name, category, label, core } = parsed.value;

  if (!NAME.test(name)) return fail(`名前 ${name} は英小文字始まりの camelCase で書く(連絡の鍵 <domain>.<name> の後ろ)`);
  const district = readDistrictMapAt(repoRoot).districts.find((d) => d.kind === "features" && d.dir.split("/").at(-1) === domain);
  if (!district) {
    return fail(`ドメイン ${domain} は features の地区(src/features/<domain> か src/features/core/<domain>)に無い`);
  }
  if (district.dir.startsWith("src/features/core/") && !core) {
    return fail(`${district.dir} は core のドメイン(fork は足せない: pnpm workflow ownership check が落ちる)。上流が足す時だけ --core`);
  }
  const categories = categoriesOf(repoRoot);
  const keys = [...categories.keys()].sort().join(" / ") || "項目なし";
  if (category === null) return fail(`--category が要る(${keys})。${NAMING}`);
  if (label === null || label.trim() === "") return fail("--label が要る(管理画面に出す連絡の名前。例 --label 注文の受付)");
  const item = categories.get(category);
  if (!item) return fail(`category ${category} は categories の受け口に無い(${keys})。${NAMING}`);
  const channels = item.channels ?? [];
  const known = receptacleItemNames(repoRoot, `${MESSAGING_DIR}/channels`);
  const unknown = channels.filter((channel) => !known.includes(channel));
  if (channels.length === 0 || unknown.length > 0) {
    return fail(`種類 ${category} の経路 ${unknown.join(", ") || "(空)"} は経路の受け口に無い(${known.join(" / ")})`);
  }

  const key = `${domain}.${name}`;
  const dir = `${district.dir}/messages`;
  const files = [{ path: `${dir}/${name}.ts`, content: (path) => definitionTemplate({ path, key, label, category, kind: item.kind, channels }) }];
  if (channels.includes("email")) {
    files.push(
      { path: `${dir}/views/${name}.tsx`, content: () => viewSwitchTemplate({ key, name }) },
      { path: `${dir}/views/${name}.default.tsx`, content: (path) => viewDefaultTemplate({ path, key }) },
    );
  }
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
