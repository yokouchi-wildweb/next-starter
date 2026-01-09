// src/features/core/user/hooks/useChangeUserStatus.ts

"use client";

import useSWRMutation from "swr/mutation";
import { useSWRConfig } from "swr";

import { userClient, type ChangeStatusInput } from "../services/client/userClient";
import { normalizeHttpError } from "@/lib/errors";

type TriggerArg = {
  userId: string;
  data: ChangeStatusInput;
};

export const useChangeUserStatus = () => {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    "users/change-status",
    async (_key: string, { arg }: { arg: TriggerArg }) => {
      try {
        return await userClient.changeStatus(arg.userId, arg.data);
      } catch (error) {
        throw normalizeHttpError(error, "ステータスの変更に失敗しました");
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
