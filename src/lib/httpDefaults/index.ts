// src/lib/httpDefaults — client の HTTP の既定(今は既定のタイムアウトだけ)。中身: ./README.md
// 部品 HttpDefaultsRoot("use client"、読み込み時に 1 回登録する。root の Provider の入れ子に置く)もこの入口から出す

import "./types";

export { httpDefaultsConfig, httpDefaultsConfigDef } from "./config";
export type { HttpDefaultsConfig, HttpDefaultsOverride } from "./config";
export { applyDefaultTimeout, installHttpDefaults } from "./install";
export { HttpDefaultsRoot } from "./HttpDefaultsRoot";
