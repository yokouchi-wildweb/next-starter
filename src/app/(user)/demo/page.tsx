"use client";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Main, PageTitle, Para } from "@/components/TextBlocks";
import { Button } from "@/components/Form/Button/Button";
import { useDemoLogin } from "@/features/core/auth/hooks/useDemoLogin";
import { err } from "@/lib/errors";

export default function DemoStartPage() {
  const { demoLogin, isLoading, error } = useDemoLogin({ redirectTo: "/" });

  const handleClick = async () => {
    try {
      await demoLogin();
    } catch {
      // エラーはフック内で処理済み
    }
  };

  return (
    <Main space="xl" padding="xl">
      <Flex direction="column" align="center" justify="center" className="min-h-[60vh]">
        <Block appearance="surface" padding="xl" className="max-w-md w-full text-center">
          <PageTitle>デモモード</PageTitle>
          <Para tone="muted" className="mt-4">
            デモユーザーとしてログインし、アプリケーションの機能をお試しいただけます。
          </Para>
          <Para tone="muted" size="sm" className="mt-2">
            デモモードでは、データベースへの書き込みはスキップされます。
          </Para>

          {error && (
            <Para tone="danger" size="sm" className="mt-4">
              {err(error, "デモログインに失敗しました")}
            </Para>
          )}

          <Button
            variant="primary"
            size="lg"
            className="mt-8 w-full"
            onClick={handleClick}
            disabled={isLoading}
          >
            {isLoading ? "ログイン中..." : "デモを開始"}
          </Button>
        </Block>
      </Flex>
    </Main>
  );
}
