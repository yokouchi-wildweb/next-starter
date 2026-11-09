// src/config/layout/user.config.ts
// ユーザー側の枠の値の設定の上書き(持ち主 src/app/(user)/_layout/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { header: { logoLink: "/home" }, footer: { copyright: { year: "2020-2026" } } } satisfies UserLayoutOverride<Extra>;`
// 自分の鍵を足す: 下の Extra に型を足し、値を書く(userLayoutConfig.<鍵> で読める)。メニュー項目・SNS リンク・ログアウトのアイコンは user.ui.config.ts
import type { UserLayoutOverride } from "@/app/(user)/_layout/config";

export type Extra = Record<never, never>;

export default {} satisfies UserLayoutOverride<Extra>;
