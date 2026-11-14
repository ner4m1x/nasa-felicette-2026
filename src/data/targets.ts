/**
 * Planetary targets the user can plan a base for.
 *
 * Deliberately contains no planetary measurements: coordinates or physical values for these
 * targets must be added only with a `sources.ts` citation (ground rule 1).
 */
import type { I18nKey } from "@/i18n/types";
import type { TargetId } from "@/lib/types";

/** The local resource a permanent crew needs at this target (used by missionFit). */
export type TargetResource =
  /** water ice for ISRU, read from `mission.iceProxy` */
  | "ice"
  /** basaltic / lava-tube substrate for natural shielding, read from `mission.basaltFrac` */
  | "basalt"
  /** water-bearing minerals; NOT captured by the global grid */
  | "hydratedMinerals";

export interface TargetMeta {
  id: TargetId;
  body: "moon" | "mars";
  environment: "polar" | "lava_tube" | "basin_delta" | "ice_plains";
  labelKey: I18nKey;
  catKey: I18nKey;
  resource: TargetResource;
  /** false = the global scan cannot see this resource; mission fit only adds a note */
  resourceGloballyCaptured: boolean;
}

export const TARGETS: Record<TargetId, TargetMeta> = {
  moon_shackleton: {
    id: "moon_shackleton",
    body: "moon",
    environment: "polar",
    labelKey: "targets.moon_shackleton.label",
    catKey: "targets.moon_shackleton.cat",
    resource: "ice",
    resourceGloballyCaptured: true,
  },
  moon_tranquillitatis_pit: {
    id: "moon_tranquillitatis_pit",
    body: "moon",
    environment: "lava_tube",
    labelKey: "targets.moon_tranquillitatis_pit.label",
    catKey: "targets.moon_tranquillitatis_pit.cat",
    resource: "basalt",
    resourceGloballyCaptured: true,
  },
  mars_jezero: {
    id: "mars_jezero",
    body: "mars",
    environment: "basin_delta",
    labelKey: "targets.mars_jezero.label",
    catKey: "targets.mars_jezero.cat",
    resource: "hydratedMinerals",
    resourceGloballyCaptured: false,
  },
  mars_arcadia: {
    id: "mars_arcadia",
    body: "mars",
    environment: "ice_plains",
    labelKey: "targets.mars_arcadia.label",
    catKey: "targets.mars_arcadia.cat",
    resource: "ice",
    resourceGloballyCaptured: true,
  },
};
