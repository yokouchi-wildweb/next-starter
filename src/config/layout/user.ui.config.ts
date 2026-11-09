// src/config/layout/user.ui.config.ts
// ユーザー側の枠の描画専用の設定の上書き(持ち主 src/app/(user)/_layout/config.ui.ts だけが読む)。キーと既定: 持ち主の config.ui.ts
// 配列(メニュー項目・SNS リンク)は丸ごと置き換わる。読んでよい指定子: lucide-react・react-icons・@/components/Icons
// 例: `import { Home } from "lucide-react";` と `export default { bottomMenu: { guestMenuItems: [{ key: "home", label: "ホーム", href: "/", icon: Home }] } } satisfies UserLayoutUiOverride<Extra>;`
// 自分の鍵を足す: 下の Extra に型を足し、値を書く(userLayoutUiConfig.<鍵> で読める)
import type { UserLayoutUiOverride } from "@/app/(user)/_layout/config.ui";

export type Extra = Record<never, never>;

export default {} satisfies UserLayoutUiOverride<Extra>;
