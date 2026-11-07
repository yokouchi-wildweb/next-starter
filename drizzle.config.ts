// drizzle.config.ts

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

const specifiedEnvFile = process.env.ENV_FILE;

if (specifiedEnvFile) {
  const envFilePath = resolve(process.cwd(), specifiedEnvFile);

  if (!existsSync(envFilePath)) {
    throw new Error(
      `ENV_FILE="${specifiedEnvFile}" で指定された環境変数ファイルが見つかりません。`
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
