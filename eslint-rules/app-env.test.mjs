// eslint-rules/app-env.test.mjs
// 実行: pnpm test eslint-rules/app-env.test.mjs

import { RuleTester } from "eslint";
import { test } from "node:test";

import plugin from "./app-env.mjs";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } });

test("app-env: APP_ENV / NODE_ENV の直接の読みを止め、読み手と他の変数は通す", () => {
  ruleTester.run("single-reader", plugin.rules["single-reader"], {
    valid: [
      { code: `import { isDevelopment } from "@/lib/appEnv"; if (isDevelopment()) {}` },
      { code: `const url = process.env.DATABASE_URL;` },
      { code: `const file = process.env.ENV_FILE ?? ".env.development";` },
      { code: `const { DATABASE_URL } = process.env;` },
      { code: `const v = env.APP_ENV;` },
      { code: `const v = foo.process.env.NODE_ENV;` },
      { code: `const key = "NODE_ENV"; const v = process.env[key];` },
      { code: `const env = process.env; const url = env.DATABASE_URL;` },
      { code: `const env = loadEnv(); const v = env.NODE_ENV;` },
    ],
    invalid: [
      { code: `if (process.env.NODE_ENV === "production") {}`, errors: [{ messageId: "direct" }] },
      { code: `const secure = process.env.APP_ENV === "production";`, errors: [{ messageId: "direct" }] },
      { code: `const v = process.env["NODE_ENV"];`, errors: [{ messageId: "direct" }] },
      { code: `const v = globalThis.process.env.APP_ENV;`, errors: [{ messageId: "direct" }] },
      { code: `const { NODE_ENV, PORT } = process.env;`, errors: [{ messageId: "direct" }] },
      { code: `const { APP_ENV: stage } = process.env;`, errors: [{ messageId: "direct" }] },
      { code: `process.env.APP_ENV = "staging";`, errors: [{ messageId: "direct" }] },
      { code: `const env = process.env; env.NODE_ENV = "development";`, errors: [{ messageId: "direct" }] },
      { code: `const env = process.env; const { APP_ENV } = env;`, errors: [{ messageId: "direct" }] },
    ],
  });
});
