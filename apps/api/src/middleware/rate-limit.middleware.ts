import { Request, Response, NextFunction } from 'express';

/**
 * A small fixed-window limiter for endpoints that call outside services (map data, geocoders,
 * the AI). Counts per signed-in user, or per address when there is none. Kept in memory: enough
 * for one server, and it only needs to stop a runaway client, not be exact.
 */
export function rateLimit(opts: { windowMs: number; max: number; name: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, opts.windowMs);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.userId ?? req.ip ?? 'anon';
    const now = Date.now();
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    cur.count += 1;
    if (cur.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((cur.resetAt - now) / 1000)));
      return res.status(429).json({ status: 'error', message: 'Too many requests. Wait a moment and try again.', code: `RATE_LIMITED_${opts.name}` });
    }
    next();
  };
}
