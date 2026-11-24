# DOWNSTREAM NOTICE id:20261124-172715-unconfigured-code
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:g2/20261124-161115/junction | commit:- (this commit)
date: 2026-11-24T17:27:15+09:00
severity: info
checkpoint: unconfigured-code
change: (1) routeFactory (createApiRoute's catch, after DomainError, before the generic 500) maps BackendNoneSelectedError (a port selected "none" was called) to 501 { message: "この機能は利用できません", code: "backend_not_selected" } and any other BackendNotConfiguredError (DB, Firebase, Storage, mail keys …) to 500 { message: "サーバーでエラーが発生しました", code: "backend_not_configured" }; port / implementation / missing never reach the body (the server log keeps them); the messaging webhook still answers 503 webhook_not_configured (its handler catches first); (2) @/lib/errors gains BACKEND_NOT_CONFIGURED_CODE, BACKEND_NOT_SELECTED_CODE, isBackendNotConfiguredResponse, isBackendNotSelectedResponse (read the response code like isMaintenanceError)
why: an unconfigured backend's API answer now carries a machine-readable code (status 500 unchanged) and a "none" port answers 501; screens may tell them apart; no fork work required
required_actions: none
verify: -
manual_steps: -
refs: docs/!must-read/エラーハンドリング方針.md; src/lib/errors/README.md; src/lib/routeFactory/README.md; .claude/rules/items/lib/errors.md; .claude/rules/items/lib/routeFactory.md; .claude/rules/core/backends.md unconfigured
notes: key table: no key of CLAUDE.md / core / cards renamed or removed | a screen that wants its own text for these reads the code with isBackendNotConfiguredResponse / isBackendNotSelectedResponse (from the HttpError its hook gets); err(error, fallback) keeps working as before | RFC 9457 problem+json is not adopted here (left to the owner of the error shape)
