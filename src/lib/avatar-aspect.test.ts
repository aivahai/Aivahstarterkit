import { describe, expect, it } from "vitest";
import {
  cssAspectRatio,
  getDefaultAvatarWidth,
  resolveDisplayAspect,
} from "@/lib/avatar-aspect";

describe("resolveDisplayAspect", () => {
  it("uses 9×5 landscape when a background is present", () => {
    expect(resolveDisplayAspect("2x3", true)).toEqual({
      width: 9,
      height: 5,
    });
    expect(resolveDisplayAspect("9x16", true)).toEqual({
      width: 9,
      height: 5,
    });
  });

  it("uses the character preset when background is cleared", () => {
    expect(resolveDisplayAspect("2x3", false)).toEqual({
      width: 2,
      height: 3,
    });
    expect(resolveDisplayAspect("9x16", false)).toEqual({
      width: 9,
      height: 16,
    });
    expect(resolveDisplayAspect("1x1", false)).toEqual({
      width: 1,
      height: 1,
    });
  });

  it("falls back to 2×3 when aspect is missing or unknown", () => {
    expect(resolveDisplayAspect(null, false)).toEqual({
      width: 2,
      height: 3,
    });
    expect(resolveDisplayAspect("wide", false)).toEqual({
      width: 2,
      height: 3,
    });
  });

  it("formats css aspect-ratio", () => {
    expect(cssAspectRatio({ width: 9, height: 5 })).toBe("9 / 5");
  });

  it("widens the panel when a background is selected", () => {
    expect(getDefaultAvatarWidth({ size: "chat", hasBackground: false })).toBe(
      320,
    );
    expect(getDefaultAvatarWidth({ size: "chat", hasBackground: true })).toBe(
      580,
    );
  });
});
