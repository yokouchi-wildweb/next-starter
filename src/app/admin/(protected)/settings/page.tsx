// src/app/admin/(protected)/settings/page.tsx
//
// システム設定ルート。動的ルート `[section]` のうち、順序最小のセクションへリダイレクトする。
// 旧ブックマーク (/admin/settings) からの導線維持と、既定ページ決定を一箇所に集約する目的。
import { redirect } from "next/navigation";

import { getDefaultSettingSectionKey } from "@/features/core/setting/setting.sections";

export default function AdminSettingIndexPage() {
  redirect(`/admin/settings/${getDefaultSettingSectionKey()}`);
}
