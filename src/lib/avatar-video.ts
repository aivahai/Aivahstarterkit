import type { RemoteParticipant, RemoteTrackPublication } from "livekit-client";

export const HERO_AVATAR_IDENTITY = "hero-avatar-agent";
export const BASIC_AVATAR_IDENTITY = "basic-avatar-agent";
/** LiveKit AvatarRunner hardcodes this track name — do not rename the value. */
export const BASIC_AVATAR_TRACK_NAME = "avatar_video";

export function isHeroAvatarParticipant(
  participant: RemoteParticipant,
): boolean {
  return (
    participant.identity === HERO_AVATAR_IDENTITY ||
    participant.identity.startsWith("hero-avatar-agent")
  );
}

export function isBasicAvatarParticipant(
  participant: RemoteParticipant,
): boolean {
  return (
    participant.identity === BASIC_AVATAR_IDENTITY ||
    participant.identity.startsWith("basic-avatar-agent")
  );
}

export function isAvatarParticipant(participant: RemoteParticipant): boolean {
  return (
    isHeroAvatarParticipant(participant) ||
    isBasicAvatarParticipant(participant)
  );
}

export function isAvatarVideoPublication(
  publication: RemoteTrackPublication,
  participant: RemoteParticipant,
): boolean {
  const pubName = publication.trackName?.trim();
  if (pubName === BASIC_AVATAR_TRACK_NAME) {
    return true;
  }
  return isAvatarParticipant(participant);
}
