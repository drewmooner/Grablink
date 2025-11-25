// Rate limiting middleware

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limit store (per IP)
// In production, consider using Redis for distributed systems
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  // Check various headers for IP (handles proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Fallback (won't work in serverless, but helps in development)
  return "unknown";
}

/**
 * Check rate limit for an IP
 * @param ip - Client IP address
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  ip: string,
  limit: number = 20,
  windowMs: number = 60 * 60 * 1000 // 1 hour default
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(ip, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit middleware for Next.js API routes
 */
export function withRateLimit(
  handler: (request: Request) => Promise<Response>,
  options: {
    limit?: number;
    windowMs?: number;
  } = {}
) {
  return async (request: Request): Promise<Response> => {
    const ip = getClientIp(request);
    const limit = options.limit || 20; // 20 requests per hour default
    const windowMs = options.windowMs || 60 * 60 * 1000; // 1 hour

    const rateLimit = checkRateLimit(ip, limit, windowMs);

    if (!rateLimit.allowed) {
      const resetTime = new Date(rateLimit.resetTime).toISOString();
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: `Rate limit exceeded. Please try again after ${new Date(rateLimit.resetTime).toLocaleString()}`,
            resetTime,
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
            "Retry-After": Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(request);
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": rateLimit.resetTime.toString(),
      },
    });

    return newResponse;
  };
}

