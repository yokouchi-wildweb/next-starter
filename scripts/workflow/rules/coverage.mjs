// scripts/workflow/rules/coverage.mjs — pnpm check rules の paths の覆いの検査
// 上流のファイル(Tier1 では追跡中の全部、fork では基準の版にある物)と書き場所の一覧(intake.txt)の各行が、どれかの上流の core のファイルか上流の札の paths に当たること。
// 決まりの要らない場所は .claude/rules/core/uncovered.txt で外す。当たらない物があれば Tier1 は exit 1、fork は知らせだけ(D223)。
// 照合は Claude Code の実際の読み込みと同じ(lib.rulePaths の matchesLoad、D225)
// (塞ぎ方: その場所の決まりを持つ core のファイルの paths を広げる。広げるのは人の承認の項目 = core/design.md authoring approval)。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INTAKE_PATH } from "../../../src/lib/forkOwnership/node.mjs";
import { coverageGaps, coverageVerdict, parseIntakeRows, parseUncovered } from "./lib.ruleCoverage.mjs";
import { parsePaths } from "./lib.rulePaths.mjs";
import { CORE_DIR, ITEMS_DIR, mdUnder, upstreamReader } from "./lib.ruleRepo.mjs";

const root = join(import.meta.dirname, "../../..");
const UNCOVERED_FILE = `${CORE_DIR}/uncovered.txt`;
const read = (p) => readFileSync(join(root, p), "utf8");

const { isTier1, upstreamOf, note } = upstreamReader(root);
const ruleFiles = [...mdUnder(root, CORE_DIR), ...mdUnder(root, ITEMS_DIR).filter(upstreamOf)];
const rulePaths = ruleFiles.flatMap((f) => parsePaths(read(f)) ?? []);
const uncovered = existsSync(join(root, UNCOVERED_FILE)) ? parseUncovered(read(UNCOVERED_FILE)).map((u) => u.glob) : [];
// 書く場所 = 上流が書く場所(fork では基準の版にあるファイル)+ 書き場所の一覧の行(D138)。fork が自分で足したファイルは数えない
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\0").filter(Boolean).filter(upstreamOf);
const intake = existsSync(join(root, INTAKE_PATH)) ? parseIntakeRows(read(INTAKE_PATH)) : [];

const gaps = coverageGaps({ files, intake, rulePaths, uncovered });
// 止めるのは Tier1 だけ。fork は知らせるだけ、基準の版が読めない fork は全部を数えず 1 行(D223)
const verdict = coverageVerdict({ isTier1, baseNote: note, gaps });
if (verdict.level === "unverified") {
  console.log(`rules coverage: ${verdict.lines[0]}`);
} else {
  console.log(`rules coverage: ファイル ${files.length} 本・書き場所 ${intake.length} 行、穴 ${gaps.files.length + gaps.intake.length}(外す場所 ${uncovered.length})`);
  const label = verdict.level === "fail" ? "失敗" : "知らせ";
  for (const line of verdict.lines) console.error(`${label}: ${line}`);
  if (verdict.lines.length) console.error(`塞ぎ方: その場所の決まりを持つ core のファイルの paths を広げる | 決まりの要らない場所だけ ${UNCOVERED_FILE} に理由つきで足す${isTier1 ? "" : "(fork の穴は止めない、上流の物なら /order <direct parent>)"}`);
}
process.exitCode = verdict.exitCode;
