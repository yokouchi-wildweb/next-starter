// scripts/structure/admin-menu/check.ts — 門の入口(pnpm check admin-menu [-- show <引数>]。門 build・ship、extensions の後)
//   引数なし = 管理メニューの受け口の置き間違いを止める(書かない): 知らないカテゴリー・管理一覧に無いドメイン・相手の無い上書き・
//     allowRoles を広げる上書き・/admin の住所でページが route-map に無いもの・key とファイル名の食い違い(./inspect.ts の checkAdminMenu)。
//     管理ダッシュボードの受け口(dashboard/sections)も: 相手の無い上書き・allowRoles を広げる上書き・key とファイル名・描画の無い定義(checkAdminDashboard)
//   show [--role=<ロール>] [--closed=now|all|none] = ロールごとの木を描く(読むだけ)。行ごとに当たる門番の規則(開/閉)か 常時、重複、
//     描かない物と理由。--closed: now = 今の規則の開閉(既定)、all = 全部閉じた、none = 全部開いた。fork の取り込みの前後比較に使う
// DB・外部に届かない(門 build の守りが確かめる)。仕組み: src/domains/core/admin/menu/README.md・src/domains/core/admin/dashboard/README.md

import { USER_ROLES } from "@/domains/core/user/constants";
import { adminDomains } from "@/registry/adminDomains";

import { readDashboardSnapshot, readGateRules, readMenuSnapshot, readRoutePaths, readSettingRows } from "./collect";
import { buildForRole, checkAdminDashboard, checkAdminMenu, renderForRole, type ShowMode } from "./inspect";

const args = process.argv.slice(2).filter((a) => a !== "--");

const option = (name: string): string | undefined => {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

async function check(): Promise<void> {
  const snapshot = await readMenuSnapshot();
  const dashboard = await readDashboardSnapshot();
  const problems = [...checkAdminMenu(snapshot, adminDomains, readRoutePaths()), ...checkAdminDashboard(dashboard)];
  if (problems.length > 0) {
    console.error(`✗ admin-menu: ${problems.length} 件\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  const overrides = [...snapshot.categories, ...snapshot.items].filter((e) => e.override).length;
  const dashboardOverrides = dashboard.sections.filter((e) => e.override).length;
  console.log(
    `✓ admin-menu OK(カテゴリー ${snapshot.categories.length} / 項目 ${snapshot.items.length} / 上書き ${overrides}、ダッシュボードのセクション ${dashboard.sections.length} / 上書き ${dashboardOverrides})`,
  );
}

async function show(): Promise<void> {
  const mode = (option("closed") ?? "now") as ShowMode;
  const roleOption = option("role");
  if (!["now", "all", "none"].includes(mode) || (roleOption !== undefined && !USER_ROLES.includes(roleOption))) {
    console.error(`使い方: pnpm check admin-menu -- show [--role=<${USER_ROLES.join("|")}>] [--closed=now|all|none]`);
    process.exit(2);
  }
  const roles: readonly string[] = roleOption ? [roleOption] : USER_ROLES;
  const snapshot = await readMenuSnapshot();
  const rules = readGateRules();
  const settingRows = readSettingRows();
  const out: string[] = [];
  for (const role of roles) {
    out.push(...renderForRole(buildForRole(snapshot, adminDomains, settingRows, rules, mode, role), rules, role, mode), "");
  }
  console.log(out.join("\n"));
}

void (args.includes("show") ? show() : check());
