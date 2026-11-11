// src/features/core/messaging/services/server/inbox/imageBinding.ts
//
// お知らせ(受け取り箱の行)の画像を保存の台帳に結ぶ。持ち主の業務行は「回」(record messaging.dispatch / <回の id> / inApp.image)。
// 受け取り箱の行ではない理由: 台帳の 1 つのファイルは 1 つの業務行にしか結べない。宛先ごとの行が同じ画像を持つので、行ごとに
// 持たせると宛先の数だけ複製(strip の描き直し)が要る。宛先ごとの行は利用者の削除の CASCADE でも消え、messaging は serviceRegistry に
// 無いので storage の照合はその種類を飛ばす(unregistered)= 外す道が無い。受け取り箱の行は回より長生きしない(FK cascade、保持の掃除は
// お知らせの行の無い回だけを消す)ので、回を消す時に外せば全部の道を覆う。
//
// 結び方(1 つの元の参照 ref について。回の行を排他で持った取引の中で呼ぶ):
// - storage:// の参照でない値(固定の URL など)はそのまま。台帳に結ばない
// - 回の metadata.inboxImages に ref がある → その値(結んだ参照)を使う(束・送り直しで同じ物を使い回す)
// - 台帳の行が ready で、既にこの回に結ばれている → そのまま
// - ready・未紐付け・用途 notification.image・持ち主 = 回の actor_id → この回に attach
// - それ以外(別の人が上げた・他の業務行に結ばれている・用途が違う)→ 回ごとに 1 回だけ複製(持ち主なし)して複製を attach
//   (coupon の issueCodeForOwner と同じ。元の行と ref を共有しない)。複製の失敗は投げる(黙って画像なしにしない)
// 結んだ参照は metadata.inboxImages { <元の参照>: <結んだ参照> } に残す。保持の掃除はこの値を detach してから回を消す。

import { isStorageRef, parseStorageRef } from "@/lib/storage";

/** 受け取り箱の画像の持ち主の種類(台帳の record_type) */
export const INBOX_IMAGE_RECORD_TYPE = "messaging.dispatch";
/** 台帳の record_field */
export const INBOX_IMAGE_RECORD_FIELD = "inApp.image";
/** 受け取り箱の画像の用途(前のお知らせの名前のまま。改名しない) */
export const INBOX_IMAGE_PURPOSE = "notification.image";
/** 回の metadata の鍵 { <元の参照>: <結んだ参照> } */
export const INBOX_IMAGES_METADATA_KEY = "inboxImages";

/** 台帳の 1 行のうち、結び方の判断に要る値 */
export type InboxImageObject = {
  status: string;
  purpose: string;
  ownerUserId: string | null;
  recordType: string | null;
  recordId: string | null;
};

/** 台帳の読み書き(本物は storageObjectService、テストは偽物)。tx = 回の行を排他で持った取引 */
export type InboxImageLedger<Tx> = {
  find: (ref: string) => Promise<InboxImageObject | null>;
  attach: (tx: Tx, input: { ref: string; actorUserId: string | null; dispatchId: string }) => Promise<void>;
  /** 複製(持ち主なし、用途 notification.image)。新しい参照を返す */
  copy: (ref: string) => Promise<string>;
};

/** 回の行のうち、結ぶのに要る値(排他で読んだ行) */
export type InboxImageDispatch = { id: string; actor_id: string | null; metadata: Record<string, unknown> | null };

/** 回の metadata から結んだ参照の対応を読む */
export function inboxImageMapping(metadata: Record<string, unknown> | null | undefined): Record<string, string> {
  const value = metadata?.[INBOX_IMAGES_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** 回に結んだ参照の一覧(保持の掃除が回を消す前に detach する) */
export function boundInboxImageRefs(metadata: Record<string, unknown> | null | undefined): string[] {
  return [...new Set(Object.values(inboxImageMapping(metadata)))].filter(isStorageRef);
}

/**
 * 画像の参照を回に結び、元の参照 → 書く参照 の対応を返す。
 * metadata = 対応を足した回の metadata(変わらなければ null。呼び手が同じ取引で回の行に書く)
 */
export async function bindInboxImages<Tx>(
  ledger: InboxImageLedger<Tx>,
  tx: Tx,
  dispatch: InboxImageDispatch,
  refs: readonly (string | null | undefined)[],
): Promise<{ map: Map<string, string>; metadata: Record<string, unknown> | null }> {
  const mapping = inboxImageMapping(dispatch.metadata);
  const map = new Map<string, string>();
  let changed = false;
  for (const ref of new Set(refs)) {
    if (typeof ref !== "string" || ref.length === 0) continue;
    if (!isStorageRef(ref)) {
      map.set(ref, ref);
      continue;
    }
    const known = mapping[ref];
    if (known) {
      map.set(ref, known);
      continue;
    }
    const bound = await bindOne(ledger, tx, dispatch, ref);
    mapping[ref] = bound;
    map.set(ref, bound);
    changed = true;
  }
  return {
    map,
    metadata: changed ? { ...(dispatch.metadata ?? {}), [INBOX_IMAGES_METADATA_KEY]: mapping } : null,
  };
}

async function bindOne<Tx>(ledger: InboxImageLedger<Tx>, tx: Tx, dispatch: InboxImageDispatch, ref: string): Promise<string> {
  const object = await ledger.find(ref);
  if (object && object.status === "ready") {
    if (object.recordType === INBOX_IMAGE_RECORD_TYPE && object.recordId === dispatch.id) return ref;
    const ownImage =
      object.recordId === null &&
      object.purpose === INBOX_IMAGE_PURPOSE &&
      parseStorageRef(ref)?.purposeId === INBOX_IMAGE_PURPOSE &&
      object.ownerUserId === dispatch.actor_id;
    if (ownImage) {
      await ledger.attach(tx, { ref, actorUserId: dispatch.actor_id, dispatchId: dispatch.id });
      return ref;
    }
  }
  const copied = await ledger.copy(ref);
  await ledger.attach(tx, { ref: copied, actorUserId: null, dispatchId: dispatch.id });
  return copied;
}
