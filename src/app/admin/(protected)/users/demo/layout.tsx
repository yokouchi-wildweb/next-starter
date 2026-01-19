// src/app/admin/(protected)/users/demo/layout.tsx

import { notFound } from "next/navigation";
import { APP_FEATURES } from "@/config/app/app-features.config";

type Props = {
  children: React.ReactNode;
};

export default function DemoUserLayout({ children }: Props) {
  if (!APP_FEATURES.adminConsole.enableDemoUser) {
    notFound();
  }

  return <>{children}</>;
}
