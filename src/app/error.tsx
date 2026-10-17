"use client";

import { useEffect } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="md"
      padding="lg"
      className="min-h-[50vh]"
    >
      <SecTitle as="h1" size="xxl">
        エラー検知
      </SecTitle>
      <Para tone="muted" align="center">
        予期しないエラーが発生しました。
      </Para>
      {process.env.NODE_ENV === "development" && (
        <Para tone="destructive" size="sm">
          {error.message}
        </Para>
      )}
      <Flex gap="sm">
        <Button variant="outline" onClick={() => reset()}>
          再試行
        </Button>
        <Button variant="default" onClick={() => (window.location.href = "/")}>
          トップへ戻る
        </Button>
      </Flex>
    </Flex>
  );
}
