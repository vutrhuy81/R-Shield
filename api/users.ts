// api/users.ts
import { connectToDatabase } from './_lib/mongodb.js';
import { User, AuditLog } from './_lib/models.js';
import { getClientIp, rateLimit, requireAdmin, setSecurityHeaders } from './_lib/security.js';
import bcrypt from 'bcryptjs';

const ADMIN_API_RATE_LIMIT = {
  keyPrefix: 'admin-users-api',
  windowMs: 60 * 1000,
  max: 80,
};

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function safeUserPayload(user: any) {
  const obj = user?.toObject ? user.toObject() : user;
  if (obj && obj.password) delete obj.password;
  return obj;
}

export default async function handler(req: any, res: any) {
  setSecurityHeaders(res);

  // CORS cho môi trường dev. Quan trọng: phải cho phép Authorization header.
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate limiting ở API quản trị để hạn chế spam request.
  if (!rateLimit(req, res, ADMIN_API_RATE_LIMIT)) return;

  // Kiểm tra quyền ở API, không chỉ ẩn nút trên giao diện. Postman/cURL cũng phải bị chặn.
  const auth = requireAdmin(req, res);
  if (!auth) return;

  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const users = await User.find({}).select('-password').sort({ createdAt: -1 });
      return res.status(200).json(users);
    }

    if (req.method === 'POST') {
      const { email, role, isActive } = req.body || {};
      const username = normalizeUsername(req.body?.username);
      const password = String(req.body?.password || '');

      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email và mật khẩu là bắt buộc.' });
      }

      if (!['ADMIN', 'GUEST'].includes(role)) {
        return res.status(400).json({ message: 'Vai trò không hợp lệ.' });
      }

      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        return res.status(400).json({ message: 'Username hoặc Email đã được sử dụng!' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        username,
        password: hashedPassword,
        email,
        role,
        isActive: Boolean(isActive),
      });

      await AuditLog.create({
        userId: auth.id,
        username: auth.username || auth.id,
        action: 'CREATE_USER',
        details: { targetUser: username, targetRole: role, ip: getClientIp(req) },
      });

      return res.status(201).json(safeUserPayload(newUser));
    }

    if (req.method === 'PUT') {
      const { id, email, role, isActive } = req.body || {};
      const username = normalizeUsername(req.body?.username);
      const password = String(req.body?.password || '');

      if (!id || !username || !email) {
        return res.status(400).json({ message: 'Thiếu id, username hoặc email.' });
      }

      if (!['ADMIN', 'GUEST'].includes(role)) {
        return res.status(400).json({ message: 'Vai trò không hợp lệ.' });
      }

      const updateData: any = {
        username,
        email,
        role,
        isActive: Boolean(isActive),
      };

      if (password.trim() !== '') {
        updateData.password = await bcrypt.hash(password, 10);
      }

      await User.findByIdAndUpdate(id, updateData, { runValidators: true });

      await AuditLog.create({
        userId: auth.id,
        username: auth.username || auth.id,
        action: 'UPDATE_USER',
        details: { targetUser: username, targetRole: role, ip: getClientIp(req) },
      });

      return res.status(200).json({ message: 'Cập nhật thành công' });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error('API User Error:', error);
    return res.status(500).json({ message: 'Lỗi Server', error: error.message });
  }
}
