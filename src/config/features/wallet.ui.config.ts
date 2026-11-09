// src/config/features/wallet.ui.config.ts
// ウォレットの描画専用の設定の上書き(持ち主 src/features/core/wallet/config.ui.ts だけが読む)。キーと既定: 持ち主の config.ui.ts
// 通貨のアイコンを変える・足す: `import { Ticket } from "lucide-react";` と `export default { currencyIcons: { my_ticket: Ticket } } satisfies WalletUiOverride;`
import type { WalletUiOverride } from "@/features/wallet/config.ui";

export default {} satisfies WalletUiOverride;
