// src/config/lib/realtimeRoom.config.ts
// リアルタイムルーム基盤の設定の上書き(@lib-config/realtimeRoom)。値はリテラルで書く。キーと既定: src/lib/realtimeRoom/config.ts
// 例: `export default { enabled: true } satisfies RealtimeRoomOverride;`(有効化の手順: servers/room/README.md)
import type { RealtimeRoomOverride } from "@/lib/realtimeRoom";

export default {} satisfies RealtimeRoomOverride;
