// src/lib/pageGuard/createPageGuard.ts
//
// ページの守りの汎用版。束(利用者の解き方・access の評価・現在パス・前提の判定)を受けて root の範囲を作る。
// 範囲は方針の段(root → 子 → 孫)の並びで、子は親の extend で 1 段足すだけ(全段を順に評価 = 親子 AND、子は狭めるだけ)。
// 方針の値は外へ出さない(返すのは guard / createLoader / extend の 3 つ)。

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import type {
  LoaderKeyValue,
  PageAccess,
  PageGuard,
  PageGuardDeps,
  PageGuardPolicy,
  PageGuardUser,
  PageLoaderConfig,
} from "./types";

/** redirectTo に ?returnTo=<今のパス> を付ける(今のパスが行き先と同じなら付けない) */
async function withReturnTo<TUser extends PageGuardUser>(
  deps: PageGuardDeps<TUser>,
  to: string,
  returnBack: boolean | undefined,
): Promise<string> {
  if (!returnBack) return to;
  const current = await deps.getRequestPathname();
  if (!current || current === to) return to;
  const separator = to.includes("?") ? "&" : "?";
  return `${to}${separator}returnTo=${encodeURIComponent(current)}`;
}

/** 方針の段 1 つを評価する。通れば何もしない、拒否なら redirect / notFound で止める */
async function enforceLevel<TUser extends PageGuardUser>(
  deps: PageGuardDeps<TUser>,
  level: PageGuardPolicy,
  user: TUser | null,
): Promise<void> {
  if (level.setupRedirectTo && !(await deps.hasUserForAccess(level.access))) {
    redirect(level.setupRedirectTo);
  }
  const decision = deps.evaluateAccess(level.access, user, { allowStatuses: level.allowStatuses });
  if (decision === "granted") return;
  if (decision === "unauthenticated") {
    if (level.redirectTo) redirect(await withReturnTo(deps, level.redirectTo, level.returnBack));
    notFound();
  }
  if (decision === "forbidden" && user) {
    // ロールは満たし status だけが通らないときは status 別の行き先へ(returnTo は付けない)
    const statusRedirect = level.statusRedirects?.[user.status];
    const roleGranted = deps.evaluateAccess(level.access, user, { allowStatuses: [user.status] }) === "granted";
    if (statusRedirect && roleGranted) redirect(statusRedirect);
    if (level.forbiddenRedirectTo) redirect(await withReturnTo(deps, level.forbiddenRedirectTo, level.returnBack));
  }
  notFound();
}

/** ページ自身の access を評価する。行き先は最寄りの段の方針を使う */
async function enforcePageAccess<TUser extends PageGuardUser>(
  deps: PageGuardDeps<TUser>,
  levels: readonly PageGuardPolicy[],
  access: PageAccess,
  allowStatuses: readonly string[] | undefined,
  user: TUser | null,
): Promise<void> {
  const nearest = levels[levels.length - 1];
  const statuses = allowStatuses ?? [...levels].reverse().find((level) => level.allowStatuses)?.allowStatuses;
  const decision = deps.evaluateAccess(access, user, { allowStatuses: statuses });
  if (decision === "granted") return;
  if (decision === "unauthenticated" && nearest.redirectTo) {
    redirect(await withReturnTo(deps, nearest.redirectTo, nearest.returnBack));
  }
  if (decision === "forbidden" && nearest.forbiddenRedirectTo) {
    redirect(await withReturnTo(deps, nearest.forbiddenRedirectTo, nearest.returnBack));
  }
  notFound();
}

/** public の主体: 利用可能な status(ページ・範囲で宣言したもの、無ければ束の既定)のときだけ渡す */
function principalFor<TUser extends PageGuardUser>(
  deps: PageGuardDeps<TUser>,
  user: TUser | null,
  allowStatuses: readonly string[] | undefined,
): TUser | null {
  if (!user) return null;
  return (allowStatuses ?? deps.availableStatuses).includes(user.status) ? user : null;
}

function buildGuard<TUser extends PageGuardUser>(
  deps: PageGuardDeps<TUser>,
  levels: readonly PageGuardPolicy[],
): PageGuard<TUser> {
  const enforceRange = async (): Promise<TUser | null> => {
    const user = await deps.resolveUser();
    for (const level of levels) await enforceLevel(deps, level, user);
    return user;
  };

  const guard = async (): Promise<void> => {
    await enforceRange();
  };

  const createLoader = <TProps, TKey extends readonly LoaderKeyValue[] = [], TData = void>(
    config: PageLoaderConfig<TProps, TKey, TData, TUser>,
  ) => {
    // cache のキーはプリミティブ(Next は page と generateMetadata に別の props を渡すため props ではキーにならない)
    const run = cache(async (...key: TKey): Promise<TData> => {
      const user = await enforceRange();
      await enforcePageAccess(deps, levels, config.access, config.allowStatuses, user);
      const statuses =
        config.allowStatuses ?? [...levels].reverse().find((level) => level.allowStatuses)?.allowStatuses;
      const allows = (rule: PageAccess) => deps.evaluateAccess(rule, user, { allowStatuses: statuses }) === "granted";
      return config.load({ user: principalFor(deps, user, statuses), allows }, ...key);
    });
    return async (props: TProps): Promise<TData> => {
      const key = config.key ? await config.key(props) : ([] as unknown as TKey);
      return run(...key);
    };
  };

  const extend = (policy: PageGuardPolicy): PageGuard<TUser> => buildGuard(deps, [...levels, policy]);

  return { guard, createLoader, extend };
}

/**
 * 束を結んだ root の範囲の作り手を返す(src/wiring/pageGuard.ts が 1 回だけ呼ぶ)。
 * root の guard.ts が方針を渡して範囲を作り、子の guard.ts は親の extend で作る。
 */
export function createPageGuard<TUser extends PageGuardUser>(deps: PageGuardDeps<TUser>) {
  return (policy: PageGuardPolicy): PageGuard<TUser> => buildGuard(deps, [policy]);
}
