// src/app/(user)/login/page.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Main, PageTitle, Section } from "@/components/TextBlocks";
import { UserLogin } from "@/features/auth/components/UserLogin";

export default function UserLoginPage() {
  return (
    <Main variant="narrowStack">
      <Flex direction="column" justify="center" align="center">
        <Block className="w-full" space="md">
          <Section as="header">
            <PageTitle>ログイン</PageTitle>
          </Section>
          <UserLogin />
        </Block>
      </Flex>
    </Main>
  );
}
