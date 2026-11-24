// src/lib/mail/backendStatus.ts
// 口 mail の状態(D49): 選択表が選んだ実装の名前と設定の揃い具合だけを出す(送れる adapter は出さない)。
// 読み手 = 生成物 src/wiring/startup.ts の起動時の知らせの行・pnpm ops mail test-send(公開の入口 @/lib/mail から)

import type { BackendStatus } from "@/lib/backends";

import { adapter, selected } from "./extensions/mail";

export const mailBackendStatus: BackendStatus = {
  port: "mail",
  selected,
  isConfigured: () => adapter.isConfigured(),
};
