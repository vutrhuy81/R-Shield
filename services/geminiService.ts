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

/**
 * Hàm thu thập dữ liệu tin đồn với cơ chế Deterministic tuyệt đối
 */
export const fetchTrendData = async (
  terms: string[], startDate: string, endDate: string, geoCode: string, searchType: SearchType, lang: Language
): Promise<TrendAnalysisResponse> => {
  if (!import.meta.env.VITE_API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
  const diffDays = Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;
  const targetLang = lang === 'vi' ? 'Vietnamese' : 'English';
  
  const prompt = `
    Role: Google Trends Data Simulator (R-Shield System).
    CRITICAL: YOU MUST RESPOND ALL TEXT FIELDS IN ${targetLang.toUpperCase()}.
    Task: Generate daily search interest index (0-100) for terms: "${terms.join(', ')}".
    Config: Geo: ${geoCode}, Type: ${searchType}, Range: ${startDate} to ${endDate} (${diffDays} days).
    
    CRITICAL INSTRUCTIONS FOR REALITY SIMULATION:
    1. **Event Detection (Grounding)**: Use Google Search to find REAL news events causing spikes. Look for multiple distinct events within the timeframe.
    2. **Curve Modeling**: 
       - Explosive Event: Jump from low (<10) to high (90-100) immediately.
       - Prolonged Interest: Gradual rise and slow decay.
       - Baseline: Days with no news should have natural noise (5-15), NOT zero.
    3. **Verification Protocol (Fact-Checking)**:
       a. **Source Type Verification**: Prioritize standard, reputable media (e.g., VTV, Tuổi Trẻ, Thanh Niên, VietnamNet, CAND).
       b. **Conclusion Rule**:
          - Classify as [${lang === 'vi' ? 'TIN ĐÃ KIỂM CHỨNG' : 'VERIFIED NEWS'}] or [${lang === 'vi' ? 'TIN GIẢ/ĐÃ BỊ BÁC BỎ' : 'FAKE NEWS/DEBUNKED'}] ONLY IF you find a direct link from a reputable media source.
          - Otherwise, classify as [${lang === 'vi' ? 'TIN ĐỒN CHƯA ĐƯỢC KIỂM CHỨNG' : 'UNVERIFIED RUMOR'}].
       
    4. **Output Requirement**: Provide a valid JSON. Display the verification status in the summary clearly. Include resource links.

    5. **Rumor Checklist Analysis (STRICT DETERMINISTIC RULES)**:
       Analyze the query topic based on 5 signs. YOU MUST BE 100% OBJECTIVE. GUESSING IS STRICTLY FORBIDDEN.
       - **Sign 1 & Sign 2**: MUST logically align with Verification Status from Step 3. (If Verified/Debunked -> these MUST be false. If Unverified -> these MUST be true).
       - **Sign 3 (Urgency/Pushy Language)**: Output TRUE ONLY IF the search query or news snippets contain explicit urgent words (e.g., "gấp", "khẩn cấp", "share ngay", "urgent", "cứu"). If not explicitly present, output FALSE.
       - **Sign 4 (Emotional Trigger)**: Output TRUE ONLY IF the topic is highly sensational (e.g., involves scandal, severe violence, death, "sốc", "kinh hoàng", "phẫn nộ"). For normal or verified formal news, output FALSE.
       - **Sign 5 (Procedural Inconsistency)**: Output TRUE ONLY IF the topic explicitly describes an action violating standard legal or school protocols. Otherwise, output FALSE.

    Output JSON Format:
    {
      "data": [ { "date": "YYYY-MM-DD", "${terms[0]}": 12 }, ... ],
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
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        tools: [{ googleSearch: {} }], 
        temperature: 0.0, 
        topP: 0.1,
        topK: 1
      }
    });
    
    const result = parseJSON(response.text);
    if (!result || !result.data) throw new Error("Invalid AI response");

    // --- LOGIC GHI ĐÈ BẮT BUỘC (DETERMINISTIC OVERRIDE) ---
    const hasGroundingLinks = !!(response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent);
    const summaryUpper = result.summary ? result.summary.toUpperCase() : "";
    const isVerified = summaryUpper.includes('TIN ĐÃ KIỂM CHỨNG') || summaryUpper.includes('VERIFIED NEWS');
    const isDebunked = summaryUpper.includes('TIN GIẢ/ĐÃ BỊ BÁC BỎ') || summaryUpper.includes('FAKE NEWS/DEBUNKED');

    if ((isVerified || isDebunked) && !hasGroundingLinks) {
        const newLabel = lang === 'vi' ? '[TIN ĐỒN CHƯA ĐƯỢC KIỂM CHỨNG]' : '[UNVERIFIED RUMOR]';
        result.summary = result.summary.replace(/\[TIN ĐÃ KIỂM CHỨNG\]|\[VERIFIED NEWS\]|\[TIN GIẢ\/ĐÃ BỊ BÁC BỎ\]|\[FAKE NEWS\/DEBUNKED\]/g, newLabel);
        result.summary += lang === 'vi' ? ' (Hệ thống tự động hạ cấp do không có link báo chí kiểm chứng).' : ' (Auto-downgraded due to no verifiable links).';
        
        if (result.checklist) {
            result.checklist = result.checklist.map((item: any) => {
                const signUpper = item.sign.toUpperCase();
                if (signUpper.includes('NGUỒN THÔNG TIN MƠ HỒ') || signUpper.includes('VAGUE SOURCE') || signUpper.includes('THIẾU BẰNG CHỨNG') || signUpper.includes('LACK OF VERIFIABLE EVIDENCE')) {
                    return { ...item, detected: true, reason: lang === 'vi' ? 'Hệ thống cập nhật: Không có link báo chính thống.' : 'System updated: No verifiable links.' };
                }
                return item;
            });
        }
    } 
    else if ((isVerified || isDebunked) && hasGroundingLinks && result.checklist) {
        result.checklist = result.checklist.map((item: any) => {
            const signUpper = item.sign.toUpperCase();
            if (signUpper.includes('NGUỒN THÔNG TIN MƠ HỒ') || signUpper.includes('VAGUE SOURCE') || signUpper.includes('THIẾU BẰNG CHỨNG') || signUpper.includes('LACK OF VERIFIABLE EVIDENCE')) {
                return { ...item, detected: false, reason: lang === 'vi' ? 'Đã có báo cáo chính thức xác nhận/bác bỏ.' : 'Official reports confirm/debunk this.' };
            }
            return item;
        });
    }

    result.data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return { 
        data: result.data, 
        summary: result.summary, 
        checklist: result.checklist,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata 
    } as TrendAnalysisResponse;

  } catch (error: any) { throw new Error(error.message); }
};

/**
 * Hàm phân tích chuyên gia với văn phong sắc bén và tư duy chiến lược
 */
export const analyzeRShieldSimulation = async (
    topic: string, params: any, realData: any[], simulatedPeak: number, realPeak: number, lang: Language
): Promise<string> => {
    if (!import.meta.env.VITE_API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
    const targetLang = lang === 'vi' ? 'Vietnamese' : 'English';
    
    const prompt = `
      You are a leading **Expert in Social Behavioral Science and Interdisciplinary Science** acting as a Strategic Advisor for the R-Shield System.
      CRITICAL: YOU MUST PROVIDE THE ENTIRE ANALYSIS IN ${targetLang.toUpperCase()}.
      Topic: "${topic}". Params: tau=${params.tau}, beta=${params.beta}, alpha=${params.alpha}, gamma=${params.gamma}, intervention Day=${params.interventionDay}, up=${params.up}, ug=${params.ug}, v=${params.v}, Rc=${params.Rc}. Peak: Real=${realPeak}, Sim=${simulatedPeak}.

      REQUEST FOR EXPERT ANALYSIS:
      Please provide a concise, high-impact report in Markdown format in ${targetLang} with the following structure:

      1. **HÀNH ĐỘNG KHẨN CẤP (Immediate Action Plan)**: 
         - List 3-5 specific, actionable steps that must be taken IMMEDIATELY based on the current parameters (especially $\\tau$ and $R_c$).
         - Use bold text for key actions.

      2. **PHÂN TÍCH CHI TIẾT (Detailed Analysis)**:
         - Wrap this entire section inside a <details> and <summary> tag so it is collapsed by default.
         - Inside, provide the technical diagnosis of System Dynamics, Intervention Audit, and Behavioral insights.
         - Explain the "Why" behind the recommendations above.

      Tone: Professional, Strategic, extremely concise. Focus on "What to do" rather than "Why" for the Action Plan.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { temperature: 0.2 } 
        });
        return response.text || "Error generating analysis.";
    } catch (error: any) { throw new Error(error.message); }
};
