// src/domains/core/admin/dashboard/components/AdminDashboard.tsx

import { adminDashboardSections } from "@/domains/core/admin/extensions/adminDashboardSections";
import { byKey } from "@/domains/core/admin/menu/byKey";

// 描き方の表(描くのは loader が門番で絞って取った data の key だけ)
const dashboardSections = byKey(adminDashboardSections);

import type { AdminDashboardData } from "../types";

type AdminDashboardProps = {
  /** 描くセクションの key → load の結果(AdminHome の loader が services/server/sectionLoads.ts の loadAdminDashboardData で作って渡す) */
  data: AdminDashboardData;
};

/**
 * 管理ダッシュボード本体(server)。
 *
 * data のキー(loader が組み立て器で hidden・ロール・門番の規則で絞り、order・key 順に並べた残り)の順に、
 * 受け口 sections/ の生成の一覧から同じ key のセクションを描き、取得結果を data で渡すだけ。
 * セクションの増減・並べ替え・隠すは受け口と override で完結し、本ファイルは変わらない。
 */
export function AdminDashboard({ data }: AdminDashboardProps) {
  return (
    <>
      {Object.keys(data).map((key) => {
        const section = dashboardSections[key];
        if (!section) return null;
        const { Section } = section;
        return <Section key={key} data={data[key]} />;
      })}
    </>
  );
}
