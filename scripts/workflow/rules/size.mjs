// scripts/workflow/rules/size.mjs — pnpm check rules の大きさの検査(字数の線と場面の合計)
// 線と数え方の正本: .claude/rules/core/design.md の size の節。場面のデータ: .claude/rules/core/scenes.jsonl
// 知らせる線を超えた物は通して知らせる(出荷したセッションが窓口へまとめ直しの依頼を 1 本)。失敗の線で exit 1。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readBaseFiles } from "../../../src/lib/forkOwnership/baseFiles.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { charCount, judgeSize, longLines, MAX_LINE_CHARS, parseScenes, sceneTotals, SIZE_LINES } from "./lib.ruleSize.mjs";

const root = join(import.meta.dirname, "../../..");
const CORE_DIR = ".claude/rules/core";
const SCENES_FILE = `${CORE_DIR}/scenes.jsonl`;

const read = (p) => readFileSync(join(root, p), "utf8");
const mdUnder = (dir) => {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".md"))
    .map((f) => relative(root, join(abs, f)))
    .sort();
};

// 上流の物 = Tier1 では全部、fork では基準の版(台帳の最後の upstream:<sha>)にある物
const identity = readForkIdentity(root);
let upstreamOf = () => true;
const notes = [];
if (!identity.isTier1) {
  const base = readBaseFiles(root);
  if ("problem" in base) notes.push(`上流の札の見分けが付かない(${base.problem})→ 札は全部を上流として数えた`);
  else upstreamOf = (path) => base.files.includes(path);
}

const fails = [];
const notifies = [];
const say = (kind, msg) => (kind === "fail" ? fails : notifies).push(msg);

function sizeOf(path, line, label) {
  const chars = charCount(read(path));
  const verdict = judgeSize(chars, line);
  if (verdict === "ok") return chars;
  const bound = verdict === "fail" ? line.fail : line.notify;
  say(verdict, `${path}: ${chars} 字(${label}の${verdict === "fail" ? "失敗" : "知らせる"}線 ${bound})`);
  return chars;
}

function linesOf(path, kind) {
  for (const l of longLines(read(path))) say(kind, `${path}:${l.line}: ${l.length} 字(1 行 ${MAX_LINE_CHARS} 字まで、同じ鍵の副行に割る)`);
}

// CLAUDE.md
// 書き直しの出荷までは(fail が null の間)知らせも依頼も出さず note だけ: 縮めるのは書き直しそのもの
if (SIZE_LINES.claudeMd.fail === null) {
  const chars = charCount(read("CLAUDE.md"));
  if (chars > SIZE_LINES.claudeMd.notify) notes.push(`CLAUDE.md ${chars} 字(知らせる線 ${SIZE_LINES.claudeMd.notify}、失敗の線 ${SIZE_LINES.claudeMd.failLater} は書き直しの出荷から。それまでの依頼は要らない)`);
} else sizeOf("CLAUDE.md", SIZE_LINES.claudeMd, "CLAUDE.md ");
linesOf("CLAUDE.md", "fail");

// core のファイル(全部 Tier1 の物)
const coreFiles = mdUnder(CORE_DIR);
for (const f of coreFiles) {
  sizeOf(f, SIZE_LINES.core, "core のファイル 1 本");
  linesOf(f, "fail");
}

// 札と service(自分の札の 1 行の長さは知らせるだけ、ほかは止める)
const cards = mdUnder(".claude/rules/items");
for (const f of cards) {
  sizeOf(f, SIZE_LINES.card, "札 1 枚 ");
  linesOf(f, upstreamOf(f) ? "fail" : "notify");
}
for (const f of mdUnder(".claude/rules/service")) {
  sizeOf(f, SIZE_LINES.service, "service 1 枚 ");
  linesOf(f, "fail");
}

// 場面の合計(上流の core のファイルと上流の札だけ。CLAUDE.md・service・fork の文脈は数えない)
if (!existsSync(join(root, SCENES_FILE))) fails.push(`${SCENES_FILE} が無い`);
else {
  const scenes = parseScenes(read(SCENES_FILE));
  const rules = [...coreFiles, ...cards.filter(upstreamOf)].map((path) => ({ path, text: read(path) }));
  const totals = sceneTotals(scenes, rules);
  for (const t of totals) {
    const verdict = judgeSize(t.chars, SIZE_LINES.scene);
    if (verdict !== "ok") say(verdict, `場面 ${t.id}(${t.scene}): ${t.chars} 字(場面の${verdict === "fail" ? "失敗" : "知らせる"}線 ${verdict === "fail" ? SIZE_LINES.scene.fail : SIZE_LINES.scene.notify})`);
  }
  if (process.argv.includes("--scenes")) for (const t of totals) console.log(`${t.id}\t${t.chars}\t${t.scene}\t${t.loaded.map((p) => p.split("/").pop()).join(",")}`);
  const max = totals.reduce((a, b) => (b.chars > a.chars ? b : a));
  console.log(`rules size: 場面 ${totals.length} 個、最大 ${max.id} ${max.chars} 字(目標 ${SIZE_LINES.scene.target}・知らせる ${SIZE_LINES.scene.notify}・失敗 ${SIZE_LINES.scene.fail})`);
}

for (const n of notes) console.error(`note: ${n}`);
for (const n of notifies) console.error(`知らせ: ${n}`);
if (notifies.length) console.error("知らせる線を超えた物がある: 出荷は止めない。出荷したセッションが窓口(/order next-starter)へまとめ直しの依頼を 1 本出す(同じ題の開いた依頼があれば足さない)");
for (const f of fails) console.error(`失敗: ${f}`);
process.exitCode = fails.length ? 1 : 0;
