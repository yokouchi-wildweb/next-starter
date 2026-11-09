// src/config/lib/jwt.config.ts
// JWT セッションの設定の上書き(@lib-config/jwt)。値はリテラルで書く。キーと既定: src/lib/jwt/config.ts
// 例: `export default { cookieName: "__myapp_session", defaultMaxAgeSeconds: 60 * 60 * 24 * 30 } satisfies JwtOverride;`
import type { JwtOverride } from "@/lib/jwt";

export default {} satisfies JwtOverride;
