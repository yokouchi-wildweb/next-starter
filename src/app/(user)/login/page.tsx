// src/app/(user)/login/page.tsx

import { Flex } from "@/components/Layout/Flex";
import { Main, PageTitle, Section } from "@/components/TextBlocks";
import { UserLogin } from "@/features/auth/components/UserLogin";

export default function UserLoginPage() {
  return (
    <Main variant="narrowStack">
      <Flex
        direction="column"
        justify="center"
        align="center"
        space="md"
        className="mx-auto w-full"
      >
        <Section as="header" className="w-full">
          <PageTitle>ログイン</PageTitle>
        </Section>
        <UserLogin />
      </Flex>
    </Main>
  );
}
