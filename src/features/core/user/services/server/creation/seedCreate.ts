// src/features/core/user/services/server/creation/seedCreate.ts
// シード(src/features/core/user/seed.ts、pnpm ops db seed)の行を入れる入口。デモの利用者だけを作る。
// ふつうの create は管理画面の作成(Firebase Auth にも作る)なので、シードからは使わない(ランナーは seedCreate があれば先に使う)。
// - 作るのは isDemo の利用者だけ(providerType custom・パスワードなし・status active)。ログインできる利用者は作らない
// - 状態の履歴は recordStatusTransition(demo_create)で残す(user_status_history の決まり)

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { recordStatusTransition } from "@/features/core/user/services/server/statusHistory";
import { getPublicColumns } from "@/lib/crud/drizzle/hiddenColumns";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

import { base } from "../drizzleBase";

export type SeedUserInput = {
  name: string;
  providerUid: string;
  email?: string | null;
  role?: string;
  [key: string]: unknown;
};

/** シードの行(デモの利用者)を入れる。providerType は custom、isDemo は true に固定する */
export async function seedCreate(input: SeedUserInput): Promise<User> {
  if (input.isDemo === false || (input.providerType !== undefined && input.providerType !== "custom")) {
    throw new DomainError("シードで作れる利用者はデモの利用者(isDemo: true・providerType: custom)だけです");
  }
  const values = await UserCoreSchema.parseAsync({
    role: input.role ?? "user",
    status: "active",
    providerType: "custom",
    providerUid: input.providerUid,
    isDemo: true,
    email: input.email ?? null,
    localPassword: null,
    name: input.name,
  });

  const [user] = await db.insert(UserTable).values(values).returning(getPublicColumns(UserTable));
  base.invalidateRequestMemo();

  await recordStatusTransition({ userId: user.id, fromStatus: null, toStatus: "active", trigger: "demo_create" });

  return user;
}
