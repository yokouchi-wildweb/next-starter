// drizzle.config.ts

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/registry/schemaRegistry.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});