// scripts/workflow/rules/generated.mjs — pnpm check rules の生成物の検査(D135)
// 止める: 上流の生成器の出力の宣言(各 phase.json の outputs)が .claude/rules/core/generated.md の paths に当たらない /
//         毎回の出力(every-run、ドメインの生成器は作り直しの対象のドメインで生成の計画が実際に書く分)で、注釈を持てる形式なのに先頭に生成物の印が無い
// 書き場所の一覧の generated の行 = outputs の一致は scripts/structure/extensions/check.mjs が守る(intake.txt の生成区画のずれで止まる)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPhases, scanTargets } from "../../runner/phases/scan.mjs";
import { hasGeneratedMark, MARKABLE, outputFiles, outputsOutsidePaths } from "./lib.ruleGenerated.mjs";
import { nodeDomainSource, primaryRegistrationOf, readDomain } from "../../../src/lib/domain/node.mjs";
import { planUnmark } from "../../structure/domain/cli/unmark.mjs";
import { createWorkspace } from "../../structure/domain/domain/workspace.mjs";
import { everyRunPathsOf, planGenerateAll } from "../../structure/domain/pipeline/generateAll.mjs";
import { parsePaths } from "./lib.rulePaths.mjs";
import { CORE_DIR } from "./lib.ruleRepo.mjs";

const root = join(import.meta.dirname, "../../..");
const read = (p) => readFileSync(join(root, p), "utf8");
const DISTRICT_MAP = "src/registry/district-map.jsonl";

const scriptsDir = join(root, "scripts");
const gates = scanTargets(scriptsDir, loadPhases(scriptsDir)).map((t) => ({ gate: `${t.kind}/${t.name}`, outputs: t.decl.outputs, upstream: t.upstream }));
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\0").filter(Boolean);
// 作り直しの対象のドメイン = 宣言を持ち生成する登録のある物(地区の地図の domainJson・generate。false = 生成器が触らない)。
// plural は主の登録の entity.json(宣言の読み込みの部品 readDomain だけで読む)
const domainSource = nodeDomainSource(root);
const primaryPluralOf = (name) => {
  const declaration = readDomain(domainSource, name);
  return declaration.domain === null ? undefined : primaryRegistrationOf(declaration)?.entity?.plural;
};
const domains = existsSync(join(root, DISTRICT_MAP))
  ? read(DISTRICT_MAP)
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((d) => d.kind === "domains" && d.domainJson === true && d.generate !== false)
      .map((d) => ({ dir: d.dir, plural: primaryPluralOf(d.name) }))
  : [];

const fails = [];
// ドメインの生成器がこの木で実際に毎回書き直すファイル = 一括生成と同じ計画(書かない)。条件つきの出力(useDetailModal など)を
// 宣言の glob だけで数えると、生成器が書かない同じ名の手書きの部品が「印が無い」で止まる。計画を組めない(entity.json の誤りなど)= 判定できないので止める
let planned = null;
try {
  const workspace = createWorkspace(root);
  const silent = { log: () => {}, warn: () => {} };
  planned = everyRunPathsOf(planGenerateAll(workspace, workspace.listDomains(), null, null, silent).plans, root);
} catch (error) {
  fails.push(`ドメインの生成の計画を組めない(生成物の印を判定できない。pnpm generate domain -- --dry-run で確かめて直す): ${error instanceof Error ? error.message : String(error)}`);
}

const entries = outputFiles(gates, files, domains, planned);
const generatedPaths = parsePaths(read(`${CORE_DIR}/generated.md`)) ?? [];
let domainEveryRun = 0;

for (const e of entries) for (const p of e.problems) fails.push(`${e.gate}/phase.json: ${p}`);
// paths の照合は上流の生成器だけ(fork が足した生成器の出力に上流の generated.md は届かない。fork の決まりは数えない、D138 と同じ)
const upstreamGates = new Set(gates.filter((g) => g.upstream).map((g) => g.gate));
for (const e of outputsOutsidePaths(entries.filter((x) => upstreamGates.has(x.gate)), generatedPaths)) fails.push(`${e.gate}/phase.json の出力 ${e.glob} が ${CORE_DIR}/generated.md の paths に当たらない(paths に足す)`);
for (const e of entries.filter((x) => x.kind === "every-run")) {
  for (const f of e.files.filter((x) => MARKABLE.test(x))) {
    if (e.domain) domainEveryRun++;
    if (!hasGeneratedMark(read(f))) fails.push(`${f}: 毎回作り直す生成物(${e.gate})なのに先頭に生成物の印が無い(生成器に印を入れる。ドメインの生成器は scripts/structure/domain/render/output.mjs の file() が入れる = pnpm generate domain で作り直す)`);
  }
}

// generate: false のドメイン(手で管理)に生成物の印が残っていたら止める(D222: 印 = 手で直さない、の読み違いを防ぐ)。
// 見るのは印の文字列そのもの(広い語の MARK_PATTERN でなく、ドメインの生成器が入れる GENERATED_MARK)。外すのは pnpm generate domain -- --unmark
if (existsSync(join(root, DISTRICT_MAP))) {
  const rows = read(DISTRICT_MAP).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const plurals = Object.fromEntries(rows.filter((r) => r.kind === "domains" && r.domainJson).map((r) => [r.dir, primaryPluralOf(r.name)]));
  const left = planUnmark({ rows, plurals, files, readText: read }).writes;
  for (const w of left) fails.push(`${w.path}: generate: false のドメインに生成物の印が残っている(手で管理するファイル。pnpm generate domain -- --unmark で外す)`);
}

console.log(`rules generated: 出力の宣言 ${entries.length} 個(${gates.filter((g) => g.outputs).length} の生成器)、ドメインの毎回の出力 ${domainEveryRun} 本`);
for (const f of fails) console.error(`失敗: ${f}`);
process.exitCode = fails.length ? 1 : 0;
