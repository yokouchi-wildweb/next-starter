// 生成物・編集不可: pnpm generate extensions が src/lib/cron/extensionPoints.ts から生成する
// cronMaintenance: 差す側の <ドメイン>/plugs/cronMaintenance/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// expiryRules: 差す側の <ドメイン>/plugs/expiryRules/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const rule(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の enabled・batchSize を重ねる)

import type { CronMaintenancePlug, ExpiryRule } from "@/lib/cron/points";

import { plug as cronMaintenance_setting_maintenance } from "@/domains/core/setting/plugs/cronMaintenance/maintenance";
import { rule as expiryRules_auditLog_auditLogPrune } from "@/domains/core/auditLog/plugs/expiryRules/auditLogPrune";
import { rule as expiryRules_deviceFingerprint_deviceFingerprintPrune } from "@/domains/core/deviceFingerprint/plugs/expiryRules/deviceFingerprintPrune";
import { rule as expiryRules_fingerprintChallenge_fingerprintChallengeAccessPrune } from "@/domains/core/fingerprintChallenge/plugs/expiryRules/fingerprintChallengeAccessPrune";
import { rule as expiryRules_interactionTracking_interactionEventPrune } from "@/domains/core/interactionTracking/plugs/expiryRules/interactionEventPrune";
import { rule as expiryRules_pairedDevice_pairedDevicePairingsPrune } from "@/domains/core/pairedDevice/plugs/expiryRules/pairedDevicePairingsPrune";
import { rule as expiryRules_rateLimit_rateLimitsExpired } from "@/domains/core/rateLimit/plugs/expiryRules/rateLimitsExpired";
import { rule as expiryRules_userCounter_userDailyCounterPrune } from "@/domains/core/userCounter/plugs/expiryRules/userDailyCounterPrune";
import { rule as expiryRules_userLoginEvent_userLoginEventPrune } from "@/domains/core/userLoginEvent/plugs/expiryRules/userLoginEventPrune";
import { rule as expiryRules_wallet_walletLotsPrune } from "@/domains/core/wallet/plugs/expiryRules/walletLotsPrune";

export const cronMaintenance: { domain: string | null; name: string; requires: readonly string[]; plug: CronMaintenancePlug }[] = [
  { domain: "setting", name: "maintenance", requires: [], plug: cronMaintenance_setting_maintenance },
];

export const expiryRules: { domain: string | null; name: string; requires: readonly string[]; plug: ExpiryRule }[] = [
  { domain: "auditLog", name: "auditLogPrune", requires: [], plug: expiryRules_auditLog_auditLogPrune },
  { domain: "deviceFingerprint", name: "deviceFingerprintPrune", requires: [], plug: expiryRules_deviceFingerprint_deviceFingerprintPrune },
  { domain: "fingerprintChallenge", name: "fingerprintChallengeAccessPrune", requires: ["deviceFingerprint"], plug: expiryRules_fingerprintChallenge_fingerprintChallengeAccessPrune },
  { domain: "interactionTracking", name: "interactionEventPrune", requires: [], plug: expiryRules_interactionTracking_interactionEventPrune },
  { domain: "pairedDevice", name: "pairedDevicePairingsPrune", requires: [], plug: expiryRules_pairedDevice_pairedDevicePairingsPrune },
  { domain: "rateLimit", name: "rateLimitsExpired", requires: [], plug: expiryRules_rateLimit_rateLimitsExpired },
  { domain: "userCounter", name: "userDailyCounterPrune", requires: [], plug: expiryRules_userCounter_userDailyCounterPrune },
  { domain: "userLoginEvent", name: "userLoginEventPrune", requires: [], plug: expiryRules_userLoginEvent_userLoginEventPrune },
  { domain: "wallet", name: "walletLotsPrune", requires: [], plug: expiryRules_wallet_walletLotsPrune },
];
