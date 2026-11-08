// src/app/(user)/maintenance/_screen/MaintenanceAutoRedirect.tsx
// メンテナンス画面専用の client 部品(契約外)。終了時刻は loader が渡し、自動遷移の処理は公開 hook
// useMaintenanceAutoRedirect が持つ。差し替え Screen は hook を自分の client 部品から呼ぶ(この部品に引数は足さない)

"use client";

import { useMaintenanceAutoRedirect } from "@/features/core/setting/hooks/useMaintenanceAutoRedirect";

type Props = {
  /** メンテナンス終了時刻（ISO8601形式） */
  endTime: string | null;
  /** リダイレクト先パス */
  redirectTo: string;
};

export function MaintenanceAutoRedirect({ endTime, redirectTo }: Props) {
  useMaintenanceAutoRedirect({ endTime, redirectTo });
  return null;
}
