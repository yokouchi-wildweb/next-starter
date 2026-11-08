// src/featureGate/checks/adminSidebar.tsx
// テストの道具: 管理のサイドバーが描くメニュー(useAdminMenu)を、管理の枠の門番の値(clientGateState("admin"))と
// セッションのロールで取り出す。規則の enabled の差し替えは呼び手の側(readers.test / walletOff.test)

import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { clientGateState } from "@/featureGate";
import { GateProvider } from "@/featureGate/client";
import { useAdminMenu } from "@/features/core/admin/hooks/useAdminMenu";
import type { AdminMenuBuiltCategory } from "@/features/core/admin/menu/types";
import { AuthSessionContext } from "@/features/core/auth/components/AuthSessionContext";
import type { SessionUser } from "@/features/core/auth/entities/session";

function Probe({ onMenu }: { onMenu: (menu: AdminMenuBuiltCategory[]) => void }) {
  onMenu(useAdminMenu());
  return null;
}

/** 今の規則の開閉でサイドバーのカテゴリーと行 */
export function adminSidebar(role = "admin"): AdminMenuBuiltCategory[] {
  let captured: AdminMenuBuiltCategory[] | undefined;
  const user = { role } as unknown as SessionUser;
  renderToStaticMarkup(
    <GateProvider state={clientGateState("admin")}>
      <AuthSessionContext.Provider value={{ user, isAuthenticated: true, refreshSession: async () => {} }}>
        <Probe onMenu={(m) => (captured = m)} />
      </AuthSessionContext.Provider>
    </GateProvider>,
  );
  assert.ok(captured);
  return captured;
}

/** サイドバーの行の住所 */
export const adminSidebarHrefs = (role = "admin"): string[] => adminSidebar(role).flatMap((c) => c.rows.map((r) => r.href));
