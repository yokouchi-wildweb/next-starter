// src/features/core/messaging/services/server/sendMessage/errors.ts

/** 冪等の鍵の重複(回の INSERT の UNIQUE 違反)。送る口が 409 の DomainError に替える */
export class MessageIdempotencyConflict extends Error {
  constructor() {
    super("message idempotency key conflict");
    this.name = "MessageIdempotencyConflict";
  }
}
