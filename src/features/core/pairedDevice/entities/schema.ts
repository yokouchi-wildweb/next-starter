// src/features/core/pairedDevice/entities/schema.ts

import { z } from "zod";

import { PAIRED_DEVICE_LABEL_MAX_LENGTH } from "@/features/core/pairedDevice/constants";

const LabelSchema = z.string().trim().min(1).max(PAIRED_DEVICE_LABEL_MAX_LENGTH);
const KindSchema = z.string().trim().min(1).max(64);

/**
 * CRUD ベース（drizzleBase）の create バリデーション。
 * scope の形は kind の scopeSchema で別途検証する（createPairedDevice）。
 */
export const PairedDeviceCreateSchema = z.object({
  label: LabelSchema,
  kind: KindSchema,
  scope: z.unknown(),
  createdBy: z.string().uuid().nullable().optional(),
});

/**
 * CRUD ベースの update バリデーション。kind は変更できない（作り直す）。
 * トークン・失効・最終アクセスの列は deviceToken.ts / deviceService.ts の専用経路だけが書く。
 */
export const PairedDeviceUpdateSchema = z.object({
  label: LabelSchema.optional(),
  scope: z.unknown().optional(),
  updatedAt: z.date().optional(),
});

export type PairedDeviceWriteInput = z.infer<typeof PairedDeviceCreateSchema> &
  Partial<z.infer<typeof PairedDeviceUpdateSchema>>;

/** 端末の登録（POST /api/paired-devices）の入力 */
export const CreatePairedDeviceSchema = z.object({
  label: LabelSchema,
  kind: KindSchema,
  /** 形は kind の scopeSchema（省略時は {}） */
  scope: z.unknown().optional(),
});
export type CreatePairedDeviceInput = z.infer<typeof CreatePairedDeviceSchema>;

/** 端末の変更（PATCH /api/paired-devices/[id]）の入力。名前の変更と scope の付け替え */
export const UpdatePairedDeviceSchema = z
  .object({
    label: LabelSchema.optional(),
    scope: z.unknown().optional(),
  })
  .refine((value) => value.label !== undefined || value.scope !== undefined, {
    message: "label か scope のどちらかを指定してください",
  });
export type UpdatePairedDeviceInput = z.infer<typeof UpdatePairedDeviceSchema>;

/** 端末の一覧（GET /api/paired-devices）の絞り込み */
export const ListPairedDevicesSchema = z.object({
  kind: KindSchema.optional(),
  /** scope の部分一致（JSONB の包含。例: { storeId: "..." }） */
  scope: z.record(z.unknown()).optional(),
  includeRevoked: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type ListPairedDevicesInput = z.infer<typeof ListPairedDevicesSchema>;

const PairingCodeSchema = z.string().trim().min(1).max(32);

/** 管理者が発行したコードを端末が送る（POST /api/paired-device/pairing/claim）入力 */
export const ClaimPairingCodeSchema = z.object({
  code: PairingCodeSchema,
});
export type ClaimPairingCodeInput = z.infer<typeof ClaimPairingCodeSchema>;

/**
 * 端末側から始めたペアリングを管理者が承認する（POST /api/paired-devices/pairing-requests/approve）入力。
 * 既存の端末を割り当てるか（deviceId）、その場で端末を登録するか（device）のどちらか。
 */
export const ApproveDevicePairingSchema = z.union([
  z.object({
    code: PairingCodeSchema,
    deviceId: z.string().uuid(),
    /**
     * 稼働中（トークン有効）の端末に割り当てるときは true が必要（今の端末は使えなくなる）。
     * 省略すると 409 device_active で止まる（取り違えで稼働中の端末を締め出さないため）
     */
    replaceActive: z.boolean().optional(),
  }),
  z.object({ code: PairingCodeSchema, device: CreatePairedDeviceSchema }),
]);
export type ApproveDevicePairingInput = z.infer<typeof ApproveDevicePairingSchema>;
