// src/lib/dataMigration/hooks/useDataMigrationConfig.ts
// DataMigration 用の設定をドメイン config から生成するフック

"use client";

import { useMemo } from "react";
import { hasRelations as checkHasRelations, getHasManyRelations } from "@/lib/domain";
import type { DomainConfig } from "@/lib/domain";
import { buildExportFields } from "../configUtils";

/**
 * DataMigration 用の設定を生成するフック
 *
 * @example
 * import config from "@/features/sample/domain.json";
 * const { exportFields, hasRelations, hasManyDomains } = useDataMigrationConfig(config);
 */
export function useDataMigrationConfig(config: DomainConfig) {
  const exportFields = useMemo(() => buildExportFields(config), [config]);
  const hasRelations = useMemo(() => checkHasRelations(config.singular), [config.singular]);
  const hasManyDomains = useMemo(() => getHasManyRelations(config.singular), [config.singular]);

  return { exportFields, hasRelations, hasManyDomains };
}
