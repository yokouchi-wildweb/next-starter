// src/lib/realtimeRoom — リアルタイムルーム基盤の設定の入口。説明: README.md
// 機能の入口は別: ./node(servers/room と共有するプロトコル)・./client(useRoomState)・./server(トークン・ルーム呼び出し)

export { realtimeRoomConfig } from "./config";
export type { RealtimeRoomConfig, RealtimeRoomOverride } from "./config";
