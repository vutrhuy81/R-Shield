
import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';
import { Settings, RefreshCw, ShieldAlert, Activity, Database, Plus, Trash2, BrainCircuit, Sparkles, MessageSquare } from 'lucide-react';
import { SearchTerm, Language } from '../types';
import { translations } from '../translations';
import { analyzeRShieldSimulation } from '../services/geminiService';

const DEFAULT_REAL_DATA = [
  { day: 0, real_I: 5000 }, { day: 1, real_I: 30000 }, { day: 2, real_I: 150000 }, { day: 3, real_I: 450000 }, 
  { day: 4, real_I: 600000 }, { day: 5, real_I: 350000 }, { day: 6, real_I: 120000 }, { day: 7, real_I: 50000 },
];

interface SimulationParams { N: number; tau: number; dt: number; T_end: number; beta: number; alpha: number; gamma: number; interventionDay: number; u: number; v: number; }
interface RealDataPoint { day: number; real_I: number; }

const DEFAULT_PARAMS: SimulationParams = { N: 10000000, tau: 1.0, dt: 0.05, T_end: 7, beta: 10.0, alpha: 1.2, gamma: 50.0, interventionDay: 4.0, u: 0.5, v: 0.8 };

interface RShieldTabProps { terms?: SearchTerm[]; lang: Language; }

const RShieldTab: React.FC<RShieldTabProps> = ({ terms = [], lang }) => {
  const t = translations[lang];
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [realData, setRealData] = useState<RealDataPoint[]>(DEFAULT_REAL_DATA);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  useEffect(() => { if (terms.length > 0) setTopic(terms.map(term => term.term).join(", ")); }, [terms]);

  const runSimulation = useMemo(() => {
    const { N, tau, dt, T_end, beta, alpha, gamma, interventionDay, u: u_active, v: v_active } = params;
    const steps = Math.floor(T_end / dt) + 1;
    const S = new Float64Array(steps), E = new Float64Array(steps), I = new Float64Array(steps), R = new Float64Array(steps), timeGrid = new Float64Array(steps);
    const I0 = realData.length > 0 ? realData[0].real_I : 5000;
    I[0] = I0; E[0] = I0 * 2; R[0] = 0; S[0] = N - E[0] - I[0] - R[0];
    const lagSteps = Math.floor(tau / dt);

    for (let i = 0; i < steps - 1; i++) {
      timeGrid[i] = i * dt;
      let S_past = i < lagSteps ? S[0] : S[i - lagSteps], I_past = i < lagSteps ? I[0] : I[i - lagSteps];
      let u = timeGrid[i] >= interventionDay ? u_active : 0, v = timeGrid[i] >= interventionDay ? v_active : 0;
      const infection = (beta * S_past * I_past) / N, incubation = alpha * E[i], recovery = (gamma * (I[i] * (I[i] + R[i]))) / N;
      const dS = -infection - (u * S[i]), dE = infection - incubation - (0.05 * E[i]), dI = incubation - recovery - (v * I[i]), dR = recovery + (v * I[i]) + (u * S[i]);
      S[i + 1] = Math.max(0, S[i] + dS * dt); E[i + 1] = Math.max(0, E[i] + dE * dt); I[i + 1] = Math.max(0, I[i] + dI * dt); R[i + 1] = Math.max(0, R[i] + dR * dt);
    }
    
    const chartResults = [];
    const maxDay = Math.max(T_end, realData.length > 0 ? realData[realData.length - 1].day : 0);
    for (let d = 0; d <= maxDay; d++) {
        const idx = Math.min(Math.floor(d / dt), steps - 1);
        chartResults.push({ day: d, sim_S: d <= T_end ? Math.round(S[idx]) : null, sim_E: d <= T_end ? Math.round(E[idx]) : null, sim_I: d <= T_end ? Math.round(I[idx]) : null, sim_R: d <= T_end ? Math.round(R[idx]) : null, real_I: realData.find(r => r.day === d)?.real_I || null });
    }
    return chartResults;
  }, [params, realData]);

  useEffect(() => { setChartData(runSimulation); }, [runSimulation]);

  const handleParamChange = (key: keyof SimulationParams, value: string) => setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  const formatNumber = (num: number) => new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(num);

  const handleConsult = async () => {
    if (!topic.trim()) return;
    setIsAnalyzing(true);
    try {
        const simPeak = Math.max(...chartData.map(d => d.sim_I || 0)), realPeak = Math.max(...realData.map(d => d.real_I));
        const res = await analyzeRShieldSimulation(topic, params, realData, simPeak, realPeak, lang);
        setAnalysisResult(res);
    } catch (e: any) { setAnalysisResult("Error: " + e.message); }
    finally { setIsAnalyzing(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 text-blue-800 border-b pb-3"><Settings size={20} /><h2 className="text-lg font-semibold">{t.configModel}</h2></div>
        <div className="space-y-6">
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
             <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1"><Database size={14} /> {t.realData}</h3><div className="flex gap-1"><button onClick={() => setRealData([...realData, { day: realData.length, real_I: 0 }])} className="p-1 bg-white border rounded text-green-600"><Plus size={14} /></button><button onClick={() => setRealData(realData.slice(0, -1))} className="p-1 bg-white border rounded text-red-600"><Trash2 size={14} /></button></div></div>
             <div className="space-y-2 max-h-48 overflow-y-auto">
                 {realData.map((p, i) => (
                   <div key={i} className="flex items-center gap-2 text-xs"><span>{t.day} {p.day}:</span><input type="number" value={p.real_I} onChange={(e) => { const nd = [...realData]; nd[i].real_I = parseInt(e.target.value) || 0; setRealData(nd); }} className="flex-1 p-1 border rounded text-right" /></div>
                 ))}
             </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.envTime}</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium">{t.population}</label><input type="number" value={params.N} onChange={(e) => handleParamChange('N', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">{t.duration}</label><input type="number" value={params.T_end} onChange={(e) => handleParamChange('T_end', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
                <div><label className="text-xs font-medium">{t.delay}</label><input type="number" step="0.1" value={params.tau} onChange={(e) => handleParamChange('tau', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <h3 className="text-xs font-bold text-blue-600 uppercase mb-3">{t.spreadParams}</h3>
            <div className="space-y-4">
               {['beta', 'alpha', 'gamma'].map(key => (
                 <div key={key}><div className="flex justify-between text-xs mb-1"><span>{key === 'beta' ? t.infection : key === 'alpha' ? t.incubation : t.recovery}</span><b>{params[key as keyof SimulationParams]}</b></div><input type="range" min="0" max={key === 'gamma' ? 200 : 30} step="0.1" value={params[key as keyof SimulationParams]} onChange={(e) => handleParamChange(key as any, e.target.value)} className="w-full h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer" /></div>
               ))}
            </div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-100">
            <h3 className="text-xs font-bold text-red-600 uppercase mb-3 flex items-center gap-1"><ShieldAlert size={14} /> {t.shieldStrategy}</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium">{t.interventionDay}</label><input type="number" value={params.interventionDay} onChange={(e) => handleParamChange('interventionDay', e.target.value)} className="w-full p-2 border rounded text-sm" /></div>
              <div className="grid grid-cols-2 gap-2">
                 <div><label className="text-[10px] font-medium">{t.controlS}</label><input type="number" step="0.1" value={params.u} onChange={(e) => handleParamChange('u', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
                 <div><label className="text-[10px] font-medium">{t.controlI}</label><input type="number" step="0.1" value={params.v} onChange={(e) => handleParamChange('v', e.target.value)} className="w-full p-1 border rounded text-sm" /></div>
              </div>
            </div>
          </div>
          <button onClick={() => { setParams(DEFAULT_PARAMS); setRealData(DEFAULT_REAL_DATA); }} className="w-full py-2 text-sm text-gray-600 border border-dashed rounded-lg flex items-center justify-center gap-2 hover:border-blue-400 transition-colors"><RefreshCw size={14} /> {t.restoreDefault}</button>
          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mt-4 shadow-sm">
             <div className="flex items-center gap-2 mb-2"><BrainCircuit size={16} className="text-indigo-600"/><h3 className="text-xs font-bold text-indigo-700 uppercase">{t.consultationTitle}</h3></div>
             <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t.rumorTopic} className="w-full p-2 text-sm border rounded mb-2 outline-none" />
             <button onClick={handleConsult} disabled={isAnalyzing} className={`w-full py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-all ${isAnalyzing ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                 {isAnalyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Sparkles size={14} />} {isAnalyzing ? t.thinking : t.analyzeConsult}
             </button>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6"><div><h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="text-blue-600" size={20}/> {t.simulationResult}</h3><p className="text-sm text-gray-500">{t.compareDesc}</p></div><div className="text-right"><span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Intv. Day: {params.interventionDay}</span></div></div>
            <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="day" label={{ value: t.day, position: 'insideBottom', offset: -10 }} />
                        <YAxis tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} width={40} />
                        <Tooltip labelFormatter={(l) => `${t.day} ${l}`} formatter={(v: any) => formatNumber(v)} />
                        <Legend verticalAlign="top" height={36}/>
                        <Bar dataKey="real_I" name={lang === 'vi' ? "Thực tế" : "Real"} barSize={30} fill="#FCA5A5" opacity={0.7} />
                        <Line type="monotone" dataKey="sim_I" name={lang === 'vi' ? "Mô phỏng (I)" : "Sim (I)"} stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="sim_E" name={lang === 'vi' ? "Mô phỏng (E)" : "Sim (E)"} stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
                 { label: t.peakSim, value: Math.max(...chartData.map(d => d.sim_I || 0)), color: "text-blue-600" },
                 { label: t.peakReal, value: Math.max(...realData.map(d => d.real_I)), color: "text-red-500" },
                 { label: t.totalInf, value: chartData[chartData.length-1]?.sim_I || 0, color: "text-gray-700" },
                 { label: t.totalRec, value: chartData[chartData.length-1]?.sim_R || 0, color: "text-green-600" },
             ].map((s, i) => (
                 <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{s.label}</p><p className={`text-xl font-bold ${s.color}`}>{formatNumber(s.value)}</p></div>
             ))}
        </div>
        {analysisResult && (
            <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
                <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-2"><MessageSquare className="text-indigo-600" size={20} /><h3 className="text-lg font-semibold text-indigo-900">{t.expertView}</h3></div>
                <div className="p-6 text-gray-800 leading-relaxed whitespace-pre-wrap font-sans text-sm md:text-base max-h-[400px] overflow-y-auto">{analysisResult}</div>
            </div>
        )}
      </div>
    </div>
  );
};

export default RShieldTab;
