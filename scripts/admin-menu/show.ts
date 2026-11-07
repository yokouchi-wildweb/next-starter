// scripts/admin-menu/show.ts(pnpm admin-menu:show [--role <ロール>] [--closed now|all|none])
// 管理メニューをロールごとに木で出す(読むだけ)。行ごとに当たる門番の規則(開/閉)か 常時、重複、描かない物と理由。
// --closed: now = 今の規則の開閉(既定)、all = 全部閉じた、none = 全部開いた。fork の取り込みの前後比較に使う
// 中身: ./inspect.ts / 仕組み: src/features/core/admin/menu/README.md

import { USER_ROLES } from "@/features/core/user/constants";
import { adminDomains } from "@/registry/adminDomains";

import { readGateRules, readMenuSnapshot, readSettingRows } from "./collect";
import { buildForRole, renderForRole, type ShowMode } from "./inspect";

const args = process.argv.slice(2).filter((a) => a !== "--");
const option = (name: string): string | undefined => {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const mode = (option("closed") ?? "now") as ShowMode;
if (!["now", "all", "none"].includes(mode)) {
  console.error("使い方: pnpm admin-menu:show [--role <ロール>] [--closed now|all|none]");
  process.exit(1);
}
const roleOption = option("role");
const roles: readonly string[] = roleOption ? [roleOption] : USER_ROLES;
if (roleOption && !USER_ROLES.includes(roleOption)) {
  console.error(`ロール ${roleOption} は無い(${USER_ROLES.join(", ")})`);
  process.exit(1);
}

async function main(): Promise<void> {
  const snapshot = await readMenuSnapshot();
  const rules = readGateRules();
  const settingRows = readSettingRows();
  const out: string[] = [];
  for (const role of roles) {
    out.push(
      ...renderForRole(buildForRole(snapshot, adminDomains, settingRows, rules, mode, role), rules, role, mode),
      "",
    );
  }
  console.log(out.join("\n"));
}

void main();
