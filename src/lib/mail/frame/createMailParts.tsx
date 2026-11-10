// src/lib/mail/frame/createMailParts.tsx
//
// 色(theme)を束ねたメールの部品を作る。部品ごとに theme を渡す手間を省くだけで、React の context は使わない
// (メールはサーバーで描く。サーバーの module から読まれる lib に createContext を置くと Next の build が落ちる)。

import type { ComponentProps } from "react";

import { MailFrame } from "./MailFrame";
import {
  MailButton,
  MailDivider,
  MailFooter,
  MailHeader,
  MailHeading,
  MailInfoBox,
  MailNote,
  MailParagraph,
  MailUrl,
} from "./parts";
import type { MailTheme } from "./theme";

/** 部品の props から theme を除いた物 */
type WithoutTheme<P> = Omit<P, "theme">;

/**
 * @example
 * ```tsx
 * const m = createMailParts(mailTheme);
 * <m.Frame preview="確認">
 *   <m.Heading>メールアドレスの確認</m.Heading>
 *   <m.Button href={url}>確認する</m.Button>
 * </m.Frame>
 * ```
 */
export function createMailParts(theme: MailTheme) {
  return {
    theme,
    Frame: (props: WithoutTheme<ComponentProps<typeof MailFrame>>) => <MailFrame theme={theme} {...props} />,
    Heading: (props: WithoutTheme<ComponentProps<typeof MailHeading>>) => <MailHeading theme={theme} {...props} />,
    Paragraph: (props: WithoutTheme<ComponentProps<typeof MailParagraph>>) => <MailParagraph theme={theme} {...props} />,
    Button: (props: WithoutTheme<ComponentProps<typeof MailButton>>) => <MailButton theme={theme} {...props} />,
    Url: (props: WithoutTheme<ComponentProps<typeof MailUrl>>) => <MailUrl theme={theme} {...props} />,
    Note: (props: WithoutTheme<ComponentProps<typeof MailNote>>) => <MailNote theme={theme} {...props} />,
    Footer: (props: WithoutTheme<ComponentProps<typeof MailFooter>>) => <MailFooter theme={theme} {...props} />,
    Divider: (props: WithoutTheme<ComponentProps<typeof MailDivider>>) => <MailDivider theme={theme} {...props} />,
    Header: (props: WithoutTheme<ComponentProps<typeof MailHeader>>) => <MailHeader theme={theme} {...props} />,
    InfoBox: (props: WithoutTheme<ComponentProps<typeof MailInfoBox>>) => <MailInfoBox theme={theme} {...props} />,
  };
}

export type MailParts = ReturnType<typeof createMailParts>;
