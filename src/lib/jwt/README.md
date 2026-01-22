# JWT ユーティリティの使い方

`src/lib/jwt` では、JWT の署名・検証・Cookie 抽出を行うための薄いラッパーを提供しています。ドメイン固有のスキーマを注入できるように汎用 API として実装されているため、利用側でクレームの正規化を行ってください。

## 1. 署名（signUserToken）

```ts
import { signUserToken } from "@/lib/jwt";
import { SessionUserSchema } from "@/features/auth/entities/session";

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

`signUserToken` は `subject` と任意の `claims` を受け取り、署名済み JWT と `expiresAt`（`Date`）を返します。`claims` はそのままペイロードに含まれるので、ドメイン固有の情報を自由に追加できます。

## 2. 検証（verifyUserToken）

```ts
import { verifyUserToken } from "@/lib/jwt";
import { SessionUserSchema, TokenPayloadSchema } from "@/features/auth/entities/session";

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

`verifyUserToken` は署名検証と有効期限チェックを行い、`claimsParser` を通じてドメイン固有の型へ正規化した結果を返します。`claimsParser` が `null` を返すとトークンは無効扱いになるため、検証エラーやスキーマ不一致時には `null` を返してください。

## 3. Cookie からの取得（parseSessionCookie）

`parseSessionCookie` は `RequestCookies` / `ResponseCookies` からセッショントークン値を取得するためのヘルパーです。Next.js の API ルートやミドルウェアからトークンを読み出す際に利用できます。
