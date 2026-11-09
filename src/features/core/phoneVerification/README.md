# phoneVerification — SMS 認証(電話番号の認証)

表を持たない core ドメイン。Firebase Phone Auth で利用者の電話番号を確かめ、認証済みの印を user の列(`phoneNumber`・`phoneVerifiedAt`)に書く(設定の議会 D106)。Firebase 側の準備は [SMS認証（電話番号認証）のセットアップ方法](../../../../docs/setup/SMS認証（電話番号認証）のセットアップ方法.md)。

## 入切

- 使うかどうかは機能 `phoneVerification` の入切だけ(規則 `src/featureGate/rules/phoneVerification.ts`、上流の既定 閉)。開けるのは `pnpm ops features set phoneVerification on`(fork は `src/config/featureGate/switches.config.ts` に書かれる)
- 閉じると: API `/api/phone-verification/**` が 404、このフォルダを外から値で読むファイルは門番の依存の検査どおり入切を確かめる
- 外の読み手(どれも自分で入切を確かめる): 電話番号の画面の loader(閉なら `/mypage/account` へ戻す)・マイページのアカウントの電話番号の行(`AccountDetails`)・`EditPhone`・財布の残高の「SMS 認証が要る」案内(`PhoneVerificationRequired`、閉なら出さず購入の欄を出す)
- 電話番号の画面(`/mypage/account/phone`、規則 `pageMypage` の住所)はこの機能に `dependsOn` しない: 電話番号は SMS 認証なしでも登録できる(設定 D122)。画面を出すかは user の設定 `account.editableItems` に `"phone"` があるか。今の画面の中身は SMS の手順なので、一覧にあってもこの機能が閉なら loader がアカウントのトップへ戻す(マイページの行も出さない)

## 中身

```
phoneVerification/
├── components/PhoneVerification/   # 手順の部品(PhoneVerification・PhoneVerificationModal・各ステップ)。使い方: ./components/PhoneVerification/README.md
├── hooks/                          # usePhoneVerification(手順の状態と Firebase の呼び出し)・usePhoneVerificationModal(Promise で認証を求める)
├── services/client/phoneVerification.ts   # checkPhoneAvailability・verifyPhone(axios、/api/phone-verification/{check,verify})
├── services/server/                # checkPhoneAvailability(重複の確認)・verifyPhoneOtp(ID トークンを checkRevoked で検証し番号の一致を確かめる)
├── entities/phoneVerification.ts   # PhoneCheckSchema・PhoneVerificationSchema
├── constants/                      # OTP の桁数・有効期限
└── utils/phoneVerificationGuard.ts # isPhoneVerified・requirePhoneVerification(403)・getPhoneVerificationStatus
```

- `index.ts` は client でも読める物だけ(定数・スキーマ・判定)
- 書き込みは user に任せる: `verifyPhoneOtp` が user の `updatePhoneVerified`(`@/features/core/user/services/server/phoneVerification`、重複の確認と base.update で監査を通す)を呼ぶ。番号の形式(`E164_PHONE_REGEX`・`formatToE164`・`formatForDisplay`)も user の `utils/phoneNumber`
- reCAPTCHA の置き場 `<div id="phone-verification-recaptcha" />` は root layout にある(モーダルの外に要る)

## API

| 住所 | 呼び手 | 処理 |
|---|---|---|
| `POST /api/phone-verification/check` | authenticated | 番号が他の利用者に使われていないか(自分は除く) |
| `POST /api/phone-verification/verify` | authenticated | OTP の後の ID トークンを検証し、番号と認証日時を保存 |

## テスト

`pnpm test "src/app/(user)/(protected)/mypage/account/phone"`(loader の入切)| `pnpm test src/features/core/auth/services/server/verifyIdTokenRevoked.test.ts`(verifyPhoneOtp の失効の検証)| `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`(規則と依存の検査)
