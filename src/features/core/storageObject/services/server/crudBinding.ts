// src/features/core/storageObject/services/server/crudBinding.ts
//
// createCrudService の `storage` オプションに渡す binding（業務行のメディア列 ↔ ファイル台帳）。
//
//   createCrudService(SampleTable, {
//     storage: storageBindingFor("sample", [{ name: "main_image", purpose: "sample.main_image" }]),
//   });
//
// 規則（ref と旧 URL）:
// - 新しく現れた ref は attach（ready・未紐付け・用途一致・保存者 = アップロードした本人のときだけ。外れたら 400 で TX ごと巻き戻る）
// - 消えた ref は detach（deleted、reason replaced）。実物は commit 後に消す
// - http(s) の値（凍結した旧 URL）は、update で前と同じ値のときだけ通す。新しい値・create では 400
//   （import や管理者の複製は storageObjectService.copy / putFromServer で新しい ref にする）
// - 置換で外れた旧 URL の実物は消さない（利用者による旧ファイルの個別削除にあたるため）
// - 物理削除では ref を detach（reason record_removed）し、旧 URL は自分の旧バケットのものだけを実物ごと消す
// - duplicate は ref・旧 URL とも copy で新しい ref にする（1 件でも失敗したら throw）
// actor は routeFactory が敷く AuditContext の actorId（runAsSystem の中では null）。

import { getAuditContext } from "@/lib/audit";
import type { CrudStorageBinding, CrudStorageCleanup, CrudStorageField } from "@/lib/crud/storageIntegration/types";
import { DomainError } from "@/lib/errors";
import { isStorageRef } from "@/lib/storage";
import {
  getStoragePort,
  parseLegacyStorageUrl,
  type ObjectLocation,
  type StoragePort,
} from "@/lib/storage/server";

import { storageObjectService, type StorageObjectService } from "./storageObjectService";

type Row = Record<string, unknown>;

/** メディア列 1 つ分の宣言（scope = 用途の範囲を行から取り出す。型は lib/crud の CrudStorageField） */
export type StorageBindingField = CrudStorageField;

export type StorageBindingOptions = {
  /** 業務行の物理削除で何をするか。keep = 何もしない（ユーザーの物理削除など。台帳と実物を残す） */
  onHardDelete?: "detach" | "keep";
  /** テスト用の差し替え */
  service?: StorageObjectService;
  port?: () => StoragePort;
};

type Cleanup = { objectIds: string[]; legacy: ObjectLocation[] };

function valuesOf(row: Row | null, field: StorageBindingField): string[] {
  if (!row) return [];
  const raw = row[field.name];
  const list = field.multi ? (Array.isArray(raw) ? raw : []) : [raw];
  return [...new Set(list.filter((v): v is string => typeof v === "string" && v.trim().length > 0))];
}

function invalidValue(field: StorageBindingField): DomainError {
  return new DomainError(`${field.name}: 新しく保存できるのはアップロード済みファイルの参照だけです`, { status: 400 });
}

export function storageBindingFor(
  recordType: string,
  fields: readonly StorageBindingField[],
  options: StorageBindingOptions = {},
): CrudStorageBinding {
  const service = options.service ?? storageObjectService;
  const port = options.port ?? getStoragePort;
  const onHardDelete = options.onHardDelete ?? "detach";
  const actorId = () => getAuditContext()?.actorId ?? null;

  return {
    fields,

    async afterWrite(tx, before, after): Promise<CrudStorageCleanup> {
      const actorUserId = actorId();
      const recordId = String(after.id);
      const cleanup: Cleanup = { objectIds: [], legacy: [] };

      for (const field of fields) {
        const previous = valuesOf(before, field);
        const next = valuesOf(after, field);
        const added = next.filter((v) => !previous.includes(v));
        const removed = previous.filter((v) => !next.includes(v));

        for (const value of added) {
          // 旧 URL・外部 URL・その他の値は、新しく書き込めない（前と同じ値の保持は added に入らない）
          if (!isStorageRef(value)) throw invalidValue(field);
          await service.attach(
            {
              ref: value,
              purpose: field.purpose,
              actorUserId,
              scopeId: field.scope ? field.scope(after) : undefined,
              record: { type: recordType, id: recordId, field: field.name },
            },
            tx,
          );
        }

        const removedRefs = removed.filter(isStorageRef);
        if (removedRefs.length > 0) {
          const detached = await service.detach(
            { refs: removedRefs, record: { type: recordType, id: recordId }, reason: "replaced" },
            tx,
          );
          cleanup.objectIds.push(...detached.map((row) => row.id));
        }
      }
      return cleanup;
    },

    async afterHardDelete(tx, rows): Promise<CrudStorageCleanup> {
      const cleanup: Cleanup = { objectIds: [], legacy: [] };
      if (onHardDelete === "keep") return cleanup;
      for (const row of rows) {
        const recordId = String(row.id);
        for (const field of fields) {
          const values = valuesOf(row, field);
          const refs = values.filter(isStorageRef);
          if (refs.length > 0) {
            const detached = await service.detach(
              { refs, record: { type: recordType, id: recordId }, reason: "record_removed" },
              tx,
            );
            cleanup.objectIds.push(...detached.map((detachedRow) => detachedRow.id));
          }
          for (const value of values) {
            if (isStorageRef(value)) continue;
            const legacy = parseLegacyStorageUrl(value);
            if (legacy) cleanup.legacy.push(legacy);
          }
        }
      }
      return cleanup;
    },

    async duplicateValues(source) {
      const ownerUserId = actorId();
      const values: Row = {};
      for (const field of fields) {
        const sourceValues = valuesOf(source, field);
        if (sourceValues.length === 0) continue;
        const copied: string[] = [];
        for (const value of sourceValues) {
          const { ref } = await service.copy({
            source: value,
            purpose: field.purpose,
            ownerUserId,
            scopeId: field.scope ? field.scope(source) : undefined,
          });
          copied.push(ref);
        }
        values[field.name] = field.multi ? copied : copied[0];
      }
      return values;
    },

    async afterCommit(cleanups) {
      for (const item of cleanups) {
        if (!item) continue;
        const { objectIds, legacy } = item as Cleanup;
        for (const id of objectIds) await service.cleanupDeletedObject(id);
        for (const location of legacy) {
          try {
            await port().delete(location);
          } catch (error) {
            console.error(`[storageObject] 旧ファイルの削除に失敗しました: ${location.bucket}/${location.path}`, error);
          }
        }
      }
    },
  };
}
