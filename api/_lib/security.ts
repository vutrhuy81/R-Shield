// api/_lib/security.ts
// Middleware bảo mật dùng cho API serverless R-SHIELD.
//
// Mục tiêu:
// 1) Rate limiting cho API đăng nhập và API gọi AI.
// 2) Chống brute-force bằng khóa tạm tài khoản/IP sau nhiều lần đăng nhập sai.
// 3) Kiểm tra JWT và role ở từng API, không chỉ ở giao diện.
//
// Lưu ý: In-memory store phù hợp cho sản phẩm demo/serverless quy mô nhỏ.
// Khi triển khai thật, nên thay bằng Redis/Upstash/KV để đồng bộ giữa nhiều instance.

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

const getGlobalMap = <T>(key: string): Map<string, T> => {
  const globalAny = globalThis as any;
  if (!globalAny[key]) globalAny[key] = new Map<string, T>();
  return globalAny[key];
};

const rateLimitStore = () => getGlobalMap<RateLimitBucket>(RATE_LIMIT_STORE_KEY);
const bruteForceStore = () => getGlobalMap<BruteForceRecord>(BRUTE_FORCE_STORE_KEY);

const now = () => Date.now();

export const SECURITY_CONFIG = {
  loginRateLimit: {
    windowMs: 60_000,
    max: 10
  },
  aiRateLimit: {
    windowMs: 60_000,
    max: 20
  },
  adminRateLimit: {
    windowMs: 60_000,
    max: 60
  },
  bruteForce: {
    maxFailures: 5,
    lockMs: 15 * 60_000
  }
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
    res.setHeader('Retry-After', retryAfterSeconds);
  }

  return res.status(status).json({
    ok: false,
    message
  });
};

export const rateLimit = (
  req: ApiRequest,
  res: ApiResponse,
  keyPrefix: 'login' | 'ai' | 'admin',
  config: { windowMs: number; max: number }
) => {
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const store = rateLimitStore();
  const current = now();

  const existing = store.get(key);
  if (!existing || existing.resetAt <= current) {
    store.set(key, { count: 1, resetAt: current + config.windowMs });
    return true;
  }

  existing.count += 1;
  store.set(key, existing);

  if (existing.count > config.max) {
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
    sendSecurityError(
      res,
      423,
      `Tài khoản/IP đang bị khóa tạm do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
      retryAfterSeconds
    );
    return false;
  }

  return true;
};

export const recordLoginFailure = (req: ApiRequest, username: string) => {
  const ip = getClientIp(req);
  const key = bruteForceKey(username, ip);
  const store = bruteForceStore();
  const current = now();
  const existing = store.get(key);

  const failures = (existing?.failures || 0) + 1;
  const lockedUntil =
    failures >= SECURITY_CONFIG.bruteForce.maxFailures
      ? current + SECURITY_CONFIG.bruteForce.lockMs
      : existing?.lockedUntil;

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

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    sendSecurityError(res, 500, 'Server chưa cấu hình JWT_SECRET.');
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthUser;

    if (!decoded?.username || !decoded?.role) {
      sendSecurityError(res, 401, 'Token không hợp lệ.');
      return null;
    }

    if (allowedRoles?.length && !allowedRoles.includes(decoded.role)) {
      sendSecurityError(res, 403, 'Tài khoản không có quyền truy cập API này.');
      return null;
    }

    return decoded;
  } catch {
    sendSecurityError(res, 401, 'Token hết hạn hoặc không hợp lệ.');
    return null;
  }
};

export const requireAdmin = (req: ApiRequest, res: ApiResponse) => requireAuth(req, res, ['ADMIN']);

/**
 * Ví dụ dùng trong /api/auth/login:
 *
 * export default async function handler(req, res) {
 *   if (!rateLimit(req, res, 'login', SECURITY_CONFIG.loginRateLimit)) return;
 *
 *   const { username, password } = req.body || {};
 *   if (!username || !password) return res.status(400).json({ message: 'Thiếu username/password.' });
 *   if (!assertLoginNotLocked(req, res, username)) return;
 *
 *   const user = await UserModel.findOne({ username });
 *   const ok = user && await bcrypt.compare(password, user.passwordHash);
 *   if (!ok) {
 *     recordLoginFailure(req, username);
 *     return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu.' });
 *   }
 *
 *   recordLoginSuccess(req, username);
 *   const token = jwt.sign({ id: user._id, username: user.username, email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '2h' });
 *   return res.status(200).json({ username: user.username, email: user.email, role: user.role, token });
 * }
 *
 * Ví dụ dùng trong /api/ai/analyze:
 *
 * export default async function handler(req, res) {
 *   if (!rateLimit(req, res, 'ai', SECURITY_CONFIG.aiRateLimit)) return;
 *   const user = requireAuth(req, res, ['ADMIN', 'GUEST']);
 *   if (!user) return;
 *   // tiếp tục xử lý gọi Gemini
 * }
 *
 * Ví dụ dùng trong /api/users, /api/logs, /api/emails/bulk:
 *
 * export default async function handler(req, res) {
 *   if (!rateLimit(req, res, 'admin', SECURITY_CONFIG.adminRateLimit)) return;
 *   const admin = requireAdmin(req, res);
 *   if (!admin) return;
 *   // tiếp tục xử lý nghiệp vụ admin
 * }
 */
