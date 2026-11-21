// src/lib/crud/types/relations.ts
// GET 系の展開(withRelations / withCount)とリレーション設定(createCrudService に渡す)

// ============================================================
// withRelations / withCount オプション
// ============================================================

/**
 * GET系メソッド（get, list, search）で使用するオプション。
 * リレーション展開やカウント取得を制御する。
 */
export type WithOptions = {
  /**
   * リレーション先のオブジェクトを展開する深さを指定する。
   * - false/undefined: 展開しない
   * - true/1: 1階層（リレーション先のみ）
   * - 2: 2階層（リレーション先のリレーションも展開）
   *
   * 例:
   * - belongsTo: 外部キー → オブジェクト（例: sample_category_id → sample_category）
   * - belongsToMany: ID配列 → オブジェクト配列（例: sample_tag_ids → sample_tags）
   */
  withRelations?: boolean | number;
  /**
   * true の場合、リレーション先のレコード数を _count に含めて返す。
   * 例: _count: { sample_tags: 5 }
   */
  withCount?: boolean;
  /**
   * 取得件数の上限。デフォルト: 100。
   * 全件取得が必要な場合は listAll() を使用する。
   */
  limit?: number;
  /**
   * hasMany リレーション展開時の、親レコードあたりの子レコード取得上限。
   * 省略時はデフォルト 100。
   */
  hasManyLimit?: number;
};

// ============================================================
// リレーション設定型（createCrudService に渡す）
// ============================================================

/**
 * ネストリレーション設定。
 * 2階層目のリレーション展開に使用する。
 */
export type NestedRelations = {
  belongsTo?: BelongsToRelation[];
  belongsToMany?: BelongsToManyObjectRelation[];
  hasMany?: HasManyRelation[];
};

/**
 * belongsTo リレーション設定。
 * 外部キーからリレーション先のオブジェクトを取得する。
 */
export type BelongsToRelation<TTable = any> = {
  /** 展開後のフィールド名（例: "sample_category"） */
  field: string;
  /** 外部キーのフィールド名（例: "sample_category_id"） */
  foreignKey: string;
  /** リレーション先のテーブル（例: SampleCategoryTable） */
  table: TTable;
  /** 取得するカラム名（省略時は全カラム） */
  targetFields?: string[];
  /**
   * リレーション先のテーブルが論理削除を使う場合 true。
   * 設定すると hydrate 時に deletedAt IS NULL で絞り込み、削除済みレコードを除外する。
   */
  useSoftDelete?: boolean;
  /** リレーション先テーブルの deletedAt カラム（useSoftDelete: true の時のみ参照） */
  deletedAtColumn?: any;
  /**
   * 2階層目のリレーション設定。
   * withRelations: 2 の場合にこのリレーション先のさらにリレーションを展開する。
   */
  nested?: NestedRelations;
};

/**
 * belongsToMany リレーションのオブジェクト展開設定。
 * 中間テーブルを経由してリレーション先のオブジェクト配列を取得する。
 */
export type BelongsToManyObjectRelation<
  TTargetTable = any,
  TThroughTable = any,
  TSourceColumn = any,
  TTargetColumn = any,
> = {
  /** 展開後のフィールド名（例: "sample_tags"） */
  field: string;
  /**
   * ID 配列を格納するフィールド名（例: "sample_tag_ids"）。
   * 指定した場合、JOIN で取得したターゲットIDから ID 配列を派生させ、
   * `field` のオブジェクト配列と並べて `record[idField]` に格納する。
   * ネスト階層で `hydrateBelongsToManyRelations` が呼ばれないため、
   * ネスト先の belongsToMany で *_ids を使いたい場合に指定する。
   * 追加 DB クエリは発生しない（JOIN 済みデータから派生）。
   */
  idField?: string;
  /** リレーション先のテーブル（例: SampleTagTable） */
  targetTable: TTargetTable;
  /** 中間テーブル（例: SampleToSampleTagTable） */
  throughTable: TThroughTable;
  /** 中間テーブルの source 側カラム（例: SampleToSampleTagTable.sampleId） */
  sourceColumn: TSourceColumn;
  /** 中間テーブルの target 側カラム（例: SampleToSampleTagTable.sampleTagId） */
  targetColumn: TTargetColumn;
  /** 取得するカラム名（省略時は全カラム） */
  targetFields?: string[];
  /**
   * リレーション先のテーブルが論理削除を使う場合 true。
   * 設定すると hydrate 時に targetTable.deletedAt IS NULL で絞り込み、削除済みレコードを除外する。
   */
  useSoftDelete?: boolean;
  /** リレーション先テーブルの deletedAt カラム（useSoftDelete: true の時のみ参照） */
  deletedAtColumn?: any;
  /**
   * 2階層目のリレーション設定。
   * withRelations: 2 の場合にこのリレーション先のさらにリレーションを展開する。
   */
  nested?: NestedRelations;
};

/**
 * hasMany リレーション設定。
 * 親→子方向のリレーションを展開し、子レコードの配列を取得する。
 */
export type HasManyRelation<TTable = any> = {
  /** 展開後のフィールド名（例: "samples"） */
  field: string;
  /** 子テーブル（例: SampleTable） */
  table: TTable;
  /** 子テーブル側の外部キーカラム名（例: "sample_category_id"） */
  foreignKey: string;
  /** 取得するカラム名（省略時は全カラム） */
  targetFields?: string[];
  /**
   * 子テーブルが論理削除を使う場合 true。
   * 設定すると hydrate 時に deletedAt IS NULL で絞り込み、削除済みレコードを除外する。
   */
  useSoftDelete?: boolean;
  /** 子テーブルの deletedAt カラム（useSoftDelete: true の時のみ参照） */
  deletedAtColumn?: any;
  /**
   * 2階層目のリレーション設定。
   * withRelations: 2 の場合にこのリレーション先のさらにリレーションを展開する。
   */
  nested?: NestedRelations;
};

/**
 * belongsToMany リレーションのカウント設定。
 * 中間テーブルを経由してリレーション先のレコード数を取得する。
 */
export type CountableRelation<TThroughTable = any, TTargetTable = any> = {
  /** カウントフィールド名（例: "sample_tags"） */
  field: string;
  /** 中間テーブル（例: SampleToSampleTagTable） */
  throughTable: TThroughTable;
  /** 中間テーブルの source 側外部キー名（例: "sampleId"） */
  foreignKey: string;
  /**
   * カウント対象のターゲットテーブル。
   * useSoftDelete: true の場合に JOIN 対象として必須。
   */
  targetTable?: TTargetTable;
  /** 中間テーブルの target 側カラム（例: SampleToSampleTagTable.sampleTagId）。useSoftDelete: true の場合に必須 */
  targetColumn?: any;
  /** ターゲットテーブルが論理削除を使う場合 true */
  useSoftDelete?: boolean;
  /** ターゲットテーブルの deletedAt カラム（useSoftDelete: true の時のみ参照） */
  deletedAtColumn?: any;
};
