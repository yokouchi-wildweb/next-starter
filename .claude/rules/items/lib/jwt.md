---
paths:
  - "src/lib/jwt/**"
  - "src/config/lib/jwt.config.ts"
---
# lib/jwt
what: thin wrappers to sign and verify user JWTs and read the session cookie, generic over injected claim schemas | entry @/lib/jwt (signUserToken, verifyUserToken, parseSessionCookie, SESSION_COOKIE_NAME, SESSION_DEFAULT_MAX_AGE_SECONDS)
use: always
change: placement → src/config/lib/jwt.config.ts (@lib-config/jwt: cookieName, defaultMaxAgeSeconds)
rules:
using:
- jwt_claims_parser: verifyUserToken always gets a claimsParser that normalizes to the domain type and returns null on a verify error or schema mismatch (null = invalid token)
- jwt_caller: the auth session layer calls this lib | routes take the principal from ctx.user, never parse the cookie themselves (CLAUDE.md API_ROUTES principal)
editing:
- jwt_generic: the lib holds no domain schema | claim shapes come from the caller
read: sign, verify examples → Usage | functions, constants → API | cookie name, max age → Extension | session reading → Related
