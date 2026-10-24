// src/lib/crud/storageIntegration/types.ts
//
// createCrudService の `storage` オプション（ファイル台帳との連動）の型。
// lib/crud は features に依存しないので、ここは型と呼び出しの約束だけを持つ。
// 実装（台帳への attach / detach / copy）は features/core/storageObject の storageBindingFor が差し込む。

import type { DbTransaction } from "../drizzle/types";

/** 業務行のメディア列 1 つ分の宣言 */
export type CrudStorageField = {
  /** 行のプロパティ名（drizzle のカラムのキー） */
  name: string;
  /** ファイル用途 ID（`<domain>.<field>`） */
  purpose: string;
  /** true = 値が配列（mediaUploaderMulti） */
  multi?: boolean;
  /** 用途の範囲（scope_id）と一致を求めるときに、行から値を取り出す */
  scope?: (row: Record<string, unknown>) => string | null;
};

/**
 * storage オプション付きのサービスが出す読み取り専用の宣言（どの列がメディア列か・用途・multi）。
 * dataMigration などがメディア列を知る正本。storage を指定しないサービスでは undefined
 */
export type StorageFieldsAugmented = {
  readonly storageFields?: readonly CrudStorageField[];
  /**
   * この表から親へ向かう FK のうち onDelete cascade のもの（`<列名> → <参照先の表>`）。
   * 親の削除で DB が行を消すと binding を通らず、台帳の紐付けが残り続ける（実物が漏れる）。
   * binding が onHardDelete: "keep" なら空（物理削除でも台帳を残す方針のため）。test:storage-purposes が空であることを確かめる
   */
  readonly storageCascadeForeignKeys?: readonly string[];
};

/**
 * afterWrite / afterHardDelete が返す「commit 後に片付けるもの」。中身は binding だけが解釈する。
 * 操作ごとに返して afterCommit に渡すので、並行する要求どうしで混ざらない。
 */
export type CrudStorageCleanup = unknown;

type Row = Record<string, unknown>;

/** afterReplace に渡す、replaceByQuery の削除フェーズの扱い */
export type CrudStorageReplaceContext = {
  /** true = 旧行は論理削除で残る（紐付けを残す。旧行の値を新しい行に入れたら throw） */
  softDeleted: boolean;
};

export interface CrudStorageBinding {
  readonly fields: readonly CrudStorageField[];
  /**
   * 業務行の物理削除で台帳をどうするか。keep = 何もしない（台帳と実物を残す）。省略 = detach。
   * DB の FK cascade で行が消えても困らないのは keep だけ（applyStorageBinding の storageCascadeForeignKeys が見る）
   */
  readonly onHardDelete?: "detach" | "keep";
  /**
   * create / update / upsert で業務行を書いた直後に、同じ TX の中で呼ぶ。
   * 新しい ref を紐付け（失敗は throw → TX ごと巻き戻る）、外れた ref を deleted にする。
   * @param before 書く前の行（create では null。update / upsert は FOR UPDATE で読んだ行）
   */
  afterWrite(tx: DbTransaction, before: Row | null, after: Row): Promise<CrudStorageCleanup>;
  /**
   * replaceByQuery で旧行の削除と新しい行の挿入を済ませた直後に、同じ TX の中で呼ぶ。
   * ref ごとに旧行全体と新しい行全体を比べ、新しく現れた ref は attach、別の行に残った ref は付け替え、
   * 消えた ref は detach する（失敗は throw → TX ごと巻き戻る）。
   * 省略した binding のサービスでは replaceByQuery を DomainError 400 で拒否する（台帳を壊さないため）。
   * @param before 削除フェーズの対象になった旧行（FOR UPDATE で読んだ行）
   * @param after 挿入した新しい行
   */
  afterReplace?(
    tx: DbTransaction,
    before: readonly Row[],
    after: readonly Row[],
    context: CrudStorageReplaceContext,
  ): Promise<CrudStorageCleanup>;
  /** 物理削除の直前に、同じ TX の中で呼ぶ（削除される行を渡す） */
  afterHardDelete(tx: DbTransaction, rows: readonly Row[]): Promise<CrudStorageCleanup>;
  /**
   * duplicate で、複製元のメディア列を複製した新しい値を返す（TX の外で先に呼ぶ）。
   * 1 件でも複製に失敗したら throw する（複製全体を失敗させる。黙って null にしない）。
   */
  duplicateValues(source: Row): Promise<Row>;
  /**
   * TX の commit 後に実物を片付ける（ベストエフォート。失敗は掃除 cron が拾う）。
   * 呼び出し元から tx を渡された操作では呼ばない（外側の TX がまだ commit されていないため。掃除 cron が片付ける）。
   */
  afterCommit(cleanups: readonly CrudStorageCleanup[]): Promise<void>;
}
