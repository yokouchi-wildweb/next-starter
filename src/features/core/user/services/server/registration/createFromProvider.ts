// src/features/core/user/services/server/registration/createFromProvider.ts

import { and, eq } from "drizzle-orm";

import { USER_NAME_CONFIG } from "@/config/app/user-name.config";
import { REGISTRATION_DEFAULT_ROLE } from "@/features/core/auth/constants/registration";
import { auditLogger } from "@/features/core/auditLog/services/server";
import type { UserRoleType } from "@/features/core/user/constants";
import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { UserActivationSchema, UserCoreSchema } from "@/features/core/user/entities/schema";
import { sanitizeUserName } from "@/features/core/user/entities/userName";
import {
  findAvailableSuffixedUserName,
  isUserNameTaken,
  lockUserName,
} from "@/features/core/user/services/server/helpers/nameAvailability";
import { recordStatusTransition } from "@/features/core/user/services/server/statusHistory";
import type { UserProviderType } from "@/features/core/user/types";
import { assertRoleEnabled } from "@/features/core/user/utils/roleHelpers";
import { recordLoginEvent } from "@/features/core/userLoginEvent/services/server";
import { getPublicColumns } from "@/lib/crud/drizzle/hiddenColumns";
import { isPgUniqueViolation } from "@/lib/crud/drizzle/service";
import type { DbExecutor, DbTransaction } from "@/lib/crud/drizzle/types";
import { db } from "@/lib/drizzle";
import { base } from "@/features/core/user/services/server/drizzleBase";

/** 表示名が空になったとき (プロバイダーが名前を返さない・使えない文字だけ) の既定名 */
export const PROVIDER_USER_DEFAULT_NAME = "ユーザー";

export type CreateFromProviderInput = {
  /** USER_PROVIDER_TYPES の値 (users の enum。無い種類は上流に足してもらう) */
  providerType: UserProviderType;
  /** プロバイダー側の利用者 ID (LINE の userId など)。(providerType, providerUid) で 1 人 */
  providerUid: string;
  /** プロバイダーの表示名。名前の規則 (sanitizeUserName・既定名・重複の扱い) を通して users.name になる */
  displayName: string | null | undefined;
  /** 新規・再登録のときの signupIp とログインの記録 signup に使う */
  ip?: string;
  /** 省略 = REGISTRATION_DEFAULT_ROLE。有効なロールであること (assertRoleEnabled) */
  role?: string;
  /** 呼び手の tx。渡せばその中で行い一緒に確定・巻き戻しする。省略 = 自分で 1 つ開く */
  tx?: DbTransaction;
};

export type CreateFromProviderResult = {
  /** 公開の列だけの利用者 (localPassword など hiddenColumns は含まない) */
  user: User;
  /** この呼び出しで行を作ったとき true (既存の行を返した・有効化したときは false) */
  isNewUser: boolean;
  /** 退会者 (withdrawn) を再登録の規則で active に戻したとき true */
  isRejoin: boolean;
};

/**
 * 外部の認証の身元 (providerType, providerUid) から利用者を引く・作る公開の口。
 * 新しい認証手段 (LINE など) は 身元の確認 → createFromProvider → establishSession の順に呼ぶ
 * (レシピ: src/features/core/auth/README.md「新しい認証手段」)。
 *
 * - 既存 (同じ providerType・providerUid): 作らずに返す。状態は変えない
 *   (security_locked・suspended などの判断は establishSession の状態の分岐)
 *   - pending → 本登録と同じく active に (監査 user.registered)
 *   - withdrawn → 上流の再登録の規則で active に (監査 user.rejoined・signupIp・ログインの記録 signup)。
 *     退会者を断りたい呼び手は先に userService.findByProvider で状態を見て、この口を呼ばない
 * - 新規: 名前の規則 → active で作成 → 状態の履歴 → 監査 user.registered を 1 つの tx で。
 *   tx の後にログインの記録 signup (best-effort)
 * - 名前の重複: USER_NAME_CONFIG.unique.enabled のとき使用中 (予約名を含む) なら "名前_n" で避ける。
 *   無効のときはそのまま (他の作成の道と同じ規則)
 * - 同時に 2 回来て (provider_type, provider_uid) の unique 違反になったら、引き直して既存として返す
 *
 * 招待コード・流入の記録・プロフィールは扱わない (呼び手がこの後に行う)。
 * 未認証の経路で呼ばれるため、監査の actor は actorOverride で本人にする。
 */
export async function createFromProvider(
  input: CreateFromProviderInput,
): Promise<CreateFromProviderResult> {
  const role = input.role ?? REGISTRATION_DEFAULT_ROLE;
  assertRoleEnabled(role);

  const run = async (tx: DbTransaction) => {
    try {
      // 呼び手の tx を巻き戻さずに unique 違反から戻れるよう、書き込みは savepoint の中で行う
      return await tx.transaction((sp) => writeInTx(sp, input, role));
    } catch (error) {
      if (!isPgUniqueViolation(error)) throw error;
      const existing = await findProviderUser(tx, input.providerType, input.providerUid);
      if (!existing) throw error;
      return { user: existing, isNewUser: false, isRejoin: false, loginEvent: false };
    }
  };

  const outcome = input.tx ? await run(input.tx) : await db.transaction(run);
  base.invalidateRequestMemo();

  // IP 横断検索用テーブル (user_login_events) の signup。新規・再登録のときだけ。
  // recordLoginEvent は IP 未指定や書き込み失敗を内部で握り潰す best-effort。
  if (outcome.loginEvent) {
    await recordLoginEvent({
      userId: outcome.user.id,
      eventType: "signup",
      ip: input.ip,
      occurredAt: new Date(),
    });
  }

  return { user: outcome.user, isNewUser: outcome.isNewUser, isRejoin: outcome.isRejoin };
}

type WriteOutcome = CreateFromProviderResult & { loginEvent: boolean };

async function writeInTx(
  tx: DbTransaction,
  input: CreateFromProviderInput,
  role: string,
): Promise<WriteOutcome> {
  const { providerType, providerUid, displayName, ip } = input;
  const now = new Date();

  const existing = await findProviderUser(tx, providerType, providerUid);

  if (existing) {
    if (existing.status !== "pending" && existing.status !== "withdrawn") {
      return { user: existing, isNewUser: false, isRejoin: false, loginEvent: false };
    }
    return activateExisting(tx, existing, { displayName, ip, role, now });
  }

  const name = await resolveProviderUserName(tx, displayName);
  const values = await UserCoreSchema.parseAsync({
    role,
    status: "active",
    providerType,
    providerUid,
    isDemo: false,
    email: null,
    localPassword: null,
    name,
    lastAuthenticatedAt: now,
    signupIp: ip ?? null,
  });

  const [user] = (await tx
    .insert(UserTable)
    .values(values)
    .returning(getPublicColumns(UserTable))) as User[];

  await recordStatusTransition({
    userId: user.id,
    fromStatus: null,
    toStatus: "active",
    trigger: "signup_activate",
    tx,
  });

  await auditLogger.record({
    targetType: "user",
    targetId: user.id,
    subjectUserId: user.id,
    action: "user.registered",
    before: null,
    after: auditAfter(user),
    actorOverride: { actorType: "user", actorId: user.id },
    tx,
  });

  return { user, isNewUser: true, isRejoin: false, loginEvent: true };
}

/** pending / withdrawn の行を active にする (registerFromAuth の本登録・再登録と同じ監査名・状態の履歴) */
async function activateExisting(
  tx: DbTransaction,
  existing: User,
  params: { displayName: string | null | undefined; ip?: string; role: string; now: Date },
): Promise<WriteOutcome> {
  const isRejoin = existing.status === "withdrawn";
  const name = await resolveProviderUserName(tx, params.displayName, existing.id);

  const parsed = await UserActivationSchema.parseAsync({
    role: params.role as UserRoleType,
    status: "active",
    name,
    email: existing.email,
    lastAuthenticatedAt: params.now,
  });

  const user = await base.update(
    existing.id,
    {
      ...parsed,
      deletedAt: null,
      ...(isRejoin && params.ip ? { signupIp: params.ip } : {}),
    } as Parameters<typeof base.update>[1],
    tx,
  );

  await recordStatusTransition({
    userId: user.id,
    fromStatus: existing.status,
    toStatus: "active",
    trigger: "signup_activate",
    tx,
  });

  if (isRejoin) {
    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      subjectUserId: user.id,
      action: "user.rejoined",
      before: { status: existing.status },
      after: auditAfter(user),
      actorOverride: { actorType: "user", actorId: user.id },
      tx,
    });
  } else {
    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      subjectUserId: user.id,
      action: "user.registered",
      before: { status: existing.status },
      after: auditAfter(user),
      actorOverride: { actorType: "user", actorId: user.id },
      tx,
    });
  }

  return { user, isNewUser: false, isRejoin, loginEvent: isRejoin };
}

/**
 * プロバイダーの表示名を users.name に入れる名前にする。
 * sanitizeUserName → 空なら既定名 → unique.enabled のとき lockUserName と使用中の判定 → 使用中なら suffix。
 * lock は tx の終わりまで保たれ、同名の同時作成と直列化する。
 */
async function resolveProviderUserName(
  tx: DbTransaction,
  displayName: string | null | undefined,
  excludeUserId?: string,
): Promise<string> {
  const name = sanitizeUserName(displayName ?? "") || PROVIDER_USER_DEFAULT_NAME;

  if (!USER_NAME_CONFIG.unique.enabled) {
    return name;
  }

  await lockUserName(tx, name);
  if (!(await isUserNameTaken(name, { excludeUserId, executor: tx }))) {
    return name;
  }
  return findAvailableSuffixedUserName(name, { executor: tx, lockCandidates: true });
}

async function findProviderUser(
  executor: DbExecutor,
  providerType: UserProviderType,
  providerUid: string,
): Promise<User | null> {
  const [user] = (await executor
    .select(getPublicColumns(UserTable))
    .from(UserTable)
    .where(and(eq(UserTable.providerType, providerType), eq(UserTable.providerUid, providerUid)))
    .limit(1)) as User[];
  return user ?? null;
}

function auditAfter(user: User) {
  return {
    status: user.status,
    email: user.email,
    name: user.name,
    providerType: user.providerType,
  };
}
