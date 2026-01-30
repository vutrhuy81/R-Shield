import React, { useState, KeyboardEvent } from 'react';
import { SearchTerm, DataSource, SearchType, LocationOption, Language } from '../types';
import { translations } from '../translations';
import { X, Search, Calendar, Sparkles, ExternalLink, MapPin, Globe, CheckCircle2, AlertTriangle, FileWarning, ClipboardCheck } from 'lucide-react';

// --- Interface mở rộng cho Checklist ---
interface ChecklistItem {
  sign: string;
  detected: boolean;
  reason: string;
}

interface TagInputProps {
  terms: SearchTerm[];
  onAddTerm: (term: string) => void;
  onRemoveTerm: (id: string) => void;
  onAnalyze: () => Promise<any>; // [UPDATED] Đổi thành Promise để nhận data trả về
  isLoading: boolean;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  geoLocation: string;
  setGeoLocation: (geo: string) => void;
  searchType: SearchType;
  setSearchType: (type: SearchType) => void;
  lang: Language;
}

const LOCATIONS: LocationOption[] = [
  { code: 'VN', name: 'Vietnam' },
  { code: '', name: 'Worldwide' },
  { code: 'US', name: 'United States' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
];

const SEARCH_TYPES: { value: SearchType; label: string; labelEn: string }[] = [
  { value: 'web', label: 'Tìm kiếm Web', labelEn: 'Web Search' },
  { value: 'images', label: 'Hình ảnh', labelEn: 'Image Search' },
  { value: 'news', label: 'Tin tức', labelEn: 'News Search' },
  { value: 'froogle', label: 'Mua sắm', labelEn: 'Shopping' },
  { value: 'youtube', label: 'YouTube', labelEn: 'YouTube Search' },
];

// --- Sub-component: Rumor Checklist Modal ---
const RumorChecklistModal = ({ 
    isOpen, 
    onClose, 
    items, 
    lang 
}: { isOpen: boolean; onClose: () => void; items: ChecklistItem[]; lang: Language }) => {
    if (!isOpen) return null;

    const detectedCount = items.filter(i => i.detected).length;
    const riskLevel = detectedCount >= 4 ? 'CAO (High)' : detectedCount >= 2 ? 'TRUNG BÌNH (Medium)' : 'THẤP (Low)';
    const riskColor = detectedCount >= 4 ? 'text-red-600 bg-red-50' : detectedCount >= 2 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                            <ClipboardCheck className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">
                                {lang === 'vi' ? 'Checklist Nhận Diện Tin Đồn' : 'Rumor Identification Checklist'}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">R-Shield Intelligence</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className={`mb-6 p-4 rounded-xl border ${riskColor} flex items-center gap-4`}>
                        <AlertTriangle size={24} className={detectedCount >= 2 ? 'animate-pulse' : ''} />
                        <div>
                            <p className="text-sm font-bold opacity-80 uppercase">{lang === 'vi' ? 'Mức độ rủi ro tin giả' : 'Fake News Risk Level'}</p>
                            <p className="text-2xl font-black tracking-wide">{riskLevel}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {items.map((item, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border transition-all ${item.detected ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100 opacity-70'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className={`font-bold text-sm flex items-center gap-2 ${item.detected ? 'text-red-700' : 'text-gray-700'}`}>
                                        {item.detected ? <FileWarning size={16}/> : <CheckCircle2 size={16}/>}
                                        {item.sign}
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.detected ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-600'}`}>
                                        {item.detected ? (lang === 'vi' ? 'Phát hiện' : 'Detected') : (lang === 'vi' ? 'An toàn' : 'Safe')}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 italic pl-6 border-l-2 border-gray-300">
                                    "{item.reason}"
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-200">
                        {lang === 'vi' ? 'Đã hiểu' : 'Close Analysis'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TagInput: React.FC<TagInputProps> = ({ 
  terms, onAddTerm, onRemoveTerm, onAnalyze, isLoading, startDate, endDate, onStartDateChange, onEndDateChange,
  dataSource, setDataSource, geoLocation, setGeoLocation, searchType, setSearchType, lang
}) => {
  const [inputValue, setInputValue] = useState('');
  const [checklistData, setChecklistData] = useState<ChecklistItem[] | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const t = translations[lang];

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTerm(); }
  };

  const addTerm = () => {
    if (inputValue.trim()) {
      onAddTerm(inputValue.trim());
      setInputValue('');
    }
  };

  // Hàm xử lý wrapper để nhận dữ liệu và hiển thị Checklist
  const handleAnalyzeWrapper = async () => {
    if (terms.length === 0) return;
    
    // Gọi hàm phân tích từ cha
    try {
        const result = await onAnalyze();
        
        // Nếu kết quả trả về có checklist, hiển thị modal
        if (result && result.checklist) {
            setChecklistData(result.checklist);
            setShowChecklist(true);
        }
    } catch (e) {
        console.error("Analysis failed", e);
    }
  };

  return (
    <>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" /> {t.exploreTrends}
            </h2>
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <button onClick={() => setDataSource('GEMINI')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${dataSource === 'GEMINI' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500'}`}>
                <Sparkles size={14} /> {t.geminiAi}
              </button>
              <button onClick={() => setDataSource('GOOGLE_TRENDS')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${dataSource === 'GOOGLE_TRENDS' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500'}`}>
                <ExternalLink size={14} /> {t.googleTrends}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[150px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500"><MapPin size={16} /></div>
              <select value={geoLocation} onChange={(e) => setGeoLocation(e.target.value)} className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-lg w-full pl-9 pr-8 py-2.5 outline-none">
                {LOCATIONS.map(loc => <option key={loc.code} value={loc.code}>{loc.name}</option>)}
              </select>
            </div>
            <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="border border-gray-200 text-sm rounded-lg px-3 py-2.5 outline-none flex-1 min-w-[150px]" />
            <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="border border-gray-200 text-sm rounded-lg px-3 py-2.5 outline-none flex-1 min-w-[150px]" />
            <div className="relative flex-1 min-w-[150px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500"><Globe size={16} /></div>
              <select value={searchType} onChange={(e) => setSearchType(e.target.value as SearchType)} className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-lg w-full pl-9 pr-8 py-2.5 outline-none">
                {SEARCH_TYPES.map(type => <option key={type.value} value={type.value}>{lang === 'vi' ? type.label : type.labelEn}</option>)}
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 p-2 min-h-[50px] bg-gray-50 border border-gray-200 rounded-lg">
              {terms.map((term) => (
                <div key={term.id} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-sm font-medium shadow-sm" style={{ backgroundColor: term.color }}>
                  <span>{term.term}</span>
                  <button onClick={() => onRemoveTerm(term.id)} className="hover:bg-black/20 rounded-full p-0.5"><X size={14} /></button>
                </div>
              ))}
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={terms.length === 0 ? t.inputPlaceholder : t.addMore} className="flex-1 bg-transparent border-none outline-none min-w-[150px] p-1 text-gray-700" disabled={isLoading} />
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-1">{t.enterHint}</div>
            
            <div className="flex justify-between items-center pt-2">
                {/* Nút xem lại checklist nếu đã có dữ liệu */}
                {checklistData && !isLoading && (
                    <button onClick={() => setShowChecklist(true)} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 animate-in fade-in">
                        <ClipboardCheck size={16}/> {lang === 'vi' ? 'Xem lại kết quả Checklist' : 'Review Checklist'}
                    </button>
                )}
                
                <button onClick={handleAnalyzeWrapper} disabled={isLoading || terms.length === 0} className={`ml-auto w-full md:w-auto px-6 py-2.5 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2 ${isLoading || terms.length === 0 ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>
                    {isLoading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t.processing}</> : dataSource === 'GEMINI' ? <><Sparkles size={18} /> {t.collectData}</> : <><ExternalLink size={18} /> {t.openGoogleTrends}</>}
                </button>
            </div>
          </div>
        </div>

        {/* Modal hiển thị Checklist */}
        <RumorChecklistModal 
            isOpen={showChecklist} 
            onClose={() => setShowChecklist(false)} 
            items={checklistData || []} 
            lang={lang} 
        />
    </>
  );
};

export default TagInput;
