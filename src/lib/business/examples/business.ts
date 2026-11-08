// src/lib/business/examples/business.ts
// 事業の素性の例の値(上流の物、fork は編集しない)。src/business/business.ts が source: "sample" の間、@/business はこの値を返す。
// 自分の値にするときは pnpm ops business from-example(この値を写して own にする)か pnpm ops business blank(空の欄で own にする)。
// 変えたら examples/CHANGELOG.md に 1 行書く

import type { BusinessValues } from "../types";

export const EXAMPLE_BUSINESS: BusinessValues = {
  serviceName: "next-starter",
  serviceNameShort: "next-starter",
  description: "next-starter is a Wildweb creation.",
  descriptionShort: "a Wildweb creation.",
  domain: "example.com",
  url: "https://example.com",
  launchedAt: "20XX年X月X日",
  company: {
    name: "Wildweb Tokyo",
    representative: "代表者名",
    postalCode: "〒000-0000",
    address: "東京都○○区○○1-2-3",
    phone: "03-0000-0000",
    email: "support@example.com",
  },
  logo: {
    variants: {
      default: "logos/default.png",
      light: "logos/light.png",
      dark: "logos/dark.png",
      primary: "logos/primary.png",
      secondary: "logos/secondary.png",
      mono: "logos/mono.png",
    },
    defaultVariant: "default",
  },
  mail: {
    defaultFrom: "noreply@example.com",
    defaultFromName: "next-starter",
  },
};
