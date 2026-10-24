// src/features/core/storageObject/services/server/storageObjectService.ts
//
// ファイル台帳のサービス。アップロード権の発行・commit・取り消し・削除・読み取りの解決・
// サーバー内の書き込みと複製・業務行への紐付けを持つ。
// 依存（台帳・ストレージのポート・用途表・時刻・ID）は createStorageObjectService で差し替えられる
// （単体テストは memoryLedger と fake ポートで動かす）。仕組みの説明: ../../README.md

import "server-only";

import { uuidv7 } from "uuidv7";

import { STORAGE_CONFIG } from "@/config/app/storage.config";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { DomainError } from "@/lib/errors";
import {
  contentDispositionFor,
  extensionForContentType,
  formatStorageRef,
  matchesContentType,
  normalizeContentType,
  objectKeyOf,
  parseStorageRef,
  resolveStorageSrc,
  type StoragePurpose,
  type StoragePurposeMap,
} from "@/lib/storage";
import {
  getStoragePort,
  locationOf,
  parseLegacyStorageUrl,
  resolveStoragePurpose,
  type ObjectLocation,
  type StoragePort,
} from "@/lib/storage/server";
import type { TransactionClient } from "@/lib/drizzle/transaction";

import type { StorageObject, StorageObjectStore } from "../../entities/model";
import { drizzleLedger } from "./ledger/drizzleLedger";
import type { StorageLedger } from "./ledger/types";
import { decideObject, decideUpload } from "./policy";
import { getStoragePurposes } from "./purposeSource";

/** 公開ファイルに、commit の照合後その世代だけへ付ける Cache-Control */
export const PUBLIC_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
/** 非公開ファイルの Cache-Control（常に） */
export const PRIVATE_CACHE_CONTROL = "no-store";

export type IssueInput = {
  purpose: string;
  contentType: string;
  size: number;
  scopeId?: string | null;
  /** ブラウザの Origin（再開可能セッションの CORS に使う） */
  origin?: string | null;
};

export type IssueResult = {
  objectId: string;
  ref: string;
  transfer:
    | { kind: "put"; url: string; headers: Record<string, string> }
    | { kind: "gcsSession"; sessionUrl: string };
  expiresAt: string;
};

export type CommitResult = {
  ref: string;
  src: string | null;
  size: number;
  contentType: string;
};

export type ReadResolution =
  | { kind: "redirect"; url: string }
  | { kind: "unauthenticated" }
  | { kind: "not_found" };

export type StorageObjectServiceDeps = {
  ledger: StorageLedger;
  port: () => StoragePort;
  purposes: () => StoragePurposeMap;
  locate: (store: StorageObjectStore, objectKey: string) => ObjectLocation;
  now: () => Date;
  newId: () => string;
};

function notFound(): DomainError {
  return new DomainError("ファイルが見つかりません", { status: 404 });
}

function refOf(row: Pick<StorageObject, "store" | "key">): string {
  return `storage://${row.store}/${row.key}`;
}

function storeOf(purpose: StoragePurpose): StorageObjectStore {
  return purpose.visibility === "public" ? "pub" : "priv";
}

function cacheControlFor(purpose: StoragePurpose): string {
  return purpose.visibility === "public" ? PUBLIC_IMMUTABLE_CACHE_CONTROL : PRIVATE_CACHE_CONTROL;
}

/** 読み取り署名の有効期間（用途ではなくファイルの種類で決める） */
function readTtlSecFor(contentType: string, use: "view" | "probe"): number {
  const ttl = STORAGE_CONFIG.readTtlSec;
  if (use === "probe") return ttl.probe;
  if (contentType.startsWith("image/")) return ttl.image;
  if (contentType.startsWith("video/")) return ttl.video;
  if (contentType.startsWith("audio/")) return ttl.audio;
  return ttl.file;
}

function assertAcceptable(purpose: StoragePurpose, contentType: string | null, size: number): string {
  const normalized = normalizeContentType(contentType);
  if (!normalized || !matchesContentType(normalized, purpose.contentTypes)) {
    throw new DomainError("この用途では受け付けないファイル形式です", { status: 400 });
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new DomainError("ファイルのサイズが不正です", { status: 400 });
  }
  if (size > purpose.maxBytes) {
    throw new DomainError("ファイルのサイズが上限を超えています", { status: 400 });
  }
  return normalized;
}

export function createStorageObjectService(deps: StorageObjectServiceDeps) {
  const { ledger, port, purposes, locate, now, newId } = deps;

  const locationOfRow = (row: Pick<StorageObject, "store" | "key">) => locate(row.store, row.key);

  /**
   * deleted にした行の実物を片付ける（ベストエフォート。失敗は掃除 cron が拾う）。
   * - 再開可能セッションは URI を DELETE して、アップロード権を先に殺す
   * - 単発 PUT の署名 URL は取り消せないため、期限内は object_removed_at を埋めない
   *   （期限前の再送で実物が復活しうる。掃除が期限後にもう一度消して完了にする）
   */
  async function cleanupDeletedObject(id: string): Promise<void> {
    const row = await ledger.findById(id);
    if (!row || row.status !== "deleted" || row.objectRemovedAt) return;
    try {
      if (row.transferKind === "session" && row.sessionUri) {
        await port().cancelSession(row.sessionUri);
      }
      await port().delete(locationOfRow(row), row.generation ? { generation: row.generation } : undefined);
      const at = now();
      if (row.transferKind === "put" && row.expiresAt > at) return;
      await ledger.markObjectRemoved(id, at);
    } catch (error) {
      console.error(`[storageObject] 実物の削除に失敗しました（掃除で再試行）: ${id}`, error);
    }
  }

  return {
    /** アップロード権を発行する（POST /api/me/storage/uploads） */
    async issue(user: SessionUser, input: IssueInput): Promise<IssueResult> {
      const purpose = resolveStoragePurpose(purposes(), input.purpose);
      const contentType = assertAcceptable(purpose, input.contentType, input.size);
      const scopeId = input.scopeId ?? null;
      if (scopeId !== null && !purpose.upload.check) {
        throw new DomainError("この用途では scopeId を指定できません", { status: 400 });
      }

      const decision = await decideUpload(purpose, user, scopeId);
      if (decision === "unauthenticated") throw new DomainError("認証が必要です。", { status: 401 });
      if (decision !== "granted") {
        throw new DomainError("このファイルをアップロードする権限がありません", { status: 403 });
      }

      const id = newId();
      const store = storeOf(purpose);
      const refParts = { store, purposeId: input.purpose, ledgerId: id, ext: extensionForContentType(contentType) };
      const ref = formatStorageRef(refParts);
      const key = objectKeyOf(refParts);
      const location = locate(store, key);
      const transferKind = input.size > STORAGE_CONFIG.sessionThresholdBytes ? "session" : "put";
      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + STORAGE_CONFIG.issueTtlSec[transferKind] * 1000);

      const inserted = await ledger.insertPendingWithinLimit(
        {
          id,
          purpose: input.purpose,
          store,
          key,
          ownerUserId: user.userId,
          scopeId,
          declaredSize: input.size,
          contentType,
          transferKind,
          expiresAt,
          createdAt: issuedAt,
        },
        purpose.maxPending ?? STORAGE_CONFIG.defaultMaxPending,
        issuedAt,
      );
      if (!inserted) {
        throw new DomainError("未完了のアップロードが多すぎます。しばらく経ってから再度お試しください", {
          status: 429,
        });
      }

      // アップロード権を渡せなかった行は deleted にして枠を返す（権そのものが無いので実物の削除は完了扱い）
      const releaseUnissued = async () => {
        const at = now();
        await ledger.markDeleted(id, { reason: "discarded", at }, { statuses: ["pending"] });
        await ledger.markObjectRemoved(id, at);
      };

      if (transferKind === "put") {
        let issued;
        try {
          issued = await port().issuePut(location, {
            contentType,
            size: input.size,
            maxBytes: purpose.maxBytes,
            ttlSec: STORAGE_CONFIG.issueTtlSec.put,
          });
        } catch (error) {
          await releaseUnissued();
          throw error;
        }
        return {
          objectId: id,
          ref,
          transfer: { kind: "put", url: issued.url, headers: issued.headers },
          expiresAt: expiresAt.toISOString(),
        };
      }

      let sessionUrl: string;
      try {
        ({ sessionUrl } = await port().issueSession(location, {
          contentType,
          size: input.size,
          origin: input.origin ?? undefined,
        }));
      } catch (error) {
        await releaseUnissued();
        throw error;
      }
      try {
        await ledger.setSessionUri(id, sessionUrl);
      } catch (error) {
        // URI を台帳に残せなかったセッションは、その場で中止してから枠を返す
        await port().cancelSession(sessionUrl).catch(() => undefined);
        await releaseUnissued();
        throw error;
      }
      return { objectId: id, ref, transfer: { kind: "gcsSession", sessionUrl }, expiresAt: expiresAt.toISOString() };
    },

    /**
     * アップロードの完了を確定する（POST /api/me/storage/uploads/[id]/commit）。
     * HEAD で size・申告 MIME・generation を照合して記録する（ファイルの中身は検査しない）。
     * 再送・並行実行には同じ ref を返す。
     */
    async commit(user: SessionUser, id: string): Promise<CommitResult> {
      const row = await ledger.findById(id);
      if (!row || row.ownerUserId !== user.userId) throw notFound();
      if (row.status === "ready") return commitResultOf(row);
      if (row.status === "deleted") {
        throw new DomainError("このアップロードは取り消されています", { status: 409 });
      }

      const purpose = resolveStoragePurpose(purposes(), row.purpose);
      const at = now();
      if (row.expiresAt <= at) {
        await ledger.markDeleted(id, { reason: "expired", at }, { statuses: ["pending"] });
        await cleanupDeletedObject(id);
        throw new DomainError("アップロードの期限が切れています", { status: 410 });
      }

      const location = locationOfRow(row);
      const head = await port().head(location);
      if (!head) throw new DomainError("ファイルがまだアップロードされていません", { status: 409 });

      const headType = normalizeContentType(head.contentType);
      const typeOk = headType === row.contentType && matchesContentType(headType, purpose.contentTypes);
      const sizeOk = head.size === row.declaredSize && head.size <= purpose.maxBytes;
      if (!typeOk || !sizeOk) {
        const marked = await ledger.markDeleted(
          id,
          { reason: sizeOk ? "type_mismatch" : "size_mismatch", at },
          { statuses: ["pending"] },
        );
        if (marked) {
          // 照合できなかった世代だけを消す
          try {
            await port().delete(location, { generation: head.generation });
          } catch (error) {
            console.error(`[storageObject] 照合に失敗したファイルの削除に失敗しました: ${id}`, error);
          }
          await cleanupDeletedObject(id);
        }
        throw new DomainError("アップロードされたファイルが申告と一致しません", { status: 422 });
      }

      if (purpose.visibility === "public") {
        await port().setCacheControl(location, head.generation, PUBLIC_IMMUTABLE_CACHE_CONTROL);
      }
      const ready = await ledger.markReady(id, {
        size: head.size,
        contentType: headType,
        generation: head.generation,
        readyAt: now(),
      });
      if (ready) return commitResultOf(ready);

      // 並行する commit が先に確定させた
      const latest = await ledger.findById(id);
      if (latest?.status === "ready") return commitResultOf(latest);
      throw new DomainError("このアップロードは取り消されています", { status: 409 });
    },

    /** 本人の未採用ファイルを取り消す（DELETE /api/me/storage/uploads/[id]）。再送しても安全 */
    async discard(user: SessionUser, id: string): Promise<{ ok: true }> {
      const row = await ledger.findById(id);
      if (!row || row.ownerUserId !== user.userId) throw notFound();
      if (row.status === "deleted") return { ok: true };
      if (row.recordId !== null) {
        throw new DomainError("使用中のファイルは取り消せません", { status: 409 });
      }
      const marked = await ledger.markDeleted(
        id,
        { reason: "discarded", at: now() },
        { statuses: ["pending", "ready"], unattachedOnly: true, ownerUserId: user.userId },
      );
      if (!marked) {
        const latest = await ledger.findById(id);
        if (latest?.status === "deleted") return { ok: true };
        throw new DomainError("使用中のファイルは取り消せません", { status: 409 });
      }
      await cleanupDeletedObject(id);
      return { ok: true };
    },

    /** 用途の delete 規則で、未紐付けのファイルを削除する（DELETE /api/storage/objects/[id]） */
    async remove(user: SessionUser, id: string): Promise<{ ok: true }> {
      const row = await ledger.findById(id);
      if (!row || row.status === "deleted") throw notFound();
      const purpose = resolveStoragePurpose(purposes(), row.purpose);
      const decision = await decideObject(purpose.delete, user, row);
      if (decision !== "granted") throw notFound();
      if (row.recordId !== null) {
        throw new DomainError("使用中のファイルは削除できません", { status: 409 });
      }
      const marked = await ledger.markDeleted(
        id,
        { reason: "http_deleted", at: now() },
        { statuses: ["pending", "ready"], unattachedOnly: true },
      );
      if (!marked) throw new DomainError("使用中のファイルは削除できません", { status: 409 });
      await cleanupDeletedObject(id);
      return { ok: true };
    },

    /**
     * 非公開ファイルの読み取りを解決する（GET /api/storage/objects/[id]）。
     * 用途の read（allow AND check）を都度判定し、照合済みの世代の短期署名 URL を返す。
     * loadUser は read 規則が "public" 以外のときだけ呼ぶ（DB と同期したセッション）。
     */
    async resolveRead(
      id: string,
      options: { loadUser: () => Promise<SessionUser | null>; use?: "view" | "probe" },
    ): Promise<ReadResolution> {
      const row = await ledger.findById(id);
      if (!row || row.status !== "ready" || !row.generation) return { kind: "not_found" };
      if (row.store !== "priv") return { kind: "not_found" };
      const purpose = purposes()[row.purpose];
      if (!purpose || purpose.visibility !== "private" || !purpose.read) return { kind: "not_found" };

      const user = purpose.read.allow === "public" ? null : await options.loadUser();
      const decision = await decideObject(purpose.read, user, row);
      if (decision === "unauthenticated") return { kind: "unauthenticated" };
      if (decision !== "granted") return { kind: "not_found" };

      const url = await port().signRead(locationOfRow(row), {
        ttlSec: readTtlSecFor(row.contentType, options.use ?? "view"),
        generation: row.generation,
        responseDisposition: contentDispositionFor(row.contentType),
      });
      return { kind: "redirect", url };
    },

    /**
     * サーバーから直接書き込み、ready の行を作る（dataMigration の import・fork の DB バックアップ等）。
     * ownerUserId は cron・system なら null、利用者・管理者が起点なら実際の利用者を渡す。
     * 呼び出し側が認可してから使う。
     */
    async putFromServer(input: {
      purpose: string;
      body: Uint8Array;
      contentType: string;
      ownerUserId: string | null;
      scopeId?: string | null;
    }): Promise<{ objectId: string; ref: string }> {
      const purpose = resolveStoragePurpose(purposes(), input.purpose);
      const contentType = assertAcceptable(purpose, input.contentType, input.body.byteLength);
      const id = newId();
      const store = storeOf(purpose);
      const key = objectKeyOf({ store, purposeId: input.purpose, ledgerId: id, ext: extensionForContentType(contentType) });
      const location = locate(store, key);
      const head = await port().put(location, input.body, { contentType, cacheControl: cacheControlFor(purpose) });
      try {
        await ledger.insertReady({
          id,
          purpose: input.purpose,
          store,
          key,
          ownerUserId: input.ownerUserId,
          scopeId: input.scopeId ?? null,
          size: head.size,
          contentType,
          generation: head.generation,
          createdAt: now(),
        });
      } catch (error) {
        await port().delete(location, { generation: head.generation }).catch(() => undefined);
        throw error;
      }
      return { objectId: id, ref: refOf({ store, key }) };
    },

    /**
     * 管理下の ref、または自分の旧バケットの旧 URL を複製し、新しい ref の ready 行を作る（duplicate・import）。
     * 失敗は黙って null にせず throw する。呼び出し側が認可してから使う。
     */
    async copy(input: {
      source: string;
      purpose: string;
      ownerUserId: string | null;
      scopeId?: string | null;
    }): Promise<{ objectId: string; ref: string }> {
      const purpose = resolveStoragePurpose(purposes(), input.purpose);
      let source: ObjectLocation;
      let sourceGeneration: string | undefined;
      let sourceType: string | null;
      let sourceSize: number;

      const parsed = parseStorageRef(input.source);
      if (parsed) {
        const row = await ledger.findById(parsed.ledgerId);
        if (!row || row.status !== "ready" || refOf(row) !== input.source || !row.generation) {
          throw new DomainError("複製元のファイルが見つかりません", { status: 404 });
        }
        source = locationOfRow(row);
        sourceGeneration = row.generation;
        sourceType = row.contentType;
        sourceSize = row.size ?? row.declaredSize;
      } else {
        const legacy = parseLegacyStorageUrl(input.source);
        if (!legacy) throw new DomainError("複製元のファイルが見つかりません", { status: 404 });
        const head = await port().head(legacy);
        if (!head) throw new DomainError("複製元のファイルが見つかりません", { status: 404 });
        source = legacy;
        sourceGeneration = head.generation;
        sourceType = head.contentType;
        sourceSize = head.size;
      }

      const contentType = assertAcceptable(purpose, sourceType, sourceSize);
      const id = newId();
      const store = storeOf(purpose);
      const key = objectKeyOf({ store, purposeId: input.purpose, ledgerId: id, ext: extensionForContentType(contentType) });
      const destination = locate(store, key);
      const head = await port().copy(source, destination, {
        cacheControl: cacheControlFor(purpose),
        sourceGeneration,
      });
      try {
        await ledger.insertReady({
          id,
          purpose: input.purpose,
          store,
          key,
          ownerUserId: input.ownerUserId,
          scopeId: input.scopeId ?? null,
          size: head.size,
          contentType,
          generation: head.generation,
          createdAt: now(),
        });
      } catch (error) {
        await port().delete(destination, { generation: head.generation }).catch(() => undefined);
        throw error;
      }
      return { objectId: id, ref: refOf({ store, key }) };
    },

    /**
     * ref を業務行に紐付ける（業務保存と同じ TX の中で呼ぶ。HTTP には出さない）。
     * ready・未紐付け・用途と ref の一致・保存者 = アップロードした本人 のときだけ成功し、
     * それ以外は DomainError 400（TX ごと巻き戻る）。
     */
    async attach(
      input: {
        ref: string;
        purpose: string;
        actorUserId: string | null;
        scopeId?: string | null;
        record: { type: string; id: string; field: string };
      },
      tx?: TransactionClient,
    ): Promise<void> {
      const parsed = parseStorageRef(input.ref);
      if (!parsed || parsed.purposeId !== input.purpose) {
        throw new DomainError("ファイルの参照が不正です", { status: 400 });
      }
      const attached = await ledger.attach(
        {
          id: parsed.ledgerId,
          purpose: input.purpose,
          store: parsed.store,
          key: objectKeyOf(parsed),
          ownerUserId: input.actorUserId,
          scopeId: input.scopeId,
          recordType: input.record.type,
          recordId: input.record.id,
          recordField: input.record.field,
        },
        tx,
      );
      if (!attached) throw new DomainError("このファイルは使用できません", { status: 400 });
    },

    /**
     * 業務行から外れた ref を deleted にする（値の置換・業務行の物理削除と同じ TX の中で呼ぶ）。
     * 戻り値の行の実物は、TX の commit 後に cleanupDeletedObject で消す。
     */
    async detach(
      input: {
        refs: readonly string[];
        record: { type: string; id: string };
        reason: "replaced" | "record_removed";
      },
      tx?: TransactionClient,
    ): Promise<StorageObject[]> {
      const ids = input.refs.flatMap((ref) => {
        const parsed = parseStorageRef(ref);
        return parsed ? [parsed.ledgerId] : [];
      });
      return ledger.detach(
        { ids, recordType: input.record.type, recordId: input.record.id, reason: input.reason, at: now() },
        tx,
      );
    },

    /**
     * 業務行に紐付いた ref を、同じ種類の別の業務行へ付け替える（replaceByQuery で新しい行に残る ref。業務保存と同じ TX の中で呼ぶ）。
     * ready・用途と ref の一致・いまの紐付け先 = from のときだけ成功し、それ以外は DomainError 400（TX ごと巻き戻る）。
     */
    async rebind(
      input: {
        ref: string;
        purpose: string;
        scopeId?: string | null;
        record: { type: string; fromId: string; toId: string; field: string };
      },
      tx?: TransactionClient,
    ): Promise<void> {
      const parsed = parseStorageRef(input.ref);
      if (!parsed || parsed.purposeId !== input.purpose) {
        throw new DomainError("ファイルの参照が不正です", { status: 400 });
      }
      const rebound = await ledger.rebind(
        {
          id: parsed.ledgerId,
          purpose: input.purpose,
          scopeId: input.scopeId,
          recordType: input.record.type,
          fromRecordId: input.record.fromId,
          toRecordId: input.record.toId,
          recordField: input.record.field,
        },
        tx,
      );
      if (!rebound) throw new DomainError("このファイルは使用できません", { status: 400 });
    },

    cleanupDeletedObject,
  };
}

function commitResultOf(row: StorageObject): CommitResult {
  const ref = refOf(row);
  return { ref, src: resolveStorageSrc(ref), size: row.size ?? row.declaredSize, contentType: row.contentType };
}

export type StorageObjectService = ReturnType<typeof createStorageObjectService>;

export const storageObjectService: StorageObjectService = createStorageObjectService({
  ledger: drizzleLedger,
  port: getStoragePort,
  purposes: getStoragePurposes,
  locate: locationOf,
  now: () => new Date(),
  newId: uuidv7,
});
