// src/lib/realtimeRoom/node.ts — 共有プロトコル(protocol/ の型と定数)の入口
// servers/room(Cloudflare Workers)・scripts・アプリの route が読む唯一の接点。React・Next・node の API を引かない
// 値は名前を並べて出す(export * だと servers/room の ESM のテストから tsx で読んだとき CJS の再 export の名前が見えない)

export { ROOM_CLOSE_CODES, ROOM_PROTOCOL_VERSION, ROOM_TOKEN_KINDS, ROOM_TOKEN_QUERY_PARAM } from "./protocol/constants";
export * from "./protocol/types";
