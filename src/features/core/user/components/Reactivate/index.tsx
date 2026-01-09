// src/features/core/user/components/Reactivate/index.tsx

"use client";

import { useCallback } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para, SecTitle } from "@/components/TextBlocks";
import { useReactivate } from "@/features/core/auth/hooks/useReactivate";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

export function Reactivate() {
  const { reactivate, isLoading: isReactivating, error } = useReactivate();
  const { logout, isLoading: isLoggingOut } = useLogout({ redirectTo: "/" });

  const isLoading = isReactivating || isLoggingOut;

  const handleReactivate = useCallback(async () => {
    try {
      await reactivate();
    } catch {
      // エラーは useReactivate 内で処理済み
    }
  }, [reactivate]);

  const handleCancel = useCallback(async () => {
    try {
      await logout();
    } catch {
      // エラーは useLogout 内で処理済み
    }
  }, [logout]);

  return (
    <Block appearance="outlined" padding="lg">
      <Flex direction="column" gap="md">
        <SecTitle as="h2">アカウントの復帰</SecTitle>
        <Para tone="muted" size="sm">
          現在、アカウントは休会中です。
          サービスを再開するには「復帰する」ボタンをクリックしてください。
        </Para>

        {error && (
          <Para tone="destructive" size="sm" className="mt-0">
            {error.message}
          </Para>
        )}

        <Flex direction="column" gap="sm">
          <Button
            variant="primary"
            onClick={handleReactivate}
            disabled={isLoading}
          >
            {isReactivating ? "処理中..." : "復帰する"}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {isLoggingOut ? "処理中..." : "キャンセル"}
          </Button>
        </Flex>
      </Flex>
    </Block>
  );
}

export default Reactivate;
