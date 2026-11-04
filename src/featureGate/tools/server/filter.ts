// src/featureGate/tools/server/filter.ts
// gate.filter(items, getHref?): 閉じた機能の住所を指す項目を一覧から除く(順は保つ。隠すだけで、応答は proxy が作る)。
// 判定は hiddenHref.ts(リンクの自動で隠す判定と同じ): '/' で始まる内部の住所で、redirectTo の無い閉じた規則に当たる項目だけを除く。
// 既定の getHref は item.href。href を持たない型は getHref が必須(型で落ちる)。getHref が undefined を返す項目は残す

import { closedPathEntries } from "../../evaluate";
import { isHiddenHref } from "../../hiddenHref";

type HrefGetter<T> = (item: T) => string | undefined;

export function filter<T extends { href?: string | null }>(items: readonly T[], getHref?: HrefGetter<T>): T[];
export function filter<T>(items: readonly T[], getHref: HrefGetter<T>): T[];
export function filter<T>(items: readonly T[], getHref?: HrefGetter<T>): T[] {
  const closed = closedPathEntries();
  if (closed.length === 0) return [...items];
  const hrefOf = getHref ?? ((item: T) => (item as { href?: string | null }).href ?? undefined);
  return items.filter((item) => {
    const href = hrefOf(item);
    return href === undefined || !isHiddenHref(href, closed);
  });
}
