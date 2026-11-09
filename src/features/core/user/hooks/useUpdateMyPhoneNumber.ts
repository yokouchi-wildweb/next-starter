// src/features/core/user/hooks/useUpdateMyPhoneNumber.ts
// 本人の電話番号を SMS 認証なしで書く(入力の値・保存・消去)。部品 PhoneNumberForm はこの返り値を描くだけ。
// 入力は「090…」のような国内の形でもよい(formatToE164 で E.164 にして送る)。成功で onSaved を呼ぶ

"use client";

import { useCallback, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";

import { updateMyPhoneNumber, type UpdateMyPhoneNumberResponse } from "../services/client/phoneNumberClient";

export type UseUpdateMyPhoneNumberOptions = {
  /** 保存・消去に成功したとき(画面の取り直しなど) */
  onSaved?: (result: UpdateMyPhoneNumberResponse) => void;
};

export function useUpdateMyPhoneNumber({ onSaved }: UseUpdateMyPhoneNumberOptions = {}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { trigger, isMutating } = useDomainMutation("users/me/phone", updateMyPhoneNumber);

  const send = useCallback(
    async (phoneNumber: string | null) => {
      setError(null);
      try {
        const result = await trigger({ phoneNumber });
        setValue("");
        onSaved?.(result);
        return true;
      } catch (e) {
        setError(err(e, "電話番号の保存に失敗しました"));
        return false;
      }
    },
    [onSaved, trigger],
  );

  /** 入力の値を E.164 にして保存する(空なら何もしない) */
  const save = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return send(formatToE164(trimmed));
  }, [send, value]);

  /** 登録済みの番号を消す */
  const clear = useCallback(() => send(null), [send]);

  return { value, setValue, save, clear, isSaving: isMutating, error };
}
