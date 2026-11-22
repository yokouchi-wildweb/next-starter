// src/domains/core/admin/dashboard/services/server/sectionLoads.ts
// 管理ダッシュボードのデータの取得(loader 側)。受け口 sections/ の生成の一覧を組み立て器で絞り(hidden・ロール・門番の規則)、
// 描くセクションの load を並列に実行する。UI(セクション)はサーバーのデータを自分で取らず、AdminHome の loader
// (範囲の守りを通った後)がここを呼び、結果を AdminDashboard の data で各セクションへ渡す。

import "server-only";

import { gate } from "@/featureGate";
import { adminDashboardSections } from "@/domains/core/admin/extensions/adminDashboardSections";
import { byKey } from "@/domains/core/admin/menu/byKey";

import { buildAdminDashboard } from "../../buildAdminDashboard";
import type { AdminDashboardData } from "../../types";

/** 見る人(loader の ctx.user。省略 = ロール指定のあるセクションは描かない) */
export type AdminDashboardViewer = { role?: string | null };

/**
 * 描くセクションを決め、その取得を並列に実行して key → 結果を返す。
 * 返り値のキー = 描くセクション(load の無いセクションも undefined の値で入る)
 */
export async function loadAdminDashboardData(viewer: AdminDashboardViewer = {}): Promise<AdminDashboardData> {
  const { sections } = buildAdminDashboard({
    // 閉じたドメインのセクション(<ドメイン>/plugs/adminDashboardSections/)は外す
    sections: byKey(gate.plugs(adminDashboardSections)),
    role: viewer.role ?? undefined,
    isEnabled: (feature) => gate.enabled(feature),
  });
  const entries = await Promise.all(
    sections.map(async (section) => [section.key, section.load ? await section.load() : undefined] as const),
  );
  return Object.fromEntries(entries);
}
