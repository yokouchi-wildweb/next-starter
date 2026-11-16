// src/featureGate/tools/server/domainOpen.ts
// gate.domainOpen(domain): ドメインが開いているか(domain = src/features/<名前> か src/features/core/<名前> のフォルダ名。core と業務で同じ名前は無い)。
// そのフォルダを規則の domains に載せた機能が全部閉じていれば false。どの規則にも載らないドメイン(門の外)は常に開。
// 読み手: ドメインに属する物を名前で持つ仕組み(例 messaging の連絡の鍵 <ドメイン>.<名前> → 閉じたドメインの連絡は出さない・送らない)

import { domainEnabled } from "../../ruleList";

export const domainOpen = (domain: string): boolean => domainEnabled(domain) && domainEnabled(`core/${domain}`);
