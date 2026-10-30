// 生成物・編集不可: pnpm extensions:generate が src/proxies/extensionPoints.ts から生成する
// decorators: src/proxies/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const decorator(並びはファイル名の順)

import type { ProxyResponseDecorator } from "@/proxies/types";

export const decorators: ProxyResponseDecorator[] = [];
