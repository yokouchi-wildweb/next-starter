import { HideHeaderNav, HideFooter, HideBottomNav } from "@/components/AppFrames/User/controls";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

export default function MaintenancePage() {
  return (
    <UserPage containerType="contentShell">
      <HideHeaderNav />
      <HideFooter />
      <HideBottomNav />
      <Stack space={8} className="text-center py-12">
        <UserPageTitle>ただいま準備中です</UserPageTitle>
        <Para tone="muted">
          現在サイトを準備しております。
        </Para>
        <Para tone="muted">
          サービス開始までしばらくお待ちください。
        </Para>
      </Stack>
    </UserPage>
  );
}
