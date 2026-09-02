/**
 * Safely extracts client IP address from HTTP request headers
 * Precedence:
 * 1. cf-connecting-ip (Cloudflare edge / Supabase hosting proxy)
 * 2. x-real-ip (Standard reverse proxy)
 * 3. x-forwarded-for (First/leftmost client IP)
 */
export function extractClientIp(headers: Headers | Record<string, string | null | undefined>): string {
  const getHeader = (name: string): string | null => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(name);
    }
    return (headers as Record<string, string | null | undefined>)[name] ?? null;
  };

  // 1. Cloudflare connecting IP
  const cfConnectingIp = getHeader("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  // 2. Standard X-Real-IP
  const xRealIp = getHeader("x-real-ip");
  if (xRealIp && xRealIp.trim()) {
    return xRealIp.trim();
  }

  // 3. X-Forwarded-For (leftmost client IP)
  const xForwardedFor = getHeader("x-forwarded-for");
  if (xForwardedFor && xForwardedFor.trim()) {
    const firstIp = xForwardedFor.split(",")[0].trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return "";
}
