export const MEDIA = {
  maxBytes: 10 * 1024 * 1024,
  maxItemsPerWorkspace: 150,
  maxBytesPerWorkspace: 300 * 1024 * 1024,
  allowedContentTypes: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]),
} as const;

