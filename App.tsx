
import React, { useState, useEffect } from 'react';
import { SearchTerm, TrendDataPoint, LoadingState, DataSource, SearchType, User, Language } from './types';
import { GOOGLE_COLORS } from './constants';
import { translations } from './translations';
import TagInput from './components/TagInput';
import TrendChart from './components/TrendChart';
import TrendTable from './components/TrendTable';
import EstimatedReachTable from './components/EstimatedReachTable';
import RShieldTab from './components/RShieldTab';
import LoginPage from './components/LoginPage';
import UserManual from './components/UserManual';
import { fetchTrendData } from './services/geminiService';
import { AlertCircle, TrendingUp, ShieldCheck, Database, LogOut, HelpCircle, User as UserIcon, Sparkles, ExternalLink, Globe } from 'lucide-react';

const App: React.FC = () => {
  // --- Auth & Language State ---
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('vi');
  const t = translations[lang];
  
  // --- App State ---
  const [activeTab, setActiveTab] = useState<'DATA' | 'R_SHIELD'>('DATA');
  const [isManualOpen, setIsManualOpen] = useState(false);

  // --- Data Collection State ---
  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [groundingMetadata, setGroundingMetadata] = useState<any>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [dataSource, setDataSource] = useState<DataSource>('GEMINI');

  // Filters State
  const [geoLocation, setGeoLocation] = useState<string>('VN');
  const [searchType, setSearchType] = useState<SearchType>('web');

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState<string>(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(today.toISOString().split('T')[0]);

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

  const handleAnalyze = async () => {
    if (terms.length === 0) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) { setErrorMessage(t.dateError); setLoadingState(LoadingState.ERROR); return; }

    if (dataSource === 'GOOGLE_TRENDS') {
        const termStrings = terms.map(term => encodeURIComponent(term.term)).join(',');
        const url = `https://trends.google.com/trends/explore?date=${startDate}%20${endDate}&geo=${geoLocation}&q=${termStrings}`;
        window.open(url, '_blank');
        return;
    }

    setLoadingState(LoadingState.LOADING);
    setErrorMessage("");
    setSummary("");
    setGroundingMetadata(null);
    setData([]);

    try {
      const termStrings = terms.map(term => term.term);
      const response = await fetchTrendData(termStrings, startDate, endDate, geoLocation, searchType, lang);
      setData(response.data);
      setSummary(response.summary);
      setGroundingMetadata(response.groundingMetadata);
      setLoadingState(LoadingState.SUCCESS);
    } catch (error: any) {
      setLoadingState(LoadingState.ERROR);
      setErrorMessage(error.message || "Error");
    }
  };

  if (!user) return <LoginPage onLogin={handleLogin} lang={lang} onToggleLang={toggleLang} />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      <UserManual isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} lang={lang} />
      
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
            <button 
              onClick={() => setIsManualOpen(true)}
              className="hidden md:flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors text-sm font-medium"
            >
              <HelpCircle size={18} />
              {t.manual}
            </button>
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
        {!process.env.API_KEY && (
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

                <TrendChart data={data} terms={terms} startDate={startDate} endDate={endDate} lang={lang} />

                {loadingState === LoadingState.SUCCESS && summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                        <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2">
                            <Sparkles size={18} className="text-blue-500" />
                            {t.aiAnalysis}
                        </h3>
                        <p className="text-blue-800 leading-relaxed text-sm mb-4">{summary}</p>

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

                <TrendTable data={data} terms={terms} lang={lang} />
                <EstimatedReachTable data={data} terms={terms} lang={lang} />
            </div>
        ) : (
            <RShieldTab terms={terms} lang={lang} />
        )}
      </main>
      <button onClick={() => setIsManualOpen(true)} className="fixed bottom-6 right-6 md:hidden bg-blue-600 text-white p-4 rounded-full shadow-2xl z-40"><HelpCircle size={24} /></button>
    </div>
  );
};

export default App;
