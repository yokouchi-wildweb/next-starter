// src/config/domains/auditLog.config.ts
// 監査ログの設定の上書き(持ち主 src/domains/core/auditLog/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// action の表示名を足す: `export default { actionLabels: { "post.published": "公開" } } satisfies AuditLogOverride;`
// 本人に開示する action を足す: `export default { userVisibleActions: ["wallet.balance.charged", "user.profile.*"] } satisfies AuditLogOverride;`
import type { AuditLogOverride } from "@/domains/auditLog/config";

export default {} satisfies AuditLogOverride;
