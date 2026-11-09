// src/features/core/user/services/server/phoneNumber/updateOwnPhoneNumber.ts
// 本人が SMS 認証なしで電話番号を登録・変更・消す(設定の議会 D122・L1.39)。
// 番号は DB だけに書き、認証の印 phoneVerifiedAt は null にする(Firebase の電話番号は SMS 認証で link したときだけ)。
// 受け付ける条件(一覧に phone があり SMS 認証が閉)は呼び手の route が確かめる

import { z } from "zod";

import type { User } from "@/features/core/user/entities";
import { E164_PHONE_REGEX } from "@/features/core/user/utils/phoneNumber";
import { DomainError } from "@/lib/errors";

import { base } from "../drizzleBase";
import { assertPhoneAvailability } from "../helpers/assertPhoneAvailability";

const OwnPhoneNumberSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(E164_PHONE_REGEX, { message: "電話番号はE.164形式で入力してください" })
    .nullable(),
});

export type UpdateOwnPhoneNumberParams = {
  userId: string;
  /** { phoneNumber: E.164 の文字列 | null(消す) }。検証前の値 */
  input: unknown;
};

export type UpdateOwnPhoneNumberResult = {
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
};

/**
 * 本人の電話番号を書く。同じ番号なら何も書かない。他の利用者が使う番号は 409。
 * 書くときは base.update を通す(監査が素通りしない)
 */
export async function updateOwnPhoneNumber({ userId, input }: UpdateOwnPhoneNumberParams): Promise<UpdateOwnPhoneNumberResult> {
  const parsed = OwnPhoneNumberSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.errors[0]?.message ?? "入力内容が不正です", { status: 400 });
  }
  const { phoneNumber } = parsed.data;

  const current = await base.get(userId);
  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }
  if (current.phoneNumber === phoneNumber) {
    return { phoneNumber: current.phoneNumber ?? null, phoneVerifiedAt: current.phoneVerifiedAt ?? null };
  }

  if (phoneNumber) {
    await assertPhoneAvailability({ phoneNumber, excludeUserId: userId });
  }

  const updated = await base.update(userId, {
    phoneNumber,
    phoneVerifiedAt: null,
    updatedAt: new Date(),
  } as Partial<User>);
  if (!updated) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }
  return { phoneNumber: updated.phoneNumber ?? null, phoneVerifiedAt: updated.phoneVerifiedAt ?? null };
}
