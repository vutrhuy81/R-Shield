// api/auth/login.ts
import { connectToDatabase } from '../_lib/mongodb.js';
import { User, AuditLog } from '../_lib/models';
import { sendAdminAlert } from '../_lib/emailService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    await connectToDatabase();

    // ----------------------------------------------------------------------
    // CƠ CHẾ AUTO-SEED: TẠO ADMIN MẶC ĐỊNH CHO LẦN CHẠY ĐẦU TIÊN
    // ----------------------------------------------------------------------
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      // Mã hóa mật khẩu '123456'
      const hashedDefaultPassword = await bcrypt.hash('123456', 10);
      
      await User.create({
        username: 'admin',
        password: hashedDefaultPassword,
        email: 'vutrhuy81@gmail.com', // Email Admin mặc định
        role: 'ADMIN',
        isActive: true
      });
      console.log('Hệ thống: Đã khởi tạo tài khoản Admin mặc định thành công.');
    }
    // ----------------------------------------------------------------------

    const { username, password } = req.body;
    
    // Tìm user theo username
    const user = await User.findOne({ username: username.toLowerCase(), isActive: true });
    
    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
    }

    // So sánh mật khẩu người dùng nhập vào với mật khẩu đã mã hóa trong DB
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Mật khẩu không chính xác.' });
    }

    // Tạo JWT Token (Thay 'YOUR_SECRET_KEY' bằng một chuỗi bí mật cấu hình trong .env)
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'R_SHIELD_SECRET_KEY_DEV', 
      { expiresIn: '8h' }
    );

    // Ghi nhật ký đăng nhập
    const log = await AuditLog.create({
      userId: user._id,
      username: user.username,
      action: 'LOGIN',
      details: { ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress },
    });

    // Gửi email cho Admin (Tùy chọn: có thể comment lại nếu không muốn nhận email mỗi lần đăng nhập)
    await sendAdminAlert('LOGIN', user.username, { 
      time: new Date().toLocaleString(),
      ip: req.headers['x-forwarded-for'] || 'Unknown'
    });

    // Trả dữ liệu về cho Frontend
    res.status(200).json({ 
      id: user._id, 
      username: user.username, 
      role: user.role, 
      email: user.email,
      token: token // Frontend sẽ lưu token này vào localStorage
    });

  } catch (error: any) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
  }
}
