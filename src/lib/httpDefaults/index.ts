// src/lib/httpDefaults — client の HTTP の既定(今は既定のタイムアウトだけ)。中身: ./README.md
// 部品は client の入口 @/lib/httpDefaults/HttpDefaultsRoot(root の Provider の入れ子に置く)

import "./types";

export { httpDefaultsConfig, httpDefaultsConfigDef } from "./config";
export type { HttpDefaultsConfig, HttpDefaultsOverride } from "./config";
export { applyDefaultTimeout, installHttpDefaults } from "./install";
