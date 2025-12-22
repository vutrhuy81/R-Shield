
import React from 'react';
import { translations } from '../translations';
import { Language } from '../types';
import { X, Database, ShieldCheck, Sparkles, Activity } from 'lucide-react';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose, lang }) => {
  const t = translations[lang];
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
          <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles size={22} /> {t.manualTitle}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-8">
          <section className="space-y-3">
            <h4 className="text-blue-700 font-bold flex items-center gap-2 uppercase text-xs tracking-wider"><Database size={16} /> {t.manualDataTitle}</h4>
            <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
              <li>{t.manualData1}</li>
              <li>{t.manualData2}</li>
            </ul>
          </section>
          <section className="space-y-3">
            <h4 className="text-indigo-700 font-bold flex items-center gap-2 uppercase text-xs tracking-wider"><ShieldCheck size={16} /> {t.manualModelTitle}</h4>
            <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
              <li>{t.manualModel1}</li>
              <li>{t.manualModel2}</li>
            </ul>
          </section>
          <section className="space-y-3">
            <h4 className="text-amber-700 font-bold flex items-center gap-2 uppercase text-xs tracking-wider"><Activity size={16} /> {t.manualConsultTitle}</h4>
            <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
              <li>{t.manualConsult1}</li>
            </ul>
          </section>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm">{t.gotIt}</button>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
