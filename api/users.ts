// api/users.ts
import { connectToDatabase } from './_lib/mongodb';
import { User, AuditLog } from './_lib/models';
import bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
  // Bật CORS nếu cần thiết cho môi trường Dev
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
      
      // Kiểm tra trùng lặp
      const existingUser = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email }] });
      if (existingUser) {
        return res.status(400).json({ message: "Username hoặc Email đã được sử dụng!" });
      }

      // Mã hóa mật khẩu
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await User.create({ 
        username: username.toLowerCase(), 
        password: hashedPassword, 
        email, 
        role, 
        isActive 
      });

      // Ghi log
      await AuditLog.create({ action: 'CREATE_USER', details: { targetUser: username } });

      return res.status(201).json(newUser);
    }

    // 3. CẬP NHẬT USER
    if (req.method === 'PUT') {
      const { id, username, password, email, role, isActive } = req.body;
      
      const updateData: any = { 
        username: username.toLowerCase(), 
        email, 
        role, 
        isActive 
      };

      // Nếu quản trị viên nhập mật khẩu mới, thì mới tiến hành băm và cập nhật mật khẩu
      if (password && password.trim() !== '') {
         updateData.password = await bcrypt.hash(password, 10);
      }

      await User.findByIdAndUpdate(id, updateData);

      // Ghi log
      await AuditLog.create({ action: 'UPDATE_USER', details: { targetUser: username } });

      return res.status(200).json({ message: "Cập nhật thành công" });
    }

    // Phương thức không được hỗ trợ
    return res.status(405).json({ message: "Method not allowed" });

  } catch (error: any) {
    console.error("API User Error:", error);
    return res.status(500).json({ message: "Lỗi Server", error: error.message });
  }
}
