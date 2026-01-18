// src/app/(user)/(auth)/signup/layout.tsx

import { HideBottomNav } from "@/components/AppFrames/User/controls/BottomNavControl";
import { HideFooter } from "@/components/AppFrames/User/controls/FooterControl";

type SignupLayoutProps = {
  children: React.ReactNode;
};

export default function SignupLayout({ children }: SignupLayoutProps) {
  return (
    <>
      <HideBottomNav />
      <HideFooter sp />
      {children}
    </>
  );
}
