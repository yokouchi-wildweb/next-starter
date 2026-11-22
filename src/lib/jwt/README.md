# JWT ユーティリティ

## Overview

- JWT の署名・検証・Cookie 抽出の薄いラッパー。入口 `@/lib/jwt`
- ドメイン固有のスキーマを注入する汎用 API なので、クレームの正規化は呼び手が行う
- 使う時・直す時の決まりは札 .claude/rules/items/lib/jwt.md にある。この README は使い方と仕組み
- 呼び手は auth のセッションの層(`src/domains/core/auth/services/server/session/` など)。API ルートの主体は Factory の `ctx.user`(CLAUDE.md API_ROUTES principal)

## Usage

### 署名

```ts
import { signUserToken } from "@/lib/jwt";
import { SessionUserSchema } from "@/domains/auth/entities/session";

const sessionUser = SessionUserSchema.parse({
  userId: "user_123",
  role: "admin",
  status: "active",
  providerType: "local",
  providerUid: "user_123",
  name: "管理者ユーザー",
});

const { token, expiresAt } = await signUserToken({
  subject: sessionUser.userId,
  claims: {
    role: sessionUser.role,
    status: sessionUser.status,
    providerType: sessionUser.providerType,
    providerUid: sessionUser.providerUid,
    name: sessionUser.name,
  },
});
```

### 検証

```ts
import { verifyUserToken } from "@/lib/jwt";
import { SessionUserSchema, TokenPayloadSchema } from "@/domains/auth/entities/session";

const result = await verifyUserToken(token, {
  claimsParser: (claims) => {
    const candidate = {
      ...claims,
      sub: claims.sub ?? "",
    };

    const parsed = TokenPayloadSchema.safeParse(candidate);

    if (!parsed.success) {
      return null;
    }

    return SessionUserSchema.parse({
      userId: parsed.data.sub,
      role: parsed.data.role,
      status: parsed.data.status,
      providerType: parsed.data.providerType,
      providerUid: parsed.data.providerUid,
      name: parsed.data.name ?? null,
    });
  },
});

if (result) {
  console.log(result.subject); // => "user_123"
  console.log(result.claims);  // => SessionUser 型
}
```

## API

- `signUserToken({ subject, claims, options? })` → `{ token, expiresAt, payload }`(`expiresAt` は `Date`)。`claims` はそのままペイロードに入るので、ドメイン固有の情報を足せる。`options.maxAge`(秒、既定 `SESSION_DEFAULT_MAX_AGE_SECONDS`)・`options.issuedAt`
- `verifyUserToken(token, { claimsParser?, currentDate? })` → `{ subject, claims, expiresAt } | null`。署名と有効期限を確かめ、`claimsParser` でドメイン固有の型へ正規化した結果を返す。`claimsParser` が `null` を返すとトークンは無効。token が空・検証の失敗も `null`(投げない)
- `parseSessionCookie(source, cookieName?)` → Cookie ヘッダーの文字列か `RequestCookies` / `ResponseCookies` 相当からセッショントークン値を取り出す(無ければ `null`)
- `getAuthJwtSecret()` → 署名の鍵。環境変数 `AUTH_JWT_SECRET` を読み、空なら投げる(1 プロセスで覚える)
- 定数: `SESSION_COOKIE_NAME`・`SESSION_DEFAULT_MAX_AGE_SECONDS`(設定の値)・`SESSION_JWT_ALGORITHM`(`"HS256"`)
- 型: `SignUserTokenParams` / `SignUserTokenOptions` / `SignUserTokenResult` / `VerifyUserTokenOptions` / `VerifyUserTokenResult` / `SessionTokenClaims`・`JwtConfig` / `JwtOverride`

## Extension

- 上書き `src/config/lib/jwt.config.ts`(`@lib-config/jwt`): `cookieName`(既定 `"__session"`)・`defaultMaxAgeSeconds`(既定 7 日)。キーと既定は `config.ts`

## Related

- セッションの読み方: `src/domains/core/auth/README.md`
