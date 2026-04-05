// api/emails/bulk.ts
import { connectToDatabase } from '../_lib/mongodb.js';
import { User } from '../_lib/models.js';
import { sendBulkEmailToUsers } from '../_lib/emailService.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    await connectToDatabase();
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: 'Thiếu tiêu đề hoặc nội dung email.' });
    }

    // 1. Quét Database, lấy ra danh sách email của TẤT CẢ các User đang "Hoạt động"
    const users = await User.find({ isActive: true }).select('email');
    const emailList = users.map((u: any) => u.email).filter((email: string) => email);

    if (emailList.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng nào có email để gửi.' });
    }

    // 2. Gọi hàm gửi mail hàng loạt
    await sendBulkEmailToUsers(emailList, subject, message);

    return res.status(200).json({ message: `Đã gửi thông báo đến tất cả email học sinh thành công tới ${emailList.length} tài khoản.` });
  } catch (error: any) {
    console.error("API Bulk Email Error:", error);
    return res.status(500).json({ message: 'Lỗi server khi gửi email', error: error.message });
  }
}
