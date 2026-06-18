// scripts/storage/setup-cors.ts
//
// Firebase Storage(GCS バケット)に CORS を設定するスクリプト。
// 実行: pnpm storage:setup-cors            (origin は ["*"])
//       pnpm storage:setup-cors https://example.com https://www.example.com  (origin を限定)
//
// 目的: ブラウザの MSE(appendBuffer)/ Web Audio(decodeAudioData)は、ファイルの「中身(バイト列)」を
// fetch() で読み取るため、別ドメイン(Firebase Storage)から読むには CORS の許可が必要になる。
// 画像/動画を <img>/<video> で表示するだけなら CORS は不要だが、バイト読み取りには必須。
// このスクリプトでバケットに一度 CORS を設定すれば、配信は Firebase から直接(CDN)のまま読めるようになる。

import dotenv from "dotenv";

// APP_ENV で指定された環境ファイルを読み込む(デフォルト: .env.development)
dotenv.config({ path: process.env.APP_ENV || ".env.development" });

import { getServerStorage } from "@/lib/firebase/server/app";

// MSE / Web Audio でのバイト読み取りに必要な範囲の CORS 設定
function buildCorsConfig(origins: string[]) {
  return [
    {
      origin: origins,
      method: ["GET", "HEAD"],
      responseHeader: ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Range"],
      maxAgeSeconds: 3600,
    },
  ];
}

async function main() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    console.error("❌ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET が未設定です。env ファイルを確認してください。");
    process.exit(1);
  }

  // CLI 引数で origin を指定できる。未指定なら "*"(誰でも GET 可)。
  const origins = process.argv.slice(2);
  const useOrigins = origins.length > 0 ? origins : ["*"];

  if (useOrigins.includes("*")) {
    console.warn("⚠ origin を '*' で設定します(誰でも fetch 可能)。本番では実ドメインを引数で指定してください。");
    console.warn("  例: pnpm storage:setup-cors https://your-app.com https://www.your-app.com");
  }

  const bucket = getServerStorage().bucket();
  console.log(`バケット: ${bucket.name}`);
  console.log(`設定する origin: ${JSON.stringify(useOrigins)}`);

  try {
    await bucket.setCorsConfiguration(buildCorsConfig(useOrigins));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`❌ CORS の設定に失敗しました。理由: ${reason}`);
    console.error(
      "  サービスアカウント(MY_SERVICE_ACCOUNT_KEY)に storage.buckets.update 権限(Storage 管理者等)が必要です。",
    );
    process.exit(1);
  }

  // 反映内容を読み戻して確認
  const [metadata] = await bucket.getMetadata();
  console.log("✅ CORS を設定しました。現在の設定:");
  console.log(JSON.stringify(metadata.cors, null, 2));
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`❌ 予期せぬエラー: ${reason}`);
  process.exit(1);
});
