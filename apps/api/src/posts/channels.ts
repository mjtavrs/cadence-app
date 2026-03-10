export type PostPlatform = "INSTAGRAM";
export type PostPlacement = "FEED" | "STORY" | "REELS" | "CAROUSEL";

export type PostChannel = {
  platform: PostPlatform;
  placement: PostPlacement;
};

export const DEFAULT_POST_CHANNELS: PostChannel[] = [{ platform: "INSTAGRAM", placement: "FEED" }];

const ALLOWED_PLATFORMS = new Set<PostPlatform>(["INSTAGRAM"]);
const ALLOWED_PLACEMENTS = new Set<PostPlacement>(["FEED", "STORY", "REELS", "CAROUSEL"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSingleChannel(value: unknown): PostChannel | null {
  if (!isRecord(value)) return null;
  const platform = typeof value.platform === "string" ? value.platform.trim().toUpperCase() : "";
  const placement = typeof value.placement === "string" ? value.placement.trim().toUpperCase() : "";

  if (!ALLOWED_PLATFORMS.has(platform as PostPlatform)) return null;
  if (!ALLOWED_PLACEMENTS.has(placement as PostPlacement)) return null;

  return {
    platform: platform as PostPlatform,
    placement: placement as PostPlacement,
  };
}

export function normalizePostChannels(value: unknown): PostChannel[] {
  if (!Array.isArray(value)) return [...DEFAULT_POST_CHANNELS];
  const channels = value.map(normalizeSingleChannel).filter((item): item is PostChannel => !!item);
  if (channels.length === 0) return [...DEFAULT_POST_CHANNELS];
  return channels;
}

export function parseMvpPostChannelsInput(
  value: unknown,
): { ok: true; channels: PostChannel[] } | { ok: false; message: string } {
  if (value == null) {
    return { ok: true, channels: [...DEFAULT_POST_CHANNELS] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, message: "channels inválido." };
  }

  const channels = value.map(normalizeSingleChannel).filter((item): item is PostChannel => !!item);
  if (channels.length !== value.length || channels.length === 0) {
    return { ok: false, message: "channels inválido." };
  }

  if (channels.length !== 1 || channels[0].platform !== "INSTAGRAM" || channels[0].placement !== "FEED") {
    return { ok: false, message: "No MVP, apenas Instagram Feed é suportado." };
  }

  return { ok: true, channels };
}
