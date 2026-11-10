// src/lib/mail/webhooks/index.ts

export {
  MailWebhookVerifyError,
  type MailWebhookEvent,
  type MailWebhookEventType,
  type MailWebhookVerifyFailure,
  type WebhookHeaders,
  type WebhookRawBody,
} from "./types";
export {
  normalizeResendWebhook,
  verifyResendWebhook,
  type ResendWebhookPayload,
  type VerifiedResendWebhook,
  type VerifyResendWebhookParams,
} from "./resend";
export {
  SENDGRID_SIGNATURE_HEADER,
  SENDGRID_TIMESTAMP_HEADER,
  normalizeSendGridWebhook,
  verifySendGridWebhook,
  type SendGridWebhookEvent,
  type VerifySendGridWebhookParams,
} from "./sendgrid";
