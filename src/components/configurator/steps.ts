/**
 * The four configurator questions, in order, with their options, icons and Félicette's comment
 * for each choice. Options and their mission-fit parameters live in src/data/missionOptions.ts.
 */
import {
  Bot,
  Building2,
  Home,
  Maximize,
  Moon,
  Mountain,
  Orbit,
  Tent,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CREW_OPTIONS, FOOTPRINT_OPTIONS, MOBILITY_OPTIONS, TARGET_OPTIONS } from "@/data/missionOptions";
import { TARGETS } from "@/data/targets";
import type { I18nKey } from "@/i18n/types";
import { CREW_IDS, FOOTPRINT_IDS, MOBILITY_IDS, type MissionConfig } from "@/lib/types";

export interface StepOption {
  id: string;
  titleKey: I18nKey;
  subtitleKey: I18nKey;
  commentKey: I18nKey;
  Icon: LucideIcon;
}

export interface ConfigStep {
  field: keyof MissionConfig;
  titleKey: I18nKey;
  options: StepOption[];
}

const FOOTPRINT_ICONS = { compact: Tent, medium: Building2, mega: Maximize } as const;
const MOBILITY_ICONS = { climber: Mountain, heavy: Truck } as const;
const CREW_ICONS = { robotic: Bot, short: Users, permanent: Home } as const;

export const CONFIG_STEPS: readonly ConfigStep[] = [
  {
    field: "target",
    titleKey: "options.target.title",
    options: TARGET_OPTIONS.map((o) => ({
      id: o.id,
      titleKey: o.labelKey,
      subtitleKey: o.catKey,
      commentKey: `felicette.choice.target.${o.id}`,
      Icon: TARGETS[o.id].body === "moon" ? Moon : Orbit,
    })),
  },
  {
    field: "footprint",
    titleKey: "options.footprint.title",
    options: FOOTPRINT_IDS.map((id) => ({
      id,
      titleKey: FOOTPRINT_OPTIONS[id].labelKey,
      subtitleKey: FOOTPRINT_OPTIONS[id].descKey,
      commentKey: `felicette.choice.footprint.${id}`,
      Icon: FOOTPRINT_ICONS[id],
    })),
  },
  {
    field: "mobility",
    titleKey: "options.mobility.title",
    options: MOBILITY_IDS.map((id) => ({
      id,
      titleKey: MOBILITY_OPTIONS[id].labelKey,
      subtitleKey: MOBILITY_OPTIONS[id].descKey,
      commentKey: `felicette.choice.mobility.${id}`,
      Icon: MOBILITY_ICONS[id],
    })),
  },
  {
    field: "crew",
    titleKey: "options.crew.title",
    options: CREW_IDS.map((id) => ({
      id,
      titleKey: CREW_OPTIONS[id].labelKey,
      subtitleKey: CREW_OPTIONS[id].descKey,
      commentKey: `felicette.choice.crew.${id}`,
      Icon: CREW_ICONS[id],
    })),
  },
];

export function selectedOption(step: ConfigStep, config: MissionConfig): StepOption | undefined {
  return step.options.find((o) => o.id === config[step.field]);
}
