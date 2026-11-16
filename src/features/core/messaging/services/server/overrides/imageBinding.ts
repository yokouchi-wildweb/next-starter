// src/features/core/messaging/services/server/overrides/imageBinding.ts
//
// 文言の上書きの画像(値の中の storage:// の参照。inApp.image など)を保存の台帳で上書きの行に結ぶ(D83)。
// 持ち主 = 上書きの行(record messaging.override / <行の id> / <欄 "<経路>.<欄>">)。storage の照合は行の有無で残す・外す。
// 結び方(保存の取引の中。テンプレートの templates/imageBinding.ts と同じ):
// - storage:// の参照でない値(固定の URL など)はそのまま
// - 既にこの行に結ばれている → そのまま
// - ready・未紐付け・用途 notification.image・持ち主 = 操作した管理者 → この行に attach
// - それ以外(他の業務行に結ばれている・別の人が上げた・用途が違う)→ 1 回だけ複製して複製を attach し、参照を書き換える
// 外し方: 差し替えで前の値にだけあった参照は replaced、既定に戻す(行を消す)時は値の参照を record_removed で外す。
// 外した物の実物は取引の commit の後に消す(cleanup)。送る時の回ごとの複製は送る口の仕事(inbox/imageBinding.ts)

import type { InboxImageObject } from "../inbox/imageBinding";
import { collectRefs, mapStrings } from "../templates/imageBinding";

/** 上書きの画像の持ち主の種類(台帳の record_type) */
export const OVERRIDE_IMAGE_RECORD_TYPE = "messaging.override";
/** 画像の用途(お知らせの画像と同じ) */
export const OVERRIDE_IMAGE_PURPOSE = "notification.image";

export type OverrideImageLedger<Tx> = {
  find: (ref: string) => Promise<InboxImageObject | null>;
  attach: (tx: Tx, input: { ref: string; actorUserId: string | null; rowId: string; fieldPath: string }) => Promise<void>;
  /** 複製(持ち主なし、用途 notification.image)。新しい参照を返す */
  copy: (ref: string) => Promise<string>;
  /** 行から外す(deleted にする)。commit の後に消す台帳の id を返す */
  detach: (tx: Tx, input: { refs: readonly string[]; rowId: string; reason: "replaced" | "record_removed" }) => Promise<string[]>;
  /** 外した物の実物を消す(commit の後) */
  cleanup: (ids: readonly string[]) => Promise<void>;
};

/**
 * 保存する値の参照を行に結び、前の値にだけあった参照を外す。
 * @returns 書く値(複製した参照に書き換えた物)と commit の後に消す台帳の id
 * @throws 台帳の誤り(結べない参照・複製の失敗)はそのまま投げる(黙って画像なしにしない)
 */
export async function bindOverrideImages<Tx>(
  ledger: OverrideImageLedger<Tx>,
  tx: Tx,
  input: { rowId: string; fieldPath: string; actorUserId: string | null; value: unknown; previousValue: unknown },
): Promise<{ value: unknown; cleanupIds: string[] }> {
  const replaced = new Map<string, string>();
  for (const ref of collectRefs(input.value, new Set())) {
    const object = await ledger.find(ref);
    if (object && object.recordType === OVERRIDE_IMAGE_RECORD_TYPE && object.recordId === input.rowId) continue;
    const attachable =
      object &&
      object.status === "ready" &&
      object.recordType === null &&
      object.purpose === OVERRIDE_IMAGE_PURPOSE &&
      object.ownerUserId !== null &&
      object.ownerUserId === input.actorUserId;
    const bound = attachable ? ref : await ledger.copy(ref);
    await ledger.attach(tx, { ref: bound, actorUserId: input.actorUserId, rowId: input.rowId, fieldPath: input.fieldPath });
    if (bound !== ref) replaced.set(ref, bound);
  }
  const value = replaced.size === 0 ? input.value : mapStrings(input.value, (text) => replaced.get(text) ?? text);
  const kept = collectRefs(value, new Set());
  const dropped = [...collectRefs(input.previousValue, new Set())].filter((ref) => !kept.has(ref));
  const cleanupIds = dropped.length > 0 ? await ledger.detach(tx, { refs: dropped, rowId: input.rowId, reason: "replaced" }) : [];
  return { value, cleanupIds };
}

/** 行を消す時に値の参照を外す。commit の後に消す台帳の id を返す */
export async function releaseOverrideImages<Tx>(
  ledger: OverrideImageLedger<Tx>,
  tx: Tx,
  input: { rowId: string; value: unknown },
): Promise<string[]> {
  const refs = [...collectRefs(input.value, new Set())];
  return refs.length > 0 ? ledger.detach(tx, { refs, rowId: input.rowId, reason: "record_removed" }) : [];
}
