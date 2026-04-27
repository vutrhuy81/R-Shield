// src/components/RShieldTab.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';
import { Settings, RefreshCw, ShieldAlert, Activity, Database, Plus, Trash2, BrainCircuit, Sparkles, MessageSquare, Wand2, Target } from 'lucide-react';
import { SearchTerm, Language } from '../types';
import { translations } from '../translations';
import { analyzeRShieldSimulation } from '../services/geminiService';
import { DEFAULT_REAL_DATA } from '../constants';
import { marked } from 'marked';

interface SimulationParams { 
  N: number; tau: number; dt: number; T_end: number; 
  beta: number; alpha: number; gamma: number; interventionDay: number; 
  up: number; ug: number; rho: number; v: number; Rc: number;
}
interface RealDataPoint { day: number; real_I: number; }
interface RShieldTabProps {
  terms: SearchTerm[];
  lang: Language;
  realData: RealDataPoint[];
  setRealData: (data: RealDataPoint[]) => void;
  user?: any;
  summary?: string;
  checklist?: any[];
}

export default function RShieldTab({ terms, lang, realData, setRealData, user, summary, checklist }: RShieldTabProps) {
  const t = translations[lang];

  const [params, setParams] = useState<SimulationParams>({
    N: 5000, tau: 2, dt: 0.1, T_end: 30, beta: 1.5, alpha: 0.2, gamma: 0.1,
    interventionDay: 5, up: 0, ug: 0, rho: 0.8, v: 0, Rc: 0
  });

  const [isAutoFitting, setIsAutoFitting] = useState(false);
  const [isAutoFittingRc, setIsAutoFittingRc] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  
  // States mới cho việc tính toán và lưu log
  const [fitMetrics, setFitMetrics] = useState<{ mse: number, peakError: number, peakTimeError: number } | null>(null);
  const [isSavedThisSession, setIsSavedThisSession] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mở khóa lưu log khi thay đổi tham số
  useEffect(() => { setIsSavedThisSession(false); }, [params, terms]);

  const formatNumber = (num: number) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const calculatedRc = useMemo(() => {
    let rc = 0;
    if (params.v > 0) {
      rc = (params.beta * params.N) * (params.alpha / (params.alpha + params.rho * params.ug)) * (1 / params.v);
    } else if (params.gamma > 0) {
      rc = (params.beta * params.N) * (params.alpha / (params.alpha + params.rho * params.ug)) * (1 / params.gamma);
    }
    return Math.max(0, rc);
  }, [params.beta, params.N, params.alpha, params.rho, params.ug, params.v, params.gamma]);

  const runSEIRModelPure = (p: SimulationParams) => {
    const data = [];
    const steps = p.T_end / p.dt;
    const initialI = 1; 
    let S = p.N - initialI; let E = 0; let I = initialI; let R = 0;
    let history_S = new Array(Math.ceil(p.tau / p.dt)).fill(S);
    let history_I = new Array(Math.ceil(p.tau / p.dt)).fill(I);

    for (let i = 0; i <= steps; i++) {
      const day = i * p.dt;
      if (Math.abs(day - Math.round(day)) < 0.01) data.push({ day: Math.round(day), S: Math.round(S), E: Math.round(E), I: Math.round(I), R: Math.round(R) });
      
      const current_up = day >= p.interventionDay ? p.up : 0;
      const current_ug = day >= p.interventionDay ? p.ug : 0;
      const current_v = day >= p.interventionDay ? p.v : 0;

      const delayIndex = Math.max(0, history_S.length - Math.ceil(p.tau / p.dt));
      const S_past = history_S[delayIndex] || S;
      const I_past = history_I[delayIndex] || I;

      const dS = -p.beta * S_past * I_past / p.N - current_up * S;
      const dE = p.beta * S_past * I_past / p.N - p.alpha * E - current_ug * E;
      const dI = p.alpha * E - p.gamma * I - current_v * I;
      const dR = p.gamma * I + current_up * S + p.rho * current_ug * E + current_v * I;

      S += dS * p.dt; E += dE * p.dt; I += dI * p.dt; R += dR * p.dt;
      
      S = Math.max(0, S); E = Math.max(0, E); I = Math.max(0, I); R = Math.max(0, R);
      
      history_S.push(S); history_I.push(I);
      if (history_S.length > Math.ceil(p.tau / p.dt) * 2) { history_S.shift(); history_I.shift(); }
    }
    return data;
  };

  const simulationData = useMemo(() => runSEIRModelPure(params), [params]);
  
  const autoFitParams = () => {
    setIsAutoFitting(true);
    setFitMetrics(null);
    setTimeout(() => {
      let bestParams = { ...params };
      let minError = Infinity;
      const realMaxI = Math.max(...realData.map(d => d.real_I), 1);
      const realPeakDay = realData.findIndex(d => d.real_I === realMaxI);

      for (let b = 0.5; b <= 2.5; b += 0.2) {
        for (let g = 0.05; g <= 0.3; g += 0.05) {
          for (let a = 0.1; a <= 0.5; a += 0.1) {
            const testParams = { ...params, beta: b, gamma: g, alpha: a };
            const simData = runSEIRModelPure(testParams);
            const simMaxI = Math.max(...simData.map(d => d.I));
            const simPeakDay = simData.findIndex(d => d.I === simMaxI);

            const peakError = Math.abs(simMaxI - realMaxI) / realMaxI;
            const timeError = Math.abs(simPeakDay - realPeakDay) / realData.length;
            const totalError = peakError * 0.7 + timeError * 0.3; 

            if (totalError < minError) { minError = totalError; bestParams = testParams; }
          }
        }
      }
      setParams(bestParams);
      setIsAutoFitting(false);

      // Tính Metrics
      const finalSimData = runSEIRModelPure(bestParams);
      let mse = 0;
      finalSimData.forEach((sd, idx) => {
         const rdI = realData[idx] ? realData[idx].real_I : 0;
         mse += Math.pow(sd.I - rdI, 2);
      });
      mse = mse / finalSimData.length;
      
      const finalSimMaxI = Math.max(...finalSimData.map(d => d.I));
      const finalSimPeakDay = finalSimData.findIndex(d => d.I === finalSimMaxI);
      
      setFitMetrics({ mse: mse, peakError: Math.abs(finalSimMaxI - realMaxI), peakTimeError: Math.abs(finalSimPeakDay - realPeakDay) });
    }, 100);
  };

  const autoCalculateRc1 = () => {
    setIsAutoFittingRc(true);
    setTimeout(() => {
      const targetRc = 0.95;
      const alpha = params.alpha;
      const beta = params.beta;
      const N = params.N;
      const rho = params.rho;
      
      let optimalV = params.v;
      let optimalUg = params.ug;

      if (beta * N * alpha > 0) {
          optimalV = (beta * N * alpha) / (targetRc * (alpha + rho * optimalUg));
          if (optimalV > 1 || optimalV < 0) {
              optimalV = 0.5;
              optimalUg = ((beta * N * alpha) / (targetRc * optimalV) - alpha) / rho;
              optimalUg = Math.max(0, Math.min(1, optimalUg));
          }
      }
      setParams({ ...params, v: Number(optimalV.toFixed(2)), ug: Number(optimalUg.toFixed(2)) });
      setIsAutoFittingRc(false);
    }, 500);
  };

  const handleRunAIAnalysis = async () => {
    if (terms.length === 0) { alert(t.enterKeywords); return; }
    setIsAnalyzing(true);
    setAnalysisResult("");
    try {
      const topicStr = terms.map(t => t.term).join(", ");
      const maxRealI = Math.max(...realData.map(d => d.real_I), 0);
      const maxSimI = Math.max(...simulationData.map(d => d.I), 0);
      const result = await analyzeRShieldSimulation(topicStr, { ...params, Rc: calculatedRc }, realData, maxSimI, maxRealI, lang);
      setAnalysisResult(result);
    } catch (error) {
      alert("Error: " + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveLog = async () => {
    if (isSavedThisSession) { alert("⚠️ Bạn đã lưu hồ sơ cho phiên phân tích này rồi!"); return; }
    if (!user) return;
    
    setIsSaving(true);
    try {
      const maxRealI = Math.max(...realData.map(d => d.real_I), 0);
      const maxSimI = Math.max(...simulationData.map(d => d.I), 0);
      const payload = {
        userId: user.id, username: user.username, action: 'SAVE_ANALYSIS_REPORT',
        details: {
          keywords: terms.map(t => t.term),
          dataTab: { checklist: checklist || [], aiSummary: summary || "" },
          modelTab: {
            seirParams: params,
            metrics: fitMetrics || { mse: 0, peakError: 0, peakTimeError: 0 },
            expertAdvice: analysisResult || "",
            peaks: { realPeak: maxRealI, simPeak: maxSimI, Rc: calculatedRc }
          }
        }
      };
      const res = await fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { alert("✅ Đã lưu nhật ký hồ sơ phân tích thành công!"); setIsSavedThisSession(true); } 
      else throw new Error("Lỗi server");
    } catch (error) { alert("❌ Có lỗi xảy ra khi lưu nhật ký."); } 
    finally { setIsSaving(false); }
  };

  const getMarkdownHtml = (content: string) => {
    if (!content) return { __html: "" };
    const processed = content.replace(/\$([^$]+)\$/g, (match, p1) => `<span class="math-symbol">${p1.replace(/\\/g, '')}</span>`);
    return { __html: marked.parse(processed) as string };
  };

  const chartData = simulationData.map(simPoint => {
    const realPoint = realData.find(r => r.day === simPoint.day);
    return { ...simPoint, Real_I: realPoint ? realPoint.real_I : null };
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6"><Settings className="text-blue-600"/> {t.modelSettings}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Database size={18}/> Dữ liệu thực tế (I)</h3>
                  <div className="flex gap-2">
                      <button onClick={() => setRealData([...realData, { day: realData.length, real_I: 0 }])} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Thêm ngày"><Plus size={16}/></button>
                      <button onClick={() => realData.length > 1 && setRealData(realData.slice(0, -1))} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Xóa ngày"><Trash2 size={16}/></button>
                  </div>
              </div>
              <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2">
                {realData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12 font-medium">Ngày {d.day}</span>
                    <input type="number" min="0" value={d.real_I} onChange={(e) => { const newData = [...realData]; newData[i].real_I = Number(e.target.value); setRealData(newData); }} className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 px-2 py-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
             <div>
                <div className="flex justify-between items-center mb-2"><label className="block text-sm font-bold text-gray-700">{t.spreadParams}</label>
                <button onClick={autoFitParams} disabled={isAutoFitting} className="text-xs flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors font-medium">
                    {isAutoFitting ? <RefreshCw className="animate-spin" size={12}/> : <Wand2 size={12}/>} Auto-Fit (Pro)
                </button>
                </div>
                <div className="space-y-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                   {[ { label: `Lây nhiễm (beta): ${params.beta}`, key: 'beta', min: 0.1, max: 5.0, step: 0.1 }, { label: `Ủ bệnh -> Phát tán (alpha): ${params.alpha}`, key: 'alpha', min: 0.05, max: 1.0, step: 0.05 }, { label: `Hồi phục (gamma): ${params.gamma}`, key: 'gamma', min: 0.01, max: 0.5, step: 0.01 } ].map(item => (
                       <div key={item.key}>
                         <label className="text-xs font-medium text-gray-600 flex justify-between"><span>{item.label}</span></label>
                         <input type="range" min={item.min} max={item.max} step={item.step} value={params[item.key as keyof SimulationParams]} onChange={(e) => setParams({ ...params, [item.key]: Number(e.target.value) })} className="w-full accent-indigo-600" />
                       </div>
                   ))}
                </div>
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t.envParams}</label>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-500">{t.totalStudents}</label><input type="number" value={params.N} onChange={(e) => setParams({ ...params, N: Number(e.target.value) })} className="mt-1 w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="text-xs text-gray-500">{t.timeDelay} ($\tau$)</label><input type="number" min="0" value={params.tau} onChange={(e) => setParams({ ...params, tau: Number(e.target.value) })} className="mt-1 w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" /></div>
                </div>
             </div>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center mb-2"><label className="block text-sm font-bold text-gray-700 flex items-center gap-2"><ShieldAlert size={16} className="text-red-500"/> {t.shieldStrategy}</label>
                <button onClick={autoCalculateRc1} disabled={isAutoFittingRc} className="text-xs flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors font-medium">
                    {isAutoFittingRc ? <RefreshCw className="animate-spin" size={12}/> : <Target size={12}/>} Auto Fit Rc&lt;1
                </button>
             </div>
             <div className="bg-red-50 p-4 rounded-lg border border-red-100 space-y-4">
                <div><label className="text-xs font-medium text-gray-700">{t.interventionDay}</label><input type="number" min="0" value={params.interventionDay} onChange={(e) => setParams({ ...params, interventionDay: Number(e.target.value) })} className="mt-1 w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500" /></div>
                {[ { label: `Bác bỏ tin đồn (ug): ${params.ug}`, key: 'ug', min: 0, max: 1, step: 0.05 }, { label: `Chặn kỹ thuật (v): ${params.v}`, key: 'v', min: 0, max: 1, step: 0.05 }, { label: `Hiệu suất bác bỏ (rho): ${params.rho}`, key: 'rho', min: 0, max: 1, step: 0.1 } ].map(item => (
                   <div key={item.key}>
                     <label className="text-xs font-medium text-gray-600 flex justify-between"><span>{item.label}</span></label>
                     <input type="range" min={item.min} max={item.max} step={item.step} value={params[item.key as keyof SimulationParams]} onChange={(e) => setParams({ ...params, [item.key]: Number(e.target.value) })} className="w-full accent-red-600" />
                   </div>
                ))}
             </div>
             <button onClick={handleRunAIAnalysis} disabled={isAnalyzing} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg shadow-md transition-all flex justify-center items-center gap-2 active:scale-95">
                {isAnalyzing ? <RefreshCw className="animate-spin" size={18} /> : <BrainCircuit size={18} />} {isAnalyzing ? t.processing : t.expertAdvice}
             </button>
          </div>

        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6"><Activity className="text-blue-600"/> {t.seirChart}</h2>
        <div className="h-96 w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" /><XAxis dataKey="day" tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={{stroke: '#D1D5DB'}} /><YAxis tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={{stroke: '#D1D5DB'}} /><Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} /><Legend wrapperStyle={{ paddingTop: '20px' }} /><Bar dataKey="Real_I" name="Thực tế (I)" fill="#9CA3AF" opacity={0.5} barSize={20} radius={[4, 4, 0, 0]} /><Line type="monotone" dataKey="S" stroke="#10B981" strokeWidth={3} dot={false} name="Chưa nghe (S)" /><Line type="monotone" dataKey="E" stroke="#F59E0B" strokeWidth={3} dot={false} name="Do dự (E)" /><Line type="monotone" dataKey="I" stroke="#EF4444" strokeWidth={3} dot={false} name="Lây truyền (I)" /><Line type="monotone" dataKey="R" stroke="#3B82F6" strokeWidth={3} dot={false} name="Ngừng chia sẻ (R)" /></ComposedChart></ResponsiveContainer></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[ { label: t.realPeak, value: Math.max(...realData.map(d => d.real_I), 0), color: "text-gray-700" }, { label: t.simPeak, value: Math.max(...simulationData.map(d => d.I)), color: "text-red-600" }, { label: t.totalInterested, value: simulationData[simulationData.length - 1]?.R + simulationData[simulationData.length - 1]?.I || 0, color: "text-blue-600" }, { label: t.rcThreshold, value: calculatedRc, color: calculatedRc > 1 ? "text-red-600" : "text-green-600", isDecimal: true } ].map((s, i) => (
             <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
               <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{s.label}</p>
               {/* @ts-ignore */}
               <p className={`text-xl font-bold ${s.color}`}>{s.isDecimal ? s.value.toFixed(2) : formatNumber(s.value)}</p>
             </div>
         ))}
      </div>

      {analysisResult && (
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 shadow-xl">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-6 py-4 border-b border-indigo-100 flex items-center gap-2"><MessageSquare className="text-white" size={20} /><h3 className="text-lg font-bold text-white uppercase tracking-wider">{t.expertView}</h3></div>
              <div className="p-8 text-gray-800 leading-relaxed font-sans text-sm md:text-base max-h-[800px] overflow-y-auto prose prose-indigo max-w-none" dangerouslySetInnerHTML={getMarkdownHtml(analysisResult)} />
          </div>
      )}

      {fitMetrics && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 border-t-4 border-blue-500">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Target className="text-blue-600"/> Đánh giá hiệu quả mô hình</h3>
            <div className="space-y-4">
               <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm text-gray-500 font-bold uppercase">Sai số bình phương trung bình (MSE)</p>
                  <p className="text-2xl font-mono text-gray-800">{fitMetrics.mse.toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-1">Độ lệch tổng thể giữa đường cong thực tế và lý thuyết.</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 p-3 rounded border border-orange-100"><p className="text-xs text-orange-600 font-bold uppercase mb-1">Sai số đỉnh dịch</p><p className="text-lg font-mono text-orange-800">{fitMetrics.peakError.toFixed(0)} <span className="text-xs">người</span></p></div>
                  <div className="bg-green-50 p-3 rounded border border-green-100"><p className="text-xs text-green-600 font-bold uppercase mb-1">Sai số thời gian đỉnh</p><p className="text-lg font-mono text-green-800">{fitMetrics.peakTimeError.toFixed(0)} <span className="text-xs">ngày</span></p></div>
               </div>
            </div>
            <button onClick={() => setFitMetrics(null)} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors">Xác nhận</button>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-center pb-8">
         <button onClick={handleSaveLog} disabled={isSaving || isSavedThisSession || terms.length === 0} className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold text-white shadow-lg transition-all ${isSavedThisSession ? 'bg-green-600 cursor-not-allowed' : isSaving ? 'bg-blue-400' : terms.length === 0 ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30 active:scale-95'}`}>
            {isSaving ? <RefreshCw className="animate-spin" size={20}/> : <Database size={20}/>}
            {isSavedThisSession ? 'Đã lưu hồ sơ phiên này' : 'Lưu Log Hồ Sơ Phân Tích'}
         </button>
      </div>

    </div>
  );
}
