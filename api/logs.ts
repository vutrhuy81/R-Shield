// api/logs.ts
import { connectToDatabase } from './_lib/mongodb.js';
import { AuditLog } from './_lib/models.js';

export default async function handler(req: any, res: any) {
  try {
    await connectToDatabase();

    // 1. PHƯƠNG THỨC GET: Lấy danh sách nhật ký hiển thị lên UI
    if (req.method === 'GET') {
      // Lấy danh sách nhật ký, sắp xếp mới nhất lên đầu, giới hạn 100 bản ghi
      const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100);
      return res.status(200).json(logs);
    }

    // 2. PHƯƠNG THỨC POST: Ghi nhận một hành động mới (do App.tsx gọi)
    if (req.method === 'POST') {
      const { userId, username, action, details, ipAddress } = req.body;
      const newLog = await AuditLog.create({
        userId,
        username: username || 'Hệ thống / GUEST',
        action,
        details,
        ipAddress: ipAddress || req.headers['x-forwarded-for'] || 'Unknown'
      });
      return res.status(201).json(newLog);
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error("API Logs Error:", error);
    return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
  }
}
