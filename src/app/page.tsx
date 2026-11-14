import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { I18nProvider } from "@/i18n/I18nProvider";
import { MissionProvider } from "@/state/MissionContext";

/**
 * The providers read localStorage and the URL query on their first render (`use(browser())`),
 * so the prerendered HTML is this boot screen and the app renders in the browser.
 */
function BootScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg font-mono text-phosphor">
      <p className="cursor-blink text-glow text-lg font-bold tracking-widest">P.U.R.R.</p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<BootScreen />}>
      <I18nProvider>
        <MissionProvider>
          <AppShell />
        </MissionProvider>
      </I18nProvider>
    </Suspense>
  );
}
