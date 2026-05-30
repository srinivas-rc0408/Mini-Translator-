import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Languages, 
  ArrowRightLeft, 
  Copy, 
  Check, 
  X,
  Loader2,
  Sparkles,
  RefreshCw,
  Mic,
  MicOff,
  Volume2,
  Star,
  History as HistoryIcon,
  Trash2,
  ExternalLink,
  LogOut,
  User as UserIcon,
  Info,
  Globe,
  Zap,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  translateText, 
  translateTextStream, 
  translateTextAdvanced,
  LANGUAGES, 
  Language, 
  TranslationMode,
  AdvancedTranslationResponse
} from '../services/geminiService';
import { TranslationEntry } from '../types';
import { useAuth } from '../context/AuthContext';
import { DbService } from '../services/dbService';

// Speech Recognition Type Definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

type Tab = 'translator' | 'history' | 'saved';

import InteractiveNeuralVortex from './ui/interactive-neural-vortex-background';
import { ImageLensTranslator } from './ImageLensTranslator';

export const TranslatorMain: React.FC = () => {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('translator');
  const [inputType, setInputType] = useState<'typing' | 'image'>('typing');
  const [translationMode, setTranslationMode] = useState<TranslationMode>('smart');
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState<Language>('English');
  const [targetLang, setTargetLang] = useState<Language>('Hindi');
  const [output, setOutput] = useState('');
  const [advancedResponse, setAdvancedResponse] = useState<AdvancedTranslationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [history, setHistory] = useState<TranslationEntry[]>([]);
  const [savedTranslations, setSavedTranslations] = useState<TranslationEntry[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
    
    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [historyData, savedData] = await Promise.all([
        DbService.getHistory(user.id),
        DbService.getSaved(user.id)
      ]);
      setHistory(historyData);
      setSavedTranslations(savedData);
    } catch (err) {
      console.warn("Failed to load data from database (using local mode if offline):", err);
    }
  };

  useEffect(() => {
    if (tab === 'translator' && inputType === 'typing' && inputText.trim().length > 2 && !isLoading) {
      const timer = setTimeout(() => {
        handleTranslate();
      }, 1200); // Increased debounce for pro model
      return () => clearTimeout(timer);
    }
  }, [inputText, sourceLang, targetLang, translationMode]);

  const recognitionRef = React.useRef<SpeechRecognition | null>(null);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      const langMap: Record<string, string> = {
        'English': 'en-US',
        'Hindi': 'hi-IN',
        'Spanish': 'es-ES',
        'French': 'fr-FR',
        'Persian': 'fa-IR',
        'Chinese': 'zh-CN',
        'Arabic': 'ar-SA'
      };

      recognition.lang = langMap[sourceLang] || 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakText = (text: string, lang: Language) => {
    if (!window.speechSynthesis) {
      setError("Text-to-speech is not supported in this browser.");
      return;
    }

    try {
      // First, cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      const langMap: Record<string, string> = {
        'English': 'en-US',
        'Hindi': 'hi-IN',
        'Spanish': 'es-ES',
        'French': 'fr-FR',
        'Persian': 'fa-IR',
        'Chinese': 'zh-CN',
        'Arabic': 'ar-SA'
      };
      
      const targetLangCode = langMap[lang] || 'en-US';
      utterance.lang = targetLangCode;
      
      // Get available voices
      const voices = window.speechSynthesis.getVoices();
      
      // Try to find the ideal voice for the language
      const voice = voices.find(v => v.lang === targetLangCode) || 
                    voices.find(v => v.lang.startsWith(targetLangCode.split('-')[0]));
      
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        setError(null); // Clear errors on start
      };

      utterance.onerror = (event) => {
        // 'interrupted' error is common when cancel() is called and can be ignored
        if (event.error !== 'interrupted') {
          console.error('SpeechSynthesisUtterance error:', event);
          setError(`Speech synthesis error: ${event.error}`);
        }
      };

      // Add a small delay to avoid race conditions with cancel()
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
        
        // Browser hack for speech synthesis getting stuck
        const rpeeatResume = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(rpeeatResume);
          } else {
            window.speechSynthesis.resume();
          }
        }, 1000);
      }, 100);

    } catch (err) {
      console.error('Speech synthesis execution failed:', err);
      setError("Failed to play audio. Please try again.");
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);
    setOutput('');
    setAdvancedResponse(null);

    try {
      const advanced = await translateTextAdvanced(inputText, sourceLang, targetLang, translationMode);
      setAdvancedResponse(advanced);
      const finalOutput = advanced.translatedText;
      setOutput(finalOutput);

      if (autoPlay && finalOutput) {
        speakText(finalOutput, targetLang);
      }

      if (user) {
        try {
          const entry = await DbService.saveTranslation(user.id, {
            timestamp: Date.now(),
            mode: 'typing',
            sourceLang,
            targetLang,
            inputText,
            output: finalOutput,
            isSaved: false
          });
          setHistory(prev => [entry, ...prev].slice(0, 50));
        } catch (err) {
          console.warn("Failed to save translation to database", err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    showToast("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const swapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  const toggleSave = async (entry?: TranslationEntry) => {
    if (!user) return;

    if (entry) {
      try {
        await DbService.toggleSave(entry.id, !entry.isSaved);
        if (entry.isSaved) {
          setSavedTranslations(prev => prev.filter(t => t.id !== entry.id));
          setHistory(prev => prev.map(t => t.id === entry.id ? { ...t, isSaved: false } : t));
          showToast("Removed from saved", "success");
        } else {
          const savedEntry = { ...entry, isSaved: true };
          setSavedTranslations(prev => [savedEntry, ...prev]);
          setHistory(prev => prev.map(t => t.id === entry.id ? { ...t, isSaved: true } : t));
          showToast("Added to saved!", "success");
        }
      } catch (err) {
        console.warn("Failed to toggle save", err);
        showToast("Failed to save", "error");
      }
    } else {
      try {
        const newEntry = await DbService.saveTranslation(user.id, {
          timestamp: Date.now(),
          mode: 'typing',
          sourceLang,
          targetLang,
          inputText,
          output,
          isSaved: true
        });
        setSavedTranslations(prev => [newEntry, ...prev]);
        setHistory(prev => [newEntry, ...prev]);
        showToast("Translation saved!", "success");
      } catch (err) {
        console.warn("Failed to save current translation", err);
        showToast("Failed to save", "error");
      }
    }
  };

  const deleteHistory = async (id: string) => {
    try {
      await DbService.deleteEntry(id);
      setHistory(prev => prev.filter(t => t.id !== id));
      setSavedTranslations(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.warn("Failed to delete entry", err);
    }
  };

  const clearAllHistory = async () => {
    if (!user) return;
    try {
      await DbService.clearHistory(user.id);
      setHistory(prev => prev.filter(t => t.isSaved));
    } catch (err) {
      console.warn("Failed to clear history", err);
    }
  };

  const loadEntry = (entry: TranslationEntry) => {
    setTab('translator');
    setSourceLang(entry.sourceLang);
    setTargetLang(entry.targetLang);
    setInputType(entry.mode);
    if (entry.mode === 'typing') {
      setInputText(entry.inputText);
    }
    setOutput(entry.output);
  };

  const clearInput = () => {
    setInputText('');
    setOutput('');
    setError(null);
  };

  return (
    <InteractiveNeuralVortex>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-3 ${
              toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen flex flex-col font-sans text-white">
        <header className="h-16 flex items-center justify-between px-4 md:px-10 bg-white/10 backdrop-blur-md border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/40 border border-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">MiniTranslator</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-white/60">
            {['translator', 'history', 'saved'].map((t) => (
              <button 
                key={t}
                onClick={() => setTab(t as Tab)}
                className={`transition-colors cursor-pointer capitalize ${tab === t ? 'text-white border-b-2 border-white pb-1' : 'hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </nav>
          
          <div className="flex items-center gap-4">
            <Link 
              to="/profile" 
              className="group flex items-center gap-3 p-1 pr-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg overflow-hidden shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col items-start max-w-[120px]">
                <span className="text-xs font-bold text-white line-clamp-1 group-hover:text-indigo-300 transition-colors">
                  {user?.name || user?.email.split('@')[0]}
                </span>
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest leading-none">View Profile</span>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-10 flex flex-col gap-8 max-w-7xl mx-auto w-full relative z-10">
          {tab === 'translator' ? (
            <>
              {/* Mode Switching Header */}
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 w-full">
                <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/10 shrink-0">
                  <button
                    onClick={() => setInputType('typing')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      inputType === 'typing' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    <Languages className="w-4 h-4" />
                    Text Mode
                  </button>
                  <button
                    onClick={() => setInputType('image')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      inputType === 'image' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    Image Mode
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
                  {inputType === 'typing' && (
                    <div className="flex bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 items-center gap-3">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest whitespace-nowrap">Domain</span>
                      <select
                        value={translationMode}
                        onChange={(e) => setTranslationMode(e.target.value as TranslationMode)}
                        className="bg-transparent text-[11px] font-bold text-indigo-400 uppercase tracking-widest focus:text-white outline-none cursor-pointer border-none"
                      >
                        <option value="smart" className="bg-slate-900">Intelligence (Auto)</option>
                        <option value="technical" className="bg-slate-900">Technical</option>
                        <option value="creative" className="bg-slate-900">Creative / Literary</option>
                        <option value="legal" className="bg-slate-900">Legal / Official</option>
                        <option value="medical" className="bg-slate-900">Healthcare / Medical</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-3 md:gap-4 select-none">
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-white/40 font-bold">From</span>
                      <select
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value as Language)}
                        className="bg-white/10 backdrop-blur-md border border-white/10 rounded-lg px-4 py-2 text-sm font-medium text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang} value={lang} className="bg-slate-900 text-white">{lang}</option>
                        ))}
                      </select>
                    </div>

                    <button onClick={swapLanguages} className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer animate-none">
                      <ArrowRightLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-white/40 font-bold">To</span>
                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value as Language)}
                        className="bg-white/10 backdrop-blur-md border border-white/10 rounded-lg px-4 py-2 text-sm font-medium text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang} value={lang} className="bg-slate-900 text-white">{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {inputType === 'typing' ? (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[400px]">
                <div className="flex flex-col bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Input Text</span>
                    <button onClick={clearInput} className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest hover:underline cursor-pointer">Clear</button>
                  </div>
                  
                  <div className="flex-1 relative overflow-hidden">
                    <div className="h-full">
                      <textarea
                        placeholder="Type or paste your text here..."
                        className="w-full h-full resize-none text-xl leading-relaxed outline-none text-white placeholder:text-white/20 min-h-[200px] bg-transparent"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                      {isListening && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none rounded-xl">
                          <div className="flex gap-1 items-end h-8 mb-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <motion.div key={i} animate={{ height: [8, 32, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} className="w-1.5 bg-indigo-500 rounded-full" />
                            ))}
                          </div>
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest animate-pulse">Listening...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-white/20 font-bold uppercase tracking-wider">
                        {inputText.length} / 5000 chars
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => speakText(inputText, sourceLang)} disabled={!inputText.trim()} className="p-1.5 text-white/40 hover:text-white transition-colors cursor-pointer disabled:opacity-0" title="Listen to source">
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={isListening ? stopListening : startListening} className={`p-1.5 rounded-full transition-all duration-300 cursor-pointer ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 scale-110' : 'text-white/40 hover:text-white hover:bg-white/10'}`}>
                          {isListening ? <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}><MicOff className="w-3.5 h-3.5" /></motion.div> : <Mic className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col bg-indigo-500/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/20 p-6 relative">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest font-sans">{targetLang} Translation</span>
                    </div>

                    {/* Standard text action controls (like speak, copy, star) shown in text mode */}
                    {output && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setAutoPlay(!autoPlay)} 
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border ${autoPlay ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}
                          title="Speak translations automatically"
                        >
                          <Sparkles className={`w-3 h-3 ${autoPlay ? 'animate-pulse' : ''}`} />
                          Auto-Play {autoPlay ? 'On' : 'Off'}
                        </button>
                        <button onClick={() => speakText(output, targetLang)} className="p-1.5 text-indigo-300 hover:text-white transition-colors cursor-pointer"><Volume2 className="w-4 h-4" /></button>
                        <button onClick={copyToClipboard} className="p-1.5 text-indigo-300 hover:text-white transition-colors cursor-pointer">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button onClick={() => toggleSave()} className="p-1.5 text-indigo-300 hover:text-white transition-colors cursor-pointer"><Star className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-xl leading-relaxed text-white break-words overflow-y-auto">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60 min-h-[350px]">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                        <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest animate-pulse">Translating...</p>
                      </div>
                    ) : error ? (
                      <div className="flex flex-col items-center justify-center h-full text-center pb-8"><p className="text-sm font-medium text-red-100">{error}</p></div>
                    ) : output ? (
                      /* PLAIN TEXT AND GENERAL INSIGHTS DISPLAY */
                      <div className="relative h-full flex flex-col">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre-wrap relative flex-1">
                          {output}
                          {isStreaming && (
                            <motion.span
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                              className="inline-block w-2 h-5 ml-1 bg-indigo-400 align-middle"
                            />
                          )}
                        </motion.div>
                        
                        <AnimatePresence>
                          {advancedResponse && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-4 font-sans text-sm"
                            >
                              {/* Feedback & Correction */}
                              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10 font-sans">
                                <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Translation Quality</span>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button 
                                      key={star}
                                      onClick={() => showToast(`Thank you for rating ${star} stars!`)}
                                      className="p-1 text-white/20 hover:text-yellow-400 transition-colors cursor-pointer"
                                    >
                                      <Star className="w-3.5 h-3.5" />
                                    </button>
                                  ))}
                                  <div className="w-px h-3 bg-white/10 mx-2" />
                                  <button 
                                    onClick={() => showToast("Correction mode coming soon in next update!", "success")}
                                    className="text-[9px] font-bold text-indigo-400 hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
                                  >
                                    Correct
                                  </button>
                                </div>
                              </div>

                              {/* Primary Stats */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 font-sans">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${advancedResponse.confidence > 0.8 ? 'bg-green-500' : advancedResponse.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                  <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest whitespace-nowrap">
                                    Accuracy: {Math.round(advancedResponse.confidence * 100)}%
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {advancedResponse.detectedStyle && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold uppercase tracking-widest flex items-center gap-1">
                                      <Zap className="w-2.5 h-2.5" />
                                      {advancedResponse.detectedStyle}
                                    </span>
                                  )}
                                  {advancedResponse.detectedTone && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold uppercase tracking-widest flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" />
                                      {advancedResponse.detectedTone}
                                    </span>
                                  )}
                                  {advancedResponse.isMixedLanguage && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-300 font-bold uppercase tracking-widest flex items-center gap-1">
                                      <Globe className="w-2.5 h-2.5" />
                                      Mixed Language
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Intelligence Insights Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                                {advancedResponse.sarcasmLevel !== undefined && advancedResponse.sarcasmLevel > 0.1 && (
                                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                    <div className="flex justify-between items-center text-[9px] font-bold text-red-300 uppercase tracking-widest mb-1">
                                      <span>Sarcasm Probability</span>
                                      <span>{Math.round(advancedResponse.sarcasmLevel * 100)}%</span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${advancedResponse.sarcasmLevel * 100}%` }}
                                        className="h-full bg-red-500"
                                      />
                                    </div>
                                  </div>
                                )}
                                {advancedResponse.detectedAccent && (
                                  <div className="flex flex-col gap-1 p-2 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Detected Dialect</span>
                                    <span className="text-xs text-white/80 font-medium">{advancedResponse.detectedAccent}</span>
                                  </div>
                                )}
                              </div>

                              {/* Cultural / Idiom Context */}
                              {advancedResponse.isIdiom && (
                                <div className="flex gap-3 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20 font-sans">
                                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Semantic Interpretation</span>
                                    <p className="text-xs text-white/80 font-medium leading-relaxed underline decoration-indigo-500/30 underline-offset-4">{advancedResponse.idiomExplanation}</p>
                                    {advancedResponse.literalMeaning && (
                                      <p className="text-[10px] text-white/40 mt-1 italic">Literal: {advancedResponse.literalMeaning}</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {advancedResponse.culturalContext && (
                                <div className="flex gap-3 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20 font-sans">
                                  <Globe className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">Cultural Nuance</span>
                                    <p className="text-xs text-white/80 leading-relaxed font-medium">{advancedResponse.culturalContext}</p>
                                  </div>
                                </div>
                              )}

                              {/* Alternatives */}
                              {advancedResponse.alternatives && advancedResponse.alternatives.length > 0 && (
                                <div className="flex flex-col gap-2 mt-2 font-sans text-xs">
                                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Alternative Interpretations</span>
                                  <div className="flex flex-col gap-1.5">
                                    {advancedResponse.alternatives.map((alt, idx) => (
                                      <div key={idx} className="flex flex-col gap-0.5 p-2 rounded bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer group" onClick={() => setOutput(alt.text)}>
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs text-white/70 font-medium group-hover:text-white transition-colors">{alt.text}</p>
                                          <span className="text-[9px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">Apply</span>
                                        </div>
                                        <p className="text-[10px] text-white/20">{alt.note}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full opacity-25 select-none italic text-white whitespace-nowrap min-h-[300px]">Translation will appear here</div>
                    )}
                  </div>

                  {output && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-end font-sans">
                      <button onClick={handleTranslate} className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest flex items-center gap-1.5 hover:underline cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                      </button>
                    </div>
                  )}
                </div>
              </div>
              ) : (
                <ImageLensTranslator 
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                  onSaveHistory={(entry) => setHistory(prev => [entry, ...prev].slice(0, 50))}
                  showToast={(msg, type) => showToast(msg, type || 'success')}
                />
              )}

              {inputType === 'typing' && (
                <div className="flex justify-center pb-8">
                  <button 
                    onClick={handleTranslate} 
                    disabled={isLoading || !inputText.trim()} 
                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 border border-indigo-400/20 cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        Translate Now
                        <ArrowRightLeft className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {tab === 'history' ? <HistoryIcon className="w-5 h-5" /> : <Star className="w-5 h-5 text-yellow-500" />} {tab === 'history' ? 'Translation History' : 'Saved Translations'}
                </h2>
                {tab === 'history' && history.length > 0 && (
                  <button onClick={clearAllHistory} className="text-xs font-bold text-red-400 uppercase tracking-widest hover:underline cursor-pointer">Clear All</button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(tab === 'history' ? history : savedTranslations).length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-dashed border-white/10 opacity-50"><p className="text-white/40 font-medium">No entries yet</p></div>
                ) : (
                  (tab === 'history' ? history : savedTranslations).map(entry => (
                    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={entry.id} className="bg-white/5 backdrop-blur-lg p-4 rounded-xl shadow-sm border border-white/10 flex flex-col gap-3 group relative overflow-hidden">
                      <div className="flex items-center justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest">
                        <span>{entry.sourceLang} → {entry.targetLang}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50">{new Date(entry.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white/60 line-clamp-2 italic mb-2">{entry.inputText}</p>
                        <p className="text-sm font-semibold text-white line-clamp-3">{entry.output}</p>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="flex gap-2">
                          <button onClick={() => loadEntry(entry)} className="p-1.5 rounded-lg hover:bg-white/10 text-indigo-400 transition-colors cursor-pointer" title="Open/Re-translate"><ExternalLink className="w-4 h-4" /></button>
                          <button onClick={() => toggleSave(entry)} className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${entry.isSaved ? 'text-yellow-500' : 'text-white/30'}`} title={entry.isSaved ? "Unsave" : "Save"}><Star className={`w-4 h-4 ${entry.isSaved ? 'fill-current' : ''}`} /></button>
                        </div>
                        {tab === 'history' && (
                          <button onClick={() => deleteHistory(entry.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </main>

        <footer className="h-12 px-4 md:px-10 flex items-center justify-between bg-white/5 backdrop-blur-md border-t border-white/5 shrink-0">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Powered by Gemini AI Engine</p>
          <div className="hidden sm:flex gap-6">
            <span className="text-[10px] text-white/30 font-bold uppercase tracking-tight">Status: Optimal</span>
            <span className="text-[10px] text-white/30 font-bold uppercase tracking-tight underline cursor-pointer">API Docs</span>
          </div>
        </footer>
      </div>
    </InteractiveNeuralVortex>
  );
};
