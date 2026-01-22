import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts';
import { Settings, RefreshCw, ShieldAlert, Activity, Database, Plus, Trash2, BrainCircuit, Sparkles, MessageSquare, Wand2, Target } from 'lucide-react';
import { SearchTerm, Language } from '../types';
import { translations } from '../translations';
import { analyzeRShieldSimulation } from '../services/geminiService';
import { DEFAULT_REAL_DATA } from '../constants';
import { marked } from 'marked';

// --- Interfaces ---
// Cập nhật tham số theo phương trình trong ảnh
interface SimulationParams { 
  N: number; 
  tau: number;       // Time delay
  dt: number; 
  T_end: number; 
  beta: number;      // Hệ số lây nhiễm
  alpha: number;     // Hệ số ủ bệnh (E -> I)
  gamma: number;     // Hệ số hồi phục
  interventionDay: number; 
  up: number;        // u_p: Kiểm soát S (Giáo dục/Phòng ngừa)
  ug: number;        // u_g: Kiểm soát E (Phản bác tin đồn)
  rho: number;       // rho: Hiệu suất của u_g
  v: number;         // v (nu): Kiểm soát I (Chặn kỹ thuật)
}

interface RealDataPoint { 
  day: number; 
  real_I: number; 
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
  up: 0.01,       // Default u_p
  ug: 3.393,       // Default u_g
  rho: 0.6,      // Default rho
  v: 0.2         // Default v
};

// --- PURE MATH FUNCTION (Updated SEIR Model with Delay & Controls) ---
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

    // Initial Conditions
    const startVal = realDataMap.size > 0 ? (realDataMap.get(0) || 1) : 1; 
    const I0 = Math.max(1, startVal); 
    
    E[0] = I0 * 2; 
    I[0] = I0;
    R[0] = 0;
    S[0] = Math.max(0, N - E[0] - I[0] - R[0]);

    for (let i = 0; i < steps - 1; i++) {
      const currentTime = i * dt;
      
      // Xử lý biến trễ (Delay Variable)
      const idx_past = i - lagSteps;
      const S_past = idx_past >= 0 ? S[idx_past] : S[0]; 
      const I_past = idx_past >= 0 ? I[idx_past] : I[0];

      // Kích hoạt tham số kiểm soát sau ngày can thiệp
      const isIntervention = currentTime >= interventionDay;
      const up_val = isIntervention ? up_active : 0;
      const ug_val = isIntervention ? ug_active : 0;
      const v_val  = isIntervention ? v_active : 0;

      // --- CÁC PHƯƠNG TRÌNH TỪ HÌNH ẢNH ---
      
      // 1. Tốc độ lây nhiễm có trễ: beta * S(t-tau) * I(t-tau) / N
      const infectionRate = (beta * S_past * I_past) / N;
      
      // 2. Tốc độ chuyển từ E sang I: alpha * E(t)
      const incubationRate = alpha * E[i];
      
      // 3. Tốc độ hồi phục (Lưu ý: Phương trình dùng gamma * I * (I+R) / N)
      // Đây là điểm khác biệt so với mô hình chuẩn (gamma * I)
      const recoveryRate = (gamma * I[i] * (I[i] + R[i])) / N; 

      // Các số hạng kiểm soát
      const controlS = up_val * S[i];                // u_p * S(t)
      const controlE = rho * ug_val * E[i];          // rho * u_g(t) * E(t)
      const controlI = v_val * I[i];                 // v * I(t)

      // --- HỆ PHƯƠNG TRÌNH ---
      // dS/dt = - Infection - u_p*S
      const dS = -infectionRate - controlS;

      // dE/dt = Infection - alpha*E - rho*u_g*E
      const dE = infectionRate - incubationRate - controlE;

      // dI/dt = alpha*E - Recovery - v*I
      const dI = incubationRate - recoveryRate - controlI;

      // dR/dt = Recovery + v*I + u_p*S + rho*u_g*E
      const dR = recoveryRate + controlI + controlS + controlE;

      // Cập nhật trạng thái tiếp theo (Euler method)
      S[i + 1] = Math.max(0, S[i] + dS * dt);
      E[i + 1] = Math.max(0, E[i] + dE * dt);
      I[i + 1] = Math.max(0, I[i] + dI * dt);
      R[i + 1] = Math.max(0, R[i] + dR * dt);
    }
    
    // Downsampling cho biểu đồ
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

  // --- Run Simulation for Charting (Using Pure Function Logic) ---
  const runSimulation = useMemo(() => {
    // Gọi hàm pure để tính toán, sau đó map lại dữ liệu khớp với format biểu đồ
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

  // --- CALCULATE RC ---
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
  }, [params, realDataMap]);

  // --- AUTO TUNE RC = 1 ---
  const handleOptimizeRc = () => {
    // Mục tiêu: Tìm k sao cho nếu v' = k*v, ug' = k*ug thì Rc = 1
    // Rc = (beta * s0 * alpha) / [(alpha + rho * k * ug) * (k * v)] = 1
    // => beta * s0 * alpha = k*v * alpha + k^2 * v * rho * ug
    // => (v * rho * ug) * k^2 + (v * alpha) * k - (beta * s0 * alpha) = 0
    // Giải phương trình bậc 2 tìm k dương.

    const { N, beta, alpha, rho, ug, v } = params;
    
    // Lấy s0
    const startVal = realDataMap.size > 0 ? (realDataMap.get(0) || 1) : 1; 
    const I0 = Math.max(1, startVal);
    const E0 = I0 * 2;
    const R0 = 0;
    const S0 = Math.max(0, N - E0 - I0 - R0);
    const s0 = S0 / N;

    // Đảm bảo giá trị khởi tạo không bằng 0 để có thể scale
    const baseV = v <= 0.001 ? 0.05 : v;
    const baseUg = ug <= 0.001 ? 0.5 : ug;

    const A = baseV * rho * baseUg;
    const B = baseV * alpha;
    const C = -(beta * s0 * alpha);

    let k = 1;
    if (Math.abs(A) < 1e-9) {
        // Trường hợp suy biến thành bậc 1: B*k + C = 0 => k = -C/B
        if (B !== 0) k = -C / B;
    } else {
        const delta = B * B - 4 * A * C;
        if (delta >= 0) {
            const k1 = (-B + Math.sqrt(delta)) / (2 * A);
            const k2 = (-B - Math.sqrt(delta)) / (2 * A);
            k = Math.max(k1, k2); // Lấy nghiệm dương
        }
    }

    if (k > 0 && isFinite(k)) {
        setParams(prev => ({
            ...prev,
            v: parseFloat((baseV * k).toFixed(3)),
            ug: parseFloat((baseUg * k).toFixed(3)),
            // Có thể scale cả rho nếu cần, nhưng thường rho là đặc tính cố định.
            // Ở đây giữ nguyên rho, chỉ điều chỉnh cường độ can thiệp v và ug.
        }));
    }
  };

  // --- SUPER-POWERED AUTO-FITTING (GRID SEARCH) ---
  const handleAutoFit = async () => {
    if (realData.length < 3) return;

    setIsFitting(true);
    
    // Sử dụng setTimeout để không block UI render
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
                        simResults.forEach(s => {
                            // @ts-ignore
                            if (s.sim_I > maxSimVal) {
                                // @ts-ignore
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
    const processed = content.replace(/\$([^$]+)\$/g, (match, p1) => {
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
          {/* Data Input Section */}
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

          {/* Core Parameters Section */}
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

          {/* Environment Parameters */}
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

          {/* Strategy / Intervention Parameters */}
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
