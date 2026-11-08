// src/features/core/user/seed.ts — user のシード(pnpm ops db seed、書き方: src/lib/seed/README.md)
// デモの利用者 1 人。入れるのは userService.seedCreate(デモの利用者だけを作る入口)。何度打っても同じ(providerType + providerUid で探す)。
import "server-only";

import { defineSeed } from "@/lib/seed";

export const seed = defineSeed({
  tables: {
    users: [
      {
        $key: "demoUser",
        $unique: ["providerType", "providerUid"],
        providerType: "custom",
        providerUid: "demo-user-u001",
        email: "demo@example.com",
        name: "デモユーザー",
        role: "user",
      },
    ],
  },
});
