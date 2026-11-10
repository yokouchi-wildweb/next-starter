// src/components/Primitives/Checkbox/index.ts
// 入口(re-export だけ)。Radix は "radix-ui" から読む
import type { Checkbox as CheckboxPrimitive } from "radix-ui";

export { Checkbox } from "./Checkbox";
/** チェックの状態(true / false / "indeterminate") */
export type CheckedState = CheckboxPrimitive.CheckedState;
