// api/users.ts
import { connectToDatabase } from './_lib/mongodb.js';
import { User, AuditLog } from './_lib/models.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit, setSecurityHeaders } from './_lib/security.js';

const ADMIN_API_RATE_LIMIT = {
  keyPrefix: 'admin-users-api',
  windowMs: 60 * 1000,
  max: 60, // Tối đa 60 req/phút
};

// Hàm Middleware xác thực Token
const authenticateAdmin = (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Truy cập bị từ chối: Thiếu Token bảo mật.' });
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'R_SHIELD_SECRET_KEY_DEV');
    if (decoded.role !== 'ADMIN') {
      res.status(403).json({ message: 'Truy cập bị từ chối: Yêu cầu quyền Quản trị viên.' });
      return null;
    }
    return decoded;
  } catch (err) {
    res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return null;
  }
};

export default async function handler(req: any, res: any) {
  setSecurityHeaders(res);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Áp dụng Rate Limit
  if (!rateLimit(req, res, ADMIN_API_RATE_LIMIT)) return;

  // XÁC THỰC QUYỀN TRUY CẬP (Bảo mật tuyệt đối)
  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return; // Dừng lại ngay nếu không có quyền

  try {
    await connectToDatabase();

    // 1. LẤY DANH SÁCH USER
    if (req.method === 'GET') {
      const users = await User.find({}).select('-password').sort({ createdAt: -1 });
      return res.status(200).json(users);
    }

    // 2. TẠO MỚI USER
    if (req.method === 'POST') {
      const { username, password, email, role, isActive } = req.body;
      const existingUser = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email }] });
      if (existingUser) return res.status(400).json({ message: "Username hoặc Email đã được sử dụng!" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({ username: username.toLowerCase(), password: hashedPassword, email, role, isActive });

      await AuditLog.create({ userId: adminUser.id, action: 'CREATE_USER', details: { targetUser: username } });
      return res.status(201).json({ message: "Tạo thành công" });
    }

    // 3. CẬP NHẬT USER
    if (req.method === 'PUT') {
      const { id, username, password, email, role, isActive } = req.body;
      const updateData: any = { username: username.toLowerCase(), email, role, isActive };

      if (password && password.trim() !== '') {
         updateData.password = await bcrypt.hash(password, 10);
      }

      await User.findByIdAndUpdate(id, updateData);
      await AuditLog.create({ userId: adminUser.id, action: 'UPDATE_USER', details: { targetUser: username } });

      return res.status(200).json({ message: "Cập nhật thành công" });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (error: any) {
    return res.status(500).json({ message: "Lỗi Server", error: error.message });
  }
}