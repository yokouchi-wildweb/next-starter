// scripts/workflow/rules/staleRefs.mjs — pnpm workflow rules staleRefs: fork の物の中の古い名指しを挙げる(読むだけ、書き換えない、段階に載せない)
// 対象 = fork が足したファイル(直接の親との分岐点から、src/lib/forkOwnership の forkAddedFiles)と、.claude/rules の core/・items/ の外の自分の決まりのファイル。
// 名の対応は renames.json(区切り v2-switch の notice の対応表)。出す形: <file>:<line> <古い> → <新しい> (<種類>)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { forkAddedFiles } from "../../../src/lib/forkOwnership/node.mjs";
import { isStaleRefTarget, staleRefsIn } from "./lib.ruleRenames.mjs";

const root = join(import.meta.dirname, "../../..");
const entries = JSON.parse(readFileSync(join(import.meta.dirname, "renames.json"), "utf8"));

const added = forkAddedFiles(root);
if (added.status === "unverified") {
  console.log(`staleRefs: 確かめられない(${added.reason})。自分の決まりのファイルだけを見る`);
}
const ownRules = execFileSync("git", ["ls-files", "--", ".claude/rules"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const targets = [...new Set([...(added.added ?? []), ...ownRules])].filter((path) => isStaleRefTarget(path) && existsSync(join(root, path))).sort();

const hits = targets.flatMap((path) => staleRefsIn(path, readFileSync(join(root, path), "utf8"), entries));
for (const hit of hits) console.log(`${hit.path}:${hit.line} ${hit.old} → ${hit.new} (${hit.kind})`);
console.log(`staleRefs: ${added.status === "tier1" ? "Tier1(fork が足したファイルは無い)、" : ""}対象 ${targets.length} 本、古い名指し ${hits.length} 件(対応表 ${entries.length} 件、書き換えはしない)`);
