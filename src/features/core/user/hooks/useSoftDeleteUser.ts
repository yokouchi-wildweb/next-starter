// src/features/core/user/hooks/useSoftDeleteUser.ts

"use client";

import useSWRMutation from "swr/mutation";
import { useSWRConfig } from "swr";

import { userClient, type SoftDeleteInput } from "../services/client/userClient";
import { normalizeHttpError } from "@/lib/errors";

type TriggerArg = {
  userId: string;
  data?: SoftDeleteInput;
};

export const useSoftDeleteUser = () => {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    "users/soft-delete",
    async (_key: string, { arg }: { arg: TriggerArg }) => {
      try {
        return await userClient.softDelete(arg.userId, arg.data);
      } catch (error) {
        throw normalizeHttpError(error, "ユーザーの削除に失敗しました");
      }
    },
    {
      onSuccess: () => {
        // ユーザー一覧を再取得
        mutate((key: unknown) => typeof key === "string" && key.startsWith("users"), undefined, {
          revalidate: true,
        });
      },
    },
  );
};
