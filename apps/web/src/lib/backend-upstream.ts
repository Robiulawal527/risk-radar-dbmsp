/** Express HTTP origin (no path) for API proxy / fallbacks. */
export function getExpressOrigin(): string {
  const explicit = process.env.BACKEND_PROXY_TARGET?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* fall through */
    }
  }
  const localApi = process.env.NEXT_PUBLIC_API_URL_LOCAL?.trim();
  if (localApi) {
    try {
      return new URL(localApi).origin;
    } catch {
      /* fall through */
    }
  }
  return 'http://127.0.0.1:3001';
}

export function getUpstreamApiOrigin(): string {
  if (process.env.NODE_ENV === 'development') {
    return getExpressOrigin();
  }
  const deployed = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (deployed) {
    try {
      return new URL(deployed).origin;
    } catch {
      /* fall through */
    }
  }
  return getExpressOrigin();
}
