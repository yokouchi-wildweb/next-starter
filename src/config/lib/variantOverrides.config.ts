// src/config/lib/variantOverrides.config.ts
// 部品の variant の上書き(@lib-config/variantOverrides)。キー: src/lib/variantOverrides/types.ts の VariantOverridesInput、既定 = 空
// 例: export default { button: { base: "rounded-full shadow-none", variant: { outline: "border-2" }, size: { md: "h-11 px-5" } } } satisfies VariantOverridesOverride;
import type { VariantOverridesOverride } from "@/lib/variantOverrides/config";

export default {} satisfies VariantOverridesOverride;
