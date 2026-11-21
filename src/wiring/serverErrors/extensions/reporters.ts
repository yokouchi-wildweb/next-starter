// 生成物・編集不可: pnpm generate extensions が src/wiring/serverErrors/extensionPoints.ts から生成する
// reporters: src/wiring/serverErrors/reporters/<名前>.ts(x) か <名前>/index.ts(x) の export const reporter(並びはファイル名の順)

import type { ServerErrorReporter } from "@/lib/serverErrorReport";

export const reporters: { name: string; load: () => Promise<ServerErrorReporter> }[] = [];
