// scripts/operations/features/list.ts(pnpm ops features list [--name <規則名>] [--json])
// 機能を閉じる規則ごとの開閉(全開スイッチで開いていれば「閉 → 開(スイッチ)」、依存先で閉じていれば「閉(依存先 <名前> が閉)」、
// --json は configEnabled / ownEnabled / openedBySwitch / dependsOn / anyOf / dependsOnAll / dependedOnBy / closedBy / switchMissing / sharedDomainsOpen)・必須・住所・表・依存・名前の呼び出し箇所を出す(読むだけ)。
// 中身は門番の道具 @/featureGate/node の readFeatureReport。詳細: src/featureGate/README.md「pnpm ops features list / pnpm ops features set」

import { readFeatureReport, rules, type FeatureDescription } from "@/featureGate/node";

const ALLOWED_LABEL: Record<string, string> = {
  sameRule: "同じ規則",
  requires: "requires",
  gate: "名前で確かめる",
  route: "閉じる住所の下",
  required: "必須",
  exception: "例外",
};

function label(dep: FeatureDescription["dependents"][number]): string {
  if (dep.allowedBy !== null) return ALLOWED_LABEL[dep.allowedBy];
  return "未(依存の検査で違反)";
}

/**
 * 開閉の見せ方: 規則の値どおりなら「開」「閉」、全開スイッチで開いていれば「閉 → 開(スイッチ)」、
 * 閉の理由が依存先なら「閉(依存先 <名前> が閉)」(自分の値も閉なら「閉(自分の値・依存先 <名前> が閉)」)
 */
function state(d: FeatureDescription): string {
  if (d.enabled) return d.openedBySwitch && !d.configEnabled ? "閉 → 開(スイッチ)" : "開";
  const deps = d.closedBy?.dependencies ?? [];
  if (deps.length === 0) return "閉";
  return `閉(${d.closedBy?.self ? "自分の値・" : ""}依存先 ${deps.join(", ")} が閉)`;
}

function detail(d: FeatureDescription): string[] {
  const lines = [
    `${d.name}  ${state(d)}${d.required !== null ? `  必須(${d.required})` : ""}`,
    `  住所(手書き): ${d.paths.handWritten.join(", ") || "-"}`,
    `  住所(汎用 API の導出): ${d.paths.domainApi.join(", ") || "-"}`,
    `  住所(設定の節の導出): ${d.paths.setting.join(", ") || "-"}`,
    `  住所(cron の task の import から導出): ${d.paths.cron.join(", ") || "-"}`,
    `  依存先(dependsOn): ${d.dependsOn.join(", ") || "-"}${d.dependsOnAll.length > d.dependsOn.length ? `(推移的: ${d.dependsOnAll.join(", ")})` : ""}`,
    ...(d.anyOf.length > 0 ? [`  どれか(anyOf): ${d.anyOf.join(", ")}`] : []),
    `  依存元(推移的): ${d.dependedOnBy.join(", ") || "-"}`,
    ...(d.switchMissing.length > 0 ? [`  全開スイッチ: 名前で開けたが依存先 ${d.switchMissing.join(", ")} が閉(FEATURE_GATE_OPEN に足す)`] : []),
    ...d.sharedDomainsOpen.map((s) => `  共有のドメイン ${s.folder} は ${s.openBy.join(", ")} で開いたまま(表・汎用 API は閉じない)`),
    `  機能のフォルダ: ${d.folders.join(", ") || "-"}`,
    `  表: ${d.tables.join(", ") || "-"}`,
    `  依存(外から読むファイル ${d.dependents.length}):`,
    ...d.dependents.map((dep) => `    ${dep.file} → ${dep.folder}  [${label(dep)}]`),
    `  名前の呼び出し(${d.callSites.length}): ${d.callSites.join(", ") || "-"}`,
  ];
  return lines;
}

async function main() {
  const args = process.argv.slice(2);
  const nameIndex = args.indexOf("--name");
  const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
  const report = await readFeatureReport(process.cwd(), rules);
  const picked = name ? report.filter((d) => d.name === name) : report;
  if (name && picked.length === 0) {
    console.error(`規則 ${name} がありません(src/featureGate/rules/<名前>.ts)`);
    process.exit(1);
  }
  if (args.includes("--json")) {
    console.log(JSON.stringify(picked, null, 2));
    return;
  }
  if (name) {
    console.log(detail(picked[0]).join("\n"));
    return;
  }
  console.log("名前 | 開閉 | 必須 | 依存先 | 住所 | 表 | 依存(うち未) | 呼び出し");
  for (const d of picked) {
    const paths = d.paths.handWritten.length + d.paths.domainApi.length + d.paths.setting.length + d.paths.cron.length;
    const open = d.dependents.filter((dep) => dep.allowedBy === null).length;
    console.log(`${d.name} | ${state(d)} | ${d.required !== null ? "必須" : "-"} | ${d.dependsOn.join(",") || "-"} | ${paths} | ${d.tables.length} | ${d.dependents.length}(${open}) | ${d.callSites.length}`);
  }
  const bySwitch = picked.filter((d) => d.enabled && d.openedBySwitch && !d.configEnabled).length;
  console.log(`\n${picked.length} 規則(閉 ${picked.filter((d) => !d.enabled).length}${bySwitch > 0 ? `・スイッチで開 ${bySwitch}(FEATURE_GATE_OPEN)` : ""})。詳細: pnpm ops features list --name <名前>`);
  const missing = picked.filter((d) => d.switchMissing.length > 0);
  if (missing.length > 0) {
    console.log(`全開スイッチの名前指定で依存先が閉じたまま(FEATURE_GATE_OPEN に足す): ${missing.map((d) => `${d.name} ← ${d.switchMissing.join(", ")}`).join(" / ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
