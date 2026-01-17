
export const dynamic = 'force-dynamic'

import type { EnvApiError, EnvSummary, KeyValuePair } from "./api/envSummary";
import { buildEnvSummary } from "./api/envSummary";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { ClientApiResultSection } from "./ClientApiResult";

const Page = async () => {
  const { data, errors } = buildEnvSummary();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Firebase 環境変数チェックデモ</h1>
        <p className="text-sm text-muted-foreground">
          Firebase 関連の環境変数とアプリ環境を SSR と API で取得して比較するデモページです。
        </p>
      </header>

      <section className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">SSR で取得した値</h2>
        <ServiceAccountSection summary={data.serviceAccount} />
        <EnvVariableSection
          title="Firebase 関連の環境変数"
          description='名称に "FIREBASE" を含む環境変数を一覧表示します。'
          entries={data.firebaseEnvVars}
        />
        <EnvVariableSection
          title="主要な環境変数"
          description="APP_ENV / NODE_ENV / MY_TEST_VALUE / NEXT_PUBLIC_MY_TEST_VALUE の値を表示します。"
          entries={data.otherEnvVars}
        />
        <ErrorList errors={errors} emptyMessage="SSR ではエラーは検出されませんでした。" />
      </section>

      <ClientApiResultSection />
    </main>
  );
};

export default Page;

const ServiceAccountSection = ({ summary }: { summary: EnvSummary["serviceAccount"] }) => (
  <Block>
    <div>
      <h3 className="text-xl font-semibold">MY_SERVICE_ACCOUNT_KEY の値</h3>
      {summary.raw ? (
        <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-4 text-sm">
          {summary.raw}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">値が存在しません。</p>
      )}
    </div>
    <div>
      <h3 className="text-xl font-semibold">MY_SERVICE_ACCOUNT_KEY の詳細</h3>
      {summary.parsed ? (
        <KeyValueTable entries={summary.parsed} emptyLabel="詳細情報は存在しません。" />
      ) : summary.raw ? (
        <p className="text-sm text-destructive">JSON の解析に失敗しました。</p>
      ) : (
        <p className="text-sm text-muted-foreground">生の値が存在しないため詳細情報は表示できません。</p>
      )}
      {summary.parseError ? (
        <p className="text-sm text-destructive">解析エラー: {summary.parseError}</p>
      ) : null}
    </div>
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
  <Stack space={6}>
    <h3 className="text-xl font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
    <KeyValueTable entries={entries} emptyLabel="該当する環境変数は見つかりませんでした。" />
  </Stack>
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
  <Stack space={4}>
    <h3 className="text-xl font-semibold">検出されたエラー</h3>
    {errors.length > 0 ? (
      <ul className="list-disc flex flex-col gap-1 pl-5 text-sm text-destructive">
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
  </Stack>
);
