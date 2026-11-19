// src/config/lib/unsavedGuard.config.ts
// 未保存の編集の守りの確認の文の上書き(@lib-config/unsavedGuard)。キーと既定: src/lib/unsavedGuard/config.ts
// 例: export default { confirm: { unsaved: { title: "保存していません" } } } satisfies UnsavedGuardOverride;
import type { UnsavedGuardOverride } from "@/lib/unsavedGuard";

export default {} satisfies UnsavedGuardOverride;
