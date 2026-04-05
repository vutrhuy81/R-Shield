// src/components/AdminPanel.tsx
import React, { useState, useEffect } from 'react';
import { Users, Activity, Mail } from 'lucide-react';

export const AdminPanel: React.FC<{ user: any }> = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState<'USERS' | 'LOGS' | 'EMAIL'>('USERS');
  const [mailContent, setMailContent] = useState('');

  // Fetch dữ liệu khi render
  useEffect(() => {
    if (activeTab === 'USERS') fetch('/api/users').then(res => res.json()).then(setUsers);
    if (activeTab === 'LOGS') fetch('/api/logs').then(res => res.json()).then(setLogs);
  }, [activeTab]);

  const handleSendMail = async () => {
    // Logic gọi API gửi mail
    await fetch('/api/emails/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Thông báo từ hệ thống R-SHIELD', message: mailContent })
    });
    alert('Đã gửi email thành công!');
    setMailContent('');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex gap-4 border-b pb-4 mb-4">
        <button onClick={() => setActiveTab('USERS')} className={`flex items-center gap-2 ${activeTab === 'USERS' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}><Users size={18}/> Quản lý Users</button>
        <button onClick={() => setActiveTab('LOGS')} className={`flex items-center gap-2 ${activeTab === 'LOGS' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}><Activity size={18}/> Xem Nhật Ký</button>
        <button onClick={() => setActiveTab('EMAIL')} className={`flex items-center gap-2 ${activeTab === 'EMAIL' ? 'text-blue-600 font-bold' : 'text-gray-500'}`}><Mail size={18}/> Gửi Email Hàng Loạt</button>
      </div>

      {/* RENDER NỘI DUNG THEO TAB */}
      {activeTab === 'USERS' && (
        <div>
          {/* Bảng danh sách user, nút thêm, sửa, xóa sẽ nằm ở đây */}
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="bg-gray-50 text-gray-700 uppercase">
              <tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u._id} className="border-b">
                  <td className="py-2">{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</td>
                  <td><button className="text-blue-500 hover:underline">Sửa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="max-h-96 overflow-y-auto">
          {logs.map((log: any) => (
            <div key={log._id} className="border-b py-2 text-sm">
              <span className="text-gray-400">[{new Date(log.createdAt).toLocaleString()}]</span> 
              <strong className="mx-2">{log.username}</strong> 
              <span className="text-blue-600 font-mono">{log.action}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'EMAIL' && (
        <div className="flex flex-col gap-4">
          <textarea 
            className="w-full border rounded p-4 outline-none focus:border-blue-500" 
            rows={5} 
            placeholder="Nhập nội dung thông báo gửi đến toàn bộ người dùng..."
            value={mailContent}
            onChange={(e) => setMailContent(e.target.value)}
          />
          <button onClick={handleSendMail} className="bg-blue-600 text-white px-6 py-2 rounded font-medium w-fit">Phát sóng Email</button>
        </div>
      )}
    </div>
  );
};
