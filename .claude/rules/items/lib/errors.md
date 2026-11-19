---
paths:
  - "src/lib/errors/**"
---
# lib/errors
what: the shared error types: DomainError on the server, HttpError on the client, and normalizeHttpError / err / createHttpError / getErrorCode / getErrorDetails, entry @/lib/errors
use: always
change: none → /order <direct parent>
rules:
using:
- domain_error_place: → core/services.md domain_error
- domain_error_message: the message is shown to the user as is (Japanese, says what to do next) | text the user must see goes in a DomainError (any other error becomes a generic 500)
- error_code_branch: the client branches on `code` (getErrorCode), never on the message text
- client_non_http: a client failure without HTTP (SDK, browser API, client validation) → createHttpError
- error_details_check: the caller validates the shape of getErrorDetails
editing: none of its own (the error flow is CLAUDE.md ARCHITECTURE errors)
read: throw and show errors → Usage | functions and options → API | app-wide hooks, dev warnings → Internals
