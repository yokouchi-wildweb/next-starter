// src/wiring/domainConfig.ts
// 全ドメインの設定を読む server 用の入口。

import "server-only";

export { getDomainConfig, hasDomainConfig } from "@/lib/domain/config/getDomainConfig";
