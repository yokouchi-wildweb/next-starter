// scripts/storage/setup.ts
//
// ファイル保存用の 2 バケット（新 pub / 新 priv）を冪等に用意する（pnpm storage:setup）。
// 何度実行しても同じ状態になり、2 回目以降は「変更なし」になる。既存の設定と食い違うものは上書きせず、
// 差分を表示して止まる（足すだけで済む公開読み取りの IAM だけは自動で足す）。
//
// 実行:
//   pnpm storage:setup -- --pub <公開バケット> --priv <非公開バケット> --origin https://app.example.com [--origin ...]
//                        [--location asia-northeast1] [--dry-run]
//   --pub / --priv を省略すると env の STORAGE_PUBLIC_BUCKET / STORAGE_PRIVATE_BUCKET を使う（env ファイルは書き換えない）
//   APP_ENV で読み込む env ファイルを変えられる（既定 .env.development）
//
// 用意する状態:
// - 共通: UBLA（均一なバケットレベルのアクセス）有効、CORS（--origin、GET / HEAD / PUT、署名 PUT と再開可能アップロードのヘッダー）
// - pub: allUsers に roles/storage.legacyObjectReader（オブジェクトの get のみ。一覧は不可）、公開アクセス防止は inherited
// - priv: 公開アクセス防止を enforced、allUsers / allAuthenticatedUsers の権限なし
// 旧バケット（Firebase の既定バケット）には触れない。新しい 2 バケットは Firebase に登録しない。
// 必要な権限: サービスアカウント（MY_SERVICE_ACCOUNT_KEY）に「Storage 管理者」。
// 足りず HTTP 403 で止まったときは、値を埋めた付与の 1 行（gcloud）を表示する（実行はしない）。詳細: scripts/storage/README.md

import dotenv from "dotenv";

dotenv.config({ path: process.env.APP_ENV || ".env.development", quiet: true });

import { getServerStorage } from "@/lib/firebase/server/app";

import { formatIamGrantGuide, resolveIamGrantTarget } from "./iamGrant";

const PUBLIC_READER_ROLE = "roles/storage.legacyObjectReader";
const PUBLIC_MEMBERS = ["allUsers", "allAuthenticatedUsers"];
const DEFAULT_LOCATION = "asia-northeast1";

const CORS_METHODS = ["GET", "HEAD", "PUT"];
const CORS_RESPONSE_HEADERS = [
  "Content-Type",
  "Content-Length",
  "Content-Range",
  "Range",
  "Accept-Ranges",
  "ETag",
  "x-goog-if-generation-match",
  "x-goog-content-length-range",
  "Cache-Control",
  "Content-Disposition",
];
const CORS_MAX_AGE_SECONDS = 3600;

type Kind = "pub" | "priv";

type Options = {
  buckets: Record<Kind, string>;
  origins: string[];
  location: string;
  dryRun: boolean;
};

type CorsRule = { origin?: string[]; method?: string[]; responseHeader?: string[]; maxAgeSeconds?: number };

class SetupStop extends Error {}

function parseArgs(argv: string[]): Options {
  const values: Record<string, string[]> = {};
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    const match = /^--(pub|priv|origin|location)$/.exec(arg);
    if (!match || argv[i + 1] === undefined) {
      throw new SetupStop(`不明な引数です: ${arg}（使い方は scripts/storage/README.md）`);
    }
    (values[match[1]] ??= []).push(argv[++i]);
  }
  const pub = values.pub?.[0] ?? process.env.STORAGE_PUBLIC_BUCKET?.trim();
  const priv = values.priv?.[0] ?? process.env.STORAGE_PRIVATE_BUCKET?.trim();
  if (!pub || !priv) {
    throw new SetupStop("--pub と --priv（または env の STORAGE_PUBLIC_BUCKET / STORAGE_PRIVATE_BUCKET）を指定してください");
  }
  if (pub === priv) throw new SetupStop("公開バケットと非公開バケットには別の名前を指定してください");
  const legacy = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (legacy && (pub === legacy || priv === legacy)) {
    throw new SetupStop(`旧バケット（${legacy}）は指定できません。新しいバケットの名前を指定してください`);
  }
  const origins = values.origin ?? [];
  if (origins.length === 0) throw new SetupStop("--origin（アプリの Origin。例 https://app.example.com）を 1 つ以上指定してください");
  for (const origin of origins) {
    if (origin === "*" || !/^https?:\/\/[^/]+$/.test(origin)) {
      throw new SetupStop(`--origin は scheme + host（末尾の / なし）で指定してください: ${origin}`);
    }
  }
  return { buckets: { pub, priv }, origins, location: values.location?.[0] ?? DEFAULT_LOCATION, dryRun };
}

function desiredCors(origins: string[]): CorsRule[] {
  return [{ origin: origins, method: CORS_METHODS, responseHeader: CORS_RESPONSE_HEADERS, maxAgeSeconds: CORS_MAX_AGE_SECONDS }];
}

/** 順序を無視して CORS の設定を比べる */
function normalizeCors(rules: CorsRule[] | undefined): string {
  const sorted = (rules ?? []).map((rule) => ({
    origin: [...(rule.origin ?? [])].sort(),
    method: [...(rule.method ?? [])].map((m) => m.toUpperCase()).sort(),
    responseHeader: [...(rule.responseHeader ?? [])].map((h) => h.toLowerCase()).sort(),
    maxAgeSeconds: rule.maxAgeSeconds ?? null,
  }));
  return JSON.stringify(sorted);
}

function errorCode(error: unknown): number | null {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "number" ? code : null;
}

function report(kind: Kind, item: string, result: string): void {
  console.log(`  [${kind}] ${item}: ${result}`);
}

async function ensureBucket(kind: Kind, name: string, options: Options): Promise<void> {
  const bucket = getServerStorage().bucket(name);
  const pap = kind === "priv" ? "enforced" : "inherited";
  console.log(`\n${kind} バケット: ${name}`);

  const [exists] = await bucket.exists();
  if (!exists) {
    if (options.dryRun) {
      report(kind, "バケット", `作成する予定（location ${options.location}、UBLA 有効、公開アクセス防止 ${pap}）`);
      report(kind, "IAM", kind === "pub" ? `allUsers に ${PUBLIC_READER_ROLE} を付ける予定` : "公開の権限は付けない");
      report(kind, "CORS", `設定する予定（origin ${options.origins.join(", ")}）`);
      return;
    }
    await bucket.create({
      location: options.location,
      iamConfiguration: {
        uniformBucketLevelAccess: { enabled: true },
        publicAccessPrevention: pap,
      },
    });
    report(kind, "バケット", `作成した（location ${options.location}、UBLA 有効、公開アクセス防止 ${pap}）`);
  } else {
    // 作成時に決まる設定は、食い違っていても書き換えない
    const [metadata] = await bucket.getMetadata();
    const problems: string[] = [];
    const location = String(metadata.location ?? "").toLowerCase();
    if (location !== options.location.toLowerCase()) {
      problems.push(`location: 既存 ${metadata.location} / 指定 ${options.location}`);
    }
    if (!metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled) problems.push("UBLA: 既存は無効 / 期待は有効");
    const currentPap = metadata.iamConfiguration?.publicAccessPrevention ?? "inherited";
    if (kind === "priv" && currentPap !== "enforced") problems.push(`公開アクセス防止: 既存 ${currentPap} / 期待 enforced`);
    if (kind === "pub" && currentPap === "enforced") problems.push("公開アクセス防止: 既存 enforced / 期待 inherited（公開できない）");
    if (problems.length > 0) {
      throw new SetupStop(`${name} の設定が期待と違うため止めます（上書きしません）:\n${problems.map((p) => `    - ${p}`).join("\n")}`);
    }
    report(kind, "バケット", `変更なし（location ${metadata.location}、UBLA 有効、公開アクセス防止 ${currentPap}）`);
  }

  // IAM: pub は公開読み取りを足すだけ。priv に公開の権限があれば止める
  const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
  const bindings = policy.bindings ?? [];
  const publicBindings = bindings.filter((b) => (b.members ?? []).some((m) => PUBLIC_MEMBERS.includes(m)));
  if (kind === "priv") {
    if (publicBindings.length > 0) {
      throw new SetupStop(
        `${name} に公開の権限があるため止めます（外しません）: ${publicBindings.map((b) => `${b.role}=${b.members?.join(",")}`).join(" / ")}`,
      );
    }
    report(kind, "IAM", "変更なし（公開の権限なし）");
  } else {
    const unexpected = publicBindings.filter((b) => b.role !== PUBLIC_READER_ROLE);
    if (unexpected.length > 0) {
      throw new SetupStop(
        `${name} に想定外の公開の権限があるため止めます（外しません）: ${unexpected.map((b) => `${b.role}=${b.members?.join(",")}`).join(" / ")}`,
      );
    }
    const reader = bindings.find((b) => b.role === PUBLIC_READER_ROLE);
    if (reader?.members?.includes("allUsers")) {
      report(kind, "IAM", `変更なし（allUsers に ${PUBLIC_READER_ROLE}）`);
    } else if (options.dryRun) {
      report(kind, "IAM", `allUsers に ${PUBLIC_READER_ROLE} を足す予定`);
    } else {
      if (reader) reader.members = [...(reader.members ?? []), "allUsers"];
      else bindings.push({ role: PUBLIC_READER_ROLE, members: ["allUsers"] });
      await bucket.iam.setPolicy({ ...policy, bindings });
      report(kind, "IAM", `allUsers に ${PUBLIC_READER_ROLE} を足した`);
    }
  }

  // CORS: 空なら設定、同じなら何もしない、違えば止める
  const [latest] = await bucket.getMetadata();
  const current = (latest.cors ?? []) as CorsRule[];
  const desired = desiredCors(options.origins);
  if (current.length === 0) {
    if (options.dryRun) {
      report(kind, "CORS", `設定する予定（origin ${options.origins.join(", ")}）`);
    } else {
      await bucket.setCorsConfiguration(desired);
      report(kind, "CORS", `設定した（origin ${options.origins.join(", ")}）`);
    }
  } else if (normalizeCors(current) === normalizeCors(desired)) {
    report(kind, "CORS", "変更なし");
  } else {
    throw new SetupStop(
      `${name} の CORS が期待と違うため止めます（上書きしません）:\n    既存: ${JSON.stringify(current)}\n    期待: ${JSON.stringify(desired)}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  console.log(options.dryRun ? "storage:setup（dry run: 読み取りだけで、何も変えません）" : "storage:setup");
  for (const kind of ["pub", "priv"] as const) {
    await ensureBucket(kind, options.buckets[kind], options);
  }
  console.log(options.dryRun ? "\n予定の表示が終わりました。" : "\n完了しました。");
}

main().catch((error: unknown) => {
  if (error instanceof SetupStop) {
    console.error(`\n停止: ${error.message}`);
    process.exit(1);
  }
  const code = errorCode(error);
  if (code === 403) {
    console.error(`\n${formatIamGrantGuide(resolveIamGrantTarget(process.env))}`);
  } else if (code === 401) {
    // 401 はキーそのものが無効・失効している。役割を付けても直らない
    console.error(
      "\n認証に失敗したため止めました（HTTP 401）。MY_SERVICE_ACCOUNT_KEY のキーが無効か失効しています。新しいキーを発行して設定し直してください。",
    );
  } else {
    console.error("\n失敗しました:", error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
