// src/wiring/domainConfig.ts
// 全ドメインの設定（domainConfigRegistry）を lib/domain の汎用関数に結んだ、server 専用の入口。
// import してよい場所は他の wiring と同じ（一覧と向きは src/wiring/README.md）。自分のドメインの設定だけなら domain.json を直接読む。

import "server-only";

import { createDomainConfigLookup } from "@/lib/domain/config/createDomainConfigLookup";
import { domainConfigMap, type DomainConfig } from "@/registry/domainConfigRegistry";

export const { getDomainConfig, hasDomainConfig } = createDomainConfigLookup<DomainConfig>(domainConfigMap);
