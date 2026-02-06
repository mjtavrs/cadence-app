export const MEDIA = {
  maxBytes: 10 * 1024 * 1024,
  maxItemsPerWorkspace: 30,
  allowedContentTypes: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]),
} as const;

