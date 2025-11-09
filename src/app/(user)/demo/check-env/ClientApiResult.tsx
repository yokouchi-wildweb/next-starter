"use client";

import type {
  EnvApiError,
  EnvApiResponse,
  EnvSummary,
  KeyValuePair,
} from "@/app/api/demo/get-env/envSummary";
import { Button } from "@/components/Form/Button";
import { Block } from "@/components/Layout/Block";
import axios from "axios";
import { useCallback, useState } from "react";

export const ClientApiResultSection = () => {
  const [result, setResult] = useState<EnvApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const handleFetch = useCallback(async () => {
    setIsLoading(true);
    setClientError(null);
    try {
      const response = await axios.get<EnvApiResponse>("/api/demo/get-env");
      setResult(response.data);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <Block space="sm">
        <h2 className="text-2xl font-semibold">API での再取得</h2>
        <p className="text-sm text-muted-foreground">
          「情報を取得」ボタンを押すと API (`/api/demo/get-env`) から同様の情報を取得し、結果とエラーを表示します。
        </p>
      </Block>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleFetch}
          disabled={isLoading}
          className="px-4 py-2 font-semibold transition hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? "取得中..." : "情報を取得"}
        </Button>
        {clientError ? (
          <span className="text-sm text-destructive">クライアントエラー: {clientError}</span>
        ) : null}
      </div>
      {result ? (
        <Block space="lg">
          <ServiceAccountSection summary={result.data.serviceAccount} />
          <EnvVariableSection
            title="Firebase 関連の環境変数"
            description='名称に "FIREBASE" を含む環境変数を一覧表示します。'
            entries={result.data.firebaseEnvVars}
          />
          <EnvVariableSection
            title="主要な環境変数"
            description="APP_ENV / NODE_ENV / MY_TEST_VALUE / NEXT_PUBLIC_MY_TEST_VALUE の値を表示します。"
            entries={result.data.otherEnvVars}
          />
          <ErrorList errors={result.errors} emptyMessage="API レスポンスにエラーは含まれていませんでした。" />
        </Block>
      ) : (
        <p className="text-sm text-muted-foreground">まだ API から情報を取得していません。</p>
      )}
    </section>
  );
};

const ServiceAccountSection = ({ summary }: { summary: EnvSummary["serviceAccount"] }) => (
  <Block space="md">
    <h3 className="text-xl font-semibold">MY_SERVICE_ACCOUNT_KEY の値</h3>
    {summary.raw ? (
      <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-4 text-sm">
        {summary.raw}
      </pre>
    ) : (
      <p className="text-sm text-muted-foreground">値が存在しません。</p>
    )}
    <Block space="sm">
      <h4 className="text-lg font-semibold">詳細</h4>
      <KeyValueTable entries={summary.parsed ?? []} emptyLabel="詳細情報は存在しません。" />
      {summary.parseError ? (
        <p className="text-sm text-destructive">解析エラー: {summary.parseError}</p>
      ) : null}
    </Block>
  </Block>
);

const EnvVariableSection = ({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: KeyValuePair[];
}) => (
  <Block space="md">
    <h3 className="text-xl font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
    <KeyValueTable entries={entries} emptyLabel="該当する環境変数は見つかりませんでした。" />
  </Block>
);

const KeyValueTable = ({ entries, emptyLabel }: { entries: KeyValuePair[]; emptyLabel: string }) => (
  <div className="overflow-x-auto">
    {entries.length > 0 ? (
      <table className="w-full min-w-[400px] table-auto border-collapse overflow-hidden rounded-md border border-border text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="border border-border px-4 py-2 text-left font-medium">キー</th>
            <th className="border border-border px-4 py-2 text-left font-medium">値</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.key} className="odd:bg-background even:bg-muted/30">
              <td className="border border-border px-4 py-2 font-mono text-xs sm:text-sm">{entry.key}</td>
              <td className="border border-border px-4 py-2 font-mono text-xs sm:text-sm">
                {entry.value ?? "値が存在しません"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    )}
  </div>
);

const ErrorList = ({ errors, emptyMessage }: { errors: EnvApiError[]; emptyMessage: string }) => (
  <Block space="sm">
    <h3 className="text-xl font-semibold">API から返却されたエラー</h3>
    {errors.length > 0 ? (
      <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
        {errors.map((error, index) => (
          <li key={`${error.section}-${index}`}>
            <span className="font-semibold">[{error.section}]</span> {error.message}
            {error.detail ? <span className="block text-xs text-muted-foreground">詳細: {error.detail}</span> : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    )}
  </Block>
);
