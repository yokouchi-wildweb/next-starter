# phoneVerification

## Overview

- SMS 認証(電話番号の認証)。表を持たない core ドメインで、Firebase Phone Auth で利用者の電話番号を確かめ、認証済みの印を user の列(`phoneNumber`・`phoneVerifiedAt`)に書く
- Firebase 側の準備は [SMS認証（電話番号認証）のセットアップ方法](../../../../docs/setup/SMS認証（電話番号認証）のセットアップ方法.md)
- 使う時・直す時の決まりは札 .claude/rules/items/features/phoneVerification.md にある

### 入切

- 使うかどうかは機能 `phoneVerification` の入切だけ(規則 `src/featureGate/rules/phoneVerification.ts`、上流の既定 閉)。開けるのは `pnpm ops features set phoneVerification on`(fork は `src/config/featureGate/switches.config.ts` に書かれる)
- 閉じると: API `/api/phone-verification/**` が 404
- 外の読み手(どれも自分で入切を確かめる): マイページのアカウントの電話番号の行(`AccountDetails`、未認証の出し分け)・`EditPhone`(SMS の手順か SMS なしの入力か)・`PATCH /api/me/phone`(開なら 404)・財布の残高の「SMS 認証が要る」案内(`PhoneVerificationRequired`、閉なら出さず購入の欄を出す)・財布の購入の制限のサーバーでの強制(wallet の `assertWalletPurchaseAllowed`、`requirePhoneVerification` で 403。閉なら 403 で断る)
- 電話番号の画面(`/mypage/account/phone`、規則 `pageMypage` の pathPatterns)を出すかは user の設定 `account.editableItems` に `"phone"` があるか。この機能が開なら SMS の手順、閉なら user の SMS なしの入力(`PATCH /api/me/phone`、未認証で保存。`src/domains/core/user/README.md`)

## Usage

- 手順の部品とフックの使い方: `components/PhoneVerification/README.md`

## API

| メソッド・パス | 呼び手 | 処理 |
|---|---|---|
| `POST /api/phone-verification/check` | authenticated | 番号が他の利用者に使われていないか(自分は除く) |
| `POST /api/phone-verification/verify` | authenticated | OTP の後の ID トークンを検証し、番号と認証日時を保存 |

- client: `services/client/phoneVerification.ts` の `checkPhoneAvailability`・`verifyPhone`(axios)
- 判定: `utils/phoneVerificationGuard.ts` の `isPhoneVerified`・`requirePhoneVerification`(403)・`getPhoneVerificationStatus`
- スキーマ: `entities/phoneVerification.ts` の `PhoneCheckSchema`・`PhoneVerificationSchema`。OTP の桁数・有効期限は `constants/`
- `index.ts` は client でも読める物(定数・スキーマ・判定)

## Internals

- フック: `usePhoneVerification`(手順の状態と Firebase の呼び出し)・`usePhoneVerificationModal`(Promise で認証を求める)
- サーバー: `checkPhoneAvailability`(重複の確認)・`verifyPhoneOtp`(ID トークンを checkRevoked で検証し番号の一致を確かめる)
- 書き込みは user が持つ: `verifyPhoneOtp` が user の `updatePhoneVerified`(`@/domains/core/user/services/server/phoneVerification`、重複の確認と base.update で監査を通す)を呼ぶ。番号の形式(`E164_PHONE_REGEX`・`formatToE164`・`formatForDisplay`)も user の `utils/phoneNumber`(札 pv_write_via_user / pv_phone_format)
- reCAPTCHA の置き場(`<Block id="phone-verification-recaptcha" />`)は root layout にある(札 pv_recaptcha_slot)

## Verification

- `pnpm test "src/app/(user)/(protected)/mypage/account/phone"`(loader の入切)
- `pnpm test src/domains/core/auth/services/server/verifyIdTokenRevoked.test.ts`(verifyPhoneOtp の失効の検証)
- `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`(規則と依存の検査)

## Related

- `components/PhoneVerification/README.md`: 手順の部品とフック
- `src/domains/core/user/README.md`: 電話番号の列と SMS なしの入力
