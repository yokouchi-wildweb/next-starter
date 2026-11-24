// src/app/admin/(protected)/users/loading.tsx
//
// ユーザー管理の範囲の境界の fallback(範囲の守りの Guard と、範囲の中の client の遷移の両方)。文字を持たない(殻に入るため)

import { ScreenLoader } from "@/components/Overlays/Loading";

export default function AdminUsersLoading() {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="bg-muted"
      spinnerClassName="h-12 w-12 text-primary"
    />
  );
}
