import React from 'react';
import { translations } from '../translations';
import { Language } from '../types';
import { X, Database, ShieldCheck, Sparkles, Activity, BookOpen, Wand2, ShieldAlert, MessageSquare, Target, Search, Settings } from 'lucide-react';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose, lang }) => {
  const t = translations[lang];
  const isVi = lang === 'vi';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8 flex flex-col animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t.manualTitle}</h3>
              <p className="text-blue-100 text-xs font-medium opacity-80">
                {isVi ? 'Phiên bản 2.1 - R-Shield Pro & Auto-Fit' : 'v2.1 - R-Shield Pro & Auto-Fit'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all active:scale-90">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8 max-h-[75vh] custom-scrollbar">
          
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 italic text-blue-800 text-sm leading-relaxed text-center">
            "{isVi 
              ? 'Hướng dẫn sử dụng hệ thống mô phỏng và ngăn chặn tin giả tích hợp AI & Mô hình toán học SEIR mở rộng.' 
              : 'User manual for the AI-integrated Disinformation Simulation & Prevention System based on extended SEIR model.'}"
          </div>

          {/* 1. INPUT DATA */}
          <section className="space-y-4">
            <h4 className="text-blue-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-blue-600 pl-3">
              <Database size={18} /> {isVi ? '1. Thu thập dữ liệu (Input)' : '1. Data Collection'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-2">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                 <h5 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                    <Search size={14} className="text-blue-500"/> {isVi ? 'Nguồn dữ liệu' : 'Data Sources'}
                 </h5>
                 <ul className="text-sm text-gray-600 space-y-2">
                    <li><span className="font-semibold text-blue-600">Google Trends:</span> {isVi ? 'Dữ liệu chỉ số quan tâm thực tế tại Google Trend.' : 'The data shows actual interest in Google Trend.'}</li>
                    <li><span className="font-semibold text-purple-600">Gemini AI:</span> {isVi ? 'Dữ liệu chỉ số quan tâm thu thập bởi AI.' : 'Interest index data collected by AI.'}</li>
                 </ul>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                 <h5 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                    <Settings size={14} className="text-blue-500"/> {isVi ? 'Bộ lọc & Từ khóa' : 'Filters & Keywords'}
                 </h5>
                 <p className="text-sm text-gray-600 leading-relaxed">
                    {isVi 
                     ? 'Hỗ trợ lọc theo Vị trí (Geo), Thời gian, và Loại tìm kiếm (Web, Youtube, News...). Nhập từ khóa và nhấn Enter để thêm.' 
                     : 'Supports filtering by Geo, Date range, and Search Type. Type keyword and hit Enter to add.'}
                 </p>
              </div>
            </div>
          </section>

          {/* 2. SIMULATION CONFIG */}
          <section className="space-y-4">
            <h4 className="text-indigo-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-indigo-600 pl-3">
              <Activity size={18} /> {isVi ? '2. Cấu hình mô phỏng (SEIR Model)' : '2. Simulation Config'}
            </h4>
            <div className="ml-2 space-y-3">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <p className="text-sm text-gray-700 mb-2">
                    {isVi ? 'Điều chỉnh các tham số lây lan tự nhiên của thông tin:' : 'Adjust natural spread parameters:'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-indigo-800">
                    <div className="bg-white p-2 rounded border border-indigo-100">Beta (β): {isVi ? 'Lây nhiễm' : 'Infection'}</div>
                    <div className="bg-white p-2 rounded border border-indigo-100">Alpha (α): {isVi ? 'Ủ tin' : 'Incubation'}</div>
                    <div className="bg-white p-2 rounded border border-indigo-100">Gamma (γ): {isVi ? 'Hồi phục' : 'Recovery'}</div>
                    <div className="bg-white p-2 rounded border border-indigo-100">Tau (τ): {isVi ? 'Độ trễ' : 'Time Delay'}</div>
                </div>
              </div>
              
              {/* Feature: Auto-Fit */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-2xl shadow-lg flex items-start gap-4">
                <div className="bg-white/20 p-2 rounded-lg mt-1">
                  <Wand2 size={20} />
                </div>
                <div>
                    <h5 className="font-bold text-sm mb-1">{isVi ? 'Tính năng: Auto-Fit (Tự động khớp)' : 'Feature: Auto-Fit'}</h5>
                    <p className="text-xs opacity-90 leading-relaxed">
                        {isVi 
                         ? 'Sử dụng thuật toán Grid Search để tự động tìm bộ tham số (Beta, Alpha, Gamma, N) sao cho đường mô phỏng khớp nhất với dữ liệu thực tế đầu vào.' 
                         : 'Uses Grid Search algorithm to automatically find parameters that best fit the simulation curve to real input data.'}
                    </p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. INTERVENTION & Rc */}
          <section className="space-y-4">
            <h4 className="text-red-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-red-600 pl-3">
              <ShieldAlert size={18} /> {isVi ? '3. Chiến lược & Chỉ số Rc' : '3. Strategy & Rc Index'}
            </h4>
            
            <div className="ml-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <p className="text-sm text-gray-700">
                        {isVi ? 'Các tham số can thiệp (Lá chắn):' : 'Intervention parameters (Shield):'}
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                        <li><b className="text-red-600">Intervention Day:</b> {isVi ? 'Ngày bắt đầu kích hoạt.' : 'Start day.'}</li>
                        <li><b className="font-mono">u_p:</b> {isVi ? 'Giáo dục/Phòng ngừa (Giảm S).' : 'Prevention (Reduce S).'}</li>
                        <li><b className="font-mono">u_g & rho:</b> {isVi ? 'Phản bác tin giả (Truth Sandwich)-Ngăn chặn E --> I.' : 'Counter-narrative-Reduce E --> I.'}</li>
                        <li><b className="font-mono">v (nu):</b> {isVi ? 'Biện pháp kỹ thuật/Chặn (Giảm I).' : 'Technical blocking.'}</li>
                    </ul>
                </div>

                {/* Feature: Rc & Auto-Optimize */}
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-red-200 pb-2">
                        <Target size={16} className="text-red-600"/>
                        <span className="font-bold text-red-800 text-sm">Target: Rc ≤ 1.0</span>
                    </div>
                    <p className="text-xs text-red-800 leading-relaxed">
                        {isVi 
                         ? 'Chỉ số Rc (Reproduction under Control) cho biết dịch tin giả có đang bùng phát (>1) hay được kiểm soát (≤1).'
                         : 'Rc Index indicates if the rumor is spreading (>1) or under control (≤1).'}
                    </p>
                    <div className="mt-auto bg-white p-2 rounded-lg border border-red-100 text-xs text-gray-600 flex items-center gap-2">
                        <Target size={12} />
                        <span>
                            {isVi ? 'Nút "Auto Fit Rc=1" sẽ tự động tính toán v và u_g cần thiết.' : 'Button "Auto Fit Rc=1" calculates needed resources.'}
                        </span>
                    </div>
                </div>
            </div>
          </section>

          {/* 4. EXPERT CONSULTATION */}
          <section className="space-y-4">
            <h4 className="text-amber-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-amber-600 pl-3">
              <MessageSquare size={18} /> {isVi ? '4. Góc nhìn chuyên gia AI' : '4. AI Expert View'}
            </h4>
            <div className="ml-2 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
               <Sparkles size={18} className="text-amber-600 mt-1 shrink-0" />
               <p className="text-sm text-amber-900 leading-relaxed">
                  {isVi 
                   ? 'Hệ thống gửi toàn bộ dữ liệu mô phỏng (Đỉnh dịch, tổng số lây nhiễm) và tham số hiện tại tới AI Model. AI sẽ đóng vai chuyên gia an ninh thông tin để phân tích tình hình và đề xuất giải pháp cụ thể (Nội dung truyền thông, biện pháp kỹ thuật) dựa trên ngữ cảnh.'
                   : 'The system sends simulation data and parameters to AI Model. The AI acts as an info-sec expert to analyze the situation and recommend specific context-aware solutions.'}
               </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end rounded-b-3xl">
          <button 
            onClick={onClose} 
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-bold hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 shadow-lg text-sm"
          >
            {isVi ? 'Đã hiểu, bắt đầu ngay!' : 'Got it, let\'s start!'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
