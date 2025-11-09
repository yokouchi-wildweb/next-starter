import type { ReactNode } from "react";

import { Flex } from "@/components/Layout/Flex";

import { UserNavigation } from "./navigation";

export type UserAppLayoutProps = {
  readonly children: ReactNode;
};

export const UserAppLayout = ({ children }: UserAppLayoutProps) => (
  <Flex
    direction="column"
    minHeight="screen"
    className="my-0 bg-background text-foreground"
  >
    <UserNavigation />
    <div className="flex-1">{children}</div>
  </Flex>
);
