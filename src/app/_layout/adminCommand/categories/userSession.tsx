// src/app/_layout/adminCommand/categories/userSession.tsx

import type { CategoryConfig } from "@/features/core/adminCommand/base/types";
import { SessionRenderer } from "@/features/core/adminCommand/definitions/session/SessionRenderer";

export const category: CategoryConfig = {
  id: "session",
  label: "セッション管理 (session)",
  description: "ログアウト・セッションリフレッシュ",
  Renderer: SessionRenderer,
};
