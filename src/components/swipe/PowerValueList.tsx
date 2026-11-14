"use client";

/**
 * Annual NASA POWER values with short EN/PL labels and display units (src/lib/format.ts).
 * The full POWER parameter name and the raw unit read from the response stay in the tooltip.
 */

import { useI18n } from "@/i18n/I18nProvider";
import { formatPowerValue } from "@/lib/format";
import { POWER_PARAMETERS, type PowerClimatology } from "@/lib/power";

export function PowerValueList({ data }: { data: PowerClimatology }) {
  const { t, lang } = useI18n();
  const params = POWER_PARAMETERS.filter((id) => data.parameters[id]);
  return (
    <dl className="space-y-1.5">
      {params.map((id) => {
        const p = data.parameters[id];
        const v = formatPowerValue(p.annual, p.units, lang);
        return (
          <div key={id} className="flex items-baseline justify-between gap-2 text-xs" title={`${p.longname} (${p.units}) · ${id}`}>
            <dt className="min-w-0 text-dim underline decoration-dotted underline-offset-2">{t(`scan.param.${id}`)}</dt>
            <dd className="shrink-0 text-right font-bold tabular-nums">
              {v.main}
              {v.extra && <span className="font-normal text-dim"> ({v.extra})</span>}
              <span className="font-normal text-dim"> · {t("scan.annual")}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
