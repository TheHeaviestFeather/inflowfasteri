/**
 * CORS configuration and helpers for edge functions
 */

/**
 * Get allowed origin based on request origin
 */
export function getAllowedOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return "";

  // Allow any Lovable preview origin
  if (requestOrigin.endsWith(".lovableproject.com")) {
    return requestOrigin;
  }

  // Allow any Lovable production/published app origin
  if (requestOrigin.endsWith(".lovable.app")) {
    return requestOrigin;
  }

  const allowedOrigins = [
    "https://lovable.dev",
    "http://localhost:5173",
    "http://localhost:3000",
    Deno.env.get("ALLOWED_ORIGIN"),
  ].filter(Boolean) as string[];

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Default to first known origin (or empty) to avoid reflecting arbitrary origins
  return allowedOrigins[0] || "";
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req.headers.get("Origin")),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Create a CORS preflight response
 */
export function handleCorsPreflightRequest(req: Request): Response {
  return new Response(null, { headers: getCorsHeaders(req) });
}
