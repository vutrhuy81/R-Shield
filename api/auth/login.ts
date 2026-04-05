import { connectToDatabase } from '../_lib/mongodb';
import { User, AuditLog } from '../_lib/models';
import { sendAdminAlert } from '../_lib/emailService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();

  const { username, password } = req.body;
  
  // Tìm user trong Database thay vì hardcode
  const user = await User.findOne({ username, password, isActive: true });
  
  if (!user) {
    return res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không chính xác' });
  }

  // Ghi nhật ký đăng nhập
  const log = await AuditLog.create({
    userId: user._id,
    username: user.username,
    action: 'LOGIN',
    details: { message: 'Đăng nhập thành công' },
  });

  // Gửi email cho Admin về việc đăng nhập này
  await sendAdminAlert('LOGIN', user.username, { logId: log._id });

  // Trong môi trường Enterprise, bạn nên trả về JWT Token ở đây
  res.status(200).json({ 
    id: user._id, 
    username: user.username, 
    role: user.role, 
    email: user.email 
  });
}
