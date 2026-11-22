// src/config/domains/chatRoom.config.ts
// チャットの設定の上書き(持ち主 src/domains/core/chatRoom/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { attachmentContentTypes: { file: ["application/pdf", "image/*"] } } satisfies ChatRoomOverride;`
import type { ChatRoomOverride } from "@/domains/chatRoom/config";

export default {} satisfies ChatRoomOverride;
