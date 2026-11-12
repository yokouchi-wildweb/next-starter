// src/features/core/messaging/services/server/templates/imageBinding.ts
//
// テンプレートの画像(content の中の storage:// の参照。inApp.image など)を保存の台帳でテンプレートの行に結ぶ。
// 持ち主 = テンプレートの行(record messaging.template / <テンプレートの id> / content)。storage の照合は行の有無で残す・外す。
// 結び方(1 つの参照について。テンプレートを作る・直す取引の中):
// - storage:// の参照でない値(固定の URL など)はそのまま
// - 既にこのテンプレートに結ばれている → そのまま
// - ready・未紐付け・用途 notification.image・持ち主 = 操作した管理者 → このテンプレートに attach
// - それ以外(他の業務行に結ばれている・別の人が上げた・用途が違う)→ 1 回だけ複製して複製を attach し、参照を書き換える
// 下書きを直して画像を外しても台帳からは外さない(公開した版がまだ使うことがある)。テンプレートの行が消えれば照合が外す。
// 送る時の回ごとの複製(回が自分の写しを持つ)は送る口の仕事

import { isStorageRef } from "@/lib/storage";

import type { InboxImageObject } from "../inbox/imageBinding";

/** テンプレートの画像の持ち主の種類(台帳の record_type) */
export const TEMPLATE_IMAGE_RECORD_TYPE = "messaging.template";
/** 台帳の record_field */
export const TEMPLATE_IMAGE_RECORD_FIELD = "content";
/** 画像の用途(お知らせの画像と同じ) */
export const TEMPLATE_IMAGE_PURPOSE = "notification.image";

export type TemplateImageLedger<Tx> = {
  find: (ref: string) => Promise<InboxImageObject | null>;
  attach: (tx: Tx, input: { ref: string; actorUserId: string | null; templateId: string }) => Promise<void>;
  /** 複製(持ち主なし、用途 notification.image)。新しい参照を返す */
  copy: (ref: string) => Promise<string>;
};

/** 中身の文字列を置き換えた写しを返す(入れ子の object・配列も) */
function mapStrings(value: unknown, map: (text: string) => string): unknown {
  if (typeof value === "string") return map(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, map));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, map)]));
  }
  return value;
}

function collectRefs(value: unknown, out: Set<string>): Set<string> {
  if (typeof value === "string") {
    if (isStorageRef(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, out);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectRefs(item, out);
  }
  return out;
}

/**
 * 中身の storage:// の参照をテンプレートに結び、書き換えた中身を返す。
 * @throws 台帳の誤り(結べない参照・複製の失敗)はそのまま投げる(黙って画像なしにしない)
 */
export async function bindTemplateImages<Tx>(
  ledger: TemplateImageLedger<Tx>,
  tx: Tx,
  input: { templateId: string; actorUserId: string | null; content: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const replaced = new Map<string, string>();
  for (const ref of collectRefs(input.content, new Set())) {
    const object = await ledger.find(ref);
    if (object && object.recordType === TEMPLATE_IMAGE_RECORD_TYPE && object.recordId === input.templateId) continue;
    const attachable =
      object &&
      object.status === "ready" &&
      object.recordType === null &&
      object.purpose === TEMPLATE_IMAGE_PURPOSE &&
      object.ownerUserId !== null &&
      object.ownerUserId === input.actorUserId;
    const bound = attachable ? ref : await ledger.copy(ref);
    await ledger.attach(tx, { ref: bound, actorUserId: input.actorUserId, templateId: input.templateId });
    if (bound !== ref) replaced.set(ref, bound);
  }
  if (replaced.size === 0) return input.content;
  return mapStrings(input.content, (text) => replaced.get(text) ?? text) as Record<string, unknown>;
}
