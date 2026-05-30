import { GoogleGenAI, Type } from "@google/genai";

export type Language = 
  | 'English' 
  | 'Hindi' 
  | 'Kannada' 
  | 'Telugu' 
  | 'Tamil' 
  | 'Urdu' 
  | 'Arabic' 
  | 'Chinese' 
  | 'Japanese' 
  | 'Korean' 
  | 'Spanish' 
  | 'French' 
  | 'Persian';

export type TranslationMode = 'smart' | 'technical' | 'creative' | 'legal' | 'medical';

export interface AdvancedTranslationResponse {
  translatedText: string;
  confidence: number;
  detectedStyle?: 'Standard' | 'Slang' | 'Professional' | 'Educational' | 'Cultural' | 'Technical' | 'Legal' | 'Medical' | 'Mixed';
  detectedTone?: 'Neutral' | 'Friendly' | 'Formal' | 'Angry' | 'Sarcastic' | 'Humorous' | 'Urgent' | 'Academic';
  isIdiom?: boolean;
  idiomExplanation?: string;
  literalMeaning?: string;
  culturalContext?: string;
  detectedAccent?: string;
  sarcasmLevel?: number; // 0-1
  domain?: string;
  isMixedLanguage?: boolean;
  alternatives?: { text: string; note: string }[];
}

export const LANGUAGES: Language[] = [
  'English', 
  'Hindi', 
  'Kannada', 
  'Telugu', 
  'Tamil', 
  'Urdu', 
  'Arabic', 
  'Chinese', 
  'Japanese', 
  'Korean', 
  'Spanish', 
  'French', 
  'Persian'
];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const PRO_MODEL = "gemini-3.1-pro-preview";
const FLASH_MODEL = "gemini-3.5-flash";

export async function* translateTextStream(
  text: string,
  from: Language,
  to: Language,
  mode: TranslationMode = 'smart'
): AsyncGenerator<string> {
  try {
    const systemInstruction = `You are an elite multilingual intelligence expert.
      
      TRANSLATION PHILOSOPHY:
      - PRIORITIZE SEMANTIC MEANING over literal word-for-word mapping.
      - PRESERVE TONE: If the source is sarcastic, the target must be culturally sarcastic.
      - CONTEXTUAL ADAPTATION: Handle pronouns, gender, and status honorifics (e.g., T-V distinction in French/Spanish) based on relationship context.
      - MIXED LANGUAGE: Recognize and handle code-switching (Hinglish, Arabizi, Spanglish) without losing meaning or cultural flavor.
      
      BEHAVIOR:
      - IDIOMS: Don't translate "Break a leg" literally. Use target-culture equivalents.
      - SLANG: Map youth/internet slang to regional equivalents.
      - DOMAIN: If technical, use precise terminology. If casual, use natural flow.
      
      Return ONLY the translated text as a stream. Use natural breathing patterns in the output.`;

    const response = await ai.models.generateContentStream({
      model: FLASH_MODEL,
      contents: text,
      config: { systemInstruction }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    console.error("Translation stream error:", error);
    throw new Error("Could not translate text. Please ensure your Gemini API key is set in Settings > Secrets.");
  }
}

export async function translateTextAdvanced(
  text: string,
  from: Language,
  to: Language,
  targetDomain?: TranslationMode
): Promise<AdvancedTranslationResponse> {
  try {
    const systemInstruction = `You are a world-class linguistic architect and cultural strategist. 
      Your task is to translate from ${from} to ${to}, deeply analyzing every nuance.
      
      INTELLIGENCE LAYER PROTOCOLS:
      1. MEANING EXTRACTION: Identify sarcasm, metaphors, humor, and irony.
      2. TONE DETECTION: Is this angry? Professional? Sneaky? 
      3. DOMAIN ANALYSIS: Detect if input is Legal, Medical, Technical, or Casual.
      4. CULTURAL SYNC: Adapt proverbs and idioms to the target culture.
      5. ACCENT RECOGNITION: Detect regional variations (e.g., British vs Australian English).
      6. MIXED LANGUAGE: Detect code-switching and blend naturally.
      
      OUTPUT REQUIREMENTS:
      - translatedText: The result focusing on semantic intent.
      - alternatives: 2-3 different ways to say it (e.g., more formal vs more local).
      - detectedStyle: Choose from standard list or "Mixed".
      - sarcasmLevel: Float 0-1.
      - isMixedLanguage: Boolean.
      
      Output MUST be valid JSON conforming to the requested schema.`;

    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: text,
      config: { 
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            detectedStyle: { type: Type.STRING },
            detectedTone: { type: Type.STRING },
            isIdiom: { type: Type.BOOLEAN },
            idiomExplanation: { type: Type.STRING },
            literalMeaning: { type: Type.STRING },
            culturalContext: { type: Type.STRING },
            detectedAccent: { type: Type.STRING },
            sarcasmLevel: { type: Type.NUMBER },
            domain: { type: Type.STRING },
            isMixedLanguage: { type: Type.BOOLEAN },
            alternatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  note: { type: Type.STRING }
                }
              }
            }
          },
          required: ["translatedText", "confidence"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Advanced translation error:", error);
    if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED") || error.status === 429) {
      throw new Error("You have exceeded your Gemini API quota. Please check your billing details or try again later.");
    }
    throw new Error("Advanced translation failed. Please check your API key.");
  }
}

export async function translateText(
  text: string,
  from: Language,
  to: Language
): Promise<string> {
  try {
    const advanced = await translateTextAdvanced(text, from, to);
    return advanced.translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Translation service temporarily unavailable.");
  }
}

export interface TextSegment {
  text: string;
  translation: string;
  boundingBox: {
    y1: number;
    x1: number;
    y2: number;
    x2: number;
  };
  detectedLanguage?: string;
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: 'sans-serif' | 'serif' | 'monospace' | 'cursive';
  fontWeight?: 'normal' | 'bold';
  fontSizeEstimation?: number;
  rotation?: number;
  layoutType?: string;
  confidence?: number;
  isIdiom?: boolean;
  explanation?: string;
}

export async function translateImage(
  base64Image: string,
  mimeType: string,
  from: Language,
  to: Language,
  mode: TranslationMode = 'smart'
): Promise<TextSegment[]> {
  try {
    const prompt = `Perform high-precision visual layout analysis, OCR, and context-aware translation from source language ${from} to target language ${to}.
    Format your response strictly as a JSON array of text segments found in the image.
    
    DETECT AND EXTRACT ALL TEXT SEGMENTS IN THE IMAGE.
    For each segment, you MUST provide precise bounding box coordinates normalized to a 0-1000 scale relative to the image dimensions.
    - y1: top boundary (0 to 1000 relative to image height)
    - x1: left boundary (0 to 1000 relative to image width)
    - y2: bottom boundary (0 to 1000 relative to image height)
    - x2: right boundary (0 to 1000 relative to image width)
    
    CRITICAL TRANSLATION PROTOCOLS:
    - Automatically detect the input language if not specified.
    - Translate the raw text into the target language (${to}). Ensure that context, slang, proverbs, signs, and cultural expressions are mapped perfectly and naturally.
    
    VISUAL APPEARANCE PRESERVATION:
    - textColor: Core text color as a HEX string (e.g. "#111111", "#FF3B30", "#FFFFFF")
    - backgroundColor: Flat background color immediately surrounding/behind the text block (e.g. "#FFFFFF", "#1E1E1E", "#3A3A3C")
    - fontFamily: Select 'sans-serif' | 'serif' | 'monospace' | 'cursive'
    - fontWeight: Select 'normal' | 'bold'
    - fontSizeEstimation: Estimated text character vertical size in pixels relative to a standard 1000px height.
    - rotation: Estimated text line rotation angle in degrees clockwise (-180 to 180). Default 0 if straight.
    - layoutType: Estimated style: e.g. 'heading' | 'paragraph' | 'caption' | 'sign'
    - confidence: Float 0-1 representation of layout bounding confidence.
    
    Output a JSON array of segment items conforming exactly to the response schema.`;

    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/png",
        data: cleanBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              translation: { type: Type.STRING },
              boundingBox: {
                type: Type.OBJECT,
                properties: {
                  y1: { type: Type.NUMBER },
                  x1: { type: Type.NUMBER },
                  y2: { type: Type.NUMBER },
                  x2: { type: Type.NUMBER }
                },
                required: ["y1", "x1", "y2", "x2"]
              },
              detectedLanguage: { type: Type.STRING },
              textColor: { type: Type.STRING },
              backgroundColor: { type: Type.STRING },
              fontFamily: { type: Type.STRING },
              fontWeight: { type: Type.STRING },
              fontSizeEstimation: { type: Type.NUMBER },
              rotation: { type: Type.NUMBER },
              layoutType: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              isIdiom: { type: Type.BOOLEAN },
              explanation: { type: Type.STRING }
            },
            required: ["text", "translation", "boundingBox"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Image visual translation layout parsing error:", error);
    throw new Error("Failed to parse and translate image visual layout.");
  }
}

