// api/_lib/security.ts
import jwt from 'jsonwebtoken';

type ApiRequest = {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
  method?: string;
  body?: any;
  query?: Record<string, any>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: any) => void;
  setHeader?: (name: string, value: string | number) => void;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type BruteForceRecord = {
  failures: number;
  lockedUntil?: number;
  updatedAt: number;
};

export type AuthUser = {
  id?: string;
  username: string;
  email?: string;
  role: 'ADMIN' | 'GUEST' | string;
};

const RATE_LIMIT_STORE_KEY = '__RSHIELD_RATE_LIMIT_STORE__';
const BRUTE_FORCE_STORE_KEY = '__RSHIELD_BRUTE_FORCE_STORE__';

// Sử dụng globalThis để giữ cache không bị mất khi Hot-Reload hoặc Cold-Start nhẹ
const getGlobalMap = <T>(key: string): Map<string, T> => {
  const globalAny = globalThis as any;
  if (!globalAny[key]) globalAny[key] = new Map<string, T>();
  return globalAny[key];
};

const rateLimitStore = () => getGlobalMap<RateLimitBucket>(RATE_LIMIT_STORE_KEY);
const bruteForceStore = () => getGlobalMap<BruteForceRecord>(BRUTE_FORCE_STORE_KEY);

const now = () => Date.now();

export const SECURITY_CONFIG = {
  loginRateLimit: { windowMs: 60_000, max: 10 },
  aiRateLimit: { windowMs: 60_000, max: 20 },
  adminRateLimit: { windowMs: 60_000, max: 60 },
  bruteForce: { maxFailures: 5, lockMs: 15 * 60_000 }
};

export const getClientIp = (req: ApiRequest) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim() || 'unknown';
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || 'unknown';

  const realIp = req.headers['x-real-ip'];
  if (Array.isArray(realIp)) return realIp[0] || 'unknown';
  if (typeof realIp === 'string') return realIp;

  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
};

export const getBearerToken = (req: ApiRequest) => {
  const raw = req.headers.authorization || req.headers.Authorization;
  const auth = Array.isArray(raw) ? raw[0] : raw;
  if (!auth || !auth.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
};

export const sendSecurityError = (res: ApiResponse, status: number, message: string, retryAfterSeconds?: number) => {
  if (retryAfterSeconds && res.setHeader) {
    res.setHeader('Retry-After', retryAfterSeconds.toString());
  }
  // Format json({ message }) để tương thích với LoginPage.tsx
  return res.status(status).json({ message });
};

// [SỬA LỖI] Bổ sung hàm setSecurityHeaders bị thiếu
export const setSecurityHeaders = (res: ApiResponse) => {
  if (res.setHeader) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
};

// [SỬA LỖI] Điều chỉnh tham số để tương thích với login.ts và users.ts hiện tại
export const rateLimit = (
  req: ApiRequest,
  res: ApiResponse,
  options: { keyPrefix: string; windowMs: number; max: number }
) => {
  const ip = getClientIp(req);
  const key = `${options.keyPrefix}:${ip}`;
  const store = rateLimitStore();
  const current = now();

  const existing = store.get(key);
  if (!existing || existing.resetAt <= current) {
    store.set(key, { count: 1, resetAt: current + options.windowMs });
    return true;
  }

  existing.count += 1;
  store.set(key, existing);

  if (existing.count > options.max) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - current) / 1000);
    sendSecurityError(
      res,
      429,
      `API đang bị giới hạn tần suất. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
      retryAfterSeconds
    );
    return false;
  }

  return true;
};

const bruteForceKey = (username: string, ip: string) => `${username.trim().toLowerCase()}:${ip}`;

export const assertLoginNotLocked = (req: ApiRequest, res: ApiResponse, username: string) => {
  const ip = getClientIp(req);
  const key = bruteForceKey(username, ip);
  const record = bruteForceStore().get(key);

  if (record?.lockedUntil && record.lockedUntil > now()) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now()) / 1000);
    // [SỬA LỖI] Đổi 423 thành 429 để khớp logic bắt lỗi bên giao diện React
    sendSecurityError(
      res,
      429,
      `Tài khoản đang bị khóa tạm do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
      retryAfterSeconds
    );
    return false;
  }

  return true;
};

// [SỬA LỖI] Bổ sung tham số thứ 3 (customOptions) để không bị báo lỗi ở file login.ts
export const recordLoginFailure = (req: ApiRequest, username: string, customOptions?: { maxFailures: number; lockMs: number }) => {
  const ip = getClientIp(req);
  const key = bruteForceKey(username, ip);
  const store = bruteForceStore();
  const current = now();
  const existing = store.get(key);

  const failures = (existing?.failures || 0) + 1;
  
  const maxFailures = customOptions?.maxFailures || SECURITY_CONFIG.bruteForce.maxFailures;
  const lockMs = customOptions?.lockMs || SECURITY_CONFIG.bruteForce.lockMs;

  const lockedUntil = failures >= maxFailures ? current + lockMs : existing?.lockedUntil;

  store.set(key, {
    failures,
    lockedUntil,
    updatedAt: current
  });

  return { failures, lockedUntil };
};

export const recordLoginSuccess = (req: ApiRequest, username: string) => {
  const ip = getClientIp(req);
  bruteForceStore().delete(bruteForceKey(username, ip));
};

export const requireAuth = (req: ApiRequest, res: ApiResponse, allowedRoles?: string[]): AuthUser | null => {
  const token = getBearerToken(req);
  if (!token) {
    sendSecurityError(res, 401, 'Thiếu Authorization Bearer token.');
    return null;
  }

  // [SỬA LỖI] Cung cấp fallback secret key phòng trường hợp Vercel chưa set ENV
  const secret = process.env.JWT_SECRET || 'R_SHIELD_SECRET_KEY_DEV';

  try {
    const decoded = jwt.verify(token, secret) as AuthUser;

    if (!decoded?.username || (!decoded?.role && !decoded?.id)) {
      sendSecurityError(res, 401, 'Token không hợp lệ hoặc đã bị thay đổi.');
      return null;
    }

    if (allowedRoles?.length && !allowedRoles.includes(decoded.role)) {
      sendSecurityError(res, 403, 'Tài khoản không có quyền truy cập API này.');
      return null;
    }

    return decoded;
  } catch {
    sendSecurityError(res, 401, 'Phiên đăng nhập hết hạn hoặc không hợp lệ.');
    return null;
  }
};

export const requireAdmin = (req: ApiRequest, res: ApiResponse) => requireAuth(req, res, ['ADMIN']);