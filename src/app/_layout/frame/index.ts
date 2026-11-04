// src/app/_layout/frame/index.ts
// 枠の宣言の入口(re-export だけ)。仕組み: ./README.md
export type { AdminFrameDeclaration, AdminFrameKey, FrameDeclaration, FramePartSetting, FrameTable, FrameTableRow, UserFrameKey } from "./types";
export { FRAME_DEVICES, FRAME_ROOTS, FRAME_SLOTS, hideableParts } from "./parts.mjs";
export { matchFrame } from "./resolve.mjs";
