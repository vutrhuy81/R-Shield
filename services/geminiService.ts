
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
  const targetLang = lang === 'vi' ? 'Vietnamese' : 'English';
  
  // --- UPDATED PROMPT: Logic mô phỏng thực tế ---
  const prompt = `
    Role: Google Trends Data Simulator (R-Shield System).
    CRITICAL: YOU MUST RESPOND ALL TEXT FIELDS IN ${targetLang.toUpperCase()}.
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

    3. **Verification Protocol (Fact-Checking)**:
       - For every major event identified in step 1, apply a verification logic:
         a. **Cross-Check Sources**: Do reputable/mainstream media outlets report this, or only social media/tabloids?
         b. **Official Statements**: Is there a confirmation from authorities (police, government, institutions)?
         c. **Classification Labels in ${targetLang}**: Label the event driving the trend as one of the following:
            - [${lang === 'vi' ? 'TIN ĐÃ KIỂM CHỨNG' : 'VERIFIED NEWS'}]
            - [${lang === 'vi' ? 'TIN ĐỒN CHƯA ĐƯỢC KIỂM CHỨNG' : 'UNVERIFIED RUMOR'}]
            - [${lang === 'vi' ? 'TIN GIẢ/ĐÃ BỊ BÁC BỎ' : 'FAKE NEWS/DEBUNKED'}]

    4. **Output Requirement**:
       - Provide a strictly valid JSON object.
       - The 'summary' must explicitly mention the specific real-world events found AND their verification status in ${targetLang}.
       - 'data' must contain exactly one entry per day for the requested range.       
       - Display the conclusion: whether this search result is fake news or not in ${targetLang}..
       - Always display resource links to reputable news websites for reference if the search result is not fake news.
       
    5. **Rumor Checklist Analysis (MANDATORY)**:
       Analyze the query topic based on these 5 signs of school rumors. Return a boolean (true if sign is present) and a short reasoning.
       CRITICAL LOGIC LINK: Your evaluation in this checklist MUST logically align with the Verification Status in Step 3. 
       - If Step 3 classifies the event as [${lang === 'vi' ? 'TIN ĐÃ KIỂM CHỨNG' : 'VERIFIED NEWS'}] OR [${lang === 'vi' ? 'TIN GIẢ/ĐÃ BỊ BÁC BỎ' : 'FAKE NEWS/DEBUNKED'}], it means the source is clear and there is official evidence or official debunking from authorities. Therefore, "Sign 1 (Vague Source)" and "Sign 2 (Lack of Evidence)" MUST BE FALSE.
       - The 'reason' field for each item MUST be in ${targetLang} and explain the connection to the facts found in Step 3.
       
       - **Sign 1: Vague Source (Nguồn tin mơ hồ)**: Does it come from "heard that", "friend said", or anonymous sources? (False if confirmed or debunked by mainstream media/authorities).
       - **Sign 2: Lack of Evidence (Thiếu bằng chứng)**: Is there a lack of official documents/announcements? (False if police/school/authorities have issued a statement confirming or debunking it).
       - **Sign 3: Urgency/Pushy (Ngôn ngữ thúc ép)**: Words like "Share now", "Don't tell anyone", "100% true"?
       - **Sign 4: Emotional Trigger (Cảm xúc mạnh)**: Does it provoke fear, anger, or extreme curiosity?
       - **Sign 5: Procedural Inconsistency (Sai quy trình)**: Does it contradict normal school protocols?

    Output JSON Format:
    {
      "data": [
        { "date": "YYYY-MM-DD", "${terms[0]}": 12, ... },
        ...
      ],
      "summary": "Detailed analysis identifying specific events. Format: [Date] - [Event Name] ([Verification Status]): Description of the event and why it drove the trend.",
      "checklist": [
         { "sign": "${lang === 'vi' ? 'Nguồn thông tin mơ hồ' : 'Vague Source'}", "detected": boolean, "reason": "Reason in ${targetLang}" },
         { "sign": "${lang === 'vi' ? 'Thiếu bằng chứng kiểm chứng được' : 'Lack of Verifiable Evidence'}", "detected": boolean, "reason": "Reason in ${targetLang}" },
         { "sign": "${lang === 'vi' ? 'Ngôn ngữ thúc ép hoặc khẩn cấp' : 'Urgent or Pushy Language'}", "detected": boolean, "reason": "Reason in ${targetLang}" },
         { "sign": "${lang === 'vi' ? 'Kích hoạt cảm xúc mạnh' : 'Strong Emotional Trigger'}", "detected": boolean, "reason": "Reason in ${targetLang}" },
         { "sign": "${lang === 'vi' ? 'Chưa phù hợp với quy trình nhà trường' : 'Inconsistent with School Protocol'}", "detected": boolean, "reason": "Reason in ${targetLang}" }
      ]
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
        checklist: result.checklist,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata 
    } as TrendAnalysisResponse;

  } catch (error: any) { throw new Error(error.message); }
};

export const analyzeRShieldSimulation = async (
    topic: string, params: any, realData: any[], simulatedPeak: number, realPeak: number, lang: Language
): Promise<string> => {
    if (!import.meta.env.VITE_API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
    const targetLang = lang === 'vi' ? 'Vietnamese' : 'English';
    
    // --- UPDATED PROMPT: Chuyên gia Khoa học Xã hội & Liên ngành ---
    const prompt = `
      You are a leading **Expert in Social Behavioral Science and Interdisciplinary Science** acting as a Strategic Advisor for the R-Shield System.
      
      CRITICAL: YOU MUST PROVIDE THE ENTIRE ANALYSIS IN ${targetLang.toUpperCase()}.
      
      **Context**: You are analyzing a mathematically modeled rumor propagation scenario (SEIR with Time Delay & Multi-channel Control).
      **Language for Output**: ${targetLang}.
      **Case Topic**: "${topic}".

      **Model Parameters & Evidence:**
      * **$\tau$ (Time Delay)**: ${params.tau} days.
      * **$R_0$ Factors**: Beta = ${params.beta}, Alpha = ${params.alpha}, Gamma = ${params.gamma}.
      * **Intervention (Day ${params.interventionDay})**: $u_p$=${params.up}, $u_g$=${params.ug} ($\rho$=${params.rho}), $v$=${params.v}.
      * **Current $R_c$**: ${params.Rc}.
      * **Data**: Real Peak: ${realPeak} | Simulated Peak: ${simulatedPeak}.

      **REQUEST FOR EXPERT ANALYSIS:**
      Please provide a concise, high-impact report in Markdown format in ${targetLang} with the following structure:

      1. **HÀNH ĐỘNG KHẨN CẤP (Immediate Action Plan)**: 
         - List 3-5 specific, actionable steps that must be taken IMMEDIATELY based on the current parameters (especially $\tau$ and $R_c$).
         - Focus on "What to do" rather than "Why".
         - Use bold text for key actions.

      2. **PHÂN TÍCH CHI TIẾT (Detailed Analysis)**:
         - Wrap this entire section inside a <details> and <summary> tag so it is collapsed by default.
         - Inside, provide the technical diagnosis of System Dynamics, Intervention Audit, and Behavioral insights.
         - Explain the "Why" behind the recommendations above.

      *Tone: Professional, Strategic, extremely concise, and strictly in ${targetLang}.*
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
