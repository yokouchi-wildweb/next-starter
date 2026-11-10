# auth ドメイン

認証（誰であるか）とセッション、ページ/API の認可ガードを担う core ドメイン。ユーザー属性・ステータス・ロールの定義は [user ドメイン](../user/README.md) の責務で、auth はそれを「ログイン・登録・セッション・ガード」の文脈で使う。

## ディレクトリ構成

```
auth/
├── entities/            # session.ts (SessionUser / TokenPayload), schema.ts (登録スキーマ: user のスキーマを拡張), registration.ts
├── constants/           # session.ts (Cookie 共通オプション), registration.ts, loginFailure.ts, localStorage.ts
├── services/
│   ├── server/
│   │   ├── session/             # getSessionUser / getTokenOnlySession / token.ts (resolveSessionUser) / issue・clearSessionCookie
│   │   ├── authorization.ts     # getRequestPathname・hasUserForAccess(ページの守りに渡す部品)
│   │   ├── pageGuardUserDeps.ts # pageGuardUserDeps (ページの守り lib/pageGuard に差し込む利用者の束。結ぶのは src/wiring/pageGuard.ts)
│   │   ├── apiAccess.ts         # evaluateApiAccessRule (API の Factory のアクセス評価。allowStatuses を受ける)
│   │   ├── apiRouteUserDeps.ts  # apiRouteUserDeps (API の Factory に差し込む利用者の束。結ぶのは src/wiring/apiRoute.ts)
│   │   ├── sessionInvalidation.ts # invalidateSessionsForUser (全セッション強制失効)
│   │   ├── preRegistration.ts / registration.ts   # 仮登録 / 本登録
│   │   ├── localLogin.ts / firebaseSession.ts / loginAudit.ts(デモのログインは core/demo)
│   │   └── sendSignInLink.ts / sendEarlyRegistrationLink.ts / sendPasswordResetLink.ts / sendEmailChangeLink.ts
│   └── client/          # 各 /api/auth/* を呼ぶ ClientService (axios + normalizeHttpError)
├── hooks/               # useAuthSession, useLogout, usePreRegistration, useRegistration, useEmailRegistrationForm / useOAuthRegistrationForm / useVerificationEmailSendForm / useEarlyRegistrationSendForm / useOAuthSignupFlow / useEmailChangeVerification / useAutoLogout / useSignupComplete (公開 hook の契約表), oauth/* (内部の部品), registration/・signup/ (内部) など
├── components/          # AuthSessionProvider 系, Signup / Verification / Registration / OAuth / UserLogin / AdminLogin 等(SMS 認証の部品は core/phoneVerification)
└── utils/               # password.ts (hash/verify), createOAuthProvider.ts など
```

API ルートは `src/app/api/auth/**`、画面は `src/app/(user)/(auth)/**`（login / signup / logout / reactivate / restricted / password / email 等）と `src/app/admin/login/`。

## アカウントとプロバイダの方針

- **プロバイダごとに独立したアカウント**。同じメールアドレス・氏名でも、登録経路（プロバイダ）が違えば別の `users` 行として扱い、**マージしない**。
- 利用者の識別キーは `(provider_type, provider_uid)`（`users_provider_type_uid_idx` で UNIQUE）。メールアドレスは識別キーではない。
- `provider_type` は Firebase Auth の `providerId` をそのまま採用（`google.com` / `yahoo.com` 等）。クライアント/サーバー間で追加マッピングが要らないため。値の一覧は `user/constants/provider.ts` (`USER_PROVIDER_TYPES`)。
  - `email`: Firebase Email Link 登録。`provider_uid` = Firebase UID
  - `local`: 管理画面で作るアカウント（管理者）。Firebase に依存せず、アプリでハッシュ化した `local_password` で認証
    - **Firebase なしで完了する**: Firebase のサーバー側が未設定（`isFirebaseServerConfigured()` が false）ならカスタムトークンを作らず `firebaseCustomToken: null` を返し、`useAdminLogin` は null かクライアントの Firebase が未設定なら Firebase Auth に触れない。設定済みなら今まで通りカスタムトークンでサインインする（Storage のルール・chatRoom・`useFirebaseAuthSync` 用）。設定済みで失敗したときはログインも失敗する（障害を隠さない）。検査: `pnpm test src/features/core/auth/`
  - サードパーティ（Google / Yahoo! / Facebook / X(twitter.com) 等）: Firebase の `signInWithRedirect` 経由。有効化は `authConfig.thirdPartyProviders`
- 管理者と一般ユーザーは **単一の `users` テーブル**で管理する（別テーブル・別ドメインを作らない）。区別は `role`（ロールカテゴリ admin / user）で、`provider_type` とは独立。
- スキーマの分担: user ドメインがユーザー属性のスキーマを持ち、auth はそれを拡張して認証文脈の検証（パスワード確認・認証情報の整合性など）を加える（`entities/schema.ts`）。
- LINE / X の `/api/auth/line/*`・`/api/auth/x/*` は **ログイン済みユーザーへの外部アカウント連携**（`userLineProfile` / `userXProfile` に紐付け）であり、ログイン手段・アカウント作成ではない。詳細は [lib/line](../../../lib/line/README.md) / [lib/x](../../../lib/x/README.md)。

## 登録フロー（仮登録 → 本登録）

メール / サードパーティとも **仮登録 API に統一**し、`(provider_type, provider_uid)` で UPSERT して `status=pending` を作ってから本登録で `active` にする。

1. `/signup` — メール入力（またはプロバイダ選択）。メールは `POST /api/auth/send-email-link` で Firebase のサインインリンクを送信し、`/signup/email-sent` で送信完了を案内。continueUrl は `/signup/verify`
2. `/signup/verify`（メール）/ `/signup/oauth`（サードパーティ）— Firebase でサインインし、ID トークンを `POST /api/auth/pre-register` へ
3. 仮登録 (`services/server/preRegistration.ts`) — ID トークンを検証し、本登録済み (`USER_REGISTERED_STATUSES`) なら 409。未登録 / pending / withdrawn（再入会）なら pending で作成・更新（実体は user ドメインの `preRegisterFromAuth`）
4. `/signup/register` — 本登録フォーム。`POST /api/auth/register` (`services/server/registration.ts`) で `active` 化（user ドメインの `registerFromAuth` → `activate`）し、セッション Cookie を発行
5. `/signup/complete`

本登録が終わるまでは何度でも仮登録をやり直せる（だから UPSERT）。管理画面からのユーザー作成は仮登録/本登録を経由しない（user ドメインの `services/server/creation/console/`）。

登録まわりの関連仕様（ここでは再説明しない）:

- **サインアップの有効/モード**: `APP_FEATURES.auth.signup`。`enabled=false` で画面・API とも `/signup-closed` へ（Feature Gate: 規則 `src/featureGate/rules/signup.ts`、詳細 `src/featureGate/README.md`）。`mode="earlyRegistration"`（事前登録）では `/signup` → `/entry` にリダイレクトされ、`POST /api/auth/send-early-registration-link` を使う（`src/proxies/redirect.ts`）
- **招待コード**: `register` の `inviteCode` は「非空=その値を使う / `""`=明示的に辞退（cookie フォールバックしない）/ undefined=招待リンク cookie にフォールバック」。消し込みは `INVITE_CODE_REDEEM_SCOPE`（invite 種別のみ）で、失敗しても登録はブロックしない → [referral README](../referral/README.md#サインアップフロー統合)。サインイン用・事前登録用のメールのリンクに招待のパラメータを付けるのは紹介が開いているとき（`gate.enabled("referral")`）だけ（route とサービスの両方で確かめる）
- **流入経路**: 本登録時に attribution cookie から `recordSignupAcquisition`（bestEffort）→ [userAcquisition README](../userAcquisition/README.md)
- **登録の後の処理**（登録ボーナスなど）: 本登録の守りの後に milestone のトリガー `user_registered` が 1 回発火する。fork は route や `registration.ts` を編集せず、マイルストーン定義を置く（1 人 1 回・付与と記録は同じ tx・失敗しても登録は止めない）→ [milestone README](../milestone/README.md#user_registered)
- **表示名の検証・一意性**: `UserNameSchema` と `withUserNameGuard`（本登録の `activate` で適用）→ [user README 表示名節](../user/README.md#表示名--ユーザー名バリデーションと一意性)

## セッション

- **JWT のみのセッション**。セッションテーブルは持たない。Cookie 名は `__session`（`src/lib/jwt/config.ts` の `cookieName`、上書き `src/config/lib/jwt.config.ts`。もともと Firebase Hosting が転送する唯一の Cookie 名に合わせたもの）。`SameSite=Lax` / `HttpOnly` / `Secure` / `path=/`（`constants/session.ts`）
- 有効期限は既定 7 日、デモユーザー 10 分（`APP_FEATURES.auth.session`）。`GET /api/auth/session` で再発行するローリングセッション。再発行も `resolveSessionUser`（DB 照合・強制失効チェック）を通し、新トークンは DB の現在値から `refreshSessionCookie` で署名する（失効済み / ユーザー不在 → 401 + Cookie 削除）。旧トークンのクレームで再署名しないこと（失効済みトークンを有効トークンへ洗浄できてしまう）
- **JWT は身元証明（userId）だけに使い、status / role / name 等の権威は DB**。`resolveSessionUser`（`services/server/session/token.ts`）が JWT 検証後に DB から現在値を引いて `SessionUser` を組み立てる。管理画面でのステータス・ロール変更は次のリクエストで反映される。DB 障害時は null（安全側）
- **強制失効あり**: `invalidateSessionsForUser`（`services/server/sessionInvalidation.ts`）が `users.sessions_invalidated_at` を更新し、それより前に発行された JWT（`iat < sessions_invalidated_at`）を `resolveSessionUser` が拒否する。Firebase の ID トークンをセッションに替えるとき(`createFirebaseSession`・`register`)も、`auth_time`(その Firebase のセッションの認証時刻)が境目より前なら 401(Firebase の取り消しが失敗していても止まる。比較は `services/server/session/invalidationBoundary.ts` の 1 か所、検査 `pnpm test src/features/core/auth/services/server`)。Firebase のリフレッシュトークンも best-effort で revoke し、監査ログ `auth.session.invalidated` を残す。発火元はパスワード変更・`banned` / `security_locked` への遷移（user の update / changeStatus wrapper、ログインロックアウト）
- `getTokenOnlySession` は JWT クレームのみ（DB を引かない stale な値）。監査ログの actor 抽出やデモ判定など、**認可と無関係な高頻度処理専用**。認可には使わない
- JWT の署名・検証・Cookie 抽出の汎用部分は [lib/jwt](../../../lib/jwt/README.md)

### セッションを出す口（establishSession）

新しい認証手段（fork の LINE ログインなど）の route は、身元を確かめて DB の利用者の行を引いた後に `establishSession` だけを呼ぶ。状態の分岐・`SessionUser`・署名・Cookie を写さない（守りの写しは禁止）。

```ts
import { establishSession } from "@/features/core/auth/services/server/session/establishSession";

const response = NextResponse.json({ ok: true });
const { sessionUser, requiresReactivation, expiresAt } = await establishSession({
  cookies: response.cookies, // 応答の Cookie
  user,                      // DB の現在値の行（{ id, role, status, isDemo, providerType, providerUid, name }）
  ip,                        // ログインの記録に残す IP（省略可）
});
```

- 順番（変えない）: ① 状態の分岐 `assertSessionStatus`（`security_locked` / `pending` / `withdrawn` は 403、`inactive` は `requiresReactivation: true`、`suspended` / `banned` はセッションを出して画面が `/restricted` へ）→ ② `userService.updateLastAuthenticated`（最終ログイン・`metadata.loginHistory`・`user_login_events`・ロックアウトの数の解除）→ ③ `issueSessionToken`（`SessionUser` を組み立てて署名。既定の maxAge は `isDemo` でデモの短い時間 / 通常）→ ④ `issueSessionCookie`
- 拒否（403）なら何も書かない（最終ログインも Cookie も）。Cookie は分岐を通った後でしか出ないので迂回できない
- 退会者（`withdrawn`）は 403 = 上流の既定（戻るには仮登録 → 本登録の再登録の道）。さらに拒否の条件を足すのは fork の呼び手（`establishSession` の前で）
- 部品 2 つ（`services/server/session/sessionToken.ts`）: `assertSessionStatus(user)` と `issueSessionToken(user, { maxAge? })`。上流のログイン 5 か所（`firebaseSession`・`localLogin`・`demoLogin`・`registration`・`refreshSessionCookie`）もこれを使う（route が Cookie を書く形のため、route と service の戻り値は変えていない）。ローカルログインの状態の分岐は失敗の記録とロックアウトを伴う別の物
- メール / OAuth のログイン（`createFirebaseSession`）も最終ログインの更新は `updateLastAuthenticated`（他のログインと同じ。`user_login_events` に行が残り、成功でパスワードのロックアウトの数が消える）
- テスト: `pnpm test src/features/core/auth/services/server`

### 新しい認証手段の公開の口（契約表）

fork が上流に無いログインの方法を足すときに呼ぶ口。守りの処理を写さない（写しは禁止。足りない口は上流に /order）。

| 口 | 置き場（import） | 引数 → 戻り値 | tx | 失敗時 |
|------|------|------|------|------|
| `establishSession` | `@/features/core/auth/services/server/session/establishSession` | `{ cookies, user, ip? }` → `{ sessionUser, requiresReactivation, expiresAt }` | なし（最終ログインの更新は自分で書く） | `security_locked` / `pending` / `withdrawn` は 403 で何も書かない（[セッションを出す口](#セッションを出す口establishsession)） |
| `userService.createFromProvider` | `@/features/core/user/services/server/userService` | `{ providerType, providerUid, displayName, ip?, role?, tx? }` → `{ user, isNewUser, isRejoin }` | 呼び手の tx（savepoint）か自分の 1 つ。ログインの記録 signup は tx の後 | 無いロールは 400。同時の作成の unique 違反は引き直して既存を返す。他の DB エラーは投げる（[user README](../user/README.md#外部の認証の身元から作る口createfromprovider)） |
| `issueOAuthState` / `verifyOAuthState` | `@/lib/line` | `{ redirectAfter, cookieName? }` → `{ state, nonceCookie }` / `{ state, cookies, cookieName? }` → `{ ok, redirectAfter }` | なし | 照合の失敗は `{ ok: false }`（戻り先を信用せず `/` へ。cookie は呼び手が消す）（[lib/line README](../../../lib/line/README.md#oauth-の-state-と-nonce-cookieissueoauthstate--verifyoauthstate)） |
| 名前の部品（`sanitizeUserName`・`lockUserName`・`isUserNameTaken`・`findAvailableSuffixedUserName`・`withUserNameGuard`） | `@/features/core/user/entities/userName`・`@/features/core/user/services/server/helpers/nameAvailability` | 名前の整形・ロック・使用中の判定・空き名 | `lockUserName` は tx の中で（終わりまで保持） | `withUserNameGuard` は使用中で 409。普通は `createFromProvider` に任せる（[user README](../user/README.md#名前の公開の部品)） |

- 呼ぶ順: 身元の確認（fork）→ `createFromProvider` → `establishSession`（下の節）
- 口に入れない物: 招待コード・流入の記録・プロフィール・登録の後の milestone（`user_registered`）。要るなら呼び手が `isNewUser` のときに行う（milestone は `runPostRegistrationMilestones`、`services/server/postRegistrationMilestones.ts`）

### 新しい認証手段（身元の確認 → createFromProvider → establishSession）

fork が上流に無いログインの方法（LINE など）を足すときの組み方。守りの処理（状態の分岐・`SessionUser`・署名・利用者の作成・状態の履歴）は写さず、公開の口を順に呼ぶ。

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

// ③ セッションを出す（上の「セッションを出す口」）
const response = NextResponse.json({ ok: true, isNewUser });
await establishSession({ cookies: response.cookies, user, ip });
return response;
```

- providerType は `USER_PROVIDER_TYPES`（`user/constants/provider.ts`、users の enum）の値。`line` / `oidc` / `custom` などは既にある。無い種類は上流に /order（fork は enum を足さない）
- 退会者（`withdrawn`）の既定は上流の再登録の規則（`createFromProvider` が `active` に戻し、監査 `user.rejoined`）。断りたい fork は ② の前に `userService.findByProvider` で状態を見て、自分のエラーを返す
- fork 独自の監査名（`user.line_registered` など）は作らない: 作成の監査は口の `user.registered` / `user.rejoined`
- 招待コード・流入の記録・プロフィールは口に入れない。fork の呼び手が ② の後に行う

## ページの認可（proxy → 範囲の guard.ts → loader の access）

```
proxy (redirectProxy)  →  範囲の guard.ts(layout が guard() の 1 行)  →  _screen/loader.ts(createLoader の access)
URL ルール              ロール + ステータス + 行き先(親子 AND)          ページの access を評価してから取得、主体は ctx.user
```

1. **proxy** (`src/proxies/redirect.ts`): 受け口 `src/proxies/redirects/<名前>.ts` のルール（+ サインアップモードの内部ルール）で先制リダイレクト。セッション判定は `resolveSessionUser`
2. **範囲の guard.ts**（layout の隣。root は `src/app/guard.ts`）: 方針（access・allowStatuses・redirectTo・forbiddenRedirectTo・returnBack・statusRedirects・setupRedirectTo）を字面で書き、layout は `await guard()` の 1 行。子は最寄りの親の `extend` で作る（親子 AND、狭めるだけ）
   - upstream の範囲: `(user)/(protected)`（利用者・管理者カテゴリ、`/login`、status 別の行き先）/ `admin/(protected)`（管理者カテゴリ、`/admin/login`、管理者 0 人なら `/admin/setup`）/ その `users`（admin ロール、`/admin`）/ `debug`（管理者カテゴリ + debugger、`/login`）
   - setup 誘導の判定は auth の `hasUserForAccess(access)`（範囲の access を満たしうる利用者が 1 人以上いるか、真偽値だけ）を wiring が作り手に渡す。guard.ts には行き先の値だけ
3. **loader**: 最寄りの guard.ts の `createLoader({ access, key?, load })`。範囲の方針とページの access を取得前に評価し、主体は `load({ user })` の `user`（DB 同期、リクエスト内 1 回）。本人の列が要るなら `requireUserRecord(user, "/login")`（user のサービス）

結ぶのは `src/wiring/pageGuard.ts`（`lib/pageGuard` の汎用版 + auth の `pageGuardUserDeps` + `hasUserForAccess`）。書き方は [lib/pageGuard README](../../../lib/pageGuard/README.md) と [SCREENS §4](../../../lib/screens/README.md)。

- page.tsx・Screen・layout にガード・取得を書かない。表示用の利用者は client の `useAuthSession`、ページ本文は loader の DTO
- 利用できない status の利用者を案内する画面（`/restricted`・`/reactivate`）は root の public の loader に `allowStatuses` を書いて受ける（public の `user` は既定で利用可能な status だけ非 null）
- `getSessionUser` は `cache()` 経由で、範囲の guard・loader・API の Factory・AuthSessionProvider が同じリクエストで呼んでも DB 引きは 1 回

### 置き場所の検査（lint `page-authz`、全 Tier で error）

- **UI の場所はサーバーのデータを取らない**（`page-authz/layout-no-server-data`。名前は互換のため据え置き）: src/app の Screen・page.tsx・layout・`_layout/`・guard.ts・`_components/` の部品と `src/components`・`src/hooks`・features の components / hooks で、`services/server`・DB（`@/lib/drizzle`・`drizzle-orm` の値・`@/lib/firebase/server`・`firebase-admin`・`entities/drizzle` の表）を値で import しない。layout は loader も不可。型だけは可
  - 理由: UI で取ったデータは範囲の守りと loader の access を通った後のデータにならない。取得は loader へ集める
  - 名前付き例外は `AuthSessionProvider`（root layout の Provider。Cookie の解析とセッション解決）
- **セッション・ガード API をページ層・UI・API で import しない**（`page-authz/session-api-callsite`）: `getSessionUser`・`getTokenOnlySession`・`resolveSessionUser(FromTokenOnly)`・`parseSessionCookie`・削除済みの `authGuard`・`requireCurrentUser`・`requireAuthenticated`・`requireAdmin`（fork の古い import を止めるため名前は残す）・pairedDevice の `getSessionDevice`・`deviceGuard`・`requireCurrentDevice`・`principalGuard`・`requireCurrentPrincipal`
  - 対象: `src/app` 全体（page・Screen・layout・`_layout/`・loader・guard.ts・`_components/`・API の route と補助ファイル）と UI 側。許可の場所は無い（ページの主体は createLoader の `ctx.user`、API の主体は Factory の `ctx.user`）。`AuthSessionProvider` は名前付き例外
- データに届く wiring の import の場所（`pnpm test src/wiring/wiring.test.mjs`）・`@/lib/pageGuard` の値 import は wiring だけ（lint `import-boundaries/page-guard-via-wiring`）・features の index.ts は services/server を値で再 export しない（`import-boundaries/features-index-no-server-reexport`）
- 不採用の案: 下流（fork）では warn にする案（セキュリティの検査は所有で強さを変えない、前例 hidden-columns）
- 限界: 直接の import だけを見る。仕様の本文と判定は `eslint-rules/page-authz.mjs`、テストは `pnpm test eslint-rules/page-authz.test.mjs`

API ルート側の認可はファクトリーが構造的に強制する（`createDomainRoute` は serviceRegistry の `access`、`createApiRoute` は `access` 必須（public / authenticated / { roles, roleCategories } + allowStatuses）、本人データは `createMeRoute`）→ [routeFactory README](../../../lib/routeFactory/README.md)。主体はリクエストごとに 1 回だけ DB 同期の `getSessionUser` で解き（`apiRouteUserDeps`）、ハンドラには `ctx.user` で渡す。セッションの確認と再発行（`GET /api/auth/session`）は `session/refreshSessionResponse.ts`。

## クライアント側

- root layout (`src/app/layout.tsx`) の `AuthSessionProvider`（server）が Cookie を `resolveSessionUser` で解決し、`AuthSessionClientProvider` に初期値として渡す
- クライアントは `useAuthSession()` → `{ user, isAuthenticated, refreshSession }`。`refreshSession` は `GET /api/auth/session` を叩いて Context を更新（失敗時は user=null）。UI の表示切替（ログインボタン・ユーザー名）は Context だけを見る
- ログアウト: `useLogout` → `services/client/logout.ts` → `POST /api/auth/logout`（Cookie 削除）
- `AuthSessionClientProvider` は `useFirebaseAuthSync`（JWT はあるのに Firebase Auth が未サインインのとき `/api/auth/firebase-token` のカスタムトークンで再サインイン）と DAU 記録も担う
- 管理者ログイン: `AdminLogin` + `useAdminLogin` → `POST /api/auth/local/login`（admin カテゴリのみ、失敗は `loginAudit` で記録・ロックアウト判定）

## 公開 hook の契約表

認証の守り（reCAPTCHA・ID トークン・セッション更新・遷移）と form の処理は `hooks/` 直下の公開 hook が持ち、既定の部品は hook を呼んで描くだけ。fork が画面を作り替えるときは処理を写さず同じ hook を呼び、返る `form` を `AppForm` + 任意の markup（`FieldRenderer` 等）で描く。契約 = hook の名前・引数・戻り値・form の項目名（変えるときは notice）。

- `hooks/registration/`・`hooks/signup/` は公開 hook の内部（送信の流れ `submitFlow.ts` / `sendFlow.ts`・共通の送信 hook・formEntities）。`hooks/oauth/transition.ts`（OAuth の遷移の決め方）も内部。部品・fork はここを import しない
- 送信の流れの単体テスト: `pnpm test src/features/core/auth/hooks/`

### 本登録 form（`/signup/register`）

| hook | 引数 | form の項目名 |
| --- | --- | --- |
| `useEmailRegistrationForm()` | なし | `email`（localStorage の認証済みメール、読み取り専用）・`name`・`password`・`passwordConfirmation`（double モードのみ）・`role`・`profileData`・`inviteCode`・`agreeToTerms` |
| `useOAuthRegistrationForm()` | なし | `email`・`name`（provider のプロフィールで初期化）・`role`・`profileData`・`inviteCode`・`agreeToTerms` |

戻り値（2 本共通。Email は `passwordConfirmationRequired` が加わる）:

- `form`: `UseFormReturn<EmailRegistrationFormValues | OAuthRegistrationFormValues>`（zodResolver 済み。型は同じファイルから export）
- `onSubmit(values)`: `AppForm` の `onSubmit` に渡す。セッション確認（無し = 401 文言・Email はメール一致・OAuth は provider を検査）→ 未適用の招待コードなら止める → ID トークン + reCAPTCHA v3 で登録 → `refreshSession` → `/signup/complete` へ遷移（遷移ガード経由）
- `isLoading`: 登録 API の通信中
- `rootErrorMessage`: `form` の root エラー（`string | null`）。失敗の文言・429 silent の文言が入る
- `selectedRole` / `profiles`: `RoleProfileFields` に渡すロールとプロフィール設定
- `inviteCodeState`: `InviteCodeField` の `state`（`InviteCodeApplyState`）
- `recaptchaV2`: `{ open, siteKey, onClose, onVerify }`。v2 チャレンジが要求されたとき `RecaptchaV2Challenge` に渡す（`siteKey` が null の間は描かない）。v2 トークンを得ると保留中の内容で自動で再送する
- `rateLimitWarning`: `{ open, onOpenChange }`。429（silent でない）で開く `RateLimitWarningModal` 用
- `passwordConfirmationRequired`（Email のみ）: パスワード（確認）欄を出すか

### メール送信 form（`/signup` のメール入力・`/entry` の事前登録）

| hook | 引数 | form の項目名 |
| --- | --- | --- |
| `useVerificationEmailSendForm({ urlAfterEmailSent })` | `urlAfterEmailSent`: 送信後の遷移先 | `email` |
| `useEarlyRegistrationSendForm({ urlAfterEmailSent })` | 同上 | `email` |

戻り値（2 本共通。メール認証は `recaptchaV2` が加わる）:

- `form`: `UseFormReturn<EmailSendFormValues>`（zodResolver 済み。型は `useVerificationEmailSendForm` から export）
- `onSubmit(values)`: `AppForm` の `onSubmit` に渡す。登録済みのメールなら root エラーで止める → （メール認証のみ reCAPTCHA v3）→ メールアドレスを localStorage へ保存（本登録 form が読む）→ リンクを送信 → `urlAfterEmailSent` へ遷移
- `isSubmitting`: 送信中（事前登録は登録済み確認中も含む）
- `rootErrorMessage`: `form` の root エラー（`string | null`）。登録済み・送信失敗の文言
- `recaptchaV2`（メール認証のみ）: `{ open, siteKey, onClose, onVerify }`。`RecaptchaV2Challenge` に渡す。v2 トークンを得ると保留中のメールアドレスへ自動で再送する

### OAuth の登録・ログイン（`/signup/oauth`）

| hook | 引数 | 戻り値 |
| --- | --- | --- |
| `useOAuthSignupFlow({ provider, redirectTo })` | `provider?: UserProviderType`・`redirectTo?: string`（登録済みユーザーのログイン後の遷移先、既定 `"/"`） | `{ phase, requiresReactivation }` |

- 中で `useOAuthPhase`（認証の段階: initial / redirecting / processing / completed / alreadyRegistered / invalidProcess）を進め、段階が決まると移る: `completed` = `authConfig.signup.afterVerificationPath?method=thirdParty` へ遷移ガード経由 / `alreadyRegistered` + 休会中 = `/reactivate` へ置き換え / `alreadyRegistered` = 成功トースト「登録済みユーザーでログインしました」+ `redirectTo` へ置き換え
- 画面は `phase` ごとの表示（読み込み中・`InvalidProcessState`）だけを描く。`useOAuthPhase` は段階だけが要る呼び出し向けに残る（遷移はしない）

### 画面の処理（`/email/verify`・`/logout`・`/signup/complete`）

既定の `_screen` 部品はこの hook を呼んで描くだけ（部品は上流専用・約束なし、引数は足さない）。見た目や文言を変える fork は同じルートの `_components/` の Screen で hook を呼び、自分の markup で描く（処理は写さない）。

| hook | 引数 | 戻り値 |
| --- | --- | --- |
| `useEmailChangeVerification({ oobCode? })` | `oobCode?: string \| null`（省略 = URL の `?oobCode=` を読む。`null` = コードなし） | `{ phase, newEmail, error, loginHref }` |
| `useAutoLogout({ redirectTo })` | `redirectTo: string`（ログアウト後の遷移先。loader が内部パスに限定した値） | `{ isLoading, error, retry }` |
| `useSignupComplete()` | なし | `{ isChecking, isValidTransition }` |

- `useEmailChangeVerification`: `phase` = `initial` / `checking_auth` / `require_login` / `processing` / `completed` / `error`。ログイン済みなら確認コードの情報を引き → Firebase で変更を適用 → サーバーの DB を同期して `completed`。`loginHref` = `/login?returnTo=<今のパス + oobCode>`（未ログインのときのログインのリンク）。`error` は表示用の文言
- `useAutoLogout`: mount で 1 回だけ `useLogout` の logout を呼ぶ（StrictMode の 2 回目の effect でも 1 回）。成功で `redirectTo` へ置き換え。失敗は `error`（`HttpError | null`）に入り、`retry()` で呼び直す（手動のボタンは `LogoutButton` でもよい）
- `useSignupComplete`: 遷移の守り（`/signup/register` からのトークン付き遷移だけを通し、それ以外はエラー画面）と、正当な遷移でのサインアップ完了コンバージョン（mount あたり 1 回、env 未設定なら何もしない）。`isChecking` の間は読み込み中を描く
- 単体テスト: `pnpm test src/features/core/auth/hooks/`（`useEmailChangeVerification` / `useAutoLogout` / `useSignupComplete` の `.test.tsx`）

## 関連

- [user ドメイン](../user/README.md) — users テーブル、ステータス、ロール、表示名、ステータス履歴
- [lib/jwt](../../../lib/jwt/README.md) — JWT 署名・検証の汎用ラッパー
- [lib/routeFactory](../../../lib/routeFactory/README.md) — API ルートの認可
- [lib/screens](../../../lib/screens/README.md) — page / Screen / loader 構造
- [referral](../referral/README.md) / [userAcquisition](../userAcquisition/README.md) — 招待コード・流入経路
- [lib/firebase](../../../lib/firebase/README.md) — Firebase 設定・未設定モード
- [phoneVerification](../phoneVerification/README.md) — SMS 認証(電話番号の認証)(部品・hook・API `/api/phone-verification/*`)
