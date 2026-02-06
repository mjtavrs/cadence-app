function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const env = {
  apiBaseUrl: required("CADENCE_API_BASE_URL").replace(/\/+$/, "") + "/",
  cookie: {
    domain: process.env.CADENCE_COOKIE_DOMAIN || undefined,
    secure: process.env.CADENCE_COOKIE_SECURE === "true",
  },
};

