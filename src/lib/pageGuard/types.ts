// src/lib/pageGuard/types.ts
//
// ページの守り(guard.ts の guard()・createLoader・extend)の汎用版の型。
// lib/pageGuard は利用者の解き方・access の評価・現在パス・前提の判定を自分で import せず、ここで決めた形で受け取る。
// 束を作るのは持ち主のドメイン(点 pageGuardUser の項目、上流は domains/core/auth)、結ぶのは生成物 src/wiring/pageGuard.ts(./wire.ts)。

import type { Metadata } from "next";

import type { DomainApiAccessRule } from "@/lib/domainAccess";

/** access の評価結果(API の Factory と同じ語彙) */
export type PageAccessDecision = "granted" | "not_found" | "unauthenticated" | "forbidden";

/** 守りが見る利用者の最小の形(持ち主の型の中身までは見ない) */
export type PageGuardUser = { role: string; status: string };

/** ページの access。custom は無い(API と同じ 4 語) */
export type PageAccess = DomainApiAccessRule;

/** 範囲(guard.ts)の access。範囲は全体を隠さないので "none" は持たない */
export type PageRangeAccess = Exclude<PageAccess, "none">;

/** 差し込む値の束。全項目必須 */
export type PageGuardDeps<TUser extends PageGuardUser = PageGuardUser> = {
  /** Cookie から DB 同期の利用者を解く(未ログイン・失効なら null)。同じリクエストの重複は持ち主側の cache で 1 回に */
  resolveUser: () => Promise<TUser | null>;
  /** access を利用者と照合する。allowStatuses 省略時は availableStatuses だけを通す */
  evaluateAccess: (
    rule: PageAccess,
    user: TUser | null,
    options: { allowStatuses?: readonly string[] },
  ) => PageAccessDecision;
  /** 既定で通す status(access "public" の主体もこの status のときだけ非 null) */
  availableStatuses: readonly string[];
  /** 今のリクエストのパス(returnBack の returnTo に使う。分からなければ null) */
  getRequestPathname: () => Promise<string | null>;
  /** 範囲の access を満たしうる利用者が 1 人以上いるか(setup 誘導の判定。真偽値だけ) */
  hasUserForAccess: (rule: PageRangeAccess) => Promise<boolean>;
};

/** 範囲の方針(guard.ts が書く値。外へは公開しない) */
export type PageGuardPolicy = {
  /** 範囲の access。子は親の access に AND で重なる(狭めるだけ) */
  access: PageRangeAccess;
  /** 通す status(省略 = 束の availableStatuses)。fail-closed */
  allowStatuses?: readonly string[];
  /** 未認証の行き先(省略 = notFound) */
  redirectTo?: string;
  /** 権限不足(ロール不一致・status で行き先の無いもの)の行き先(省略 = notFound) */
  forbiddenRedirectTo?: string;
  /** 行き先に ?returnTo=<今のパス> を付ける */
  returnBack?: boolean;
  /** status 別の行き先(ロールは満たし status だけが通らないとき。returnTo は付けない) */
  statusRedirects?: Partial<Record<string, string>>;
  /** 範囲の access を満たす利用者が 1 人もいないときの行き先(初期セットアップの誘導) */
  setupRedirectTo?: string;
};

/** loader の cache のキーに使える値(プリミティブ) */
export type LoaderKeyValue = string | number | boolean | null | undefined;

/**
 * load に渡す文脈。どちらも呼んだ時に利用者を解く(リクエスト内 1 回、getUser と allows で共有)。
 * 範囲の全段とページが public で setup 誘導の無い鎖は、呼ばなければセッションを読まない(公開のページの殻に入る)
 */
export type PageLoaderContext<TUser> = {
  /** DB 同期の利用者。public で未ログイン・利用不可 status なら null */
  getUser: () => Promise<TUser | null>;
  /**
   * 別の access をこのリクエストの利用者で評価する(取得前の追加の判定。例: 管理画面の関連先ごとの list の access)。
   * status はこのページで通す status で見る
   */
  allows: (rule: PageAccess) => Promise<boolean>;
};

/** createLoader の設定 */
export type PageLoaderConfig<TProps, TKey extends readonly LoaderKeyValue[], TData, TUser> = {
  /** このページの access(必須)。範囲の方針と AND */
  access: PageAccess;
  /** このページで通す status(省略 = 範囲の最寄りの allowStatuses か束の既定) */
  allowStatuses?: readonly string[];
  /** props(params / searchParams)からキーのプリミティブを取り出す(省略 = キー無し)。ここではデータを取らない */
  key?: (props: TProps) => TKey | Promise<TKey>;
  /**
   * 許可されたときだけ呼ばれる取得本体。データの無いページは省く(access だけを評価して undefined を返す。公開の鎖では殻に入る)。
   * 範囲の全段とページが public で setup 誘導の無い鎖では、既定で connection() の後(request 時)に呼ぶ
   */
  load?: (ctx: PageLoaderContext<TUser>, ...key: TKey) => Promise<TData>;
  /**
   * load が DB・保管庫・request(key・getUser・allows)を読まないことの宣言。公開の鎖で connection() を待たずに load を呼び、ページが殻に入る。
   * 読む物を足したら外す(検査が名指す: src/lib/screens の checkLoaderFile と build:post の殻の検査)。公開の鎖の外では意味を持たない
   */
  shell?: true;
};

/** 範囲の guard.ts が export する 3 つ */
export type PageGuard<TUser extends PageGuardUser = PageGuardUser> = {
  /** layout が 1 行で呼ぶ。利用者は返さない */
  guard: () => Promise<void>;
  /** この範囲の設定済み loader の作り手 */
  createLoader: <TProps, TKey extends readonly LoaderKeyValue[] = [], TData = void>(
    config: PageLoaderConfig<TProps, TKey, TData, TUser>,
  ) => (props: TProps) => Promise<TData>;
  /**
   * 範囲の layout の generateMetadata を作る(layout が `export const generateMetadata = guardMetadata({...})` の 1 行)。
   * 先に guard() と同じ判定を通し、断られた訪問者には redirect / notFound で止める(base を返さない)。
   * Next は metadata を根からページへ順に解くので、範囲の layout で断ればその下のページの題名は応答に出ない
   */
  guardMetadata: (base?: Metadata) => () => Promise<Metadata>;
  /** 子の範囲(子 guard.ts)を作る。親の方針と AND */
  extend: (policy: PageGuardPolicy) => PageGuard<TUser>;
};
