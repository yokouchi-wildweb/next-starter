// src/domains/core/adminCommand/plugs/adminCommandCategories/userSession.tsx

import type { CategoryConfig } from "../../base/types";
import { SessionRenderer } from "../../definitions/session/SessionRenderer";

export const category: CategoryConfig = {
  id: "session",
  label: "セッション管理 (session)",
  description: "ログアウト・セッションリフレッシュ",
  Renderer: SessionRenderer,
};
