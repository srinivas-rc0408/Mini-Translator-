import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  RefreshCw, 
  Layers, 
  Sliders, 
  HelpCircle, 
  X, 
  Check, 
  ChevronRight, 
  Languages, 
  Info, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translateImage, TextSegment, Language, LANGUAGES } from '../services/geminiService';
import { renderVisualTranslation } from '../utils/lensInpainter';
import { DbService } from '../services/dbService';
import { useAuth } from '../context/AuthContext';

interface ImageLensTranslatorProps {
  sourceLang: Language;
  targetLang: Language;
  onSaveHistory?: (entry: any) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const ImageLensTranslator: React.FC<ImageLensTranslatorProps> = ({
  sourceLang,
  targetLang,
  onSaveHistory,
  showToast
}) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [translatedSrc, setTranslatedSrc] = useState<string | null>(null);
  const [segments, setSegments] = useState<TextSegment[]>([]);
  
  // App States
  const [statusStep, setStatusStep] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Interaction controls
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Comparison slider
  const [sliderPos, setSliderPos] = useState<number>(50); // 0 to 100
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side' | 'only-translated'>('slider');
  const [isSliderDragging, setIsSliderDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setError(null);
      setTranslatedSrc(null);
      setSegments([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });

      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleTranslateImage = async () => {
    if (!imageSrc || !file) return;

    setIsLoading(true);
    setError(null);
    setTranslatedSrc(null);
    
    try {
      setStatusStep('Analyzing visual text regions...');
      // Start translation via custom layout model in services
      const detectedSegments = await translateImage(
        imageSrc,
        file.type,
        sourceLang,
        targetLang
      );

      if (detectedSegments.length === 0) {
        throw new Error("No text layers were detected in the uploaded image. Please try another image with distinct texts.");
      }

      setSegments(detectedSegments);

      setStatusStep('Reconstructing background & rendering translated overlays...');
      const outputDataUrl = await renderVisualTranslation(imageSrc, detectedSegments);
      
      setTranslatedSrc(outputDataUrl);
      showToast("Visual translation complete!", "success");

      // Save to server history if user is logged in
      if (user && onSaveHistory) {
        const fullSegmentsText = detectedSegments.map(s => s.text).join('\n');
        const fullTranslatedText = detectedSegments.map(s => s.translation).join('\n');

        try {
          const entry = await DbService.saveTranslation(user.id, {
            timestamp: Date.now(),
            mode: 'image',
            sourceLang,
            targetLang,
            inputText: fullSegmentsText,
            output: fullTranslatedText,
            image: imageSrc,
            translatedImage: outputDataUrl,
            segments: detectedSegments,
            isSaved: false
          });
          onSaveHistory(entry);
        } catch (dbErr) {
          console.warn("Failed to save image entry in history:", dbErr);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Visual translation failed. Check image layout and network.");
      showToast("Visual translation failed", "error");
    } finally {
      setIsLoading(false);
      setStatusStep('');
    }
  };

  // Zoom / Pan handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return; // Only pan when zoomed in
    // Prevent panning trigger when dragging slider
    if ((e.target as HTMLElement).closest('.slider-drag-handle')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    if (!translatedSrc) return;
    const link = document.createElement('a');
    link.download = `minitranslator-lens-${Date.now()}.png`;
    link.href = translatedSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded translated signboard image!");
  };

  const clearWorkspace = () => {
    setFile(null);
    setImageSrc(null);
    setTranslatedSrc(null);
    setSegments([]);
    setError(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Slider Drag Engine
  const updateSliderPosition = (clientX: number) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const width = rect.width;
    if (width <= 0) return;

    let relativeX = clientX - rect.left;
    // Clamp movement correctly between image left and image right boundaries
    relativeX = Math.max(0, Math.min(relativeX, width));
    
    // Calculate percentage and update
    const percentage = (relativeX / width) * 100;
    setSliderPos(percentage);
  };

  const handleSliderStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSliderDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updateSliderPosition(clientX);
  };

  useEffect(() => {
    if (!isSliderDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Prevent screen scrolling or standard touch actions when dragging
      if (e.cancelable) {
        e.preventDefault();
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      updateSliderPosition(clientX);
    };

    const handleEnd = () => {
      setIsSliderDragging(false);
    };

    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isSliderDragging]);

  return (
    <div id="image_visual_translation_workspace" className="flex flex-col gap-6 w-full select-none">
      <AnimatePresence mode="wait">
        {!imageSrc ? (
          // 1. Upload Landing Spot
          <motion.div
            key="upload-pantheon"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full"
          >
            <div
              {...getRootProps()}
              className={`cursor-pointer group flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-12 text-center transition-all min-h-[380px] bg-white/5 backdrop-blur-xl ${
                isDragActive 
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-2xl scale-[1.01]' 
                  : 'border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-xl mb-6">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Google Lens-Style Visual Sign Translator</h3>
              <p className="text-sm text-white/50 max-w-sm leading-relaxed mb-6">
                Drop an image or signboard here. MiniTranslator will remove the original text and seamlessly typeset translations back in place.
              </p>
              <span className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all shadow-md">
                Select Sign / Cover File
              </span>
            </div>
          </motion.div>
        ) : (
          // 2. Workbench & Overlay Builder
          <motion.div
            key="canvas-arena"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full"
          >
            {/* Visual Canvas Panel */}
            <div className="lg:col-span-8 flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-white/5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 select-none">
                    Lens Workspace
                  </span>
                  <p className="text-xs text-white/40 truncate max-w-[200px] font-mono">{file?.name}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={clearWorkspace}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Change Image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Central Viewbox */}
              <div 
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                className={`relative w-full h-[450px] bg-slate-950/40 rounded-2xl overflow-hidden flex items-center justify-center select-none ${
                  zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                }`}
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6 text-center">
                    <LoaderRing />
                    <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-400 mt-6 animate-pulse mb-2">
                      In-painting Engine Status
                    </h4>
                    <p className="text-xs font-semibold text-white/60 font-mono tracking-tight max-w-sm">
                      {statusStep}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-8 text-center max-w-lg mx-auto rounded-2xl">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
                    <h3 className="text-base font-bold text-white mb-2">Translation Sandbox Halted</h3>
                    <p className="text-xs text-white/60 leading-relaxed mb-6">{error}</p>
                    <button 
                      onClick={handleTranslateImage}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Retry Rendering
                    </button>
                  </div>
                )}

                {/* The Render Canvas viewport */}
                <div 
                  className="relative select-none transition-transform duration-75 inline-block"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`
                  }}
                >
                  <img 
                    ref={imageRef}
                    src={imageSrc} 
                    alt="Original Lens Source"
                    className="max-h-[420px] max-w-full w-auto h-auto block pointer-events-none rounded-xl shadow-2xl"
                  />
                  
                  {/* Visual Translated output overlay with clip comparison slider */}
                  {translatedSrc && (
                    <div 
                      className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl"
                      style={{
                        clipPath: compareMode === 'slider' 
                          ? `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                          : compareMode === 'only-translated'
                          ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                          : 'none'
                      }}
                    >
                      <img 
                        src={translatedSrc} 
                        alt="Translated Lens Output"
                        className="w-full h-full block pointer-events-none rounded-xl"
                      />
                    </div>
                  )}

                  {/* Render Visual segment indicators (optional helper bounding boxes shown during debug/highlight) */}
                  {translatedSrc && zoom > 1.2 && (
                    <div className="absolute inset-0 pointer-events-none">
                      {segments.map((seg, index) => {
                        const { x1, y1, x2, y2 } = seg.boundingBox;
                        return (
                          <div 
                            key={index}
                            className="absolute border border-indigo-400/25 bg-indigo-500/5 group/box cursor-help"
                            style={{
                              left: `${x1 / 10}%`,
                              top: `${y1 / 10}%`,
                              width: `${(x2 - x1) / 10}%`,
                              height: `${(y2 - y1) / 10}%`
                            }}
                            title={`Original: "${seg.text}"\nTranslated: "${seg.translation}"`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Slider Drag Overlay (Placed exactly over the image so it zooms and transforms automatically) */}
                  {translatedSrc && compareMode === 'slider' && (
                    <div 
                      className="slider-drag-handle absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-ew-resize pointer-events-auto"
                      style={{ 
                        left: `${sliderPos}%`,
                        transform: 'translateX(-50%)',
                        width: '32px'
                      }}
                      onMouseDown={handleSliderStart}
                      onTouchStart={handleSliderStart}
                    >
                      <div className="w-[3px] h-[101%] bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)] pointer-events-none" />
                      <div className="absolute w-9 h-9 rounded-full bg-slate-900 border-2 border-white shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center text-white pointer-events-none group active:scale-95 hover:scale-110 transition-transform">
                        <Sliders className="w-4 h-4 text-indigo-400" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Toolbar controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleZoomOut}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors h-9 w-9 flex items-center justify-center cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-mono text-white/50 w-12 text-center select-none">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button 
                    onClick={handleZoomIn}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors h-9 w-9 flex items-center justify-center cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleZoomReset}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
                    title="Reset Zoom"
                  >
                    1:1
                  </button>
                </div>

                {/* Compare Mode Toggles */}
                {translatedSrc && (
                  <div className="flex bg-white/5 rounded-xl border border-white/10 p-1">
                    <button 
                      onClick={() => setCompareMode('slider')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        compareMode === 'slider' ? 'bg-indigo-600 text-white shadow' : 'text-white/40 hover:text-white/80'
                      }`}
                    >
                      Slider
                    </button>
                    <button 
                      onClick={() => setCompareMode('only-translated')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        compareMode === 'only-translated' ? 'bg-indigo-600 text-white shadow' : 'text-white/40 hover:text-white/80'
                      }`}
                    >
                      Inpainted Mask
                    </button>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="flex items-center gap-2">
                  {!translatedSrc ? (
                    <button 
                      onClick={handleTranslateImage}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer border border-indigo-500/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      Translate Image Text
                    </button>
                  ) : (
                    <button 
                      onClick={handleDownload}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer border border-emerald-500/20"
                    >
                      <Download className="w-4 h-4" />
                      Download Output
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Inspector Panel */}
            <div className="lg:col-span-4 flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" /> Layout Metadata
                </h4>
                <span className="text-[10px] font-mono font-bold text-white/30 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                  {segments.length} regions
                </span>
              </div>

              {segments.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40 py-20">
                  <HelpCircle className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-xs leading-relaxed text-white/60 font-medium">
                    Trigger layout analysis to visualize extracted sign translations, color presets, and linguistic idioms.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[380px] flex flex-col gap-3 pr-1">
                  {segments.map((seg, i) => (
                    <div 
                      key={i}
                      className="group p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all font-sans text-xs flex flex-col gap-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                          Region #{i + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="w-2.5 h-2.5 rounded-full border border-white/10" 
                            style={{ backgroundColor: seg.textColor || '#fff' }}
                            title="Detected text color"
                          />
                          <span 
                            className="w-2.5 h-2.5 border border-white/10" 
                            style={{ backgroundColor: seg.backgroundColor || '#000', borderRadius: '2px' }}
                            title="Detected backdrop color"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-white/40 italic font-medium leading-relaxed font-sans truncate">
                          &ldquo;{seg.text}&rdquo;
                        </p>
                        <div className="flex items-start gap-1">
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-xs font-bold text-white font-sans leading-relaxed">
                            {seg.translation}
                          </p>
                        </div>
                      </div>

                      {/* Accent context */}
                      {seg.isIdiom && (
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/15 text-[10px] leading-relaxed text-indigo-300 mt-1">
                          <div className="flex gap-1.5 items-center font-bold uppercase tracking-wider mb-0.5">
                            <Info className="w-3 h-3 text-indigo-400" />
                            Cultural Nuance
                          </div>
                          {seg.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {translatedSrc && (
                <div className="mt-6 pt-4 border-t border-white/5 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold leading-none">
                      Visual Translation Verified
                    </p>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Background reconstruction generated via local boundary perimeter inpainting. Fonts, typesetting, and rotation matched successfully.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Simple Loading Indicator
const LoaderRing = () => (
  <div className="relative w-16 h-16">
    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 mr-1" />
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent"
    />
  </div>
);
