"use client";

import { isDevelopment } from "@/lib/appEnv";
import { useEffect } from "react";

import { Button } from "@/components/Button/Button";
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
      gap="lg"
      padding={{ base: "md", sm: "lg" }}
      className="min-h-[50vh]"
    >
      <SecTitle as="h1" size="xxl">
        エラー検知
      </SecTitle>
      <Para tone="muted" align="center">
        予期しないエラーが発生しました。
      </Para>
      {isDevelopment() && (
        <Para tone="destructive" size="sm">
          {error.message}
        </Para>
      )}
      <Flex gap="md">
        <Button variant="outline" onClick={() => reset()}>
          再試行
        </Button>
        <Button variant="default" onClick={() => window.location.assign(new URL("/", window.location.origin))}>
          トップへ戻る
        </Button>
      </Flex>
    </Flex>
  );
}
