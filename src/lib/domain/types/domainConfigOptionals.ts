// src/lib/domain/types/domainConfigOptionals.ts
// 生成物 src/registry/domainConfigRegistry.ts の DomainConfig に重ねる、登録の entity.json の省略できるフィールドの型(手書き)

/**
 * entity.json でオプショナル（⚪ No）なフィールド。
 * union 型では省略されたメンバーのプロパティにアクセスできないため、
 * intersection で付与して型安全にアクセス可能にする。
 *
 * ⚠️ entity.json スキーマにオプショナルフィールドを追加した場合、ここにも追加すること。
 *    追加漏れ → searchFields がないドメインが存在するだけでビルドエラーになる。
 *    スキーマ定義: src/domains/README.md「トップレベルプロパティ」
 */
export type DomainConfigOptionals = {
  useSoftDelete?: boolean;
  searchFields?: string[];
  // 関連度ランキング（searchRank: true 時のフィールド重み、Neon のみ）。
  // 未宣言なら searchFields 等重み。詳細は src/lib/crud/README.md の searchRank 節を参照。
  searchRank?: { fields?: Array<string | { field: string; weight?: number }> };
  defaultOrderBy?: string[][];
  tableFields?: string[];
  useDetailModal?: boolean;
  addToAdminDataMenu?: boolean;
  useDuplicateButton?: boolean;
  useImportExport?: boolean;
  useAutoSave?: boolean;
  // 正規の型は src/lib/formSuite/FieldRenderer/types.ts の FieldGroup を参照。
  // JSON インポートの型推論と相性を保つためインラインで再宣言している。
  fieldGroups?: Array<{
    key: string;
    label: string;
    fields: string[];
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    bgColor?: string;
  }>;
  // 鍵の集合の正は src/lib/domain/definition/declaration.mjs の INDEX_KEYS(列 fields か式 expression のどちらか)
  indexes?: Array<{
    fields?: string[];
    where?: string;
    name?: string;
    // インデックス方式（gin / gist など）。省略 = btree
    using?: string;
    // 列ごとの演算子クラス（例: { title: "gin_trgm_ops" }）。Partial なのは、索引ごとに鍵の違う entity.json を JSON の import で読むと、
    // TypeScript が他の索引の鍵を `?: undefined` で足すため(metadataBinding と同じ)
    opclass?: Readonly<Partial<Record<string, string>>>;
    // ユニークの索引（ユニークは索引だけで書く）
    unique?: boolean;
    // 降順の列（fields のうち）
    desc?: string[];
    // 列の代わりの SQL の式
    expression?: string;
  }>;
  sortOrderField?: string | null;
  // systemUpdate / systemBulkUpdateByQuery（特権書き込み）の allowlist（Neon のみ）。
  // 詳細は src/lib/crud/README.md を参照。
  systemColumns?: string[];
  // 秘匿カラム（サービスの全戻り値・withRelations 展開から null 置換、Neon のみ）。
  // pnpm generate domain が entities/drizzle.ts に defineHiddenColumns() を出力する。
  // 詳細は src/lib/crud/README.md の hiddenColumns 節を参照。
  hiddenColumns?: string[];
  // JSON インポートの型推論（string）と相性を保つため、リテラル union ではなく緩い型で宣言する。
  // 厳密な型は @/lib/domainAccess の DomainApiAccessConfig を参照。
  apiAccess?: {
    read?: string | { roles?: string[]; roleCategories?: string[] };
    write?: string | { roles?: string[]; roleCategories?: string[] };
    operations?: Record<string, string | { roles?: string[]; roleCategories?: string[] }>;
  };
  // 共有の読みのキャッシュの宣言（domain.json の無いドメインは同じ形の <domain>/cache.json）。
  // JSON インポートの型推論（string）と相性を保つため緩い型で宣言する。厳密な型は ./cache の DomainCacheDeclaration、
  // 形と上限の検査は scripts/structure/domain/checks/cache.mjs（pnpm check domain）
  cache?: {
    mode?: string;
    life?: string | { stale?: number; revalidate?: number; expire?: number };
    get?: boolean;
    list?: { limit?: number };
    reads?: Array<{ name?: string; where?: unknown; orderBy?: unknown; limit?: number; mode?: string; life?: unknown }>;
    readsDomains?: string[];
  };
  // false = 手で管理し pnpm generate domain は何も書かない（省略 = true）。生成器だけが読む
  generate?: boolean;
  // 開発者のメモ（どの階層にも書ける。生成器も client の写しも読まず、動作に効かない）
  $comment?: string | string[];
};
