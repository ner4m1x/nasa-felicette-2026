/**
 * Small data-quality note for cards whose NDVI was imputed by the pipeline (deck.schema.json
 * `ndviImputed`): no MODIS coverage at the site, so NDVI was set from a non-vegetated land cover.
 * Renders nothing unless `imputed` is exactly true. Shown on the card face and in the breakdown.
 */

import { Info } from "lucide-react";

interface NdviImputedNoteProps {
  imputed: boolean | undefined;
  label: string;
  className?: string;
}

export function NdviImputedNote({ imputed, label, className = "" }: NdviImputedNoteProps) {
  if (imputed !== true) return null;
  return (
    <p
      data-testid="ndvi-imputed-note"
      className={`flex items-start gap-1.5 rounded-control border border-dashed border-line px-2 py-1.5 text-[11px] leading-snug text-dim ${className}`}
    >
      <Info aria-hidden size={12} className="mt-px shrink-0 text-amber" />
      <span>{label}</span>
    </p>
  );
}
