# auth ドメイン

認証（誰であるか）とセッション、ページ/API の認可ガードを担う core ドメイン。ユーザー属性・ステータス・ロールの定義は [user ドメイン](../user/README.md) の責務で、auth はそれを「ログイン・登録・セッション・ガード」の文脈で使う。

## ディレクトリ構成

```
auth/
├── entities/            # session.ts (SessionUser / TokenPayload), schema.ts (登録スキーマ: user のスキーマを拡張), registration.ts, phoneVerification.ts
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
│   │   ├── localLogin.ts / firebaseSession.ts / demoLogin.ts / loginAudit.ts
│   │   ├── sendSignInLink.ts / sendEarlyRegistrationLink.ts / sendPasswordResetLink.ts / sendEmailChangeLink.ts
│   │   └── phoneVerification/   # 電話番号の重複チェック・OTP 検証
│   └── client/          # 各 /api/auth/* を呼ぶ ClientService (axios + normalizeHttpError)
├── hooks/               # useAuthSession, useLogout, usePreRegistration, useRegistration, oauth/* など
├── components/          # AuthSessionProvider 系, Signup / Verification / Registration / OAuth / UserLogin / AdminLogin / PhoneVerification 等
└── utils/               # password.ts (hash/verify), createOAuthProvider.ts など
```

API ルートは `src/app/api/auth/**`、画面は `src/app/(user)/(auth)/**`（login / signup / logout / reactivate / restricted / password / email 等）と `src/app/admin/login/`。

## アカウントとプロバイダの方針

- **プロバイダごとに独立したアカウント**。同じメールアドレス・氏名でも、登録経路（プロバイダ）が違えば別の `users` 行として扱い、**マージしない**。
- 利用者の識別キーは `(provider_type, provider_uid)`（`users_provider_type_uid_idx` で UNIQUE）。メールアドレスは識別キーではない。
- `provider_type` は Firebase Auth の `providerId` をそのまま採用（`google.com` / `yahoo.com` 等）。クライアント/サーバー間で追加マッピングが要らないため。値の一覧は `user/constants/provider.ts` (`USER_PROVIDER_TYPES`)。
  - `email`: Firebase Email Link 登録。`provider_uid` = Firebase UID
  - `local`: 管理画面で作るアカウント（管理者）。Firebase に依存せず、アプリでハッシュ化した `local_password` で認証
  - サードパーティ（Google / Yahoo! / Facebook / X(twitter.com) 等）: Firebase の `signInWithRedirect` 経由。有効化は `APP_FEATURES.auth.thirdPartyProviders`
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

- **サインアップの有効/モード**: `APP_FEATURES.auth.signup`。`enabled=false` で画面・API とも `/signup-closed` へ（Feature Gate: 規則 `src/proxies/featureGateRules/signup.ts`、詳細 `src/proxies/README.md`）。`mode="earlyRegistration"`（事前登録）では `/signup` → `/entry` にリダイレクトされ、`POST /api/auth/send-early-registration-link` を使う（`src/proxies/redirect.ts`）
- **招待コード**: `register` の `inviteCode` は「非空=その値を使う / `""`=明示的に辞退（cookie フォールバックしない）/ undefined=招待リンク cookie にフォールバック」。消し込みは `INVITE_CODE_REDEEM_SCOPE`（invite 種別のみ）で、失敗しても登録はブロックしない → [referral README](../referral/README.md#サインアップフロー統合)
- **流入経路**: 本登録時に attribution cookie から `recordSignupAcquisition`（bestEffort）→ [userAcquisition README](../userAcquisition/README.md)
- **表示名の検証・一意性**: `UserNameSchema` と `withUserNameGuard`（本登録の `activate` で適用）→ [user README 表示名節](../user/README.md#表示名--ユーザー名バリデーションと一意性)

## セッション

- **JWT のみのセッション**。セッションテーブルは持たない。Cookie 名は `__session`（`APP_FEATURES.auth.session.cookieName`。もともと Firebase Hosting が転送する唯一の Cookie 名に合わせたもの）。`SameSite=Lax` / `HttpOnly` / `Secure` / `path=/`（`constants/session.ts`）
- 有効期限は既定 7 日、デモユーザー 10 分（`APP_FEATURES.auth.session`）。`GET /api/auth/session` で再発行するローリングセッション。再発行も `resolveSessionUser`（DB 照合・強制失効チェック）を通し、新トークンは DB の現在値から `refreshSessionCookie` で署名する（失効済み / ユーザー不在 → 401 + Cookie 削除）。旧トークンのクレームで再署名しないこと（失効済みトークンを有効トークンへ洗浄できてしまう）
- **JWT は身元証明（userId）だけに使い、status / role / name 等の権威は DB**。`resolveSessionUser`（`services/server/session/token.ts`）が JWT 検証後に DB から現在値を引いて `SessionUser` を組み立てる。管理画面でのステータス・ロール変更は次のリクエストで反映される。DB 障害時は null（安全側）
- **強制失効あり**: `invalidateSessionsForUser`（`services/server/sessionInvalidation.ts`）が `users.sessions_invalidated_at` を更新し、それより前に発行された JWT（`iat < sessions_invalidated_at`）を `resolveSessionUser` が拒否する。Firebase のリフレッシュトークンも best-effort で revoke し、監査ログ `auth.session.invalidated` を残す。発火元はパスワード変更・`banned` / `security_locked` への遷移（user の update / changeStatus wrapper、ログインロックアウト）
- `getTokenOnlySession` は JWT クレームのみ（DB を引かない stale な値）。監査ログの actor 抽出やデモ判定など、**認可と無関係な高頻度処理専用**。認可には使わない
- JWT の署名・検証・Cookie 抽出の汎用部分は [lib/jwt](../../../lib/jwt/README.md)

## ページの認可（proxy → 範囲の guard.ts → loader の access）

```
proxy (redirectProxy)  →  範囲の guard.ts(layout が guard() の 1 行)  →  _screen/loader.ts(createLoader の access)
URL ルール              ロール + ステータス + 行き先(親子 AND)          ページの access を評価してから取得、主体は ctx.user
```

1. **proxy** (`src/proxies/redirect.ts`): `src/config/app/redirect.config.ts` のルール（+ サインアップモードの内部ルール）で先制リダイレクト。セッション判定は `resolveSessionUser`
2. **範囲の guard.ts**（layout の隣。root は `src/app/guard.ts`）: 方針（access・allowStatuses・redirectTo・forbiddenRedirectTo・returnBack・statusRedirects・setupRedirectTo）を字面で書き、layout は `await guard()` の 1 行。子は最寄りの親の `extend` で作る（親子 AND、狭めるだけ）
   - upstream の範囲: `(user)/(protected)`（利用者・管理者カテゴリ、`/login`、status 別の行き先）/ `admin/(protected)`（管理者カテゴリ、`/admin/login`、管理者 0 人なら `/admin/setup`）/ その `users`（admin ロール、`/admin`）/ `admin/insane`（admin ロール）/ `debug`（管理者カテゴリ + debugger、`/login`）
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
- データに届く wiring の import の場所（`pnpm test:wiring`）・`@/lib/pageGuard` の値 import は wiring だけ（lint `import-boundaries/page-guard-via-wiring`）・features の index.ts は services/server を値で再 export しない（`import-boundaries/features-index-no-server-reexport`）
- 不採用の案: 下流（fork）では warn にする案（セキュリティの検査は所有で強さを変えない、前例 hidden-columns）
- 限界: 直接の import だけを見る。仕様の本文と判定は `eslint-rules/page-authz.mjs`、テストは `pnpm test:page-authz-lint`

API ルート側の認可はファクトリーが構造的に強制する（`createDomainRoute` は serviceRegistry の `access`、`createApiRoute` は `access` 必須（public / authenticated / { roles, roleCategories } + allowStatuses）、本人データは `createMeRoute`）→ [routeFactory README](../../../lib/routeFactory/README.md)。主体はリクエストごとに 1 回だけ DB 同期の `getSessionUser` で解き（`apiRouteUserDeps`）、ハンドラには `ctx.user` で渡す。セッションの確認と再発行（`GET /api/auth/session`）は `session/refreshSessionResponse.ts`。

## クライアント側

- root layout (`src/app/layout.tsx`) の `AuthSessionProvider`（server）が Cookie を `resolveSessionUser` で解決し、`AuthSessionClientProvider` に初期値として渡す
- クライアントは `useAuthSession()` → `{ user, isAuthenticated, refreshSession }`。`refreshSession` は `GET /api/auth/session` を叩いて Context を更新（失敗時は user=null）。UI の表示切替（ログインボタン・ユーザー名）は Context だけを見る
- ログアウト: `useLogout` → `services/client/logout.ts` → `POST /api/auth/logout`（Cookie 削除）
- `AuthSessionClientProvider` は `useFirebaseAuthSync`（JWT はあるのに Firebase Auth が未サインインのとき `/api/auth/firebase-token` のカスタムトークンで再サインイン）と DAU 記録も担う
- 管理者ログイン: `AdminLogin` + `useAdminLogin` → `POST /api/auth/local/login`（admin カテゴリのみ、失敗は `loginAudit` で記録・ロックアウト判定）

## 関連

- [user ドメイン](../user/README.md) — users テーブル、ステータス、ロール、表示名、ステータス履歴
- [lib/jwt](../../../lib/jwt/README.md) — JWT 署名・検証の汎用ラッパー
- [lib/routeFactory](../../../lib/routeFactory/README.md) — API ルートの認可
- [lib/screens](../../../lib/screens/README.md) — page / Screen / loader 構造
- [referral](../referral/README.md) / [userAcquisition](../userAcquisition/README.md) — 招待コード・流入経路
- [lib/firebase](../../../lib/firebase/README.md) — Firebase 設定・未設定モード
- [PhoneVerification](./components/PhoneVerification/README.md) — 電話番号 SMS 認証コンポーネント
