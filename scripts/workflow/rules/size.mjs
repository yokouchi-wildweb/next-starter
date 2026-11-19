// scripts/workflow/rules/size.mjs — pnpm check rules の大きさの検査(1 ファイルの字数の線と 1 行の長さ)
// 線の正本: .claude/rules/core/design.md の size の節。作業の場面ごとの読み込みの量は数えない。
// CLAUDE.md が知らせる線を超えたら通して知らせる(出荷したセッションが窓口へまとめ直しの依頼を 1 本)。失敗の線で exit 1。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CORE_DIR, ITEMS_DIR, mdUnder as mdUnderRoot, SERVICE_DIR, upstreamReader } from "./lib.ruleRepo.mjs";
import { charCount, judgeSize, longLines, MAX_LINE_CHARS, SIZE_LINES } from "./lib.ruleSize.mjs";

const root = join(import.meta.dirname, "../../..");

const read = (p) => readFileSync(join(root, p), "utf8");
const mdUnder = (dir) => mdUnderRoot(root, dir);

// 上流の物 = Tier1 では全部、fork では基準の版(台帳の最後の upstream:<sha>)にある物
const { upstreamOf, note } = upstreamReader(root);
const notes = note ? [note] : [];

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
sizeOf("CLAUDE.md", SIZE_LINES.claudeMd, "CLAUDE.md ");
linesOf("CLAUDE.md", "fail");

// core のファイル(全部 Tier1 の物)
const coreFiles = mdUnder(CORE_DIR);
for (const f of coreFiles) {
  sizeOf(f, SIZE_LINES.core, "core のファイル 1 本");
  linesOf(f, "fail");
}

// 札と service(自分の札の 1 行の長さは知らせるだけ、ほかは止める)
const cards = mdUnder(ITEMS_DIR);
for (const f of cards) {
  sizeOf(f, SIZE_LINES.card, "札 1 枚 ");
  linesOf(f, upstreamOf(f) ? "fail" : "notify");
}
for (const f of mdUnder(SERVICE_DIR)) {
  sizeOf(f, SIZE_LINES.service, "service 1 枚 ");
  linesOf(f, "fail");
}

console.log(`rules size: CLAUDE.md・core ${coreFiles.length} 本・札 ${cards.length} 枚・service を見た(CLAUDE.md 知らせる ${SIZE_LINES.claudeMd.notify}・失敗 ${SIZE_LINES.claudeMd.fail}、core と service 1 本 ${SIZE_LINES.core.fail}、札 ${SIZE_LINES.card.fail}、1 行 ${MAX_LINE_CHARS})`);

for (const n of notes) console.error(`note: ${n}`);
for (const n of notifies) console.error(`知らせ: ${n}`);
if (notifies.length) console.error("知らせる線を超えた物がある: 出荷は止めない。出荷したセッションが窓口(/order next-starter)へまとめ直しの依頼を 1 本出す(同じ題の開いた依頼があれば足さない)");
for (const f of fails) console.error(`失敗: ${f}`);
process.exitCode = fails.length ? 1 : 0;
