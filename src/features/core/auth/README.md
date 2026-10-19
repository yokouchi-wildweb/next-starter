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
│   │   ├── authorization.ts     # authGuard (SSR layout / loader 用ガード)
│   │   ├── requireRole.ts       # requireAuthenticated / requireAdmin (カスタム API ルート用ガード)
│   │   ├── apiAccess.ts         # evaluateApiAccessRule (createDomainRoute のアクセス評価)
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

- **サインアップの有効/モード**: `APP_FEATURES.auth.signup`。`enabled=false` で画面・API とも `/signup-closed` へ（`src/proxies/featureGate.ts`）。`mode="earlyRegistration"`（事前登録）では `/signup` → `/entry` にリダイレクトされ、`POST /api/auth/send-early-registration-link` を使う（`src/proxies/redirect.ts`）
- **招待コード**: `register` の `inviteCode` は「非空=その値を使う / `""`=明示的に辞退（cookie フォールバックしない）/ undefined=招待リンク cookie にフォールバック」。消し込みは `INVITE_CODE_REDEEM_SCOPE`（invite 種別のみ）で、失敗しても登録はブロックしない → [referral README](../referral/README.md#サインアップフロー統合)
- **流入経路**: 本登録時に attribution cookie から `recordSignupAcquisition`（bestEffort）→ [userAcquisition README](../userAcquisition/README.md)
- **表示名の検証・一意性**: `UserNameSchema` と `withUserNameGuard`（本登録の `activate` で適用）→ [user README 表示名節](../user/README.md#表示名--ユーザー名バリデーションと一意性)

## セッション

- **JWT のみのセッション**。セッションテーブルは持たない。Cookie 名は `__session`（`APP_FEATURES.auth.session.cookieName`。もともと Firebase Hosting が転送する唯一の Cookie 名に合わせたもの）。`SameSite=Lax` / `HttpOnly` / `Secure` / `path=/`（`constants/session.ts`）
- 有効期限は既定 7 日、デモユーザー 10 分（`APP_FEATURES.auth.session`）。`GET /api/auth/session` で再発行するローリングセッション
- **JWT は身元証明（userId）だけに使い、status / role / name 等の権威は DB**。`resolveSessionUser`（`services/server/session/token.ts`）が JWT 検証後に DB から現在値を引いて `SessionUser` を組み立てる。管理画面でのステータス・ロール変更は次のリクエストで反映される。DB 障害時は null（安全側）
- **強制失効あり**: `invalidateSessionsForUser`（`services/server/sessionInvalidation.ts`）が `users.sessions_invalidated_at` を更新し、それより前に発行された JWT（`iat < sessions_invalidated_at`）を `resolveSessionUser` が拒否する。Firebase のリフレッシュトークンも best-effort で revoke し、監査ログ `auth.session.invalidated` を残す。発火元はパスワード変更・`banned` / `security_locked` への遷移（user の update / changeStatus wrapper、ログインロックアウト）
- `getTokenOnlySession` は JWT クレームのみ（DB を引かない stale な値）。監査ログの actor 抽出やデモ判定など、**認可と無関係な高頻度処理専用**。認可には使わない
- 既知の制約: `GET /api/auth/session` は現状 JWT クレームのみで再発行しており、DB 同期・`sessions_invalidated_at` の照合を通らない
- JWT の署名・検証・Cookie 抽出の汎用部分は [lib/jwt](../../../lib/jwt/README.md)

## 認可ガードの 3 層

```
proxy (redirectProxy)  →  layout (authGuard)  →  _screen/loader.ts (requireCurrentUser)
URL ルール              ロール + ステータス       自分のレコードを DB から取得
```

1. **proxy** (`src/proxies/redirect.ts`): `src/config/app/redirect.config.ts` のルール（+ サインアップモードの内部ルール）で先制リダイレクト。セッション判定は `resolveSessionUser`
2. **layout** (`authGuard`, `services/server/authorization.ts`): ルートグループ単位で掛ける。配下のページは自前でガードしない
   - `allowRoles`: 許可ロール。不一致は `redirectTo` へ
   - `allowStatuses`: 許可ステータス。省略時 `USER_AVAILABLE_STATUSES`（= active のみ）
   - `redirectTo`: 未認証・権限不足時の遷移先（未指定なら redirect せず null を返す）
   - `returnBack`: true なら `redirectTo?returnTo=<現在のパス>`（パスは proxy が付ける `x-pathname`）。ログイン画面の loader が内部パスに限定して遷移先に使う
   - `statusRedirects`: ステータス別の遷移先（`redirectTo` より優先、returnTo なし）。例: `(user)/(protected)/layout.tsx` は inactive → `/reactivate`、suspended / banned / security_locked → `/restricted`、pending / withdrawn → `/logout?redirectTo=/signup`
   - 適用箇所: `admin/(protected)` と `admin/insane`（admin ロール、`/admin/login`）、`(user)/(protected)`（`/login`）、`debug/`（admin カテゴリ + debugger、`/login`）
3. **loader** (`requireCurrentUser`, `user/services/server/resolvers/requireCurrentUser.ts`): セッションの userId で自分の `users` レコードを取得する。`cache()` でリクエスト内 1 回。`behavior`: 省略時 `throw` / `"redirect"`（`redirectTo` 必須）/ `"notFound"` / `"returnNull"`

```ts
// src/app/(user)/(protected)/<route>/_screen/loader.ts
import "server-only";
import { cache } from "react";
import { requireCurrentUser } from "@/features/core/user/services/server/resolvers/requireCurrentUser";

const resolveXxxScreen = cache(async () => {
  // redirectTo はグループ layout の authGuard と同じリテラル
  const user = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
  return { /* 最小 DTO */ };
});
```

使い分けのルール（[SCREENS](../../../lib/screens/README.md)）:

- page.tsx にガード・取得を書かない（1 行スイッチ）。ユーザー取得は `_screen/loader.ts` で行う
- `(protected)` 配下の loader は `requireCurrentUser` のみ。`getSessionUser`（nullable）は公開ルートでの任意のパーソナライズ用で、`(protected)` 配下に「未ログインなら既定値」分岐を書かない（layout が既に弾いている）
- `(protected)` の外でログイン状態を見て遷移する画面（login / restricted / reactivate）は loader で `getSessionUser` を使って自分で redirect する
- `getSessionUser` / `authGuard` / `requireCurrentUser` はいずれも `cache()` 経由で、同一リクエスト内の DB 引きは 1 回にまとまる

API ルート側の認可はファクトリーが構造的に強制する（`createDomainRoute` は serviceRegistry の `access` → `evaluateApiAccessRule`、`createApiRoute` は `access` 必須、`access:"custom"` はハンドラ内で `requireAuthenticated` / `requireAdmin`、本人データは `createMeRoute`）→ [routeFactory README](../../../lib/routeFactory/README.md)。いずれも DB 同期の `getSessionUser` で判定する。

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
