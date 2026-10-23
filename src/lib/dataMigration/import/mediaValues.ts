// src/lib/dataMigration/import/mediaValues.ts
//
// import するメディア列の値を、業務行に書ける値（ref / null）に解決する。書き込みの TX の外で先に呼ぶ（duplicate と同じ考え方）。
// 値ごとの扱い:
// - 空 → null（multi は []）
// - 既存行の今の値と同じ → そのまま（binding の「同じ値は通す」規則。ref・旧 URL・外部 URL のどれでも）
// - `assets/…` → 同梱ファイルを putFromServer で新しい ref に（同梱が無ければ失敗）
// - 今回クライアントがアップロードした ref → そのまま（binding の attach が本人・未紐付け・用途一致を検査する）
// - それ以外の ref・自分の旧バケットの旧 URL → copy で新しい ref に（所有者 = 実行者。元のファイルは変えない）
// - 外部 URL・"/" で始まる値・解釈できない値 → 失敗
// 1 つでも解決できなければ MediaValueError を throw し、呼び出し側がチャンク全体を失敗にする（multi も黙って欠落させない）。
// 解決した後に書き込みが失敗した場合、作った ref は未紐付けのまま残り、掃除 cron が消す。

import "server-only";

import type { CrudStorageField } from "@/lib/crud/storageIntegration/types";
import { isStorageRef } from "@/lib/storage";
import { parseLegacyStorageUrl } from "@/lib/storage/server";

import { contentTypeFromFilename, type DataMigrationMediaResolver } from "../media";

const ASSET_PREFIX = "assets/";

/** メディア値を解決できなかった（行・列・値つき） */
export class MediaValueError extends Error {
  constructor(
    readonly rowNumber: number,
    readonly field: string,
    readonly value: string,
    reason: string,
  ) {
    super(`データ行 ${rowNumber}: ${field}: ${reason}（値: ${value}）`);
    this.name = "MediaValueError";
  }
}

export type MediaValueKind = "empty" | "keep" | "asset" | "uploaded" | "copy" | "invalid";

/**
 * 1 つの値の扱いを決める（I/O なし）。
 * @param current 既存行のこの列の今の値（新規行なら空）
 * @param uploadedRefs 今回クライアントがアップロードした ref
 */
export function classifyMediaValue(
  value: string,
  current: readonly string[],
  uploadedRefs: ReadonlySet<string>,
): MediaValueKind {
  if (value.length === 0) return "empty";
  if (current.includes(value)) return "keep";
  if (value.startsWith(ASSET_PREFIX)) return "asset";
  if (isStorageRef(value)) return uploadedRefs.has(value) ? "uploaded" : "copy";
  if (parseLegacyStorageUrl(value)) return "copy";
  return "invalid";
}

/** CSV のセルを値の並びにする（multi はカンマ区切り。単一列は 1 つ） */
export function splitMediaCell(raw: unknown, multi: boolean): string[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
  const text = String(raw).trim();
  if (text.length === 0) return [];
  if (!multi) return [text];
  return text
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function currentValuesOf(row: Record<string, unknown> | null, field: CrudStorageField): string[] {
  if (!row) return [];
  return splitMediaCell(row[field.name], Boolean(field.multi));
}

export type ResolveMediaRowInput = {
  /** CSV のデータ行番号（1 始まり。エラー表示用） */
  rowNumber: number;
  /** CSV の行（型変換前） */
  record: Record<string, unknown>;
  /** 書き込み先の既存行（無ければ null） */
  existing: Record<string, unknown> | null;
  /** scope の計算に使う行（CSV の値を既存行に重ねたもの） */
  scopeRow: Record<string, unknown>;
  fields: readonly CrudStorageField[];
  assets: ReadonlyMap<string, Uint8Array>;
  uploadedRefs: ReadonlySet<string>;
  media: DataMigrationMediaResolver;
};

/**
 * 1 行分のメディア列を解決する。CSV に列が無いメディア列は触らない（戻り値に入れない）。
 * @returns 列名 → 書く値（単一列は ref または null、multi は ref の配列）
 */
export async function resolveMediaRow(input: ResolveMediaRowInput): Promise<Record<string, string | string[] | null>> {
  const { rowNumber, record, existing, scopeRow, fields, assets, uploadedRefs, media } = input;
  const resolved: Record<string, string | string[] | null> = {};

  for (const field of fields) {
    if (!(field.name in record)) continue;
    const multi = Boolean(field.multi);
    const values = splitMediaCell(record[field.name], multi);
    const current = currentValuesOf(existing, field);
    const scopeId = field.scope ? field.scope(scopeRow) : null;
    const next: string[] = [];

    for (const value of values) {
      const kind = classifyMediaValue(value, current, uploadedRefs);
      switch (kind) {
        case "empty":
          continue;
        case "keep":
        case "uploaded":
          next.push(value);
          continue;
        case "asset": {
          const assetPath = value.slice(ASSET_PREFIX.length);
          const body = assets.get(assetPath);
          if (!body) throw new MediaValueError(rowNumber, field.name, value, "ZIP に同梱ファイルがありません");
          const filename = assetPath.split("/").pop() ?? assetPath;
          try {
            next.push(
              await media.putAsset({ purpose: field.purpose, body, contentType: contentTypeFromFilename(filename), scopeId }),
            );
          } catch (error) {
            const reason = error instanceof Error ? error.message : "保存に失敗しました";
            throw new MediaValueError(rowNumber, field.name, value, `同梱ファイルを保存できません（${reason}）`);
          }
          continue;
        }
        case "copy":
          try {
            next.push(await media.copy({ source: value, purpose: field.purpose, scopeId }));
          } catch (error) {
            const reason = error instanceof Error ? error.message : "複製に失敗しました";
            throw new MediaValueError(rowNumber, field.name, value, `複製できません（${reason}）`);
          }
          continue;
        case "invalid":
          throw new MediaValueError(
            rowNumber,
            field.name,
            value,
            "取り込めない値です（使えるのは ZIP の同梱ファイル・ファイルの参照・自分の旧バケットの URL だけ。外部 URL は取り込めません）",
          );
      }
    }

    if (multi) resolved[field.name] = next;
    else if (next.length > 1) throw new MediaValueError(rowNumber, field.name, values.join(","), "値は 1 つだけです");
    else resolved[field.name] = next[0] ?? null;
  }

  return resolved;
}
