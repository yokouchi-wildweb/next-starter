// src/lib/dataMigration/hooks/useDataMigrationConfig.ts
// DataMigration 用の設定を写しから生成するフック

"use client";

import { useMemo } from "react";
import { hasRelationsOf, getHasManyRelationsOf } from "@/lib/domain";
import type { DomainDisplay } from "@/lib/domain/types/display";
import { buildExportFields } from "../configUtils";

/**
 * DataMigration 用の設定を生成するフック
 *
 * @example
 * import { domainDisplay } from "@/features/sample/entities/display";
 * const { exportFields, hasRelations, hasManyDomains } = useDataMigrationConfig(domainDisplay);
 */
export function useDataMigrationConfig(config: DomainDisplay) {
  const exportFields = useMemo(() => buildExportFields(config), [config]);
  const hasRelations = useMemo(() => hasRelationsOf(config), [config]);
  const hasManyDomains = useMemo(() => getHasManyRelationsOf(config), [config]);

  return { exportFields, hasRelations, hasManyDomains };
}
