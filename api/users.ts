import { connectToDatabase } from './_lib/mongodb';
import { User, AuditLog } from './_lib/models';
import { sendAdminAlert } from './_lib/emailService';

export default async function handler(req: any, res: any) {
  await connectToDatabase();
  const { adminUsername } = req.headers; // Hoặc verify qua JWT

  if (req.method === 'GET') {
    const users = await User.find({}).select('-password');
    return res.status(200).json(users);
  }

  if (req.method === 'POST') {
    const { username, password, email, role } = req.body;
    const newUser = await User.create({ username, password, email, role });
    
    await AuditLog.create({ username: adminUsername, action: 'CREATE_USER', details: { target: username } });
    await sendAdminAlert('CREATE_USER', adminUsername, { targetUser: username });
    
    return res.status(201).json(newUser);
  }

  // Bổ sung các logic PUT (update) và DELETE tương tự...
}
