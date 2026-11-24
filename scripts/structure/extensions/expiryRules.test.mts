// scripts/structure/extensions/expiryRules.test.mts
// 増設点 expiryRules へ移した上流の項目(生成された一覧 src/wiring/cron.ts)が、今の削除(旧 cron 8 本と cleanupExpiredRateLimits)と同じ行を消すことを、
// 今の式の表と、項目から組んだ SQL の字面で確かめる(区切り expiry-move。DB は使わない)。
// fork でも走る: 上流の 9 つの中身は全 Tier、一覧がちょうど 9 つ・enabled / batchSize を書かないことは Tier1 だけ(fork は項目を足し、上書きで enabled・batchSize を変える)
// 実行: pnpm test scripts/structure/extensions/expiryRules.test.mts
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { expiryDeleteQuery, expiryRuleProblems } from "@/lib/cron";
import { walletConfig } from "@/domains/wallet/config";
import { getExpirationEnabledWalletTypes } from "@/domains/core/wallet/utils/expiration";
import { readForkIdentity } from "@/lib/forkOwnership/node.mjs";

const { isTier1 } = readForkIdentity(resolve(import.meta.dirname, "../../.."));

const dialect = new PgDialect();
const NOW = new Date("2026-01-01T00:00:00Z");
/** 生成された一覧(scripts は @/wiring を import() でだけ読む: scripts-no-static-wiring) */
const loadItems = async () => (await import("@/wiring/cron")).expiryRules;
type Items = Awaited<ReturnType<typeof loadItems>>;

const render = (expiryRules: Items, name: string) => {
  const item = expiryRules.find((entry) => `${entry.domain}/${entry.name}` === name);
  assert.ok(item, `項目 ${name} が一覧に無い`);
  const q = dialect.sqlToQuery(expiryDeleteQuery(item.plug, item.plug.batchSize ?? 1000, NOW));
  return { item, text: q.sql, params: q.params };
};

/** 今の削除の式(旧 cron の関数の WHERE・ORDER BY)。条件は項目から組んだ SQL の WHERE の字面 */
const rowDays = (table: string, column: string) => ({
  table,
  where: `"${column}" + ("retention_days" * INTERVAL '1 day') < $1::timestamptz`,
  order: `"${column}"`,
});
const walletWhere = getExpirationEnabledWalletTypes().length > 0 ? "(remaining = 0)" : "(false)";
const TODAY: Record<string, { from: string; table: string; where: string; order: string; pii: boolean; params?: unknown[] }> = {
  "auditLog/auditLogPrune": { from: "audit-log-prune", ...rowDays("audit_logs", "created_at"), pii: true },
  "deviceFingerprint/deviceFingerprintPrune": { from: "device-fingerprint-prune", ...rowDays("device_fingerprints", "created_at"), pii: true },
  "fingerprintChallenge/fingerprintChallengeAccessPrune": {
    from: "fingerprint-challenge-access-prune",
    ...rowDays("fingerprint_challenge_access_events", "accessed_at"),
    pii: true,
  },
  "interactionTracking/interactionEventPrune": { from: "interaction-event-prune", ...rowDays("interaction_events", "created_at"), pii: true },
  "userCounter/userDailyCounterPrune": { from: "user-daily-counter-prune", ...rowDays("user_daily_counters", "date"), pii: true },
  "userLoginEvent/userLoginEventPrune": { from: "user-login-event-prune", ...rowDays("user_login_events", "created_at"), pii: true },
  "wallet/walletLotsPrune": {
    from: "wallet-lots-prune (remaining = 0 AND created_at < NOW() - make_interval(days => lotPruneRetentionDays), 有効期限の通貨が 1 つでもある時だけ)",
    table: "wallet_lots",
    where: `"created_at" < $1::timestamptz - make_interval(days => $2) AND ${walletWhere}`,
    order: `"created_at"`,
    pii: false,
    params: [NOW.toISOString(), walletConfig.lotPruneRetentionDays],
  },
  "pairedDevice/pairedDevicePairingsPrune": {
    from: "paired-device-pairings-prune (expires_at < now - 24h)",
    table: "device_pairings",
    where: `"expires_at" < $1::timestamptz - make_interval(days => $2)`,
    order: `"expires_at"`,
    pii: false,
    params: [NOW.toISOString(), 1],
  },
  "rateLimit/rateLimitsExpired": {
    from: "cleanupExpiredRateLimits (expires_at < now)",
    table: "rate_limits",
    where: `"expires_at" < $1::timestamptz`,
    order: `"expires_at"`,
    pii: true,
  },
};

test("一覧: 上流の項目は今の削除 9 つ(Tier1 はちょうど、fork は含む)、字面が使える", async () => {
  const expiryRules = await loadItems();
  const names = expiryRules.map((entry) => `${entry.domain}/${entry.name}`);
  if (isTier1) assert.deepEqual([...names].sort(), Object.keys(TODAY).sort());
  else for (const name of Object.keys(TODAY)) assert.ok(names.includes(name), `上流の項目 ${name} が一覧に無い`);
  for (const entry of expiryRules) assert.deepEqual(expiryRuleProblems(entry.plug), [], `${entry.domain}/${entry.name}`);
});

test("各項目: 今の削除と同じ表・条件・順・個人情報の印、enabled は書かない、束は既定 1000(Tier1。fork は上書きの値)", async () => {
  const expiryRules = await loadItems();
  for (const [name, today] of Object.entries(TODAY)) {
    const { item, text, params } = render(expiryRules, name);
    assert.equal(item.plug.table, today.table, name);
    assert.equal(item.plug.key, "id", name);
    assert.equal(item.plug.pii, today.pii, name);
    if (isTier1) {
      assert.equal(item.plug.enabled, undefined, name);
      assert.equal(item.plug.batchSize, undefined, name);
    }
    assert.equal(
      text,
      `WITH d AS (DELETE FROM "${today.table}" WHERE "id" IN (SELECT "id" FROM "${today.table}" WHERE ${today.where} ORDER BY ${today.order} LIMIT $${(today.params?.length ?? 1) + 1} FOR UPDATE SKIP LOCKED) RETURNING 1) SELECT count(*)::int AS n FROM d`,
      `${name}(今: ${today.from})`,
    );
    assert.deepEqual(params, [...(today.params ?? [NOW.toISOString()]), item.plug.batchSize ?? 1000], name);
  }
});
