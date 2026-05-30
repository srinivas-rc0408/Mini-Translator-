import { Language, TextSegment } from "./services/geminiService";

export interface TranslationEntry {
  id: string;
  timestamp: number;
  mode: 'typing' | 'image';
  sourceLang: Language;
  targetLang: Language;
  inputText: string;
  output: string;
  image?: string;
  translatedImage?: string;
  segments?: TextSegment[];
  isSaved: boolean;
}
