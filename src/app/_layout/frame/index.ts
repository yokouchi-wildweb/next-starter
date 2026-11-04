// src/app/_layout/frame/index.ts
// 枠の宣言の入口(re-export だけ)。表の読み手 useFrameAttributes("use client")は ./useFrameAttributes から直に import する。仕組み: ./README.md
export type { AdminFrameDeclaration, FrameAttributes, AdminFrameKey, AdminFrameValue, FrameDeclaration, FramePartSetting, FrameTable, FrameTableRow, FrameValue, UserFrameKey } from "./types";
export { FRAME_DEVICES, FRAME_ROOTS, FRAME_SLOTS, hideableParts } from "./parts.mjs";
export { matchFrame } from "./resolve.mjs";
