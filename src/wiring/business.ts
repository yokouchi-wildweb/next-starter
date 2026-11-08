// src/wiring/business.ts — @/business の結び(受付係)。tsconfig.json の "@/business" がここを指す
// src/business/business.ts(fork の値と印)を src/lib/business の resolveBusiness に渡す。読み手は @/business を読む(この中身を直に読まない)
// 決まり: src/lib/business/README.md(設定の議会 D88・L1.22)

import file from "../business/business";
import { resolveBusiness } from "@/lib/business";

/** このプロジェクトの事業の素性(sample のときは例の値) */
export const business = resolveBusiness(file);

/** src/business/business.ts の印(sample | own) */
export const businessSource = file.source;

export type { BusinessValues as Business, LogoVariant } from "@/lib/business";
