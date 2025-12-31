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
  // Giữ nguyên logic lấy key bằng import.meta.env cho Vite
  if (!import.meta.env.VITE_API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  
  const diffDays = Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;
  /*------------------
  const prompt = `
    Role: Google Trends Data Simulator (R-Shield System).
    Language for the 'summary' field: ${lang === 'vi' ? 'Vietnamese' : 'English'}.
    Task: Generate daily search interest index (0-100) for terms: "${terms.join(', ')}".
    Config: Geo: ${geoCode}, Type: ${searchType}, Range: ${startDate} to ${endDate} (${diffDays} days).
    Instructions:
    1. Use Google Search tool to find real news events related to these terms in this time range.
    2. If real events exist, create spikes on those dates. If not, simulate natural fluctuations.
    3. Output JSON ONLY:
    {
      "data": [{ "date": "YYYY-MM-DD", "${terms[0]}": 45, ... }],
      "summary": "Short analysis of trends in ${lang === 'vi' ? 'Vietnamese' : 'English'}."
    }
  `;
  ------------------*/
  const prompt = `
    Role: Google Trends Data Simulator (R-Shield System).
    Language for the 'summary' field: ${lang === 'vi' ? 'Vietnamese' : 'English'}.
    Task: Generate daily search interest index (0-100) for terms: "${terms.join(', ')}".
    Config: Geo: ${geoCode}, Type: ${searchType}, Range: ${startDate} to ${endDate} (${diffDays} days).
    
    CRITICAL INSTRUCTIONS FOR REALITY SIMULATION:
    1. **Event Detection (Grounding)**: Use Google Search to find REAL news events causing spikes.
       - Look for *multiple* distinct events within the timeframe (e.g., initial rumors, official investigation, court dates, or separate unrelated incidents under the same keyword).
       - Case Example: If analyzing a legal case, look for separate spikes for "Initial Rumors", "Official Arrest", and "Court Trial".
    
    2. **Curve Modeling**:
       - **Explosive Event**: Jump from low (<10) to high (90-100) immediately (e.g., breaking news, arrests).
       - **Prolonged Interest**: Gradual rise and slow decay (e.g., ongoing rumors, leaked documents).
       - **Baseline**: Days with no news should have natural noise (5-15), NOT zero.

    3. **Output Requirement**:
       - Provide a strictly valid JSON object.
       - The 'summary' must explicitly mention the specific real-world events found (dates and context) that caused the simulated peaks.
       - 'data' must contain exactly one entry per day for the requested range.

    Output JSON Format:
    {
      "data": [
        { "date": "YYYY-MM-DD", "${terms[0]}": 12, ... },
        ...
      ],
      "summary": "Detailed analysis identifying the specific events (e.g., Event A on Date X, Event B on Date Y) that drove the trends."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], temperature: 0.7 }
    });
    const result = parseJSON(response.text);
    if (!result || !result.data) throw new Error("Invalid AI response");
    result.data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { data: result.data, summary: result.summary, groundingMetadata: response.candidates?.[0]?.groundingMetadata } as TrendAnalysisResponse;
  } catch (error: any) { throw new Error(error.message); }
};

export const analyzeRShieldSimulation = async (
    topic: string, params: any, realData: any[], simulatedPeak: number, realPeak: number, lang: Language
): Promise<string> => {
    // SỬA: Đổi từ process.env sang import.meta.env.VITE_API_KEY để đồng nhất và chạy được trên Vercel/Vite
    if (!import.meta.env.VITE_API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
    /*-----------------------
    const prompt = `
      You are an R-Shield Crisis Management Expert.
      Language: Respond in ${lang === 'vi' ? 'Vietnamese' : 'English'}.
      Case: "${topic}".
      Simulation Stats: N=${params.N}, Beta=${params.beta}, Alpha=${params.alpha}, Gamma=${params.gamma}, InterventionDay=${params.interventionDay}, u=${params.u}, v=${params.v}.
      Peaks: Real=${realPeak}, Simulated=${simulatedPeak}.
      Request:
      1. Assess the situation (is it under control?).
      2. Forecast the trend.
      3. Recommend R-Shield Actions (Technical, Communication, Educational/Legal).
      Output in Markdown format.
    `;
    -------------*/

  const prompt = `
    You are an **R-Shield Social Media Crisis & Disinformation Analyst**.
    Your goal is to analyze the spread of rumors/news based on the SEIR mathematical model applied to **Information Diffusion**, NOT biological viruses.
  
    **CONTEXT & MAPPING:**
    - **Topic:** "${topic}"
    - **Population (N):** Total Netizens (internet users) in the monitored area.
    - **Infected (I):** People actively discussing/sharing the news/rumor.
    - **Exposed (E):** People who saw the news but haven't shared yet.
    - **Recovered (R):** People who lost interest or accepted the official truth.
    - **Beta ($\beta$):** Virality rate / Sensationalism of the news. High Beta = Viral content.
    - **Alpha ($\alpha$):** Reaction speed (Time from reading to sharing).
    - **Gamma ($\gamma$):** "Boredom" rate or Fact-check effectiveness.
    - **Intervention:** Actions taken (censorship, official statement, etc.).
    - **u (Control S):** Effectiveness of Education/Legal warnings.
    - **v (Control I):** Effectiveness of Technical blocking/content removal.
  
    **INPUT DATA:**
    - Simulation Params: N=${params.N}, Beta=${params.beta}, Alpha=${params.alpha}, Gamma=${params.gamma}, InterventionDay=${params.interventionDay}, u=${params.u}, v=${params.v}.
    - Peak Interest (Concurrent Users): Real=${realPeak} vs Simulated=${simulatedPeak}.
  
    **REQUEST:**
    Analyze the data and provide a report in **${lang === 'vi' ? 'Vietnamese' : 'English'}** using Markdown format:
  
    ## 1. Situation Assessment (Đánh giá Tình hình)
    - Compare Real vs. Simulated peaks.
    - **Critical:** If Real > Simulated, imply that "Dark Social" or "Organized campaigns" might be pushing the rumor faster than the algorithm predicted.
    - Assess the "Virality" ($\beta$) and "Control Effectiveness" ($u, v$). Is the crisis contained or exploding?
  
    ## 2. Trend Forecast (Dự báo Xu hướng)
    - Predict the lifespan of this discussion. Will it fade naturally (High Gamma) or linger (Low Gamma)?
    - Is there a risk of a "Second Wave" of rumors?
  
    ## 3. R-Shield Action Plan (Kế hoạch Hành động)
    - **Technical (Kỹ thuật):** Recommend keyword filtering, account reporting, reducing reach (If $v$ is low, suggest stronger tech measures).
    - **Communication (Truyền thông):** Recommend Key Messages, Press Conferences, or KOL deployment to correct information.
    - **Educational/Legal (Giáo dục/Pháp lý):** Suggest fines for fake news spreaders or public awareness campaigns (Based on $u$).
  
    **TONE:** Professional, Analytical, Urgent (if peaks are high). Use terms like "Netizens", "Engagement", "Viral", "Fake News", "Public Sentiment".
  `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { temperature: 0.7 }
        });
        return response.text || "Error generating analysis.";
    } catch (error: any) { throw new Error(error.message); }
};
