import type { Metadata } from "next";
import "@/styles/global.css";
import { Toaster } from "sonner";
import { Suspense } from "react";

import { GlobalScreenLoader } from "@/components/Overlays/Loading/GlobalScreenLoader";
import { GlobalAppToast } from "@/components/Overlays/AppToast";
import { RouteTransitionOverlay } from "@/components/Overlays/Loading/RouteTransition";
import { ImageViewerProvider } from "@/components/Overlays/ImageViewer/Provider";
import { ViewportHeightWatcher } from "@/components/Fanctional/ViewportHeightWatcher";
import { FirebaseAnalytics } from "@/components/Fanctional/FirebaseAnalytics";
import { MicrosoftClarity } from "@/lib/clarity/MicrosoftClarity";
import { AuthSessionProvider } from "@/features/core/auth/components/AuthSessionProvider";
import { AdminCommandProvider } from "src/features/core/adminCommand";
import { RedirectToastProvider } from "@/lib/redirectToast";
import { businessConfig } from "@/config/business.config";

export const metadata: Metadata = {
  title: `${businessConfig.serviceNameShort} ${businessConfig.descriptionShort}`,
  description: businessConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />

      <body suppressHydrationWarning className="antialiased font-sans">
        <Suspense fallback={null}>
          <FirebaseAnalytics />
        </Suspense>
        <Suspense fallback={null}>
          <MicrosoftClarity />
        </Suspense>
        <ViewportHeightWatcher />
        <GlobalScreenLoader />
        <GlobalAppToast />
        <AuthSessionProvider>
          <AdminCommandProvider>
            <ImageViewerProvider>
              <RouteTransitionOverlay />
              {children}
            </ImageViewerProvider>
          </AdminCommandProvider>
        </AuthSessionProvider>
        <Toaster position="bottom-center" richColors />
        <RedirectToastProvider />
      </body>
    </html>
  );
}
