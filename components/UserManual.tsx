
import React from 'react';
import { translations } from '../translations';
import { Language } from '../types';
import { X, Database, ShieldCheck, Sparkles, Activity, BookOpen, Wand2, ShieldAlert, MessageSquare } from 'lucide-react';

interface UserManualProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose, lang }) => {
  const t = translations[lang];
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full my-8 flex flex-col animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t.manualTitle}</h3>
              <p className="text-blue-100 text-xs font-medium opacity-80">{lang === 'vi' ? 'Phiên bản 2.0 - Tích hợp AI' : 'v2.0 - AI Integrated'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all active:scale-90">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8 max-h-[70vh] custom-scrollbar">
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 italic text-blue-800 text-sm leading-relaxed">
            "{t.manualIntro}"
          </div>

          <section className="space-y-4">
            <h4 className="text-blue-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-blue-600 pl-3">
              <Database size={18} /> {t.manualDataTitle}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-2">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="inline-block w-6 h-6 bg-blue-600 text-white rounded-full text-center text-xs leading-6 font-bold mr-2">1</span>
                  {t.manualData1}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="inline-block w-6 h-6 bg-blue-600 text-white rounded-full text-center text-xs leading-6 font-bold mr-2">2</span>
                  {t.manualData2}
                </p>
              </div>
              <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-200 md:col-span-2">
                <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-600" />
                  {t.manualData3}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-indigo-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-indigo-600 pl-3">
              <ShieldCheck size={18} /> {t.manualModelTitle}
            </h4>
            <div className="ml-2 space-y-3">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-3">
                    <div className="mt-1"><Activity size={14} className="text-indigo-500" /></div>
                    {t.manualModel1}
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1"><Activity size={14} className="text-indigo-500" /></div>
                    {t.manualModel2}
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1"><Activity size={14} className="text-indigo-500" /></div>
                    {t.manualModel3}
                  </li>
                </ul>
              </div>
              <div className="bg-indigo-700 text-white p-4 rounded-2xl shadow-lg flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Wand2 size={20} />
                </div>
                <p className="text-sm font-semibold">{t.manualModel4}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-red-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-red-600 pl-3">
              <ShieldAlert size={18} /> {t.manualIntervTitle}
            </h4>
            <ul className="space-y-3 text-sm text-gray-700 ml-5 list-disc">
              <li>{t.manualInterv1}</li>
              <li>{t.manualInterv2}</li>
              <li>{t.manualInterv3}</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h4 className="text-amber-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-amber-600 pl-3">
              <MessageSquare size={18} /> {t.manualConsultTitle}
            </h4>
            <div className="ml-5 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
               <Sparkles size={18} className="text-amber-600 mt-1 shrink-0" />
               <p className="text-sm text-amber-900 leading-relaxed italic">{t.manualConsult1}</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end rounded-b-3xl">
          <button 
            onClick={onClose} 
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-bold hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 shadow-lg text-sm"
          >
            {t.gotIt}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
