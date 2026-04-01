import React, { useState, useEffect, useMemo } from 'react';
import { SearchTerm, TrendDataPoint, LoadingState, DataSource, SearchType, User, Language, TrendAnalysisResponse } from './types';
import { GOOGLE_COLORS, K_FACTOR, DEFAULT_REAL_DATA } from './constants';
import { translations } from './translations';
import TagInput from './components/TagInput';
import TrendChart from './components/TrendChart';
import TrendTable from './components/TrendTable';
import EstimatedReachTable from './components/EstimatedReachTable';
import RShieldTab from './components/RShieldTab';
import LoginPage from './components/LoginPage';
import UserManual from './components/UserManual';
import QAModal from './components/QAModal';
import { fetchTrendData } from './services/geminiService';
// ĐÃ THÊM: Import Filter và ArrowUpDown cho UI Lọc/Sắp xếp
import { AlertCircle, TrendingUp, ShieldCheck, Database, LogOut, HelpCircle, User as UserIcon, Sparkles, ExternalLink, Globe, MessageCircleQuestion, Filter, ArrowUpDown } from 'lucide-react';
import { marked } from 'marked';

const App: React.FC = () => {
  // --- Auth & Language State ---
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('vi');
  const t = translations[lang];
  
  // --- App State ---
  const [activeTab, setActiveTab] = useState<'DATA' | 'R_SHIELD'>('DATA');
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isQAOpen, setIsQAOpen] = useState(false);

  // --- Data Collection State ---
  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [groundingMetadata, setGroundingMetadata] = useState<any>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [dataSource, setDataSource] = useState<DataSource>('GEMINI');

  // --- Sorting & Filtering State (MỚI) ---
  const [filterText, setFilterText] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // --- R-Shield Model State ---
  const [realData, setRealData] = useState<any[]>(DEFAULT_REAL_DATA);

  // Filters State
  const [geoLocation, setGeoLocation] = useState<string>('VN');
  const [searchType, setSearchType] = useState<SearchType>('web');

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState<string>(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(today.toISOString().split('T')[0]);

  // Sync Logic: Automatically update R-Shield real data when trend data is fetched
  useEffect(() => {
    if (data && data.length > 0 && terms.length > 0) {
      // Sort data chronologically to map to Day 0, Day 1...
      const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const syncedData = sorted.map((point, index) => {
        let totalReach = 0;
        // Sum reach for all tracked terms on this day
        terms.forEach(term => {
          const indexValue = Number(point[term.term] || 0);
          totalReach += Math.round(indexValue * K_FACTOR);
        });
        
        return {
          day: index,
          real_I: totalReach
        };
      });

      setRealData(syncedData);
    }
  }, [data, terms]);

  // --- Logic Xử lý Dữ liệu Lọc & Sắp xếp (MỚI) ---
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Lọc dữ liệu (Filter)
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      result = result.filter(item => {
        // Lọc theo ngày
        if (item.date && String(item.date).toLowerCase().includes(lowerFilter)) return true;
        // Lọc theo giá trị của từng từ khóa
        return terms.some(t => {
          const val = item[t.term];
          return val !== undefined && String(val).toLowerCase().includes(lowerFilter);
        });
      });
    }

    // 2. Sắp xếp dữ liệu (Sort)
    if (sortConfig) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (valA === undefined) valA = '';
        if (valB === undefined) valB = '';

        // Ưu tiên sắp xếp theo số (nếu là dữ liệu độ quan tâm)
        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        // Sắp xếp theo chuỗi (dành cho cột Ngày)
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, filterText, sortConfig, terms]);

  useEffect(() => {
    if (user && user.role === 'GUEST') {
      setActiveTab('R_SHIELD');
    } else {
      setActiveTab('DATA');
    }
  }, [user]);

  const handleLogin = (userData: User) => setUser(userData);
  const handleLogout = () => { setUser(null); setData([]); setTerms([]); };
  const toggleLang = () => setLang(prev => prev === 'vi' ? 'en' : 'vi');

  const handleAddTerm = (termText: string) => {
    if (terms.some(t => t.term.toLowerCase() === termText.toLowerCase())) return;
    if (terms.length >= 5) { alert(t.maxTerms); return; }
    const newTerm: SearchTerm = {
      id: Date.now().toString() + Math.random().toString(),
      term: termText,
      color: GOOGLE_COLORS[terms.length % GOOGLE_COLORS.length]
    };
    setTerms([...terms, newTerm]);
  };

  const handleRemoveTerm = (id: string) => setTerms(terms.filter(t => t.id !== id));

  const handleAnalyze = async (): Promise<TrendAnalysisResponse | undefined> => {
    if (terms.length === 0) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start > end) { 
        setErrorMessage(t.dateError); 
        setLoadingState(LoadingState.ERROR); 
        return; 
    }

    if (start > today || end > today+1) {
        setErrorMessage(t.futureDateError);
        setLoadingState(LoadingState.ERROR);
        return;
    }

    if (dataSource === 'GOOGLE_TRENDS') {
        const termStrings = terms.map(term => encodeURIComponent(term.term)).join(',');
        const url = `https://trends.google.com/explore?q=${termStrings}&date=${startDate}%20${endDate}&geo=${geoLocation}`;
        window.open(url, '_blank');
        return;
    }

    setLoadingState(LoadingState.LOADING);
    setErrorMessage("");
    setSummary("");
    setGroundingMetadata(null);
    setData([]);
    
    // ĐÃ THÊM: Reset Filter & Sort khi phân tích dữ liệu mới
    setFilterText("");
    setSortConfig(null);

    try {
      const termStrings = terms.map(term => term.term);
      const response = await fetchTrendData(termStrings, startDate, endDate, geoLocation, searchType, lang);

      setData(response.data);
      setSummary(response.summary);
      setGroundingMetadata(response.groundingMetadata);
      setLoadingState(LoadingState.SUCCESS);
      
      return response; 
      
    } catch (error: any) {
      setLoadingState(LoadingState.ERROR);
      setErrorMessage(error.message || "Error");
      throw error;
    }
  };

  const getMarkdownHtml = (content: string) => {
    if (!content) return { __html: "" };
    const processed = content.replace(/\$([^$]+)\$/g, (match, p1) => {
      const clean = p1.replace(/\\/g, '');
      return `<span class="math-symbol">${clean}</span>`;
    });
    return { __html: marked.parse(processed) as string };
  };

  if (!user) return <LoginPage onLogin={handleLogin} lang={lang} onToggleLang={toggleLang} />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      <UserManual isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} lang={lang} />
      <QAModal isOpen={isQAOpen} onClose={() => setIsQAOpen(false)} lang={lang} />
      
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-md">
                <TrendingUp size={20} />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 tracking-tight">{t.appTitle}</h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={toggleLang}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200 transition-all"
            >
              <Globe size={14} />
              {lang.toUpperCase()}
            </button>
            <div className="hidden md:flex items-center gap-4">
              <button 
                onClick={() => setIsManualOpen(true)}
                className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors text-sm font-medium"
              >
                <HelpCircle size={18} />
                {t.manual}
              </button>
              <button 
                onClick={() => setIsQAOpen(true)}
                className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 transition-colors text-sm font-medium"
              >
                <MessageCircleQuestion size={18} />
                {t.qa}
              </button>
            </div>
            <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
            <div className="flex items-center gap-3">
               <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
                    <UserIcon size={14} className="text-blue-500" />
                    {user.username}
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{user.role}</span>
               </div>
               <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title={t.logout}>
                 <LogOut size={20} />
               </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 -mb-px">
                {user.role === 'ADMIN' && (
                  <button
                      onClick={() => setActiveTab('DATA')}
                      className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'DATA' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                      <Database size={18} />
                      {t.tabData}
                  </button>
                )}
                <button
                    onClick={() => setActiveTab('R_SHIELD')}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'R_SHIELD' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <ShieldCheck size={18} />
                    {t.tabModel}
                </button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!import.meta.env.VITE_API_KEY && (
           <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <p className="text-sm text-yellow-700">{t.apiKeyWarning}</p>
            </div>
          </div>
        )}

        {activeTab === 'DATA' && user.role === 'ADMIN' ? (
            <div className="space-y-6">
                <TagInput 
                  terms={terms} onAddTerm={handleAddTerm} onRemoveTerm={handleRemoveTerm} onAnalyze={handleAnalyze} isLoading={loadingState === LoadingState.LOADING}
                  startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate}
                  dataSource={dataSource} setDataSource={setDataSource} geoLocation={geoLocation} setGeoLocation={setGeoLocation} searchType={searchType} setSearchType={setSearchType} lang={lang}
                />

                {loadingState === LoadingState.ERROR && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2"><AlertCircle size={18} />{errorMessage}</div>
                )}

                {/* Giữ nguyên mảng data cho Chart để biểu đồ luôn hiện theo thời gian thực (Trục X) */}
                <TrendChart data={data} terms={terms} startDate={startDate} endDate={endDate} lang={lang} />

                {loadingState === LoadingState.SUCCESS && summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                        <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2">
                            <Sparkles size={18} className="text-blue-500" />
                            {t.aiAnalysis}
                        </h3>
                        <div 
                          className="prose prose-sm prose-blue text-blue-800 leading-relaxed"
                          dangerouslySetInnerHTML={getMarkdownHtml(summary)}
                        />

                        {groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.some((c: any) => c.web) && (
                          <div className="mt-4 pt-4 border-t border-blue-100">
                            <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wider">{t.searchSources}</p>
                            <div className="flex flex-wrap gap-2">
                              {groundingMetadata.groundingChunks.map((chunk: any, idx: number) => (
                                chunk.web && (
                                  <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-white text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 flex items-center gap-1 shadow-sm">
                                    <ExternalLink size={10} /> {chunk.web.title || chunk.web.uri}
                                  </a>
                                )
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                )}

                {/* ĐÃ THÊM: CONTROL PANEL LỌC VÀ SẮP XẾP BẢNG DỮ LIỆU */}
                {data.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center mt-6">
                        <div className="flex items-center gap-2 w-full md:w-auto relative">
                            <Filter size={18} className="text-gray-400 absolute left-3" />
                            <input
                                type="text"
                                placeholder={lang === 'vi' ? "Tìm kiếm trong bảng..." : "Search in table..."}
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="w-full md:w-64 pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-medium text-gray-500 whitespace-nowrap">{lang === 'vi' ? "Sắp xếp theo:" : "Sort by:"}</span>
                            <select
                                value={sortConfig?.key || ''}
                                onChange={(e) => setSortConfig(e.target.value ? { key: e.target.value, direction: sortConfig?.direction || 'desc' } : null)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 w-full"
                            >
                                <option value="">-- {lang === 'vi' ? "Mặc định (Ngày)" : "Default (Date)"} --</option>
                                <option value="date">{lang === 'vi' ? "Ngày (Date)" : "Date"}</option>
                                {terms.map(t => (
                                    <option key={t.id} value={t.term}>{t.term}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setSortConfig(prev => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key: 'date', direction: 'asc' })}
                                disabled={!sortConfig}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50 transition-all shrink-0"
                                title={lang === 'vi' ? "Đảo chiều sắp xếp" : "Toggle sort direction"}
                            >
                                <ArrowUpDown size={18} />
                            </button>
                        </div>
                    </div>
                )}
