"use client";

import { useI18n } from "@/i18n/I18nProvider";

/** Red banner shown whenever dev fixture data is in use (ground rule 2). Styling refined in Phase 2. */
export function FixtureBanner({ visible }: { visible: boolean }) {
  const { t } = useI18n();
  if (!visible) return null;
  return (
    <div role="alert" className="bg-red-700 px-3 py-1 text-center font-mono text-sm font-bold text-white">
      {t("fixture.banner")}
    </div>
  );
}
