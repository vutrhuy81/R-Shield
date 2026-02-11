
import React from 'react';
import { translations } from '../translations';
import { Language } from '../types';
import { X, MessageCircleQuestion, ChevronRight, HelpCircle } from 'lucide-react';

interface QAModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const QAModal: React.FC<QAModalProps> = ({ isOpen, onClose, lang }) => {
  const t = translations[lang];
  if (!isOpen) return null;

  const sections = [
    { title: t.qa_sec1, start: 1, end: 6 },
    { title: t.qa_sec2, start: 7, end: 14 },
    { title: t.qa_sec3, start: 15, end: 22 },
    { title: t.qa_sec4, start: 23, end: 27 },
    { title: t.qa_sec5, start: 28, end: 30 },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8 flex flex-col animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-800 to-indigo-900 text-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <MessageCircleQuestion size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t.qaTitle}</h3>
              <p className="text-blue-100 text-xs font-medium opacity-80">R-Shield Knowledge Base</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all active:scale-90">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-10 max-h-[75vh] custom-scrollbar">
          {sections.map((section, sIdx) => (
            <section key={sIdx} className="space-y-4">
              <h4 className="text-indigo-700 font-bold flex items-center gap-2 uppercase text-sm tracking-widest border-l-4 border-indigo-600 pl-3 sticky top-0 bg-white py-2 z-10">
                {section.title}
              </h4>
              <div className="space-y-6 ml-2">
                {Array.from({ length: section.end - section.start + 1 }, (_, i) => {
                  const qId = section.start + i;
                  return (
                    <div key={qId} className="group">
                      <div className="flex gap-3 mb-2">
                        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          {qId}
                        </span>
                        <h5 className="font-bold text-gray-800 text-base group-hover:text-indigo-600 transition-colors">
                          {(t as any)[`q${qId}`]}
                        </h5>
                      </div>
                      <div className="ml-11 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-sm text-gray-600 leading-relaxed italic relative">
                        <div className="absolute top-4 -left-2 w-4 h-4 bg-gray-50 border-l border-b border-gray-100 rotate-45"></div>
                        {(t as any)[`a${qId}`]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end rounded-b-3xl">
          <button onClick={onClose} className="px-8 py-3 bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-xl font-bold hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 shadow-lg text-sm">
            {t.gotIt}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QAModal;
