"use client";

/**
 * About & credits: data credits (src/data/credits.ts — Earth datasets, planetary missions + the
 * publications behind their values), the source repo, and the AI disclosure (same text as
 * docs/AI_DISCLOSURE.md). Opened from the Report tab and the desktop footer.
 */

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { EARTH_CREDITS, PLANETARY_CREDITS, type Credit } from "@/data/credits";
import { REPO_URL } from "@/data/project";
import { getSource } from "@/data/sources";
import { useI18n } from "@/i18n/I18nProvider";

export const AI_DISCLOSURE_URL = `${REPO_URL}/blob/main/docs/AI_DISCLOSURE.md`;

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-phosphor">
      {children}
      <ExternalLink aria-hidden size={10} className="ml-1 inline align-baseline" />
    </a>
  );
}

function CreditList({ items }: { items: Credit[] }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-2.5">
      {items.map((c) => (
        <li key={c.id} className="text-xs leading-snug">
          <p className="font-bold text-fg">
            {c.url ? <Ext href={c.url}>{c.name}</Ext> : c.name}
          </p>
          <p className="text-[11px] text-dim">
            {c.by} · {t(c.roleKey)}
          </p>
          {c.papers && c.papers.length > 0 && (
            <p className="mt-0.5 text-[11px] text-dim">
              {t("about.papers")}:{" "}
              {c.papers.map((id, i) => {
                const s = getSource(id);
                if (!s) return null;
                return (
                  <span key={id}>
                    {i > 0 && "; "}
                    {s.url ? <Ext href={s.url}>{s.publisher}</Ext> : s.publisher}
                  </span>
                );
              })}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

const H = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-dim">{children}</h3>
);

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} titleId="about-title" title={t("about.title")} closeLabel={t("breakdown.close")}>
      <div className="space-y-5">
        <p className="text-xs leading-relaxed">{t("about.intro")}</p>

        <section aria-labelledby="about-ai" className="rounded-control border border-amber/50 p-3">
          <h3 id="about-ai" className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-dim">
            {t("about.aiTitle")}
          </h3>
          <p className="text-xs leading-relaxed">{t("about.ai")}</p>
          <p className="mt-2 text-[11px]">
            <Ext href={AI_DISCLOSURE_URL}>{t("about.aiDoc")}</Ext>
          </p>
        </section>

        <section>
          <H>{t("about.earthTitle")}</H>
          <CreditList items={EARTH_CREDITS} />
        </section>

        <section>
          <H>{t("about.planetTitle")}</H>
          <CreditList items={PLANETARY_CREDITS} />
        </section>

        <section>
          <H>{t("about.repoTitle")}</H>
          <p className="text-xs">
            <Ext href={REPO_URL}>{t("about.repo")}</Ext>
          </p>
        </section>
      </div>
    </Sheet>
  );
}
