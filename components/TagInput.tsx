
import React, { useState, KeyboardEvent } from 'react';
import { SearchTerm, DataSource, SearchType, LocationOption, Language } from '../types';
import { translations } from '../translations';
import { X, Search, Calendar, Sparkles, ExternalLink, MapPin, Globe } from 'lucide-react';

interface TagInputProps {
  terms: SearchTerm[];
  onAddTerm: (term: string) => void;
  onRemoveTerm: (id: string) => void;
  onAnalyze: () => void;
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

const TagInput: React.FC<TagInputProps> = ({ 
  terms, onAddTerm, onRemoveTerm, onAnalyze, isLoading, startDate, endDate, onStartDateChange, onEndDateChange,
  dataSource, setDataSource, geoLocation, setGeoLocation, searchType, setSearchType, lang
}) => {
  const [inputValue, setInputValue] = useState('');
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

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
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
        <div className="flex justify-end pt-2">
          <button onClick={onAnalyze} disabled={isLoading || terms.length === 0} className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2 ${isLoading || terms.length === 0 ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>
            {isLoading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t.processing}</> : dataSource === 'GEMINI' ? <><Sparkles size={18} /> {t.collectData}</> : <><ExternalLink size={18} /> {t.openGoogleTrends}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagInput;
