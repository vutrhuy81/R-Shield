import React, { useState, useEffect } from 'react';
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
import { AlertCircle, TrendingUp, ShieldCheck, Database, LogOut, HelpCircle, User as UserIcon, Sparkles, ExternalLink, Globe, MessageCircleQuestion } from 'lucide-react';
import { marked } from 'marked';
import { AdminPanel } from './components/AdminPanel';

// Thêm logic ghi log mô phỏng (gọi API /api/logs ngầm)
const logAction = async (user: User | null, action: string, details: any) => {
  if (!user) return;
  fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, username: user.username, action, details })
  }).catch(console.error); 
};

const getVNDateString = (date: Date) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('vi');
  const t = translations[lang];  

  const [activeTab, setActiveTab] = useState<'DATA' | 'R_SHIELD' | 'ADMIN_PANEL'>('DATA');
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isQAOpen, setIsQAOpen] = useState(false);

  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [groundingMetadata, setGroundingMetadata] = useState<any>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [dataSource, setDataSource] = useState<DataSource>('GEMINI');

  const [realData, setRealData] = useState<any[]>(DEFAULT_REAL_DATA);
  const [geoLocation, setGeoLocation] = useState<string>('VN');
  const [searchType, setSearchType] = useState<SearchType>('web');
  
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const [startDate, setStartDate] = useState<string>(getVNDateString(thirtyDaysAgo)); 
  const [endDate, setEndDate] = useState<string>(getVNDateString(today)); 

  useEffect(() => {
    if (data && data.length > 0 && terms.length > 0) {
      const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const syncedData = sorted.map((point, index) => {
        let totalReach = 0;
        terms.forEach(term => {
          const indexValue = Number(point[term.term] || 0);
          totalReach += Math.round(indexValue * K_FACTOR);
        });
        return { day: index, real_I: totalReach };
      });
      setRealData(syncedData);
    }
  }, [data, terms]);

  useEffect(() => {
    if (user && user.role === 'GUEST') setActiveTab('R_SHIELD');
    else if (user && user.role === 'ADMIN') setActiveTab('DATA');
  }, [user]);

  const handleLogin = (userData: User) => setUser(userData);
  const handleLogout = () => { logAction(user, 'LOGOUT', {}); setUser(null); setData([]); setTerms([]); };
  const toggleLang = () => setLang(prev => prev === 'vi' ? 'en' : 'vi');
  
  const handleAddTerm = (termText: string) => {
    if (terms.some(t => t.term.toLowerCase() === termText.toLowerCase())) return;
    if (terms.length >= 5) { alert(t.maxTerms); return; }
    setTerms([...terms, { id: Date.now().toString() + Math.random().toString(), term: termText, color: GOOGLE_COLORS[terms.length % GOOGLE_COLORS.length] }]);
  };

  const handleRemoveTerm = (id: string) => setTerms(terms.filter(t => t.id !== id));

  const handleAnalyze = async (): Promise<TrendAnalysisResponse | undefined> => {
    if (terms.length === 0) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const vnTodayStr = getVNDateString(new Date()); 
    const todayDate = new Date(vnTodayStr); 
    
    if (start > end || start > todayDate || end > todayDate) { 
        setErrorMessage(start > end ? t.dateError : t.futureDateError); 
        setLoadingState(LoadingState.ERROR); 
        return; 
    }

    if (dataSource === 'GOOGLE_TRENDS') {
        const termStrings = terms.map(term => encodeURIComponent(term.term)).join(',');
        window.open(`https://trends.google.com/explore?q=${termStrings}&date=${startDate}%20${endDate}&geo=${geoLocation}`, '_blank');
        logAction(user, 'OPEN_GOOGLE_TRENDS', { terms: termStrings });
        return;
    }

    setLoadingState(LoadingState.LOADING);
    setErrorMessage(""); setSummary(""); setGroundingMetadata(null); setData([]);

    try {
      const termStrings = terms.map(term => term.term);
      // Ghi log người dùng bấm nút phân tích
      logAction(user, 'RUN_AI_ANALYSIS', { terms: termStrings, startDate, endDate });
      
      const response = await fetchTrendData(termStrings, startDate, endDate, geoLocation, searchType, lang);

      setData(response.data);
      setSummary(response.summary);
      setGroundingMetadata(response.groundingMetadata);
      setLoadingState(LoadingState.SUCCESS);

      // GHI LOG TOÀN BỘ KẾT QUẢ AI VÀ SỐ LIỆU TẠI TAB THU THẬP DỮ LIỆU
      logAction(user, 'DATA_COLLECTION_ANALYSIS', {
          searchQuery: {
              terms: termStrings,
              dateRange: `${startDate} to ${endDate}`,
              location: geoLocation,
              type: searchType
          },
          aiAnalysisReport: response.summary,
          googleSources: response.groundingMetadata?.groundingChunks?.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, url: c.web.uri })) || [],
          estimatedReachData: response.data.map(d => ({
              date: d.date,
              rawIndices: termStrings.reduce((acc, term) => ({ ...acc, [term]: d[term] }), {}),
              estimatedTotalReach: termStrings.reduce((sum, term) => sum + Math.round(Number(d[term] || 0) * K_FACTOR), 0)
          }))
      });
    
      return response; 
    } catch (error: any) {
      setLoadingState(LoadingState.ERROR);
      setErrorMessage(error.message || "Error");
      throw error;
    }
  };

  const getMarkdownHtml = (content: string) => {
    if (!content) return { __html: "" };
    return { __html: marked.parse(content.replace(/\$([^$]+)\$/g, (match, p1) => `<span class="math-symbol">${p1.replace(/\\/g, '')}</span>`)) as string };
  };

  if (!user) return <LoginPage onLogin={handleLogin} lang={lang} onToggleLang={toggleLang} />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      <UserManual isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} lang={lang} />
      <QAModal isOpen={isQAOpen} onClose={() => setIsQAOpen(false)} lang={lang} />   
      
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-md"><TrendingUp size={20} /></div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 tracking-tight">{t.appTitle}</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={toggleLang} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200 transition-all"><Globe size={14} />{lang.toUpperCase()}</button>
            <div className="hidden md:flex items-center gap-4">
              {user.role === 'ADMIN' && (<button onClick={() => setActiveTab('ADMIN_PANEL')} className={`flex items-center gap-1.5 font-bold text-sm transition-colors ${activeTab === 'ADMIN_PANEL' ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}><ShieldCheck size={18} />Quản trị Hệ thống</button>)}
              <button onClick={() => setIsManualOpen(true)} className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 text-sm font-medium transition-colors"><HelpCircle size={18} />{t.manual}</button>
              <button onClick={() => setIsQAOpen(true)} className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 text-sm font-medium transition-colors"><MessageCircleQuestion size={18} />{t.qa}</button>
            </div>
            <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
            <div className="flex items-center gap-3">
               <div className="flex flex-col items-end"><span className="text-sm font-bold text-gray-800 flex items-center gap-1"><UserIcon size={14} className="text-blue-500" />{user.username}</span><span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{user.role}</span></div>
               <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title={t.logout}><LogOut size={20} /></button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 -mb-px">
                {user.role === 'ADMIN' && (<button onClick={() => setActiveTab('DATA')} className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'DATA' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}><Database size={18} />{t.tabData}</button>)}
                <button onClick={() => setActiveTab('R_SHIELD')} className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'R_SHIELD' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}><ShieldCheck size={18} />{t.tabModel}</button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!import.meta.env.VITE_API_KEY && (<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg"><div className="flex items-center gap-3"><AlertCircle className="h-5 w-5 text-yellow-400" /><p className="text-sm text-yellow-700">{t.apiKeyWarning}</p></div></div>)}

        {activeTab === 'ADMIN_PANEL' && user.role === 'ADMIN' && (<AdminPanel user={user} />)}

        {activeTab === 'DATA' && user.role === 'ADMIN' && (
            <div className="space-y-6 animate-in fade-in">
                <TagInput terms={terms} onAddTerm={handleAddTerm} onRemoveTerm={handleRemoveTerm} onAnalyze={handleAnalyze} isLoading={loadingState === LoadingState.LOADING} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} dataSource={dataSource} setDataSource={setDataSource} geoLocation={geoLocation} setGeoLocation={setGeoLocation} searchType={searchType} setSearchType={setSearchType} lang={lang} />
                {loadingState === LoadingState.ERROR && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2"><AlertCircle size={18} />{errorMessage}</div>)}
                <TrendChart data={data} terms={terms} startDate={startDate} endDate={endDate} lang={lang} />
                {loadingState === LoadingState.SUCCESS && summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                        <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2"><Sparkles size={18} className="text-blue-500" />{t.aiAnalysis}</h3>
                        <div className="prose prose-sm prose-blue text-blue-800 leading-relaxed" dangerouslySetInnerHTML={getMarkdownHtml(summary)} />
                        {groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.some((c: any) => c.web) && (
                          <div className="mt-4 pt-4 border-t border-blue-100"><p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wider">{t.searchSources}</p><div className="flex flex-wrap gap-2">{groundingMetadata.groundingChunks.map((chunk: any, idx: number) => (chunk.web && (<a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-white text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 flex items-center gap-1 shadow-sm"><ExternalLink size={10} /> {chunk.web.title || chunk.web.uri}</a>)))}</div></div>
                        )}
                    </div>
                )}
                <TrendTable data={data} terms={terms} lang={lang} />
                <EstimatedReachTable data={data} terms={terms} lang={lang} />
            </div>
        )}

        {activeTab === 'R_SHIELD' && (
            <div className="animate-in fade-in">
              <RShieldTab 
                terms={terms} 
                lang={lang} 
                realData={realData} 
                setRealData={setRealData} 
                onLog={(action, details) => logAction(user, action, details)} 
              />
            </div>
        )}
      </main>

      {/* Floating Action Buttons for Mobile (Đã được khôi phục) */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 md:hidden z-40">
        {user.role === 'ADMIN' && (
          <button onClick={() => setActiveTab('ADMIN_PANEL')} className={`p-4 rounded-full shadow-2xl transition-colors ${activeTab === 'ADMIN_PANEL' ? 'bg-blue-800' : 'bg-gray-800'} text-white`}>
            <ShieldCheck size={24} />
          </button>
        )}
        <button onClick={() => setIsManualOpen(true)} className="bg-blue-600 hover:bg-blue-700 transition-colors text-white p-4 rounded-full shadow-2xl">
            <HelpCircle size={24} />
        </button>
        <button onClick={() => setIsQAOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white p-4 rounded-full shadow-2xl">
            <MessageCircleQuestion size={24} />
        </button>
      </div>
    </div>
  );
};

export default App;
