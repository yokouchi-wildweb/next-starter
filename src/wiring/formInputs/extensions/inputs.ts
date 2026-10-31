// 生成物・編集不可: pnpm extensions:generate が src/wiring/formInputs/extensionPoints.ts から生成する
// inputs: src/wiring/formInputs/inputs/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const formInput(並びはファイル名の順)

import type { FormInputItem } from "@/components/Form/Field/types";

const inputsList = [] as const satisfies readonly FormInputItem[];
export const inputs = Object.assign(Object.create(null), Object.fromEntries((inputsList as readonly FormInputItem[]).map((item) => [String(item.name), item]))) as unknown as { readonly [I in (typeof inputsList)[number] as I["name"]]: I };
if (Object.keys(inputs).length !== inputsList.length) throw new Error("inputs: name が重複している項目がある");
