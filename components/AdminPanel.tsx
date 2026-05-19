// src/components/AdminPanel.tsx
import React, { useState, useEffect } from 'react';
import { Users, Activity, Mail, Plus, Edit, X, Save, FileJson } from 'lucide-react';

// Hàm lấy Token chuẩn
const getAuthHeaders = () => {
  const token = localStorage.getItem('rshield_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Bắt buộc phải có dòng này!
  };
};

export const AdminPanel: React.FC<{ user: any }> = ({ user }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'USERS' | 'LOGS' | 'EMAIL'>('USERS');
  const [mailContent, setMailContent] = useState('');
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<any>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'GUEST', isActive: true });

  // --- SỬA LẠI HÀM FETCH ĐỂ TRUYỀN TOKEN ---
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { headers: getAuthHeaders() });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs', { headers: getAuthHeaders() });
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (activeTab === 'USERS') fetchUsers();
    if (activeTab === 'LOGS') fetchLogs();
  }, [activeTab]);

  const handleSendMail = async () => {
    if (!mailContent.trim()) return alert('Vui lòng nhập nội dung!');
    setIsSendingMail(true);
    try {
      const res = await fetch('/api/emails/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ subject: 'Thông báo từ R-SHIELD', message: mailContent })
      });
      const data = await res.json();
      if (res.ok) { alert('✅ ' + data.message); setMailContent(''); } 
      else alert('❌ Lỗi: ' + data.message);
    } catch (error) { alert('Lỗi mạng.'); } 
    finally { setIsSendingMail(false); }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const body = editingUser ? { id: editingUser._id, ...formData } : formData;

      const res = await fetch('/api/users', {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Lỗi hệ thống');
      }

      alert(editingUser ? 'Cập nhật thành công!' : 'Tạo mới thành công!');
      setIsModalOpen(false);
      fetchUsers(); 
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => { setEditingUser(null); setFormData({ username: '', email: '', password: '', role: 'GUEST', isActive: true }); setIsModalOpen(true); };
  const openEditModal = (u: any) => { setEditingUser(u); setFormData({ username: u.username, email: u.email, password: '', role: u.role, isActive: u.isActive }); setIsModalOpen(true); };
  
  const getActionColor = (action: string) => {
      if(action.includes('RSHIELD')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      if(action.includes('DATA')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      if(action.includes('LOGIN') || action.includes('LOGOUT')) return 'bg-gray-100 text-gray-800 border-gray-200';
      return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    // Phần Return giao diện UI HTML giữ nguyên 100% không đổi
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative">
      <div className="flex gap-4 border-b pb-4 mb-4">
        <button onClick={() => setActiveTab('USERS')} className={`flex items-center gap-2 ${activeTab === 'USERS' ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-blue-500'}`}><Users size={18}/> Quản lý Users</button>
        <button onClick={() => setActiveTab('LOGS')} className={`flex items-center gap-2 ${activeTab === 'LOGS' ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-blue-500'}`}><Activity size={18}/> Xem Nhật Ký</button>
        <button onClick={() => setActiveTab('EMAIL')} className={`flex items-center gap-2 ${activeTab === 'EMAIL' ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-blue-500'}`}><Mail size={18}/> Gửi Email Hàng Loạt</button>
      </div>

      {activeTab === 'USERS' && (
        <div className="animate-in fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700">Danh sách Tài khoản</h3>
            <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Plus size={16}/> Thêm User mới</button>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-bold border-b">
                <tr><th className="px-4 py-3">Username</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-center">Hành động</th></tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u._id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{u.role}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td>
                    <td className="px-4 py-3 text-center"><button onClick={() => openEditModal(u)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded" title="Sửa thông tin"><Edit size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="bg-white border rounded-lg overflow-hidden animate-in fade-in">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-bold border-b">
               <tr><th className="px-4 py-3 w-40">Thời gian</th><th className="px-4 py-3 w-32">Tài khoản</th><th className="px-4 py-3">Loại hành động</th><th className="px-4 py-3 text-right">Chi tiết</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log: any) => (
                <tr key={log._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 font-bold text-gray-800">{log.username}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getActionColor(log.action)}`}>{log.action}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setSelectedLogDetail(log)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold inline-flex items-center gap-1.5"><FileJson size={14}/> Xem Payload</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLogDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <div>
                          <h3 className="font-bold text-gray-800 flex items-center gap-2">Chi tiết nhật ký hệ thống<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getActionColor(selectedLogDetail.action)}`}>{selectedLogDetail.action}</span></h3>
                          <p className="text-xs text-gray-500 mt-1">User: <b>{selectedLogDetail.username}</b> • Time: {new Date(selectedLogDetail.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                      <button onClick={() => setSelectedLogDetail(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-0 overflow-y-auto flex-1 bg-gray-900"><pre className="text-xs text-green-400 font-mono p-6 whitespace-pre-wrap">{JSON.stringify(selectedLogDetail.details, null, 2)}</pre></div>
                  <div className="p-3 border-t bg-gray-50 flex justify-end"><button onClick={() => setSelectedLogDetail(null)} className="px-5 py-2 bg-gray-800 text-white text-sm font-medium rounded hover:bg-gray-700">Đóng</button></div>
              </div>
          </div>
      )}

      {activeTab === 'EMAIL' && (
        <div className="flex flex-col gap-4 animate-in fade-in max-w-3xl mt-4">
          <label className="text-sm font-semibold text-gray-700">Soạn thông báo hệ thống</label>
          <textarea className="w-full border rounded-lg p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all min-h-[150px]" placeholder="Nhập nội dung thông báo..." value={mailContent} onChange={(e) => setMailContent(e.target.value)} />
          <button onClick={handleSendMail} disabled={isSendingMail} className={`px-6 py-2.5 rounded-lg font-medium w-fit flex items-center justify-center gap-2 shadow-sm text-white ${isSendingMail ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {isSendingMail ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Mail size={18}/>}
            {isSendingMail ? 'Đang gửi...' : 'Gửi thông báo Email'}
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-bold text-gray-800">{editingUser ? 'Chỉnh sửa User' : 'Thêm User mới'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Username</label>
                <input required type="text" disabled={!!editingUser} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-blue-500 disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mật khẩu {editingUser && <span className="text-gray-400 font-normal">(Bỏ trống nếu không đổi)</span>}</label>
                <input required={!editingUser} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Vai trò</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-2 border rounded outline-none focus:border-blue-500 bg-white">
                    <option value="GUEST">GUEST</option><option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label>
                  <select value={formData.isActive ? 'true' : 'false'} onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})} className="w-full p-2 border rounded outline-none focus:border-blue-500 bg-white">
                    <option value="true">Hoạt động</option><option value="false">Khóa tài khoản</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Hủy</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2">
                  {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save size={18}/>} Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};