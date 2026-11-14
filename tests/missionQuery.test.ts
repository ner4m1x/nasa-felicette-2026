import { describe, expect, it } from "vitest";
import { DEFAULT_MISSION } from "@/data/missionOptions";
import type { MissionConfig } from "@/lib/types";
import {
  isCompleteMission,
  parseMissionQuery,
  parseStoredMission,
  resolveInitialMission,
  withMissionQuery,
} from "@/state/missionQuery";

const SHARED: MissionConfig = { target: "mars_jezero", footprint: "mega", mobility: "heavy", crew: "permanent" };

describe("mission URL query", () => {
  it("parses the documented share format", () => {
    const q = new URLSearchParams("?t=mars_jezero&f=mega&m=heavy&c=permanent");
    expect(parseMissionQuery(q)).toEqual(SHARED);
    expect(isCompleteMission(parseMissionQuery(q))).toBe(true);
  });

  it("drops unknown or invalid values instead of guessing", () => {
    const q = new URLSearchParams("?t=venus&f=mega&m=&c=PERMANENT&x=1");
    expect(parseMissionQuery(q)).toEqual({ footprint: "mega" });
  });

  it("round-trips through withMissionQuery and keeps unrelated params", () => {
    const params = withMissionQuery(new URLSearchParams("utm=demo"), SHARED);
    expect(params.get("utm")).toBe("demo");
    expect(parseMissionQuery(params)).toEqual(SHARED);
  });
});

describe("stored mission", () => {
  it("accepts only known fields and values", () => {
    expect(parseStoredMission({ target: "moon_shackleton", crew: "lots", extra: 1 })).toEqual({
      target: "moon_shackleton",
    });
    expect(parseStoredMission(null)).toEqual({});
    expect(parseStoredMission("mars_jezero")).toEqual({});
  });
});

describe("initial mission resolution", () => {
  it("URL beats localStorage beats default", () => {
    const { config, fromLink } = resolveInitialMission(
      { crew: "robotic" },
      { crew: "permanent", mobility: "climber" },
      DEFAULT_MISSION,
    );
    expect(config).toEqual({ ...DEFAULT_MISSION, mobility: "climber", crew: "robotic" });
    expect(fromLink).toBe(false);
  });

  it("flags a complete shared link", () => {
    expect(resolveInitialMission(SHARED, {}, DEFAULT_MISSION)).toEqual({ config: SHARED, fromLink: true });
  });
});
