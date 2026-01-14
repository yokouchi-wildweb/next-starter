// src/features/core/user/hooks/useChangeUserRole.ts

"use client";

import useSWRMutation from "swr/mutation";
import { useSWRConfig } from "swr";

import { userClient, type ChangeRoleInput } from "../services/client/userClient";
import { normalizeHttpError } from "@/lib/errors";

type TriggerArg = {
  userId: string;
  data: ChangeRoleInput;
};

export const useChangeUserRole = () => {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    "users/change-role",
    async (_key: string, { arg }: { arg: TriggerArg }) => {
      try {
        return await userClient.changeRole(arg.userId, arg.data);
      } catch (error) {
        throw normalizeHttpError(error, "ロールの変更に失敗しました");
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
