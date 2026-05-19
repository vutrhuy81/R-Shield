// api/auth/login.ts
import { connectToDatabase } from '../_lib/mongodb.js';
import { User, AuditLog } from '../_lib/models.js';
import { sendAdminAlert } from '../_lib/emailService.js';
import {
  assertLoginNotLocked,
  getClientIp,
  rateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  setSecurityHeaders,
} from '../_lib/security.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const LOGIN_RATE_LIMIT = {
  keyPrefix: 'auth-login',
  windowMs: 60 * 1000,
  max: 10,
};

const LOGIN_LOCK_OPTIONS = {
  maxFailures: 5,
  lockMs: 15 * 60 * 1000,
};

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req: any, res: any) {
  setSecurityHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // API-level rate limiting. Đây mới là lớp chặn thật, không phải chỉ khóa nút trên giao diện.
  if (!rateLimit(req, res, LOGIN_RATE_LIMIT)) return;

  try {
    await connectToDatabase();

    // ----------------------------------------------------------------------
    // CƠ CHẾ AUTO-SEED: TẠO ADMIN MẶC ĐỊNH CHO LẦN CHẠY ĐẦU TIÊN
    // Khuyến nghị: đổi mật khẩu mặc định ngay sau lần đăng nhập đầu tiên.
    // ----------------------------------------------------------------------
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const hashedDefaultPassword = await bcrypt.hash('123456', 10);

      await User.create({
        username: 'admin',
        password: hashedDefaultPassword,
        email: 'vutrhuy81@gmail.com',
        role: 'ADMIN',
        isActive: true,
      });
      console.log('Hệ thống: Đã khởi tạo tài khoản Admin mặc định thành công.');
    }
    // ----------------------------------------------------------------------

    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập username và mật khẩu.' });
    }

    // Chống brute-force theo cặp IP + username.
    if (!assertLoginNotLocked(req, res, username)) return;

    const ip = getClientIp(req);
    const user = await User.findOne({ username, isActive: true });

    // Dùng thông báo chung để hạn chế dò tài khoản.
    if (!user) {
      recordLoginFailure(req, username, LOGIN_LOCK_OPTIONS);
      await AuditLog.create({
        username,
        action: 'LOGIN_FAILED',
        details: { reason: 'USER_NOT_FOUND_OR_INACTIVE', ip },
      });
      return res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      recordLoginFailure(req, username, LOGIN_LOCK_OPTIONS);
      await AuditLog.create({
        userId: user._id,
        username: user.username,
        action: 'LOGIN_FAILED',
        details: { reason: 'WRONG_PASSWORD', ip },
      });
      return res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    recordLoginSuccess(req, username);

    const token = jwt.sign(
      { id: String(user._id), username: user.username, role: user.role },
      process.env.JWT_SECRET || 'R_SHIELD_SECRET_KEY_DEV',
      { expiresIn: '8h' },
    );

    await AuditLog.create({
      userId: user._id,
      username: user.username,
      action: 'LOGIN',
      details: { ip },
    });

    // Không để lỗi email làm hỏng phiên đăng nhập.
    try {
      await sendAdminAlert('LOGIN', user.username, {
        time: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        ip,
      });
    } catch (emailError) {
      console.warn('Không thể gửi email cảnh báo đăng nhập:', emailError);
    }

    return res.status(200).json({
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      token,
    });
  } catch (error: any) {
    console.error('Lỗi đăng nhập:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
  }
}
