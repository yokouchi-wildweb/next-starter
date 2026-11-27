# auth — 公開の口と公開 hook

## Overview

auth の README の API を分けた文書(README が 20,000 字を超えるため)。新しい認証手段を足すときの公開の口と、画面を作り替えるときの公開 hook の契約を持つ。エンドポイントと連絡(メール)の鍵は `README.md` の API。

## API

### 新しい認証手段の公開の口

fork が上流に無いログインの方法を足すときに呼ぶ口。呼ぶ順: 身元の確認(fork)→ `createFromProvider` → `establishSession`(`README.md` Usage「新しい認証手段」)。

| 口 | 置き場（import） | 引数 → 戻り値 | tx | 失敗時 |
|------|------|------|------|------|
| `establishSession` | `@/domains/core/auth/services/server/session/establishSession` | `{ cookies, user, ip? }` → `{ sessionUser, requiresReactivation, expiresAt }` | なし（最終ログインの更新 `updateLastAuthenticated` も中でする） | `security_locked` / `pending` / `withdrawn` は 403 で何も書かない(`README.md` Internals「セッションを出す口」) |
| `userService.createFromProvider` | `@/domains/core/user/services/server/userService` | `{ providerType, providerUid, displayName, ip?, role?, tx? }` → `{ user, isNewUser, isRejoin }` | 呼び手の tx（savepoint）か自分の 1 つ。ログインの記録 signup は tx の後 | 無いロールは 400。同時の作成の unique 違反は引き直して既存を返す。他の DB エラーは投げる（[user README](../user/README.md#外部の認証の身元から作る口createfromprovider)） |
| `issueOAuthState` / `verifyOAuthState` | `@/lib/line` | `{ redirectAfter, cookieName? }` → `{ state, nonceCookie }` / `{ state, cookies, cookieName? }` → `{ ok, redirectAfter }` | なし | 照合の失敗は `{ ok: false }`（戻り先を信用せず `/` へ。cookie は呼び手が消す）（[lib/line README](../../../lib/line/README.md#oauth-の-state-と-nonce-cookieissueoauthstate--verifyoauthstate)） |
| 名前の部品（`sanitizeUserName`・`lockUserName`・`isUserNameTaken`・`findAvailableSuffixedUserName`・`withUserNameGuard`） | `@/domains/core/user/entities/userName`・`@/domains/core/user/services/server/helpers/nameAvailability` | 名前の整形・ロック・使用中の判定・空き名 | `lockUserName` は tx の中で（終わりまで保持） | `withUserNameGuard` は使用中で 409。普通は `createFromProvider` に任せる（[user README](../user/README.md#名前の公開の部品)） |

- 口に入れない物: 招待コード・流入の記録・プロフィール・登録の後の milestone(`user_registered`)。要るなら呼び手が `isNewUser` のときに行う(milestone は `runPostRegistrationMilestones`、`services/server/postRegistrationMilestones.ts`)
- `establishSession` の部品 2 つ(`services/server/session/sessionToken.ts`): `assertSessionStatus(user)` と `issueSessionToken(user, { maxAge? })`

### 公開 hook

認証の守り(reCAPTCHA・ID トークン・セッション更新・遷移)と form の処理は `hooks/` 直下の公開 hook が持ち、既定の部品は hook を呼んで描くだけ。契約 = hook の名前・引数・戻り値・form の項目名。

- 内部(公開 hook の中身): `hooks/registration/`・`hooks/signup/`(送信の流れ `submitFlow.ts` / `sendFlow.ts`・共通の送信 hook・formEntities)・`hooks/oauth/transition.ts`(OAuth の遷移の決め方)

#### 本登録 form(`/signup/register`)

| hook | 引数 | form の項目名 |
| --- | --- | --- |
| `useEmailRegistrationForm()` | なし | `email`（localStorage の認証済みメール、読み取り専用）・`name`・`password`・`passwordConfirmation`（double モードのみ）・`role`・`profileData`・`inviteCode`・`agreeToTerms`・`marketingConsent?`（上流の画面には無い） |
| `useOAuthRegistrationForm()` | なし | `email`・`name`（provider のプロフィールで初期化）・`role`・`profileData`・`inviteCode`・`agreeToTerms`・`marketingConsent?`（上流の画面には無い） |

戻り値(2 本共通。Email は `passwordConfirmationRequired` が加わる):

- `form`: `UseFormReturn<EmailRegistrationFormValues | OAuthRegistrationFormValues>`(zodResolver 済み。型は同じファイルから export)
- `onSubmit(values)`: `AppForm` の `onSubmit` に渡す。セッション確認(無し = 401 文言・Email はメール一致・OAuth は provider を検査)→ 未適用の招待コードなら止める → ID トークン + reCAPTCHA v3 で登録 → `refreshSession` → `/signup/complete` へ遷移(遷移ガード経由)
- `isLoading`: 登録 API の通信中
- `rootErrorMessage`: `form` の root エラー(`string | null`)。失敗の文言・429 silent の文言が入る
- `selectedRole` / `profiles`: `RoleProfileFields` に渡すロールとプロフィール設定
- `inviteCodeState`: `InviteCodeField` の `state`(`InviteCodeApplyState`)
- `recaptchaV2`: `{ open, siteKey, onClose, onVerify }`。v2 チャレンジが要求されたとき `RecaptchaV2Challenge` に渡す(`siteKey` が null の間は描かない)。v2 トークンを得ると保留中の内容で自動で再送する
- `rateLimitWarning`: `{ open, onOpenChange }`。429(silent でない)で開く `RateLimitWarningModal` 用
- `passwordConfirmationRequired`(Email のみ): パスワード(確認)欄を出すか
- `marketingConsent`: form の zod(`hooks/registration/*FormEntities.ts`)は省略可で受け、送信の流れ(`submitFlow.ts`)は項目がある時だけ payload に入れる(v2 の再送の payload にも)

#### メール送信 form(`/signup` のメール入力・`/entry` の事前登録)

| hook | 引数 | form の項目名 |
| --- | --- | --- |
| `useVerificationEmailSendForm({ urlAfterEmailSent })` | `urlAfterEmailSent`: 送信後の遷移先 | `email` |
| `useEarlyRegistrationSendForm({ urlAfterEmailSent })` | 同上 | `email` |

戻り値(2 本共通。メール認証は `recaptchaV2` が加わる):

- `form`: `UseFormReturn<EmailSendFormValues>`(zodResolver 済み。型は `useVerificationEmailSendForm` から export)
- `onSubmit(values)`: `AppForm` の `onSubmit` に渡す。登録済みのメールなら root エラーで止める →(メール認証のみ reCAPTCHA v3)→ メールアドレスを localStorage へ保存(本登録 form が読む)→ リンクを送信 → `urlAfterEmailSent` へ遷移
- `isSubmitting`: 送信中(事前登録は登録済み確認中も含む)
- `rootErrorMessage`: `form` の root エラー(`string | null`)。登録済み・送信失敗の文言
- `recaptchaV2`(メール認証のみ): `{ open, siteKey, onClose, onVerify }`。`RecaptchaV2Challenge` に渡す。v2 トークンを得ると保留中のメールアドレスへ自動で再送する

#### ログイン form(`/login`)

| 名前 | 引数 | 戻り値 |
| --- | --- | --- |
| `useEmailPasswordLogin()`(hook) | なし | `{ signIn, isLoading }`。`signIn({ email, password })` → `{ credential, requiresReactivation }`(失敗は投げる) |
| `UserLoginEmailForm`(部品、入口 `@/domains/core/auth/components/UserLogin`) | `redirectTo?: string`(ログインの後の移り先、既定 `"/"`) | メールとパスワードの欄・パスワードを忘れた人へのリンク・誤りの文・送信ボタンを描く |

- `UserLoginEmailForm` は入力の状態・送信(二重の送信を止める)・休会中の利用者の `/reactivate` への移動・失敗の文「ログインが失敗しました」を自分で持つ。既定の `UserLogin` もこれを描く
- 並べ方を変える Screen は部品を並べ、見た目ごと作り直すなら hook を呼んで自分の form を描く

#### OAuth の登録・ログイン(`/signup/oauth`)

| hook | 引数 | 戻り値 |
| --- | --- | --- |
| `useOAuthSignupFlow({ provider, redirectTo })` | `provider?: UserProviderType`・`redirectTo?: string`（登録済みユーザーのログイン後の遷移先、既定 `"/"`） | `{ phase, requiresReactivation }` |

- 中で `useOAuthPhase`(認証の段階: initial / redirecting / processing / completed / alreadyRegistered / invalidProcess)を進め、段階が決まると移る: `completed` = `authConfig.signup.afterVerificationPath?method=thirdParty` へ遷移ガード経由 / `alreadyRegistered` + 休会中 = `/reactivate` へページの読み直し / `alreadyRegistered` = `redirectTo` へページの読み直し(利用者が替わる、D139)。成功トースト「登録済みユーザーでログインしました」は session の要求(`announce: "alreadyRegistered"`)で route が積む redirect の cookie から読み直しの後に出る(`constants/loginAnnouncement.ts`、`src/lib/toast` の redirect)
- 画面は `phase` ごとの表示(読み込み中・`InvalidProcessState`)だけを描く。`useOAuthPhase` は段階だけが要る呼び出し向けに残る(遷移はしない)

#### 画面の処理(`/email/verify`・`/logout`・`/signup/complete`)

既定の `_screen` 部品はこの hook を呼んで描くだけ(部品は上流専用・約束なし、引数は足さない)。

| hook | 引数 | 戻り値 |
| --- | --- | --- |
| `useEmailChangeVerification({ oobCode? })` | `oobCode?: string \| null`（省略 = URL の `?oobCode=` を読む。`null` = コードなし） | `{ phase, newEmail, error, loginHref }` |
| `useAutoLogout({ redirectTo })` | `redirectTo: string`（ログアウト後の遷移先。loader が内部パスに限定した値） | `{ isLoading, error, retry }` |
| `useSignupComplete()` | なし | `{ isChecking, isValidTransition }` |

- `useEmailChangeVerification`: `phase` = `initial` / `checking_auth` / `require_login` / `processing` / `completed` / `error`。ログイン済みなら確認コードの情報を引き → Firebase で変更を適用 → サーバーの DB を同期して `completed`。`loginHref` = `/login?returnTo=<今のパス + oobCode>`(未ログインのときのログインのリンク)。`error` は表示用の文言
- `useAutoLogout`: mount で 1 回だけ `useLogout` の logout を呼ぶ(StrictMode の 2 回目の effect でも 1 回)。成功で `redirectTo` へページの読み直し(D139)。失敗は `error`(`HttpError | null`)に入り、`retry()` で呼び直す(手動のボタンは `LogoutButton` でもよい)
- `useSignupComplete`: 遷移の守り(`/signup/register` からのトークン付き遷移だけを通し、それ以外はエラー画面)と、正当な遷移でのサインアップ完了コンバージョン(mount あたり 1 回、env 未設定なら何もしない)。`isChecking` の間は読み込み中を描く
