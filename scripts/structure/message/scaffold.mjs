// scripts/structure/message/scaffold.mjs
// 新しい連絡の 3 本(定義 messages/<名前>.ts・描き方 views/<名前>.tsx と views/<名前>.default.tsx)を無い時だけ書く(pnpm generate message の中身)。
// 引数: <domain> <name> [--kind marketing|activity|transactional] [--category <key>] [--channels a,b] [--core]
// - 引数なし = 何もしない(pnpm generate の一括でも回る)。質問はしない
// - exit 2(書かない): 知らない引数・domain が features の地区(src/features の下のフォルダ、地区の地図の読み手で読む)に無い・名前が camelCase でない・
//   core のドメインに --core が無い(fork の持ち場の外)・知らない kind・category が受け口に無い・marketing / activity に category が無い・
//   知らない経路(経路の受け口の項目に無い)
// - 既にあるファイルは触らない(理由を出す)。書いた時だけ呼び手が src/registry を作り直す
// 雛形: ./templates.mjs

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";
import { CATEGORY_POINT, readCategoryKeys } from "../extensions/derive/messageGuards.mjs";
import { definitionTemplate, viewDefaultTemplate, viewSwitchTemplate } from "./templates.mjs";

const NAME = /^[a-z][A-Za-z0-9]*$/;
const KINDS = ["transactional", "marketing", "activity"];
const DEFAULT_CHANNELS = ["email", "inApp"];
const MESSAGING_DIR = "src/features/core/messaging";
const USAGE = "使い方: pnpm generate message -- <domain> <name> [--kind marketing|activity|transactional] [--category <key>] [--channels email,inApp] [--core]";

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

/** categories の受け口の項目の鍵(字面) */
function categoryKeysOf(repoRoot) {
  const dir = `${MESSAGING_DIR}/categories`;
  const files = receptacleItemNames(repoRoot, dir).flatMap((name) =>
    [`${dir}/${name}.ts`, `${dir}/${name}.tsx`, `${dir}/${name}/index.ts`, `${dir}/${name}/index.tsx`].filter((path) => existsSync(join(repoRoot, path))),
  );
  return readCategoryKeys(repoRoot, [{ ...CATEGORY_POINT, spec: { dir: "categories", export: "category" } }], files) ?? [];
}

/** @returns {{ ok: true, value: { domain, name, kind, category, channels, core } } | { ok: false, reason: string } | null} null = 引数なし */
export function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  if (args.length === 0) return null;
  const positional = [];
  const options = { kind: "transactional", category: null, channels: DEFAULT_CHANNELS, core: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--core") options.core = true;
    else if (arg === "--kind" || arg === "--category" || arg === "--channels") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) return { ok: false, reason: `${arg} に値が要ります` };
      i += 1;
      if (arg === "--kind") options.kind = value;
      if (arg === "--category") options.category = value;
      if (arg === "--channels") options.channels = [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
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
  const { domain, name, kind, category, channels, core } = parsed.value;

  if (!NAME.test(name)) return fail(`名前 ${name} は英小文字始まりの camelCase で書く(連絡の鍵 <domain>.<name> の後ろ)`);
  const district = readDistrictMapAt(repoRoot).districts.find((d) => d.kind === "features" && d.dir.split("/").at(-1) === domain);
  if (!district) {
    return fail(`ドメイン ${domain} は features の地区(src/features/<domain> か src/features/core/<domain>)に無い`);
  }
  if (district.dir.startsWith("src/features/core/") && !core) {
    return fail(`${district.dir} は core のドメイン(fork は足せない: pnpm workflow ownership check が落ちる)。上流が足す時だけ --core`);
  }
  if (!KINDS.includes(kind)) return fail(`kind ${kind} は ${KINDS.join(" / ")} のどれか`);
  const categories = categoryKeysOf(repoRoot);
  if (category !== null && !categories.includes(category)) {
    return fail(`category ${category} は categories の受け口に無い(${categories.join(" / ") || "項目なし"})。先に ${MESSAGING_DIR}/categories/<名前>.ts を足す`);
  }
  if (category === null && kind !== "transactional") return fail(`${kind} の連絡は --category が要る(${categories.join(" / ") || "項目なし"})`);
  const known = receptacleItemNames(repoRoot, `${MESSAGING_DIR}/channels`);
  const unknown = channels.filter((channel) => !known.includes(channel));
  if (channels.length === 0 || unknown.length > 0) {
    return fail(`経路 ${unknown.join(", ") || "(空)"} は経路の受け口に無い(${known.join(" / ")})`);
  }

  const key = `${domain}.${name}`;
  const dir = `${district.dir}/messages`;
  const files = [{ path: `${dir}/${name}.ts`, content: (path) => definitionTemplate({ path, key, kind, category, channels }) }];
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
