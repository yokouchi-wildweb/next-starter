// src/lib/crud/collections/types.ts
//
// createCrudService の `collections` オプション（ドメイン集約: 主の 1 行に属する従属ドメインの行の集まり）の型。
// 主のレコード上では列でない配列（ref の値の並び）として扱い、create / update / upsert で
// 同じ TX の中で従属ドメインのサービスを通して差分同期する。

import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { DuplicateOptions } from "../types";
import type { DbTransaction } from "../drizzle/types";

/** 集まりの 1 要素（従属の行を見分ける ref 列の値） */
export type CollectionRef = string | number;

/**
 * 同期が使う従属ドメインのサービスの口（createCrudService の戻り値がそのまま満たす）。
 * 並びの列は systemUpdate で書くため、従属のサービスは systemColumns に並びの列を宣言する。
 */
export type CrudCollectionChildService = {
  create(data: any, tx?: DbTransaction): Promise<any>;
  hardDelete(id: string, tx?: DbTransaction): Promise<void>;
  systemUpdate(id: string, data: Record<string, unknown>, tx?: DbTransaction): Promise<any>;
  /**
   * 複製でファイルの列を新しい ref に写した値を返す（storage オプション付きのサービスだけが持つ。TX の外で呼ぶ）。
   * 無いサービスの行は値をそのまま写す
   */
  duplicateStorageValues?(source: Record<string, unknown>): Promise<Record<string, unknown>>;
};

/** 主ドメインの集まりの項目 1 つ分の宣言 */
export type CrudCollectionConfig = {
  /** 主のレコード上のフィールド名（列ではない配列）。e.g. galleryImages */
  fieldName: string;
  /** 従属ドメインのサービス。import の循環を避けるため遅延で渡す（e.g. () => import("...").then((m) => m.childService)） */
  service: () => CrudCollectionChildService | Promise<CrudCollectionChildService>;
  /** 従属の表の主への参照列（主の物理削除で cascade する外部キー） */
  parentColumn: AnyPgColumn;
  /** 従属の表の ref 列（集まりの要素の値。差分はこの値で取る） */
  refColumn: AnyPgColumn;
  /**
   * 従属の表の並びの列（主の中だけで配列順に振り、同期のたびに振り直す）。従属の systemColumns に宣言する。
   * text の列（テンプレートの既定）= lib の fractional の鍵、integer の列 = 0 始まりの添字
   */
  sortColumn: AnyPgColumn;
  /** 最大件数。超える配列の保存は 400（切り詰めない）。省略時は上限なし */
  maxItems?: number;
  /** 主の複製で従属も写すか（既定 true）。false なら複製した主の集まりは空 */
  duplicate?: boolean;
};

/** 差分同期の結果 */
export type CollectionSyncResult = {
  /** 同期後の従属の行（配列順） */
  rows: Record<string, unknown>[];
  /** 作った行の数 */
  created: number;
  /** 消した行の数 */
  deleted: number;
};

/** 複製で使う主のサービスの口（createCrudService の戻り値がそのまま満たす。手書きのサービスでもよい） */
export type CollectionDuplicateParentService = {
  get(id: string): Promise<any>;
  create(data: any, tx?: DbTransaction): Promise<any>;
  /** 主のファイルの列を新しい ref に写した値（storage オプション付きのサービスだけが持つ。TX の外で呼ぶ） */
  duplicateStorageValues?(source: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export type DuplicateWithCollectionsParams = {
  /** 主のサービス（主の行の create はここを通る: 主のファイルの紐付け・集まりの層） */
  service: CollectionDuplicateParentService;
  /** 主の集まりの宣言 */
  collections: readonly CrudCollectionConfig[];
  /** 複製元の主の id */
  id: string;
  options?: DuplicateOptions;
};

/** 複製の結果 */
export type CollectionDuplicateResult<T = Record<string, unknown>> = {
  /** 複製した主の行（集まりの項目に新しい ref の配列を載せる） */
  record: T;
  /** 集まりの項目ごとの、複製元の従属の id → 複製した従属の id */
  idMaps: Record<string, Map<string | number, string | number>>;
};
