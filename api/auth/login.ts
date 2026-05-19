// api/auth/login.ts
import { connectToDatabase } from '../_lib/mongodb.js';
import { User, AuditLog } from '../_lib/models.js';
import { sendAdminAlert } from '../_lib/emailService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit, assertLoginNotLocked, recordLoginFailure, recordLoginSuccess, setSecurityHeaders } from '../_lib/security.js';

const LOGIN_RATE_LIMIT = {
  keyPrefix: 'auth-login',
  windowMs: 60 * 1000, // 1 phút
  max: 10, // Tối đa 10 request/phút để tránh Spam API
};

const LOGIN_LOCK_OPTIONS = {
  maxFailures: 5, // Sai 5 lần sẽ khóa
  lockMs: 15 * 60 * 1000, // Khóa 15 phút
};

export default async function handler(req: any, res: any) {
  setSecurityHeaders(res);

  if (req.method !== 'POST') return res.status(405).end();
  
  // 1. Áp dụng Rate Limit cho API Login
  if (!rateLimit(req, res, LOGIN_RATE_LIMIT)) return;

  try {
    await connectToDatabase();

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập tài khoản và mật khẩu.' });
    }

    const normalizedUsername = username.toLowerCase().trim();

    // 2. Chống Brute-force: Kiểm tra xem tài khoản có đang bị khóa tạm thời không
    if (!assertLoginNotLocked(req, res, normalizedUsername)) return;
    
    // Tìm user theo username
    const user = await User.findOne({ username: normalizedUsername, isActive: true });
    
    if (!user) {
      // Ghi nhận 1 lần đăng nhập thất bại
      recordLoginFailure(req, normalizedUsername, LOGIN_LOCK_OPTIONS);
      return res.status(401).json({ message: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
    }

    // So sánh mật khẩu
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      // Ghi nhận đăng nhập thất bại và tính toán khóa tài khoản
      recordLoginFailure(req, normalizedUsername, LOGIN_LOCK_OPTIONS);
      return res.status(401).json({ message: 'Mật khẩu không chính xác.' });
    }

    // 3. Đăng nhập thành công -> Xóa lịch sử lỗi (Reset đếm Brute-force)
    recordLoginSuccess(req, normalizedUsername);

    // Tạo JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username }, 
      process.env.JWT_SECRET || 'R_SHIELD_SECRET_KEY_DEV', 
      { expiresIn: '8h' }
    );

    // Ghi log & Gửi Email cảnh báo
    await AuditLog.create({
      userId: user._id,
      username: user.username,
      action: 'LOGIN',
      details: { ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown' },
    });

    res.status(200).json({ 
      id: user._id, 
      username: user.username, 
      role: user.role, 
      email: user.email,
      token: token // Cấp token cho Frontend
    });

  } catch (error: any) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
  }
}