// drizzle.config.ts

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

const specifiedEnvFile = process.env.APP_ENV;

if (specifiedEnvFile) {
  const envFilePath = resolve(process.cwd(), specifiedEnvFile);

  if (!existsSync(envFilePath)) {
    throw new Error(
      `APP_ENV="${specifiedEnvFile}" で指定された環境変数ファイルが見つかりません。`
    );
  }

  loadEnv({ path: envFilePath });
} else {
  loadEnv();
}

export default defineConfig({
  schema: "./src/registry/schemaRegistry.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
