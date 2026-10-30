// 生成物・編集不可: pnpm extensions:generate が src/features/core/pairedDevice/extensionPoints.ts から生成する
// kinds: src/features/core/pairedDevice/kinds/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const kind(並びはファイル名の順)

import type { AnyPairedDeviceKindDefinition } from "@/features/core/pairedDevice/types/kind";

const kindsList = [] as const satisfies readonly AnyPairedDeviceKindDefinition[];
export const kinds = Object.assign(Object.create(null), Object.fromEntries((kindsList as readonly AnyPairedDeviceKindDefinition[]).map((item) => [String(item.kind), item]))) as unknown as { readonly [I in (typeof kindsList)[number] as I["kind"]]: I };
if (Object.keys(kinds).length !== kindsList.length) throw new Error("kinds: kind が重複している項目がある");
