// src/components/AppFrames/User/Layout/UserPage.tsx

import { Main, type MainProps } from "@/components/TextBlocks";

export type UserPageProps = MainProps;

export function UserPage({ children, ...props }: UserPageProps) {
  return <Main {...props}>{children}</Main>;
}
