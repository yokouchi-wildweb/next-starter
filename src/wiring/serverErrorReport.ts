// 生成物・編集不可: pnpm generate extensions が src/lib/serverErrorReport/extensionPoints.ts から生成する
// serverErrorReporters: 差す側の <ドメイン>/plugs/serverErrorReporters/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const reporter(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// 結び目: src/lib/serverErrorReport/extensionPoints.ts の wire(一覧を門番で絞って lib の wireServerErrorReport に渡す)

import { gate } from "@/featureGate";
import { wireServerErrorReport } from "@/lib/serverErrorReport";

import type { ServerErrorReporter } from "@/lib/serverErrorReport/points";

export const serverErrorReporters: { domain: string | null; name: string; requires: readonly string[]; load: () => Promise<ServerErrorReporter> }[] = [];

export const serverErrorReport = wireServerErrorReport({ serverErrorReporters: gate.plugs(serverErrorReporters) });
