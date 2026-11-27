// src/lib/dataMigration/relations.ts
// データマイグレーション用のリレーション情報収集ユーティリティ

import {
  type DomainConfig,
  getRelationsOf,
  getHasManyRelationsOf,
  type RelationType,
  type RelationInfo,
  type HasManyRelationInfo,
  junctionColumnsOf,
  registrationTableName,
  extractFields,
  extractImageFields,
  type DomainFieldInfo,
} from "@/lib/domain";
import { toCamelCase, toSnakeCase } from "@/lib/stringCase/index.mjs";

/** ドメイン名から設定を引く（API ルートが src/wiring/domainConfig.ts の getDomainConfig を注入する） */
export type DataMigrationConfigResolver = (domain: string) => DomainConfig;

/** エクスポート対象ドメイン情報 */
export type ExportDomainInfo = {
  /** ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
  /** ドメインタイプ: main/related/junction/hasMany */
  type: "main" | "related" | "junction" | "hasMany";
  /** リレーションタイプ（related/hasMany の場合） */
  relationType?: RelationType | "hasMany";
  /** リレーションフィールド名（related の場合: sample_category_id, sample_tag_ids、hasMany の場合: 子側の外部キー） */
  relationField?: string;
  /** ソースフィールド名（junction の場合） */
  sourceField?: string;
  /** ターゲットフィールド名（junction の場合） */
  targetField?: string;
  /** エクスポート対象フィールド情報 */
  fields: DomainFieldInfo[];
  /** 画像フィールド名リスト */
  imageFields: string[];
};

/**
 * エクスポート対象ドメイン情報を収集
 * includeRelations: true の場合、関連ドメイン・中間テーブルも含める
 * selectedHasManyDomains: hasMany ドメインの選択リスト（指定された場合のみ hasMany をエクスポート）
 */
export function collectExportDomains(
  getDomainConfig: DataMigrationConfigResolver,
  mainDomain: string,
  includeRelations: boolean = false,
  selectedHasManyDomains?: string[]
): ExportDomainInfo[] {
  const domains: ExportDomainInfo[] = [];
  const mainConfig = getDomainConfig(mainDomain);
  const mainDomainSnake = toSnakeCase(mainDomain);

  if (!includeRelations) {
    // 単一ドメインモード
    domains.push({
      domain: mainDomainSnake,
      label: mainConfig.label,
      type: "main",
      fields: extractFields(mainConfig),
      imageFields: extractImageFields(mainConfig),
    });
    return domains;
  }

  // リレーション含むモード
  const relations = getRelationsOf(mainConfig as Parameters<typeof getRelationsOf>[0]);
  const hasManyRelations = getHasManyRelationsOf(mainConfig as Parameters<typeof getHasManyRelationsOf>[0]);

  // 1. related ドメイン（belongsTo, belongsToMany の参照先）
  for (const relation of relations) {
    const relatedConfig = getDomainConfig(relation.domain);
    domains.push({
      domain: relation.domain,
      label: relatedConfig.label,
      type: "related",
      relationType: relation.relationType,
      relationField: relation.fieldName,
      fields: extractFields(relatedConfig),
      imageFields: extractImageFields(relatedConfig),
    });
  }

  // 2. main ドメイン
  domains.push({
    domain: mainDomainSnake,
    label: mainConfig.label,
    type: "main",
    fields: extractFields(mainConfig),
    imageFields: extractImageFields(mainConfig),
  });

  // 3. hasMany ドメイン（選択されたもののみ）
  for (const hasManyRelation of hasManyRelations) {
    // selectedHasManyDomains が指定されていて、かつそのドメインが含まれている場合のみ追加
    if (selectedHasManyDomains && selectedHasManyDomains.includes(hasManyRelation.domain)) {
      const childConfig = getDomainConfig(hasManyRelation.domain);
      domains.push({
        domain: hasManyRelation.domain,
        label: childConfig.label,
        type: "hasMany",
        relationType: "hasMany",
        relationField: hasManyRelation.fieldName,
        fields: extractFields(childConfig),
        imageFields: extractImageFields(childConfig),
      });
    }
  }

  // 4. junction テーブル（多対多の結びの登録、D354）。through を書いた関係(持つ側)だけ。反対側(through なし)は結びを持たない
  //    名前を組み立てない: 表・列は through が名指す結びの登録の宣言から読む
  const mainRegistration = toCamelCase(mainDomain);
  for (const relation of relations) {
    if (relation.relationType !== "belongsToMany" || typeof relation.through !== "string") continue;
    const junctionConfig = getDomainConfig(toSnakeCase(relation.through));
    const target = toCamelCase(relation.domain);
    const tables = new Map([
      [registrationTableName(mainRegistration, mainConfig), mainRegistration],
      [registrationTableName(target, getDomainConfig(relation.domain)), target],
    ]);
    const columns = junctionColumnsOf(junctionConfig, mainRegistration, target, (table) => tables.get(table) ?? null);
    if (!columns) throw new Error(`${mainDomain}: belongsToMany "${relation.domain}" の結びの登録 ${relation.through} が両側を指す 2 本を持ちません(pnpm check domain)`);
    domains.push({
      domain: registrationTableName(relation.through, junctionConfig),
      label: `${mainConfig.label} - ${relation.label}`,
      type: "junction",
      relationType: "belongsToMany",
      sourceField: columns.sourceColumn,
      targetField: columns.targetColumn,
      fields: [
        { name: columns.sourceColumn, label: `${mainConfig.label}ID`, fieldType: "uuid" },
        { name: columns.targetColumn, label: `${relation.label}ID`, fieldType: "uuid" },
      ],
      imageFields: [],
    });
  }

  return domains;
}

/**
 * インポート順序を決定
 * related → main → hasMany → junction の順でソート
 */
export function sortDomainsForImport(domains: ExportDomainInfo[]): ExportDomainInfo[] {
  const typeOrder: Record<ExportDomainInfo["type"], number> = {
    related: 1,
    main: 2,
    hasMany: 3,
    junction: 4,
  };

  return [...domains].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
}
