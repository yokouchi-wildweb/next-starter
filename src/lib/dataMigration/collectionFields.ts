// src/lib/dataMigration/collectionFields.ts
//
// 集まりの項目（createCrudService の collections オプション）は CSV/ZIP のデータ移行に対応しない。
// - 取り込み: CSV の見出し・行のキー・申告された項目のどれかに集まりの項目があれば、DB を変える前
//   （メディアの写し・アップロードより前）に DomainError 400 で拒否する
// - 書き出し: 選ばれていても出さない（CSV の列・manifest の fields から外す）
// どれが集まりの項目かはサービスの collectionFields が正本（クライアントの申告は使わない）

import "server-only";
import { DomainError } from "@/lib/errors";

/** サービスの集まりの項目名（collections オプションの無いサービスは空） */
export function collectionFieldsOf(service: unknown): readonly string[] {
  const fields = (service as { collectionFields?: readonly string[] } | null)?.collectionFields;
  return Array.isArray(fields) ? fields : [];
}

/** 書き出す項目から集まりの項目を外す */
export function withoutCollectionFields(service: unknown, fields: readonly string[]): string[] {
  const collectionFields = new Set(collectionFieldsOf(service));
  return fields.filter((field) => !collectionFields.has(field));
}

/**
 * 取り込む CSV（見出し・行のキー）と申告された項目に、集まりの項目があれば DomainError 400 を投げる
 */
export function assertNoCollectionFields(
  service: unknown,
  domain: string,
  input: {
    headers?: readonly string[];
    records?: readonly Record<string, unknown>[];
    fields?: readonly { name: string }[];
  },
): void {
  const collectionFields = new Set(collectionFieldsOf(service));
  if (collectionFields.size === 0) return;
  const found = new Set<string>();
  const check = (name: string) => {
    if (collectionFields.has(name)) found.add(name);
  };
  input.headers?.forEach(check);
  input.records?.forEach((record) => Object.keys(record).forEach(check));
  input.fields?.forEach((field) => check(field.name));
  if (found.size > 0) {
    throw new DomainError(
      `${domain} の集まりの項目（${[...found].join(", ")}）は CSV/ZIP の取り込みに対応していません。列から外してください`,
      { status: 400 },
    );
  }
}
