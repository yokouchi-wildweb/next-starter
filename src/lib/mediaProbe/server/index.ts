// src/lib/mediaProbe/server/index.ts
//
// 入口 "./server": サーバーでのメディア解析(probe)。server-only(WASM の mediainfo・node の API・storage の ./server を読む)。
// このモジュールを import した時点で既定エンジン(mediainfo / WASM)が登録される。
// 型と結果の判定は入口 "."(../index.ts)。詳細・設計は ../README.md。

import { mediainfoEngine } from "./engine/mediainfoEngine";
import { registerProbeEngine } from "./registry";

// 既定エンジンを登録(フォーク側は setDefaultProbeEngine / registerProbeEngine で差し替え可)
registerProbeEngine(mediainfoEngine, { makeDefault: true });

export { probeMedia, type ProbeOptions } from "./probeMedia";
export { registerProbeEngine, setDefaultProbeEngine, getProbeEngine, listProbeEngines } from "./registry";
export type { ProbeEngine, MediaSource } from "./engine/types";
export { ProbeEngineError } from "./engine/types";
