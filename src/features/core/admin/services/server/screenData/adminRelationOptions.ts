// src/features/core/admin/services/server/screenData/adminRelationOptions.ts
// 管理画面(追加・編集)のフォームの関連選択肢を SSR で先読みし、SWRConfig の fallback の形で返す取得本体。
// どの関連を読むか・どのキーで渡すかは src/lib/domain/relations/relationOptions.mjs の判定に従う
// (クライアントの useRelationOptions と同じ判定・同じキー)。
// 関連先の access(list)と service は外から受け(登録表は読まない。結ぶのは src/wiring/domains.ts)、
// 関連先ごとに access を取得前に評価する。拒否された関連先は取得せず空にする(その関連だけ空)。一覧・規則: ./README.md

import "server-only";

import type { DomainApiAccessRule } from "@/lib/domain";
import {
  domainsFromRelationOptionsKey,
  getStaticRelations,
  relationOptionsKey,
} from "@/lib/domain/relations/relationOptions.mjs";

/** domain.json のうち読む部分 */
export type AdminRelationOptionsConfig = {
  relations?: Array<{
    domain: string;
    relationType: string;
    formInput?: string;
    includeRelationTable?: boolean;
  }>;
};

/**
 * SWRConfig の fallback に渡す形。`{ [SWR キー]: { [関連先ドメイン]: 全件配列 } }`。
 * 全件取得する関連が無ければ空オブジェクト(Screen はそのまま fallback に渡してよい)
 */
export type AdminRelationOptionsFallback = Record<string, Record<string, unknown[]>>;

/** 関連先 1 つ: 取得前に評価する list の access と、許可されたときだけ呼ぶ取得 */
export type AdminRelationTarget = {
  access: DomainApiAccessRule;
  list: () => Promise<unknown[]>;
};

export type AdminRelationOptionsDeps = {
  /** 関連先ドメイン名(domain.json の表記)から access と取得を引く。引けなければ throw(設定ミスを黙って通さない) */
  resolveTarget: (domain: string) => AdminRelationTarget;
  /** access をこのリクエストの利用者で評価する(loader の ctx.allows) */
  allows: (rule: DomainApiAccessRule) => boolean;
};

/**
 * フォームの関連選択肢(全件取得する関連だけ)を並列に読み、useRelationOptions と同じ SWR キーで返す。
 * async / custom の関連と逆側の belongsToMany は読まない(クライアントも読まない)。
 * 拒否で飛ばしたとき、開発環境だけサーバーログに 1 行(関連先のドメイン名だけ。利用者・取得データは出さない)
 */
export async function fetchAdminRelationOptions(
  domainConfig: AdminRelationOptionsConfig,
  deps: AdminRelationOptionsDeps,
): Promise<AdminRelationOptionsFallback> {
  const key = relationOptionsKey(getStaticRelations(domainConfig));
  if (!key) return {};
  const domains = domainsFromRelationOptionsKey(key);
  const lists = await Promise.all(
    domains.map(async (domain) => {
      const target = deps.resolveTarget(domain);
      if (!deps.allows(target.access)) {
        if (process.env.NODE_ENV === "development") {
          console.info(`[admin] 関連選択肢 "${domain}" は list の access で拒否したため取得しません(選択肢は空)`);
        }
        return [];
      }
      return target.list();
    }),
  );
  const byDomain: Record<string, unknown[]> = {};
  domains.forEach((domain, index) => {
    byDomain[domain] = lists[index];
  });
  return { [key]: byDomain };
}
