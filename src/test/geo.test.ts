import { describe, it, expect } from "vitest";
import { project, unproject, ORIGIN } from "@/game/geo";

describe("Lagos projection", () => {
  it("puts Marina/CMS at (0,0)", () => {
    const [x, z] = project(ORIGIN.lat, ORIGIN.lon);
    expect(Math.abs(x)).toBeLessThan(1e-6);
    expect(Math.abs(z)).toBeLessThan(1e-6);
  });
  it("maps north to -Z and east to +X in real metres", () => {
    const [, zN] = project(ORIGIN.lat + 0.001, ORIGIN.lon);
    const [xE] = project(ORIGIN.lat, ORIGIN.lon + 0.001);
    expect(zN).toBeCloseTo(-111.3, 0);
    expect(xE).toBeCloseTo(110.6, 0);
  });
  it("round-trips", () => {
    const [lat, lon] = unproject(...project(6.4571, 3.3879));
    expect(lat).toBeCloseTo(6.4571, 7);
    expect(lon).toBeCloseTo(3.3879, 7);
  });
});
