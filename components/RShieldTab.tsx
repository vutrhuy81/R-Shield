
import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';
import { Settings, RefreshCw, ShieldAlert, Activity, Database, Plus, Trash2, BrainCircuit, Sparkles, MessageSquare, Wand2 } from 'lucide-react';
import { SearchTerm, Language } from '../types';
import { translations } from '../translations';
import { analyzeRShieldSimulation } from '../services/geminiService';
import { DEFAULT_REAL_DATA } from '../constants';
import { marked } from 'marked';

// --- Interfaces ---
interface SimulationParams { 
  N: number; 
  tau: number; 
  dt: number; 
  T_end: number; 
  beta: number; 
  alpha: number; 
  gamma: number; 
  interventionDay: number; 
  u: number; 
  v: number; 
}

interface RealDataPoint { 
  day: number; 
  real_I: number; 
}

// --- Constants ---
const DEFAULT_PARAMS: SimulationParams = { 
  N: 2000000,    // Tăng N mặc định lên mức an toàn
  tau: 1.0,      
  dt: 0.05,      
  T_end: 30,     
  beta: 2.0,     
  alpha: 1.0,    
  gamma: 0.5,    
  interventionDay: 10.0, 
  u: 0.1,        
  v: 0.2         
};

// --- PURE MATH FUNCTION (SEIR Model) ---
const runSEIRModelPure = (
    params: SimulationParams, 
    realDataMap: Map<number, number>, 
    maxRealDay: number
) => {
    const { N, tau, dt, T_end, beta, alpha, gamma, interventionDay, u: u_active, v: v_active } = params;
    const final_T_end = Math.max(T_end, maxRealDay); 
    const steps = Math.floor(final_T_end / dt) + 1;
    const lagSteps = Math.floor(tau / dt);

    const S = new Float64Array(steps);
    const E = new Float64Array(steps);
    const I = new Float64Array(steps);
    const R = new Float64Array(steps);

    // Initial Conditions
    const startVal = realDataMap.size > 0 ? (realDataMap.get(0) || 1) : 1; 
    const I0 = Math.max(1, startVal); 
    
    E[0] = I0 * 2; 
    I[0] = I0;
    R[0] = 0;
    S[0] = Math.max(0, N - E[0] - I[0] - R[0]);

    for (let i = 0; i < steps - 1; i++) {
      const currentTime = i * dt;
      const idx_past = i - lagSteps;
      const S_past = idx_past >= 0 ? S[idx_past] : S[0]; 
      const I_past = idx_past >= 0 ? I[idx_past] : I[0];

      const u = currentTime >= interventionDay ? u_active : 0;
      const v = currentTime >= interventionDay ? v_active : 0;

      // Equations
      const infection = (beta * S_past * I_past) / N;
      const incubation = alpha * E[i];
      const recovery = (gamma * I[i] * (I[i] + R[i])) / N; 

      const dS = -infection - (u * S[i]);
      const dE = infection - incubation - (0.05 * E[i]); 
      const dI = incubation - recovery - (v * I[i]);
      const dR = recovery + (v * I[i]) + (u * S[i]);

      S[i + 1] = Math.max(0, S[i] + dS * dt);
      E[i + 1] = Math.max(0, E[i] + dE * dt);
      I[i + 1] = Math.max(0, I[i] + dI * dt);
      R[i + 1] = Math.max(0, R[i] + dR * dt);
    }
    
    // Downsampling
    const resultI = [];
    for (let d = 0; d <= final_T_end; d++) {
        const idx = Math.min(Math.floor(d / dt), steps - 1);
        resultI.push({ day: d, sim_I: I[idx] });
    }
    return resultI;
};

// --- Main Component ---
interface RShieldTabProps { 
  terms?: SearchTerm[]; 
  lang: Language; 
  realData: RealDataPoint[];
  setRealData: (data: RealDataPoint[]) => void;
}

const RShieldTab: React.FC<RShieldTabProps> = ({ terms = [], lang, realData, setRealData }) => {
  const t = translations[lang];
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isFitting, setIsFitting] = useState<boolean>(false);

  useEffect(() => { 
    if (terms.length > 0) setTopic(terms.map(term => term.term).join(", ")); 
  }, [terms]);

  const realDataMap = useMemo(() => new Map(realData.map(d => [d.day, d.real_I])), [realData]);
  const maxRealDay = useMemo(() => realData.length > 0 ? realData[realData.length - 1].day : 0, [realData]);

  // --- Run Simulation for Charting ---
  const runSimulation = useMemo(() => {
    const { N, tau, dt, T_end, beta, alpha, gamma, interventionDay, u: u_active, v: v_active } = params;
    const final_T_end = Math.max(T_end, maxRealDay); 
    const steps = Math.floor(final_T_end / dt) + 1;
    const lagSteps = Math.floor(tau / dt);
    
    const S = new Float64Array(steps), E = new Float64Array(steps), I = new Float64Array(steps), R = new Float64Array(steps);
    
    const startVal = realDataMap.size > 0 ? (realDataMap.get(0) || 1) : 1; 
    const I0 = Math.max(1, startVal); 
    I[0] = I0; E[0] = I0 * 2; R[0] = 0; S[0] = Math.max(0, N - E[0] - I[0] - R[0]);

    for (let i = 0; i < steps - 1; i++) {
        const currentTime = i * dt;
        const idx_past = i - lagSteps;
        const S_past = idx_past >= 0 ? S[idx_past] : S[0]; 
        const I_past = idx_past >= 0 ? I[idx_past] : I[0];
        const u = currentTime >= interventionDay ? u_active : 0;
        const v = currentTime >= interventionDay ? v_active : 0;
        
        const infection = (beta * S_past * I_past) / N;
        const incubation = alpha * E[i];
        const recovery = (gamma * I[i] * (I[i] + R[i])) / N; 
        
        const dS = -infection - (u * S[i]);
        const dE = infection - incubation - (0.05 * E[i]); 
        const dI = incubation - recovery - (v * I[i]);
        const dR = recovery + (v * I[i]) + (u * S[i]);
        
        S[i + 1] = Math.max(0, S[i] + dS * dt);
        E[i + 1] = Math.max(0, E[i] + dE * dt);
        I[i + 1] = Math.max(0, I[i] + dI * dt);
        R[i + 1] = Math.max(0, R[i] + dR * dt);
    }

    const results = [];
    for (let d = 0; d <= final_T_end; d++) {
        const idx = Math.min(Math.floor(d / dt), steps - 1);
        results.push({
            day: d,
            sim_S: Math.round(S[idx]),
            sim_E: Math.round(E[idx]),
            sim_I: Math.round(I[idx]),
            sim_R: Math.round(R[idx]),
            real_I: realDataMap.get(d) ?? null
        });
    }
    return results;
  }, [params, realDataMap, maxRealDay]);

  useEffect(() => { setChartData(runSimulation); }, [runSimulation]);

  // --- SUPER-POWERED AUTO-FITTING (GRID SEARCH) ---
  const handleAutoFit = async () => {
    if (realData.length < 3) return;

    setIsFitting(true);
    
    setTimeout(() => {
        let maxRealVal = 0;
        let peakRealDay = 0;
        realData.forEach(d => {
            if (d.real_I > maxRealVal) {
                maxRealVal = d.real_I;
                peakRealDay = d.day;
            }
        });

        let bestParams = { ...params };
        let minError = Infinity;

        const n_candidates = [maxRealVal * 1.5, maxRealVal * 3, maxRealVal * 5, maxRealVal * 10];
        const beta_candidates = [1.0, 1.5, 2.0, 2.5, 3.5, 5.0, 8.0];
        const gamma_candidates = [0.2, 0.4, 0.6];

        for (const n_try of n_candidates) {
            for (const beta_try of beta_candidates) {
                for (const gamma_try of gamma_candidates) {
                    const testParams = {
                        ...params,
                        N: n_try,
                        beta: beta_try,
                        gamma: gamma_try
                    };

                    const simResults = runSEIRModelPure(testParams, realDataMap, maxRealDay);

                    let maxSimVal = 0;
                    let peakSimDay = 0;
                    simResults.forEach(s => {
                        if (s.sim_I > maxSimVal) {
                            maxSimVal = s.sim_I;
                            peakSimDay = s.day;
                        }
                    });

                    const dayError = Math.abs(peakSimDay - peakRealDay);
                    const heightErrorRatio = Math.abs(maxSimVal - maxRealVal) / maxRealVal;
                    const totalError = (dayError * 1000) + (heightErrorRatio * 100);

                    if (totalError < minError) {
                        minError = totalError;
                        bestParams = testParams;
                    }
                }
            }
        }

        bestParams.N = Math.round(bestParams.N);
        setParams(bestParams);
        setIsFitting(false);
    }, 100);
  };

  const handleParamChange = (key: keyof SimulationParams, value: string) => setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  const formatNumber = (num: number) => new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(num);

  const handleConsult = async () => {
    if (!topic.trim()) return;
    setIsAnalyzing(true);
    try {
        const simPeak = Math.max(...chartData.map(d => d.sim_I || 0));
        const realPeak = realData.length > 0 ? Math.max(...realData.map(d => d.real_I)) : 0;
        const res = await analyzeRShieldSimulation(topic, params, realData, simPeak, realPeak, lang);
        setAnalysisResult(res);
    } catch (e: any) { setAnalysisResult("Error: " + e.message); }
    finally { setIsAnalyzing(false); }
  };

  const getMarkdownHtml = (content: string) => {
    if (!content) return { __html: "" };
    
    // Improved logic to capture everything between dollar signs and wrap in math-symbol span
    const processed = content.replace(/\$([^$]+)\$/g, (match, p1) => {
      // Remove LaTeX backslashes for common greek letters to make them look cleaner with the selected font
      const clean = p1.replace(/\\/g, '');
      return `<span class="math-symbol">${clean}</span>`;
    });
    
    return { __html: marked.parse(processed) as string };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 text-blue-800 border-b pb-3"><Settings size={20} /><h2 className="text-lg font-semibold">{t.configModel}</h2></div>
        
        <div className="space-y-6">
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
             <div className="flex items-center justify-between mb-3">
               <h3 className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1"><Database size={14} /> {t.realData}</h3>
               <div className="flex gap-1">
                 <button onClick={() => setRealData([...realData, { day: realData.length, real_I: 0 }])} className="p-1 bg-white border rounded text-green-600 hover:bg-green-50"><Plus size={14} /></button>
                 <button onClick={() => setRealData(realData.slice(0, -1))} className="p-1 bg-white border rounded text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
               </div>
             </div>
             <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                 {realData.map((p, i) => (
                   <div key={i} className="flex items-center gap-2 text-xs">
                     <span className="w-12 font-medium">{t.day} {p.day}:</span>
                     <input type="number" value={p.real_I} onChange={(e) => { const nd = [...realData]; nd[i].real_I = parseInt(e.target.value) || 0; setRealData(nd); }} className="flex-1 p-1 border rounded text-right focus:ring-1 focus:ring-amber-300 outline-none" />
                   </div>
                 ))}
                 {realData.length === 0 && <p className="text-center text-gray-400 py-4 italic text-xs">{lang === 'vi' ? 'Chưa có dữ liệu. Hãy nhập thủ công hoặc tải từ API.' : 'No data. Please input manually or fetch.'}</p>}
             </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 relative">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-blue-600 uppercase">{t.spreadParams}</h3>
                <button 
                    onClick={handleAutoFit}
                    disabled={isFitting || realData.length === 0}
                    className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded border transition-all ${isFitting ? 'bg-blue-200 text-blue-800' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-100 shadow-sm'}`}
                    title="Grid Search Fitting"
                >
                    {isFitting ? <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <Wand2 size={12} />}
                    {isFitting ? 'Fitting...' : 'Auto-Fit (Pro)'}
                </button>
            </div>

            <div className="space-y-4">
               {['beta', 'alpha', 'gamma'].map(key => (
                 <div key={key}>
                   <div className="flex justify-between text-xs mb-1">
                     <span className="capitalize">{key === 'beta' ? t.infection : key === 'alpha' ? t.incubation : t.recovery} ({key})</span>
                     <b className="text-blue-800">{params[key as keyof SimulationParams].toFixed(2)}</b>
                   </div>
                   <input type="range" min="0" max={key === 'gamma' ? 10 : 20} step="0.01" value={params[key as keyof SimulationParams]} onChange={(e) => handleParamChange(key as any, e.target.value)} className="w-full h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer" />
                 </div>
               ))}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.envTime}</h3>
            <div className="space-y-3">
              <div>
                  <label className="text-xs font-medium block mb-1">{t.population} (N) - <span className="text-gray-400 font-normal">Est. Audience</span></label>
                  <input type="number" value={params.N} onChange={(e) => handleParamChange('N', e.target.value)} className="w-full p-2 border rounded text-sm bg-yellow-50 focus:bg-white transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium block mb-1">{t.duration} (Days)</label><input type="number" value={params.T_end} onChange={(e) => handleParamChange('T_end', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
                <div><label className="text-xs font-medium block mb-1">{t.delay} (Tau)</label><input type="number" step="0.1" value={params.tau} onChange={(e) => handleParamChange('tau', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-3 rounded-lg border border-red-100">
            <h3 className="text-xs font-bold text-red-600 uppercase mb-3 flex items-center gap-1"><ShieldAlert size={14} /> {t.shieldStrategy}</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium block mb-1">{t.interventionDay} (Start Day)</label><input type="number" value={params.interventionDay} onChange={(e) => handleParamChange('interventionDay', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
              <div className="grid grid-cols-2 gap-2">
                 <div><label className="text-[10px] font-medium block mb-1">{t.controlS} (Edu/Legal)</label><input type="number" step="0.1" value={params.u} onChange={(e) => handleParamChange('u', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
                 <div><label className="text-[10px] font-medium block mb-1">{t.controlI} (Tech Block)</label><input type="number" step="0.1" value={params.v} onChange={(e) => handleParamChange('v', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
              </div>
            </div>
          </div>

          <button onClick={() => { setParams(DEFAULT_PARAMS); setRealData(DEFAULT_REAL_DATA); }} className="w-full py-2 text-sm text-gray-600 border border-dashed rounded-lg flex items-center justify-center gap-2 hover:border-blue-400 transition-colors bg-white"><RefreshCw size={14} /> {t.restoreDefault}</button>
          
          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mt-4 shadow-sm">
             <div className="flex items-center gap-2 mb-2"><BrainCircuit size={16} className="text-indigo-600"/><h3 className="text-xs font-bold text-indigo-700 uppercase">{t.consultationTitle}</h3></div>
             <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t.rumorTopic} className="w-full p-2 text-sm border rounded mb-2 outline-none focus:border-indigo-400" />
             <button onClick={handleConsult} disabled={isAnalyzing} className={`w-full py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-all ${isAnalyzing ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                 {isAnalyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Sparkles size={14} />} {isAnalyzing ? t.thinking : t.analyzeConsult}
             </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="text-blue-600" size={20}/> {t.simulationResult}</h3>
                <p className="text-sm text-gray-500">{t.compareDesc}</p>
              </div>
              <div className="text-right"><span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Intervention Day: {params.interventionDay}</span></div>
            </div>
            
            <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="day" label={{ value: t.day, position: 'insideBottom', offset: -10 }} />
                        <YAxis tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} width={40} />
                        <Tooltip labelFormatter={(l) => `${t.day} ${l}`} formatter={(v: any) => formatNumber(v)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="top" height={36}/>
                        <Bar dataKey="real_I" name={lang === 'vi' ? "Thực tế (Real)" : "Real Data"} barSize={20} fill="#FCA5A5" opacity={0.6} radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="sim_I" name={lang === 'vi' ? "Mô phỏng (Infected)" : "Sim (Infected)"} stroke="#2563EB" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="sim_E" name={lang === 'vi' ? "Ủ tin (Exposed)" : "Sim (Exposed)"} stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="sim_R" name={lang === 'vi' ? "Đã biết/Bão hòa (R)" : "Sim (Recovered)"} stroke="#6B7280" strokeWidth={1} dot={false} opacity={0.5} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
                 { label: t.peakSim, value: Math.max(...chartData.map(d => d.sim_I || 0)), color: "text-blue-600" },
                 { label: t.peakReal, value: realData.length > 0 ? Math.max(...realData.map(d => d.real_I)) : 0, color: "text-red-500" },
                 { label: t.totalInf, value: chartData[chartData.length-1]?.sim_I || 0, color: "text-gray-700" },
                 { label: t.totalRec, value: chartData[chartData.length-1]?.sim_R || 0, color: "text-green-600" },
             ].map((s, i) => (
                 <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
                   <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{s.label}</p>
                   <p className={`text-xl font-bold ${s.color}`}>{formatNumber(s.value)}</p>
                 </div>
             ))}
        </div>

        {analysisResult && (
            <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 shadow-xl mt-6">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-6 py-4 border-b border-indigo-100 flex items-center gap-2">
                  <MessageSquare className="text-white" size={20} />
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">{t.expertView}</h3>
                </div>
                <div 
                  className="p-8 text-gray-800 leading-relaxed font-sans text-sm md:text-base max-h-[800px] overflow-y-auto prose prose-indigo"
                  dangerouslySetInnerHTML={getMarkdownHtml(analysisResult)}
                />
            </div>
        )}
      </div>
    </div>
  );
};

export default RShieldTab;
