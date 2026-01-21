import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { TrendDataPoint, TrendAnalysisResponse, SearchType, Language } from "../types";

const parseJSON = (text: string): any => {
  try {
    let jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
  } catch (e) { return null; }
};

export const fetchTrendData = async (
  terms: string[], startDate: string, endDate: string, geoCode: string, searchType: SearchType, lang: Language
): Promise<TrendAnalysisResponse> => {
  if (!import.meta.env.VITE_API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  const diffDays = Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;
  
  // --- UPDATED PROMPT: Logic mô phỏng thực tế ---
  const prompt = `
    Role: Google Trends Data Simulator (R-Shield System).
    Language for the 'summary' field: ${lang === 'vi' ? 'Vietnamese' : 'English'}.
    Task: Generate daily search interest index (0-100) for terms: "${terms.join(', ')}".
    Config: Geo: ${geoCode}, Type: ${searchType}, Range: ${startDate} to ${endDate} (${diffDays} days).
    
    CRITICAL INSTRUCTIONS FOR REALITY SIMULATION:
    1. **Event Detection (Grounding)**: Use Google Search to find REAL news events causing spikes.
       - Look for *multiple* distinct events within the timeframe.
       - Case Example: If analyzing a legal case, look for separate spikes for "Rumors", "Arrest", and "Trial".
    
    2. **Curve Modeling**:
       - **Explosive Event**: Jump from low (<10) to high (90-100) immediately.
       - **Prolonged Interest**: Gradual rise and slow decay.
       - **Baseline**: Days with no news should have natural noise (5-15), NOT zero.

    3. **Output Requirement**:
       - Provide a strictly valid JSON object.
       - The 'summary' must explicitly mention the specific real-world events found.
       - 'data' must contain exactly one entry per day.

    Output JSON Format:
    {
      "data": [
        { "date": "YYYY-MM-DD", "${terms[0]}": 12, ... },
        ...
      ],
      "summary": "Detailed analysis identifying the specific events..."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Giữ nguyên Flash cho tác vụ search/data generation để tối ưu tốc độ
      contents: prompt,
      config: { 
        tools: [{ googleSearch: {} }], 
        temperature: 0.5 
      }
    });
    
    const result = parseJSON(response.text);
    if (!result || !result.data) throw new Error("Invalid AI response");
    result.data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return { 
        data: result.data, 
        summary: result.summary, 
        groundingMetadata: response.candidates?.[0]?.groundingMetadata 
    } as TrendAnalysisResponse;

  } catch (error: any) { throw new Error(error.message); }
};

export const analyzeRShieldSimulation = async (
    topic: string, params: any, realData: any[], simulatedPeak: number, realPeak: number, lang: Language
): Promise<string> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // --- UPDATED PROMPT: Chuyên gia Khoa học Xã hội & Liên ngành ---
    const prompt = `
      You are a leading **Expert in Social Behavioral Science and Interdisciplinary Science** acting as a Strategic Advisor for the R-Shield System.
      
      **Context**: You are analyzing a mathematically modeled rumor propagation scenario (SEIR with Time Delay & Multi-channel Control).
      **Language**: Respond in ${lang === 'vi' ? 'Vietnamese' : 'English'}.
      **Case Topic**: "${topic}".

      **1. Mathematical Model Parameters (The Evidence):**
      * **$\tau$ (Time Delay)**: ${params.tau} days. (Represents the latency in information verification or the psychological gap between exposure and reaction).
      * **$R_0$ Factors**: Beta (Infection) = ${params.beta}, Alpha (Incubation) = ${params.alpha}, Gamma (Recovery/Loss of Interest) = ${params.gamma}.
      * **Population (N)**: ${params.N}.
      
      **2. Intervention Strategy (Started on Day ${params.interventionDay}):**
      * **$u_p$ (Prevention - Education/Legal)**: ${params.up}. (Measures: Immunity building, legal deterrence acting on Susceptible).
      * **$u_g$ (Correction - Counter-narrative)**: ${params.ug} with Efficiency $\rho$ = ${params.rho}. (Measures: Effectiveness of fact-checking acting on Exposed).
      * **$v$ (Suppression - Technical)**: ${params.v}. (Measures: Blocking, filtering, removing content acting on Infected).

      **3. Comparative Data:**
      * Real Peak: ${realPeak} | Simulated Peak: ${simulatedPeak}.

      **REQUEST FOR EXPERT ANALYSIS:**
      Please provide a comprehensive report in Markdown format covering:

      1.  **System Dynamics Diagnosis**: 
          * Analyze how the **Time Delay ($\tau$)** is affecting the spread. Does the delay in information verification lead to a larger outbreak before controls kick in?
          * Evaluate the basic reproduction of the rumor based on Beta/Gamma.

      2.  **Intervention Strategy Audit**:
          * Critique the balance of the current strategy. Are we relying too much on "Hard Power" (Technical Blocking $v$) vs. "Soft Power" (Education $u_p$ & Correction $u_g$)?
          * Assess the "Correction Efficiency" ($\rho * u_g$). Is the counter-narrative strong enough to convert 'Exposed' individuals?

      3.  **Behavioral & Interdisciplinary Recommendations**:
          * **Psychological Angle**: How to increase public skepticism (reduce $\beta$) or accelerate 'Recovery' (increase $\gamma$)?
          * **Communication Science**: Specific messaging strategies to improve $\rho$ (e.g., speed of truth vs. viral lies).
          * **Policy/Tech**: How to optimize the timing ($interventionDay$) relative to the delay ($\tau$).

      *Tone: Professional, Insightful, Strategic, and scientifically grounded.*
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Sử dụng Pro model để có khả năng suy luận (Reasoning) tốt nhất
            contents: prompt,
            config: { temperature: 0.7 }
        });
        return response.text || "Error generating analysis.";
    } catch (error: any) { throw new Error(error.message); }
};
