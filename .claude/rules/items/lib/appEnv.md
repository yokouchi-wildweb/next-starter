---
paths:
  - "src/lib/appEnv/**"
---
# lib/appEnv
what: the single reader of the stage APP_ENV (development | staging | production) | entry @/lib/appEnv (getAppEnv, isDevelopment, isStaging, isProduction, parseAppEnv, test helpers withAppEnv / setAppEnv)
use: always
change: none → /order <direct parent>
rules:
using:
- app_env_reader: every stage decision goes through @/lib/appEnv | process.env.APP_ENV / NODE_ENV are read only inside this folder (lint app-env/single-reader: error in Tier1, warn in forks)
- app_env_no_node_env: NODE_ENV never drives a project rule and is never written to an env file
- app_env_env_files: .env.development and .env.production both exist, each with one `APP_ENV=<stage>` line, on separate DBs
- app_env_dev_aid: development aids open on isDevelopment() only (staging sides with production) | production-only behavior picks !isDevelopment() or isProduction() by meaning
- app_env_cookie_secure: session and device-token cookies are always `secure: true` (SESSION_COOKIE_BASE_OPTIONS), other cookies `secure: !isDevelopment()`, never NODE_ENV | an upstream cookie writer is also added to COOKIE_WRITERS (a fork does not) | a place that only passes an ISSUERS tool's cookie (issueOAuthState's nonceCookie) to cookies.set is listed nowhere
- app_env_client_literal: client code reads the literal `process.env.APP_ENV`, never by destructuring
- app_env_not_build: a decision that only means "dev server or build" (HMR and the like) is not split by stage
editing:
- app_env_safe_default: a missing or unknown value parses to production | getAppEnv reads on every call, never cached
read: calls, which check to use, env files → Usage | functions → API | build embedding, cookie forms, lint → Internals | tests → Verification
