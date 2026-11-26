// pnpm generate domain -- --unmark [<Domain>] の本体: generate: false のドメインのファイルから生成物の印の行を外す(D222)
// 手で管理に切り替えたドメインに「自動で作られた・直さない」の印が残ると、エージェントが手で直してよいファイルを直さないと読み違える。
// 対象 = district-map で宣言(domain.json)を持ち generate が false のドメイン(名を省くと全部)の、ドメインのフォルダと管理画面のルートの下のファイル。
// 印の行だけを消す(他の行は変えない)。2 回目は書く物 0。残っていたら pnpm check rules(scripts/workflow/rules/generated.mjs)が止める
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { domainNamesOf } from "../../../../src/lib/districtMap/node.mjs";
import { nodeDomainSource, primaryRegistrationOf, readDomain } from "../../../../src/lib/domain/node.mjs";
import { GENERATED_MARK, withoutGeneratedMark } from "../render/output.mjs";

export const DISTRICT_MAP = "src/registry/district-map.jsonl";
export const ADMIN_ROUTES = "src/app/admin/(protected)";

/**
 * 外す計画(純粋): 書くファイルと中身
 * @param {{ rows: { kind: string, name: string, dir: string, domainJson?: boolean, generate?: boolean | null }[], plurals: Record<string, string | undefined>, files: string[], readText: (path: string) => string, name?: string | null }} input
 * @returns {{ domains: string[], writes: { path: string, content: string }[] }}
 */
export function planUnmark({ rows, plurals, files, readText, name = null }) {
  const withJson = rows.filter((r) => r.kind === "domains" && r.domainJson === true);
  if (name) {
    const hit = withJson.find((r) => r.name === name || r.name.toLowerCase() === name.toLowerCase() || domainNamesOf({ dir: r.dir }).Pascal === name);
    if (!hit) throw new Error(`宣言(domain.json)を持つドメイン ${name} が無い`);
    if (hit.generate !== false) throw new Error(`${hit.name} は generate が false でない(生成器が毎回印を入れる)。印を外すのは登録の entity.json を "generate": false にしてから`);
  }
  const targets = withJson.filter((r) => r.generate === false && (!name || r.name === name || r.name.toLowerCase() === name.toLowerCase() || domainNamesOf({ dir: r.dir }).Pascal === name));
  const writes = [];
  for (const d of targets) {
    const { route } = domainNamesOf({ dir: d.dir, plural: plurals[d.dir] });
    const roots = [`${d.dir}/`, `${ADMIN_ROUTES}/${route}/`];
    for (const f of files) {
      if (!roots.some((r) => f.startsWith(r))) continue;
      const text = readText(f);
      if (!text.includes(GENERATED_MARK)) continue;
      writes.push({ path: f, content: withoutGeneratedMark(text) });
    }
  }
  return { domains: targets.map((d) => d.name), writes };
}

/** 実行(リポの根で) */
export function runUnmark(root, name = null) {
  const rows = readFileSync(join(root, DISTRICT_MAP), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const plurals = {};
  const source = nodeDomainSource(root);
  for (const r of rows) {
    if (r.kind !== "domains" || !r.domainJson) continue;
    // plural は主の登録の entity.json(宣言の読み込みの部品 readDomain だけで読む)
    const declaration = readDomain(source, r.name);
    plurals[r.dir] = declaration.domain === null ? undefined : primaryRegistrationOf(declaration)?.entity?.plural;
  }
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\0").filter(Boolean);
  const { domains, writes } = planUnmark({ rows, plurals, files, readText: (p) => readFileSync(join(root, p), "utf8"), name });
  for (const w of writes) writeFileSync(join(root, w.path), w.content);
  console.log(`unmark: generate: false のドメイン ${domains.length} 個(${domains.join("・") || "-"})、印を外したファイル ${writes.length} 本`);
  for (const w of writes) console.log(`  ${w.path}`);
  return writes.length;
}
