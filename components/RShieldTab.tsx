import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';
import { Settings, RefreshCw, ShieldAlert, Activity, Database, Plus, Trash2, BrainCircuit, Sparkles, MessageSquare, Wand2, Target, X, BarChart } from 'lucide-react';
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
  up: number;        
  ug: number;        
  rho: number;       
  v: number;         
  Rc: number;        
}

interface RealDataPoint { 
  day: number; 
  real_I: number; 
}

// [UPDATED] Thêm chỉ số RMSE vào giao diện đánh giá
interface FitMetrics {
  mse: number;
  rmse: number;
  peakErrorAbs: number;
  peakErrorPct: number;
  peakDayError: number;
}

// --- Constants ---
const DEFAULT_PARAMS: SimulationParams = { 
  N: 2000000,
  tau: 0.5,      
  dt: 0.05,      
  T_end: 15,     
  beta: 0.752,     
  alpha: 0.676,    
  gamma: 0.1,    
  interventionDay: 5.0, 
  up: 0.01,       
  ug: 3.393,       
  rho: 0.6,      
  v: 0.2,        
  Rc: 1          
};

// --- PURE MATH FUNCTION ---
const runSEIRModelPure = (
    params: SimulationParams, 
    realDataMap: Map<number, number>, 
    maxRealDay: number
) => {
    const { N, tau, dt, T_end, beta, alpha, gamma, interventionDay, up: up_active, ug: ug_active, rho, v: v_active } = params;
    const final_T_end = Math.max(T_end, maxRealDay); 
    const steps = Math.floor(final_T_end / dt) + 1;
    const lagSteps = Math.floor(tau / dt);

    const S = new Float64Array(steps);
    const E = new Float64Array(steps);
    const I = new Float64Array(steps);
    const R = new Float64Array(steps);

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

      const isIntervention = currentTime >= interventionDay;
      const up_val = isIntervention ? up_active : 0;
      const ug_val = isIntervention ? ug_active : 0;
      const v_val  = isIntervention ? v_active : 0;

      const infectionRate = (beta * S_past * I_past) / N;
      const incubationRate = alpha * E[i];
      const recoveryRate = (gamma * I[i] * (I[i] + R[i])) / N; 

      const controlS = up_val * S[i];                
      const controlE = rho * ug_val * E[i];          
      const controlI = v_val * I[i];                 

      const dS = -infectionRate - controlS;
      const dE = infectionRate - incubationRate - controlE;
      const dI = incubationRate - recoveryRate - controlI;
      const dR = recoveryRate + controlI + controlS + controlE;

      S[i + 1] = Math.max(0, S[i] + dS * dt);
      E[i + 1] = Math.max(0, E[i] + dE * dt);
      I[i + 1] = Math.max(0, I[i] + dI * dt);
      R[i + 1] = Math.max(0, R[i] + dR * dt);
    }
    
    const resultI = [];
    for (let d = 0; d <= final_T_end; d++) {
        const idx = Math.min(Math.floor(d / dt), steps - 1);
        resultI.push({ 
            day: d, 
            sim_I: I[idx],
            sim_S: S[idx],
            sim_E: E[idx],
            sim_R: R[idx] 
        });
    }
    return resultI;
};

// --- Main Component ---
interface RShieldTabProps { 
  terms?: SearchTerm[]; 
  lang: Language; 
  realData: RealDataPoint[];
  setRealData: (data: RealDataPoint[]) => void;
  onLog?: (action: string, details: any) => void; 
}

const RShieldTab: React.FC<RShieldTabProps> = ({ terms = [], lang, realData, setRealData, onLog }) => {
  const t = translations[lang];
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isFitting, setIsFitting] = useState<boolean>(false);
  
  const [fitMetrics, setFitMetrics] = useState<FitMetrics | null>(null);
  const [showMetricsPopup, setShowMetricsPopup] = useState<boolean>(false);

  useEffect(() => { 
    if (terms.length > 0) setTopic(terms.map(term => term.term).join(", ")); 
  }, [terms]);

  const realDataMap = useMemo(() => new Map(realData.map(d => [d.day, d.real_I])), [realData]);
  const maxRealDay = useMemo(() => realData.length > 0 ? realData[realData.length - 1].day : 0, [realData]);

  const runSimulation = useMemo(() => {
    const rawResults = runSEIRModelPure(params, realDataMap, maxRealDay);
    return rawResults.map(item => ({
        day: item.day,
        sim_S: Math.round(item.sim_S || 0),
        sim_E: Math.round(item.sim_E || 0),
        sim_I: Math.round(item.sim_I || 0),
        sim_R: Math.round(item.sim_R || 0),
        real_I: realDataMap.get(item.day) ?? null
    }));
  }, [params, realDataMap, maxRealDay]);

  useEffect(() => { setChartData(runSimulation); }, [runSimulation]);

  const calculatedRc = useMemo(() => {
    const { N, beta, alpha, rho, ug, v } = params;
    const startVal = realDataMap.size > 0 ? (realDataMap.get(0) || 1) : 1; 
    const I0 = Math.max(1, startVal); 
    const E0 = I0 * 2;
    const R0 = 0;
    const S0 = Math.max(0, N - E0 - I0 - R0);
    const s0 = S0 / N; 

    const denominator = (alpha + rho * ug) * v;
    if (denominator === 0) return 0;
    return (beta * s0 * alpha) / denominator;
  }, [params.N, params.beta, params.alpha, params.rho, params.ug, params.v, realDataMap]);

  useEffect(() => {
      if (Math.abs(params.Rc - calculatedRc) > 0.000001) {
          setParams(prev => ({ ...prev, Rc: calculatedRc }));
      }
  }, [calculatedRc, params.Rc]);

  const getSimSummary = (currentParams: SimulationParams, currentRc: number) => {
     const data = runSEIRModelPure(currentParams, realDataMap, maxRealDay);
     let maxSim = 0; 
     data.forEach(d => { if (d.sim_I > maxSim) maxSim = d.sim_I; });
     const maxReal = realData.length > 0 ? Math.max(...realData.map(d => d.real_I)) : 0;
     return { 
         PeakSim: Math.round(maxSim), 
         PeakReal: maxReal, 
         TotalInf: Math.round(data[data.length-1].sim_I), 
         TotalRec: Math.round(data[data.length-1].sim_R), 
         ThresholdRc: currentRc 
     };
  };

  const handleOptimizeRc = () => {
    const oldParams = { ...params };
    const oldSummary = getSimSummary(oldParams, calculatedRc);

    const { N, beta, alpha, rho, ug, v } = params;
    const startVal = realDataMap.size > 0 ? (realDataMap.get(0) || 1) : 1; 
    const I0 = Math.max(1, startVal);
    const E0 = I0 * 2;
    const R0 = 0;
    const S0 = Math.max(0, N - E0 - I0 - R0);
    const s0 = S0 / N;

    const baseV = v <= 0.001 ? 0.05 : v;
    const baseUg = ug <= 0.001 ? 0.5 : ug;

    const A = baseV * rho * baseUg;
    const B = baseV * alpha;
    const C = -(beta * s0 * alpha);

    let k = 1;
    if (Math.abs(A) < 1e-9) {
        if (B !== 0) k = -C / B;
    } else {
        const delta = B * B - 4 * A * C;
        if (delta >= 0) {
            const k1 = (-B + Math.sqrt(delta)) / (2 * A);
            const k2 = (-B - Math.sqrt(delta)) / (2 * A);
            k = Math.max(k1, k2); 
        }
    }

    if (k > 0 && isFinite(k)) {
        const newParams = {
            ...params,
            v: parseFloat((baseV * k).toFixed(3)),
            ug: parseFloat((baseUg * k).toFixed(3)),
        };
        setParams(newParams);

        if (onLog) {
            onLog('RSHIELD_AUTO_FIT_RC', {
                rumorTopic: topic,
                before: { params: oldParams, summary: oldSummary },
                after: { params: newParams, summary: getSimSummary(newParams, 1) }
            });
        }
    }
  };

  const handleAutoFit = async () => {
    if (realData.length < 3) return;
    setIsFitting(true);
    
    const oldParams = { ...params };
    const oldSummary = getSimSummary(oldParams, calculatedRc);

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
        const beta_candidates = [1.0, 1.5, 2.0, 2.5, 3.5, 5.0];
        const gamma_candidates = [0.2, 0.4, 0.6, 0.8];
        const alpha_candidates = [0.5, 1.0, 1.5];

        for (const n_try of n_candidates) {
            for (const beta_try of beta_candidates) {
                for (const gamma_try of gamma_candidates) {
                    for (const alpha_try of alpha_candidates) {
                        const testParams = {
                            ...params,
                            N: n_try,
                            beta: beta_try,
                            gamma: gamma_try,
                            alpha: alpha_try
                        };

                        const simResults = runSEIRModelPure(testParams, realDataMap, maxRealDay);

                        let maxSimVal = 0;
                        let peakSimDay = 0;
                        let mseSumCandidate = 0;
                        let mseCountCandidate = 0;

                        simResults.forEach(s => {
                            // @ts-ignore
                            if (s.sim_I > maxSimVal) {
                                // @ts-ignore
                                maxSimVal = s.sim_I;
                                peakSimDay = s.day;
                            }
                            if (realDataMap.has(s.day)) {
                                const rVal = realDataMap.get(s.day)!;
                                // @ts-ignore
                                mseSumCandidate += Math.pow(rVal - s.sim_I, 2);
                                mseCountCandidate++;
                            }
                        });

                        const currentMse = mseCountCandidate > 0 ? mseSumCandidate / mseCountCandidate : 0;
                        const dayError = Math.abs(peakSimDay - peakRealDay);
                        const heightErrorRatio = Math.abs(maxSimVal - maxRealVal) / (maxRealVal || 1);

                        // Hàm mất mát tối ưu hóa
                        const normalizedMse = currentMse / Math.pow(maxRealVal || 1, 2); 
                        const totalError = (normalizedMse * 500) + (dayError * 100) + (heightErrorRatio * 100);

                        if (totalError < minError) {
                            minError = totalError;
                            bestParams = testParams;
                        }
                    }
                }
            }
        }

        bestParams.N = Math.round(bestParams.N);
        setParams(bestParams); 
        
        const finalResults = runSEIRModelPure(bestParams, realDataMap, maxRealDay);
        
        let finalMaxSimVal = 0;
        let finalPeakSimDay = 0;
        let mseSum = 0;
        let mseCount = 0;

        finalResults.forEach(s => {
            // @ts-ignore
            if (s.sim_I > finalMaxSimVal) {
                // @ts-ignore
                finalMaxSimVal = s.sim_I;
                finalPeakSimDay = s.day;
            }
            if (realDataMap.has(s.day)) {
                const rVal = realDataMap.get(s.day)!;
                // @ts-ignore
                mseSum += Math.pow(rVal - s.sim_I, 2);
                mseCount++;
            }
        });

        // [UPDATED] Tính toán MSE và RMSE
        const mse = mseCount > 0 ? mseSum / mseCount : 0;
        const rmse = Math.sqrt(mse);

        const metrics = {
            mse,
            rmse,
            peakErrorAbs: Math.abs(finalMaxSimVal - maxRealVal),
            peakErrorPct: maxRealVal > 0 ? (Math.abs(finalMaxSimVal - maxRealVal) / maxRealVal) * 100 : 0,
            peakDayError: Math.abs(finalPeakSimDay - peakRealDay)
        };

        setFitMetrics(metrics);
        setIsFitting(false);
        setShowMetricsPopup(true);

        if (onLog) {
            onLog('RSHIELD_AUTO_FIT_PRO', {
                rumorTopic: topic,
                before: { params: oldParams, summary: oldSummary },
                after: { params: bestParams, summary: getSimSummary(bestParams, calculatedRc), evaluationMetrics: metrics }
            });
        }

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
        const res = await analyzeRShieldSimulation(topic, params, realData, simPeak, realPeak, lang, calculatedRc);
        setAnalysisResult(res);

        if (onLog) {
            onLog('RSHIELD_AI_CONSULTATION', {
                rumorTopic: topic,
                currentParams: params,
                simulationSummary: getSimSummary(params, calculatedRc),
                aiExpertReport: res
            });
        }
    } catch (e: any) { setAnalysisResult("Error: " + e.message); }
    finally { setIsAnalyzing(false); }
  };

  const getMarkdownHtml = (content: string) => {
    if (!content) return { __html: "" };
    const processed = content.replace(/\$([^$]+)\$/g, (match, p1) => {
      const clean = p1.replace(/\\/g, '');
      return `<span class="math-symbol">${clean}</span>`;
    });
    return { __html: marked.parse(processed) as string };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
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
                 {realData.length === 0 && <p className="text-center text-gray-400 py-4 italic text-xs">{lang === 'vi' ? 'Chưa có dữ liệu.' : 'No data.'}</p>}
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
                     <span className="capitalize font-mono">{key}</span>
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
                  <label className="text-xs font-medium block mb-1">{t.population} (N)</label>
                  <input type="number" value={params.N} onChange={(e) => handleParamChange('N', e.target.value)} className="w-full p-2 border rounded text-sm bg-yellow-50 focus:bg-white transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium block mb-1">T_end (Days)</label><input type="number" value={params.T_end} onChange={(e) => handleParamChange('T_end', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
                <div><label className="text-xs font-medium block mb-1">Tau (Delay)</label><input type="number" step="0.1" value={params.tau} onChange={(e) => handleParamChange('tau', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-3 rounded-lg border border-red-100 relative">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-red-600 uppercase flex items-center gap-1"><ShieldAlert size={14} /> {t.shieldStrategy}</h3>
                <button 
                    onClick={handleOptimizeRc}
                    className="text-[10px] flex items-center gap-1 px-2 py-1 rounded border bg-white text-red-600 border-red-200 hover:bg-red-100 shadow-sm transition-all"
                    title="Auto-adjust v, ug to make Rc = 1"
                >
                    <Target size={12} />
                    Auto Fit Rc=1
                </button>
            </div>
            
            <div className="space-y-3">
              <div><label className="text-xs font-medium block mb-1">{t.interventionDay} (Start Day)</label><input type="number" value={params.interventionDay} onChange={(e) => handleParamChange('interventionDay', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
              
              <div className="grid grid-cols-2 gap-2">
                 <div><label className="text-[10px] font-medium block mb-1 font-mono">u_p (S Control)</label><input type="number" step="0.05" value={params.up} onChange={(e) => handleParamChange('up', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
                 <div><label className="text-[10px] font-medium block mb-1 font-mono">u_g (E Control)</label><input type="number" step="0.05" value={params.ug} onChange={(e) => handleParamChange('ug', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div><label className="text-[10px] font-medium block mb-1 font-mono">v (I Control)</label><input type="number" step="0.05" value={params.v} onChange={(e) => handleParamChange('v', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
                 <div><label className="text-[10px] font-medium block mb-1 font-mono">rho (Ug Effect)</label><input type="number" step="0.1" value={params.rho} onChange={(e) => handleParamChange('rho', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
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
              <div className="text-right"><span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Intervention: Day {params.interventionDay}</span></div>
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
                        <Line type="monotone" dataKey="sim_I" name={lang === 'vi' ? "Lây nhiễm (Infected)" : "Sim (Infected)"} stroke="#2563EB" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="sim_E" name={lang === 'vi' ? "Ủ tin (Exposed)" : "Sim (Exposed)"} stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="sim_R" name={lang === 'vi' ? "Hồi phục (Recovered)" : "Sim (Recovered)"} stroke="#6B7280" strokeWidth={1} dot={false} opacity={0.5} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
             {[
                 { label: t.peakSim, value: Math.max(...chartData.map(d => d.sim_I || 0)), color: "text-blue-600" },
                 { label: t.peakReal, value: realData.length > 0 ? Math.max(...realData.map(d => d.real_I)) : 0, color: "text-red-500" },
                 { label: t.totalInf, value: chartData[chartData.length-1]?.sim_I || 0, color: "text-gray-700" },
                 { label: t.totalRec, value: chartData[chartData.length-1]?.sim_R || 0, color: "text-green-600" },
                 { label: lang === 'vi' ? "Ngưỡng Rc" : "Rc Threshold", value: calculatedRc, color: calculatedRc > 1 ? "text-red-600" : "text-green-600", isDecimal: true }
             ].map((s, i) => (
                 <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
                   <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{s.label}</p>
                   {/* @ts-ignore */}
                   <p className={`text-xl font-bold ${s.color}`}>{s.isDecimal ? s.value.toFixed(2) : formatNumber(s.value)}</p>
                 </div>
             ))}
        </div>

        {analysisResult && (
            <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 shadow-xl">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-6 py-4 border-b border-indigo-100 flex items-center gap-2">
                    <MessageSquare className="text-white" size={20} />
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">{t.expertView}</h3>
                </div>
                <div 
                    className="p-8 text-gray-800 leading-relaxed font-sans text-sm md:text-base max-h-[800px] overflow-y-auto prose prose-indigo max-w-none"
                    dangerouslySetInnerHTML={getMarkdownHtml(analysisResult)}
                />
            </div>
        )}
      </div>

      {/* [UPDATED] Giao diện Popup Đánh giá (Grid 2x2) */}
      {showMetricsPopup && fitMetrics && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <BarChart size={20} />
                        <h3 className="font-bold text-lg">{lang === 'vi' ? 'Đánh giá hiệu quả mô hình' : 'Model Fit Evaluation'}</h3>
                    </div>
                    <button onClick={() => setShowMetricsPopup(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-5">
                    <p className="text-sm text-gray-600">
                        {lang === 'vi' 
                            ? 'Thuật toán Auto-Fit đã tìm ra bộ tham số tối ưu. Dưới đây là các chỉ số đánh giá độ lệch so với dữ liệu thực tế:' 
                            : 'Auto-Fit algorithm found the optimal parameters. Here are the deviation metrics compared to real data:'}
                    </p>

                    {/* Lưới 2x2 chứa 4 chỉ số */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* 1. MSE */}
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                                {lang === 'vi' ? 'MSE (Sai số B.Phương)' : 'Mean Squared Error'}
                            </p>
                            <p className="text-xl font-black text-blue-700">{formatNumber(Math.round(fitMetrics.mse))}</p>
                        </div>
                        
                        {/* 2. RMSE */}
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                                {lang === 'vi' ? 'RMSE (Sai số Chuẩn)' : 'Root Mean Square Error'}
                            </p>
                            <p className="text-xl font-black text-indigo-600">{formatNumber(Math.round(fitMetrics.rmse))}</p>
                        </div>
                        
                        {/* 3. Lệch thời gian */}
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                                {lang === 'vi' ? 'Lệch thời gian đỉnh' : 'Peak Time Error'}
                            </p>
                            <p className="text-xl font-black text-amber-600">
                                {fitMetrics.peakDayError} <span className="text-sm font-medium">{lang === 'vi' ? 'ngày' : 'days'}</span>
                            </p>
                        </div>
                        
                        {/* 4. Lệch số lượng */}
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100 shadow-sm relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-[10px] text-red-500 font-bold uppercase mb-1">
                                    {lang === 'vi' ? 'Sai số lượng ca đỉnh' : 'Peak Volume Error'}
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-xl font-black text-red-600">{formatNumber(Math.round(fitMetrics.peakErrorAbs))}</p>
                                    <p className="text-xs text-red-400 font-medium mb-1">
                                        ({fitMetrics.peakErrorPct.toFixed(2)}%)
                                    </p>
                                </div>
                            </div>
                            <Target size={40} className="text-red-200 absolute right-[-10px] bottom-[-10px] opacity-50 z-0" />
                        </div>
                    </div>

                    <button 
                        onClick={() => setShowMetricsPopup(false)} 
                        className="w-full py-3 mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors"
                    >
                        {lang === 'vi' ? 'Đóng' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default RShieldTab;
