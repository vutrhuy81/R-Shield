
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
  if (!process.env.API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const diffDays = Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;
  
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
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { temperature: 0.7 }
        });
        return response.text || "Error generating analysis.";
    } catch (error: any) { throw new Error(error.message); }
};
