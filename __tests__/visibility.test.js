import { resolveBoolean, shouldRenderSectionOnMobile } from "../src/engine/visibility";

describe("resolveBoolean", () => {
  it("handles strings, numbers and wrapped values", () => {
    expect(resolveBoolean("true", false)).toBe(true);
    expect(resolveBoolean("0", true)).toBe(false);
    expect(resolveBoolean(1, false)).toBe(true);
    expect(resolveBoolean({ value: "no" }, true)).toBe(false);
    expect(resolveBoolean({ const: "yes" }, false)).toBe(true);
    expect(resolveBoolean({ properties: { value: "true" } }, false)).toBe(true);
  });
});

describe("shouldRenderSectionOnMobile", () => {
  const buildSection = (visibility) => ({
    properties: visibility ? { visibility } : {},
  });

  it("allows sections without visibility configuration", () => {
    expect(shouldRenderSectionOnMobile(buildSection())).toBe(true);
  });

  it("hides sections explicitly marked to hide on mobile", () => {
    const section = buildSection({ properties: { hideOnMobile: { value: true } } });
    expect(shouldRenderSectionOnMobile(section)).toBe(false);
  });

  it("respects show-on-mobile flags", () => {
    const section = buildSection({ properties: { mobileVisible: { value: false } } });
    expect(shouldRenderSectionOnMobile(section)).toBe(false);
  });

  it("skips desktop-only targets", () => {
    const section = buildSection({ properties: { target: "desktop" } });
    expect(shouldRenderSectionOnMobile(section)).toBe(false);
  });

  it("keeps mobile targeted sections", () => {
    const section = buildSection({ properties: { target: "mobile" } });
    expect(shouldRenderSectionOnMobile(section)).toBe(true);
  });
});

