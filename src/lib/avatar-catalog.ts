/** Product catalog: Basic vs Hero. */
export type AvatarCatalog = "basic" | "hero";

export const DEFAULT_AVATAR_CATALOG: AvatarCatalog = "hero";

/** Prefer platform camelCase (`avatarType`); fall back to list-row snake_case. */
export function avatarTypeOf(resource?: {
  avatarType?: string | null;
  avatar_type?: string | null;
} | null) {
  return resource?.avatarType ?? resource?.avatar_type ?? null;
}

export function toAvatarCatalog(
  value?: string | null,
): AvatarCatalog | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "basic" ||
    normalized === "basic_character" ||
    normalized === "basic_character_background"
  ) {
    return "basic";
  }
  if (
    normalized === "hero" ||
    normalized === "hero_character" ||
    normalized === "hero_character_background"
  ) {
    return "hero";
  }
  return null;
}

export function isBasicAvatarCatalog(value?: string | null) {
  return toAvatarCatalog(value) === "basic";
}

export function isHeroAvatarCatalog(value?: string | null) {
  return toAvatarCatalog(value) === "hero";
}

export function catalogLabel(catalog: AvatarCatalog) {
  return catalog === "basic" ? "Basic" : "Hero";
}

export function resourceNameOf(item: { avatar_name?: string | null }) {
  return String(item.avatar_name || "").trim();
}
