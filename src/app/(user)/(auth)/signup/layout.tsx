// src/app/(user)/(auth)/signup/layout.tsx
// 新規登録の流れの layout。枠の部位の出し入れは隣の frame.ts(この layout の下全部に効く)

type SignupLayoutProps = {
  children: React.ReactNode;
};

export default function SignupLayout({ children }: SignupLayoutProps) {
  return children;
}
