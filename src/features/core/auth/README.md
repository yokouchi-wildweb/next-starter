# auth ドメイン

## Overview

認証(誰であるか)とセッション、ページ / API の認可ガードを担う core ドメイン。ユーザー属性・ステータス・ロールの定義は [user ドメイン](../user/README.md) の責務で、auth はそれを「ログイン・登録・セッション・ガード」の文脈で使う。

- 置き場: サーバーの処理 `services/server/`(セッション `session/`・ページの守りに渡す部品 `authorization.ts` / `pageGuardUserDeps.ts`・API の Factory に渡す部品 `apiAccess.ts` / `apiRouteUserDeps.ts`・強制失効・仮登録 / 本登録・ログイン・認証のメール)| `/api/auth/*` を呼ぶ ClientService `services/client/` | 公開 hook `hooks/` | 部品 `components/`(SMS 認証の部品は core/phoneVerification、デモのログインは core/demo)| 連絡の定義 `messages/`
- API ルートは `src/app/api/auth/**`、画面は `src/app/(user)/(auth)/**`(login / signup / logout / reactivate / restricted / password / email 等)と `src/app/admin/login/`

### アカウントとプロバイダ

- プロバイダごとに独立したアカウント: 同じメールアドレス・氏名でも、登録経路(プロバイダ)が違えば別の `users` 行
- 利用者の識別キーは `(provider_type, provider_uid)`(`users_provider_type_uid_idx` で UNIQUE)。メールアドレスは識別キーではない
- `provider_type` は Firebase Auth の `providerId` をそのまま使う(`google.com` / `yahoo.com` 等。クライアント / サーバー間で追加の対応表が要らない)。値の一覧は `user/constants/provider.ts`(`USER_PROVIDER_TYPES`)
  - `email`: Firebase Email Link 登録。`provider_uid` = Firebase UID
  - `local`: 管理画面で作るアカウント(管理者)。Firebase に依存せず、アプリでハッシュ化した `local_password` で認証
  - サードパーティ(Google / Yahoo! / Facebook / X(twitter.com) 等): Firebase の `signInWithRedirect` 経由。有効化は `authConfig.thirdPartyProviders`
- 管理者と一般ユーザーは単一の `users` テーブル。区別は `role`(ロールカテゴリ admin / user)で、`provider_type` とは独立
- スキーマの分担: user ドメインがユーザー属性のスキーマを持ち、auth はそれを拡張して認証文脈の検証(パスワード確認・認証情報の整合性など)を加える(`entities/schema.ts`)
- LINE / X の `/api/auth/line/*`・`/api/auth/x/*` はログイン済みユーザーへの外部アカウント連携(`userLineProfile` / `userXProfile` に紐付け)で、ログイン手段・アカウント作成ではない([lib/line](../../../lib/line/README.md) / [lib/x](../../../lib/x/README.md))

## Usage

### 登録フロー(仮登録 → 本登録)

メール / サードパーティとも仮登録 API に統一し、`(provider_type, provider_uid)` で UPSERT して `status=pending` を作ってから本登録で `active` にする。

1. `/signup` — メール入力(またはプロバイダ選択)。メールは `POST /api/auth/send-email-link` で Firebase のサインインリンクを送り、`/signup/email-sent` で送信完了を案内。continueUrl は `/signup/verify`
2. `/signup/verify`(メール)/ `/signup/oauth`(サードパーティ)— Firebase でサインインし、ID トークンを `POST /api/auth/pre-register` へ
3. 仮登録(`services/server/preRegistration.ts`)— ID トークンを検証し、本登録済み(`USER_REGISTERED_STATUSES`)なら 409。未登録 / pending / withdrawn(再入会)なら pending で作成・更新(実体は user ドメインの `preRegisterFromAuth`)
4. `/signup/register` — 本登録フォーム。`POST /api/auth/register`(`services/server/registration.ts`)で `active` 化(user ドメインの `registerFromAuth` → `activate`)し、セッション Cookie を発行
5. `/signup/complete`

- 本登録が終わるまでは何度でも仮登録をやり直せる(だから UPSERT)
- 管理画面からのユーザー作成は仮登録 / 本登録を経由しない(user ドメインの `services/server/creation/console/`)

登録まわりの関連の仕様:

- サインアップの入切は門番の規則 `src/featureGate/rules/signup.ts`(閉で画面・API とも `/signup-closed` へ、`src/featureGate/README.md`)、mode は `user/config.ts` の `signupMode`。`mode="earlyRegistration"`(事前登録)では `/signup` → `/entry` にリダイレクトされ、`POST /api/auth/send-early-registration-link` を使う(`src/proxies/redirect.ts`)
- 招待コード: `register` の `inviteCode` は「非空 = その値を使う / `""` = 明示的に辞退(cookie に頼らない)/ undefined = 招待リンクの cookie に頼る」。消し込みは `INVITE_CODE_REDEEM_SCOPE`(invite 種別のみ)で、失敗しても登録は止めない → [referral README](../referral/README.md#サインアップフロー統合)
- 流入経路: 本登録時に attribution cookie から `recordSignupAcquisition`(bestEffort)→ [userAcquisition README](../userAcquisition/README.md)
- 登録の後の処理(登録ボーナスなど): 本登録の守りの後に milestone のトリガー `user_registered` が 1 回発火する(1 人 1 回・付与と記録は同じ tx・失敗しても登録は止めない)→ [milestone README](../milestone/README.md#user_registered)
- 宣伝の同意: `register` の `marketingConsent`(省略可の boolean)。中身は Internals「宣伝の同意」。チェックを出す fork は自分の登録の Screen(`_components/`)の form に `marketingConsent` のチェック(例 `SingleCardCheckbox`、既定の値は fork が決める。事前の同意を求める国ではオフ)を足す
- 表示名の検証・一意性: `UserNameSchema` と `withUserNameGuard`(本登録の `activate` で適用)→ [user README 表示名節](../user/README.md#表示名--ユーザー名バリデーションと一意性)

### セッションを出す(establishSession)

新しい認証手段(fork の LINE ログインなど)の route は、身元を確かめて DB の利用者の行を引いた後に `establishSession` を呼ぶ。

```ts
import { establishSession } from "@/features/core/auth/services/server/session/establishSession";

const response = NextResponse.json({ ok: true });
const { sessionUser, requiresReactivation, expiresAt } = await establishSession({
  cookies: response.cookies, // 応答の Cookie
  user,                      // DB の現在値の行（{ id, role, status, isDemo, providerType, providerUid, name }）
  ip,                        // ログインの記録に残す IP（省略可）
});
```

### 新しい認証手段(身元の確認 → createFromProvider → establishSession)

fork が上流に無いログインの方法(LINE など)を足すときの組み方。口の契約は `API.md`。

```ts
// ① 身元の確認（fork の物: OAuth のコードの交換・id token の検証など）
const { providerUid, displayName } = await verifyWithProvider(request);

// ② 利用者を引く・作る（user README「外部の認証の身元から作る口」）
const { user, isNewUser } = await userService.createFromProvider({
  providerType: "line",
  providerUid,
  displayName,
  ip,
});

// ③ セッションを出す（上の「セッションを出す」）
const response = NextResponse.json({ ok: true, isNewUser });
await establishSession({ cookies: response.cookies, user, ip });
return response;
```

- providerType は `USER_PROVIDER_TYPES`(`user/constants/provider.ts`、users の enum)の値。`line` / `oidc` / `custom` などは既にある
- 退会者(`withdrawn`)の既定は上流の再登録の規則(`createFromProvider` が `active` に戻し、監査 `user.rejoined`)。断る fork は ② の前に `userService.findByProvider` で状態を見て、自分のエラーを返す
- 作成の監査は口の `user.registered` / `user.rejoined`
- 招待コード・流入の記録・プロフィールは ② の後に fork の呼び手が行う

### クライアント側

- クライアントは `useAuthSession()` → `{ user, isAuthenticated, refreshSession }`。`refreshSession` は `GET /api/auth/session` を叩いて Context を更新(失敗時は user=null)
- ログアウト: `useLogout` → `services/client/logout.ts` → `POST /api/auth/logout`(Cookie 削除)
- パスワード再設定メール: `useForgotPassword` → `services/client/forgotPassword.ts`(`sendPasswordResetEmail`)→ `POST /api/auth/forgot-password`
- 管理者ログイン: `AdminLogin` + `useAdminLogin` → `POST /api/auth/local/login`(admin カテゴリのみ、失敗は `loginAudit` で記録・ロックアウト判定)
- 画面を作り替える fork は同じルートの `_components/` の Screen で公開 hook を呼び、返る `form` を `AppForm` + 任意の markup(`FieldRenderer` 等)で描く(hook の契約は `API.md`)

## API

- 公開の口(新しい認証手段)と公開 hook の契約: `API.md`(この README の API を分けた文書)
- `POST /api/auth/send-email-link`・`/pre-register`・`/register`・`/send-early-registration-link`・`/forgot-password`・`/local/login`・`/logout`、`GET /api/auth/session`(確認と再発行)・`/api/auth/firebase-token`

### システムの連絡(メール)

認証のメールは連絡の定義(`messages/<名前>.ts`、鍵 `auth.<名前>`)で、送る口 `messagingService.sendMessage` が送る(仕組み: src/features/core/messaging/services/server/sendMessage/README.md・src/lib/messaging/README.md)。

| 鍵 | 送り手 | 宛先 | 扱い |
| --- | --- | --- | --- |
| `auth.verification` | `sendSignInLink`（`POST /api/auth/send-email-link`） | 入力のアドレス | required・リンクは `secretVar` |
| `auth.earlyRegistration` | `sendEarlyRegistrationLink`（`POST /api/auth/send-early-registration-link`） | 入力のアドレス | required・リンクは `secretVar` |
| `auth.passwordReset` | `sendPasswordResetLink`（`POST /api/auth/forgot-password`。Firebase に無いアドレスは送らずに返す） | 入力のアドレス | required・リンクは `secretVar` |
| `auth.emailChange` | `sendEmailChangeLink`（`POST /api/me/email/send-verification`） | 新しいアドレス | required・リンクは `secretVar` |
| `auth.accountLocked` | `localLogin`（永続ロックの時。送りっぱなし、失敗は warn だけ） | 利用者（`users.email`） | 取引の連絡・`record: "meta"`（IP を残さない） |

- required の 4 本は要求の中で短く送り直し、メールの配達が `sent` でなければ(失敗・不明・宛先の停止)DomainError(500)「…の送信に失敗しました: <理由>」(`sendMailMessage.ts`)
- 見た目はひな形(`src/features/core/messaging/layouts/`、欄は意味で名づけ)
  - リンクの 4 本 = ひな形 `link`(認証のリンク): `heading` → `received` 受付の文 → `buttonGuide` → ボタン(`button`)→ `urlGuide` → ボタンの URL をそのまま出す → `footer`
  - `accountLocked` = ひな形 `alert`(セキュリティの警告): `heading` → `explanation` → 情報の箱(`details` = 発生時刻・アクセス元 IP。値が空の行は出さない)→ `notYou`・`ifYou`(最初の行を太字)→ `footer`

## Extension

- 設定: 持ち主 `config.ts`(既定・型 `AuthOverride`・合成 `authConfig`)、上書き `src/config/features/auth.config.ts`(値はリテラル、fork 独自の鍵は上書きの `export type Extra`)。鍵: `thirdPartyProviders`(提供元ごとの有効化)・`signup`(遷移先・進捗の表示・パスワード入力のモード・ロール選択・メール認証後の動作・Hide My Email の扱い)・`rateLimitWarning`(重複登録の警告の文言)
- ほかの置き場: サインアップの入切 = 門番の規則 `signup`・mode = `user/config.ts` の `signupMode`・セッション Cookie = `lib/jwt`・メールチェック = `lib/spamGuard`
- メールの見た目を替える fork はひな形の描き方の `.replace`、文言は上書きの `values`
- 登録の後の処理は milestone の定義(`user_registered`)を置く(Usage「登録フロー」)

## Internals

### セッション

- JWT のみのセッション。セッションテーブルは持たない。Cookie 名は `__session`(`src/lib/jwt/config.ts` の `cookieName`、上書き `src/config/lib/jwt.config.ts`。もともと Firebase Hosting が転送する唯一の Cookie 名に合わせた物)。`SameSite=Lax` / `HttpOnly` / `Secure` / `path=/`(`constants/session.ts`)
- 有効期限は既定 7 日(`lib/jwt` の設定)、デモユーザー 10 分(`demo` の設定の `session.maxAgeSeconds`、デモのログインの機能が開のとき)。`GET /api/auth/session` で再発行するローリングセッション。再発行も `resolveSessionUser`(DB 照合・強制失効チェック)を通し、新トークンは DB の現在値から `refreshSessionCookie` で署名する(失効済み / ユーザー不在 → 401 + Cookie 削除)
- `resolveSessionUser`(`services/server/session/token.ts`)が JWT 検証後に DB から現在値を引いて `SessionUser` を組み立てる。管理画面でのステータス・ロール変更は次のリクエストで反映される。DB 障害時は null(安全側)
- 強制失効: `invalidateSessionsForUser`(`services/server/sessionInvalidation.ts`)が `users.sessions_invalidated_at` を更新し、それより前に発行された JWT(`iat < sessions_invalidated_at`)を `resolveSessionUser` が拒否する
  - Firebase の ID トークンをセッションに替えるとき(`createFirebaseSession`・`register`)も、`auth_time`(その Firebase のセッションの認証時刻)が境目より前なら 401(Firebase の取り消しが失敗していても止まる)。比較は `services/server/session/invalidationBoundary.ts`
  - Firebase のリフレッシュトークンも best-effort で revoke し、監査ログ `auth.session.invalidated` を残す。発火元はパスワード変更・`banned` / `security_locked` への遷移(user の update / changeStatus wrapper、ログインロックアウト)
- `getTokenOnlySession` は JWT クレームのみ(DB を引かない stale な値)。監査ログの actor 抽出やデモ判定など
- JWT の署名・検証・Cookie 抽出の汎用部分は [lib/jwt](../../../lib/jwt/README.md)
- `local` の管理者ログインは Firebase なしで完了する: Firebase のサーバー側が未設定(`isFirebaseServerConfigured()` が false)ならカスタムトークンを作らず `firebaseCustomToken: null` を返し、`useAdminLogin` は null かクライアントの Firebase が未設定なら Firebase Auth に触れない。設定済みなら今まで通りカスタムトークンでサインインする(Storage のルール・chatRoom・`useFirebaseAuthSync` 用)。設定済みで失敗したときはログインも失敗する

### セッションを出す口

- 順番: ① 状態の分岐 `assertSessionStatus`(`security_locked` / `pending` / `withdrawn` は 403、`inactive` は `requiresReactivation: true`、`suspended` / `banned` はセッションを出して画面が `/restricted` へ)→ ② `userService.updateLastAuthenticated`(最終ログイン・`metadata.loginHistory`・`user_login_events`・ロックアウトの数の解除)→ ③ `issueSessionToken`(`SessionUser` を組み立てて署名。既定の maxAge は `isDemo` でデモの短い時間 / 通常)→ ④ `issueSessionCookie`
- 拒否(403)なら何も書かない(最終ログインも Cookie も)。Cookie は分岐を通った後でしか出ないので迂回できない
- 退会者(`withdrawn`)は 403 = 上流の既定(戻るには仮登録 → 本登録の再登録の道)
- 上流のログイン 5 か所(`firebaseSession`・`localLogin`・`demoLogin`・`registration`・`refreshSessionCookie`)も部品 `assertSessionStatus` / `issueSessionToken` を使う(route が Cookie を書く形のため、route と service の戻り値は変えていない)。ローカルログインの状態の分岐は失敗の記録とロックアウトを伴う別の物
- メール / OAuth のログイン(`createFirebaseSession`)も最終ログインの更新は `updateLastAuthenticated`(`user_login_events` に行が残り、成功でパスワードのロックアウトの数が消える)

### 宣伝の同意

- `marketingConsent` = `false`: 宣伝の種別まるごとの停止の行(kind `marketing`、`'*'` `'*'`)を source `signup` で書く(fork が後から足す宣伝の種類にも効く)
- `true`: 同じ登録の前の失敗した試みが残したその行を消す(有効化の前の利用者にほかの好みの行は無い)| 省略 = 何もしない
- 書くのは有効化(`registerFromAuth`)の前に仮登録の id で、書けなければ投げる(有効化していないので登録はやり直せる)
- 中身は `services/server/marketingConsent.ts` → messaging の `setMessagePreference(userId, { kind, optedOut }, { source })`

### ページの認可(proxy → 範囲の guard.ts → loader の access)

```
proxy (redirectProxy)  →  範囲の guard.ts(layout が guard() の 1 行)  →  _screen/loader.ts(createLoader の access)
URL ルール              ロール + ステータス + 行き先(親子 AND)          ページの access を評価してから取得、主体は ctx.user
```

1. proxy(`src/proxies/redirect.ts`): 受け口 `src/proxies/redirects/<名前>.ts` のルール(+ サインアップモードの内部ルール)で先にリダイレクト。セッションの判定は `resolveSessionUser`
2. 範囲の guard.ts(layout の隣。root は `src/app/guard.ts`): 方針(access・allowStatuses・redirectTo・forbiddenRedirectTo・returnBack・statusRedirects・setupRedirectTo)を字面で書き、layout は `await guard()` の 1 行。子は最寄りの親の `extend` で作る(親子 AND、狭めるだけ)
   - 上流の範囲: `(user)/(protected)`(利用者・管理者カテゴリ、`/login`、status 別の行き先)/ `admin/(protected)`(管理者カテゴリ、`/admin/login`、管理者 0 人なら `/admin/setup`)/ その `users`(admin ロール、`/admin`)/ `debug`(管理者カテゴリ + debugger、`/login`)
   - setup への誘導の判定は auth の `hasUserForAccess(access)`(範囲の access を満たしうる利用者が 1 人以上いるか、真偽値だけ)を wiring が作り手に渡す。guard.ts には行き先の値だけ
3. loader: 最寄りの guard.ts の `createLoader({ access, key?, load })`。範囲の方針とページの access を取得前に評価し、主体は `load({ user })` の `user`(DB 同期、リクエスト内 1 回)。本人の列が要るなら `requireUserRecord(user, "/login")`(user のサービス)

- 結ぶのは `src/wiring/pageGuard.ts`(`lib/pageGuard` の汎用版 + auth の `pageGuardUserDeps` + `hasUserForAccess`)。書き方は [lib/pageGuard README](../../../lib/pageGuard/README.md) と [SCREENS §4](../../../lib/screens/README.md)
- page.tsx・Screen・layout にガード・取得を書かない。表示用の利用者は client の `useAuthSession`、ページ本文は loader の DTO
- 利用できない status の利用者を案内する画面(`/restricted`・`/reactivate`)は root の public の loader に `allowStatuses` を書いて受ける(public の `user` は既定で利用可能な status だけ非 null)
- `getSessionUser` は `cache()` 経由で、範囲の guard・loader・API の Factory・AuthSessionProvider が同じリクエストで呼んでも DB 引きは 1 回
- API ルート側の認可はファクトリーが構造的に強制する(`createDomainRoute` は serviceRegistry の `access`、`createApiRoute` は `access` 必須(public / authenticated / { roles, roleCategories } + allowStatuses)、本人データは `createMeRoute`)→ [routeFactory README](../../../lib/routeFactory/README.md)
- API の主体はリクエストごとに 1 回だけ DB 同期の `getSessionUser` で解き(`apiRouteUserDeps`)、ハンドラには `ctx.user` で渡す。セッションの確認と再発行(`GET /api/auth/session`)は `session/refreshSessionResponse.ts`

### 置き場所の検査(lint `page-authz`、全 Tier で error)

- UI の場所はサーバーのデータを取らない(`page-authz/layout-no-server-data`。名前は互換のため据え置き): src/app の Screen・page.tsx・layout・`_layout/`・guard.ts・`_components/` の部品と `src/components`・`src/hooks`・features の components / hooks で、`services/server`・DB(`@/lib/drizzle`・`drizzle-orm` の値・`@/lib/firebase/server`・`firebase-admin`・`entities/drizzle` の表)を値で import しない。layout は loader も不可。型だけは可
  - 理由: UI で取ったデータは範囲の守りと loader の access を通った後のデータにならない。取得は loader へ集める
  - 名前付き例外は `AuthSessionProvider`(root layout の Provider。Cookie の解析とセッション解決)
- セッション・ガード API をページ層・UI・API で import しない(`page-authz/session-api-callsite`): `getSessionUser`・`getTokenOnlySession`・`resolveSessionUser(FromTokenOnly)`・`parseSessionCookie`・削除済みの `authGuard`・`requireCurrentUser`・`requireAuthenticated`・`requireAdmin`(fork の古い import を止めるため名前は残す)・pairedDevice の `getSessionDevice`・`deviceGuard`・`requireCurrentDevice`・`principalGuard`・`requireCurrentPrincipal`
  - 対象: `src/app` 全体(page・Screen・layout・`_layout/`・loader・guard.ts・`_components/`・API の route と補助ファイル)と UI 側。許可の場所は無い(ページの主体は createLoader の `ctx.user`、API の主体は Factory の `ctx.user`)。`AuthSessionProvider` は名前付き例外
- データに届く wiring の import の場所(`pnpm test src/wiring/wiring.test.mjs`)・`@/lib/pageGuard` の値 import は wiring だけ(lint `import-boundaries/page-guard-via-wiring`)・features の index.ts は services/server を値で再 export しない(`import-boundaries/features-index-no-server-reexport`)
- 限界: 直接の import だけを見る。判定は `eslint-rules/page-authz.mjs`

### クライアントのセッション

- root layout(`src/app/layout.tsx`)の `AuthSessionProvider`(server)が Cookie を `resolveSessionUser` で解決し、`AuthSessionClientProvider` に初期値として渡す
- `AuthSessionClientProvider` は `useFirebaseAuthSync`(JWT はあるのに Firebase Auth が未サインインのとき `/api/auth/firebase-token` のカスタムトークンで再サインイン)と DAU 記録も担う

## Verification

- サーバー(セッション・失効の境目・establishSession・Firebase なしの管理者ログイン): `pnpm test src/features/core/auth/services/server`(全体は `pnpm test src/features/core/auth/`)
- 公開 hook と送信の流れ: `pnpm test src/features/core/auth/hooks/`
- 連絡の件名と見える文面: `pnpm test src/features/core/auth/messages`
- 置き場所の検査: `pnpm test eslint-rules/page-authz.test.mjs`

## Related

- [user ドメイン](../user/README.md) — users テーブル、ステータス、ロール、表示名、ステータス履歴
- [lib/jwt](../../../lib/jwt/README.md) — JWT 署名・検証の汎用ラッパー
- [lib/routeFactory](../../../lib/routeFactory/README.md) — API ルートの認可
- [lib/screens](../../../lib/screens/README.md) — page / Screen / loader 構造
- [referral](../referral/README.md) / [userAcquisition](../userAcquisition/README.md) — 招待コード・流入経路
- [lib/firebase](../../../lib/firebase/README.md) — Firebase 設定・未設定モード
- [phoneVerification](../phoneVerification/README.md) — SMS 認証(電話番号の認証)(部品・hook・API `/api/phone-verification/*`)
