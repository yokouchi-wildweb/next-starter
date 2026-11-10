// src/lib/mail/frame/index.ts

export { MAIL_FONT_FAMILY, MailFrame, type MailFrameProps } from "./MailFrame";
export {
  MailButton,
  MailDivider,
  MailFooter,
  MailHeader,
  MailHeading,
  MailInfoBox,
  MailNote,
  MailParagraph,
  MailUrl,
  type MailAlign,
  type MailInfoRow,
} from "./parts";
export { createMailParts, type MailParts } from "./createMailParts";
export type { MailTheme } from "./theme";
