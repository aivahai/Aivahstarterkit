import { describe, expect, it } from "vitest";
import {
  isBasicAvatarCatalog,
  isHeroAvatarCatalog,
  toAvatarCatalog,
} from "@/lib/avatar-catalog";

describe("avatar catalog helpers", () => {
  it("normalizes Hero and Basic catalog labels and DB types", () => {
    expect(toAvatarCatalog("hero")).toBe("hero");
    expect(toAvatarCatalog("hero_character")).toBe("hero");
    expect(toAvatarCatalog("basic")).toBe("basic");
    expect(toAvatarCatalog("basic_character")).toBe("basic");
    expect(toAvatarCatalog("unknown")).toBeNull();
  });

  it("detects catalog families for compositing and provider routing", () => {
    expect(isHeroAvatarCatalog("hero_character_background")).toBe(true);
    expect(isBasicAvatarCatalog("basic_character_background")).toBe(true);
    expect(isBasicAvatarCatalog("hero")).toBe(false);
  });
});
