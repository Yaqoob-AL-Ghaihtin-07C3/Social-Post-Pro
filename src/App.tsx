/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Copy, 
  Check, 
  Send, 
  RefreshCcw, 
  Hash, 
  Type, 
  Layout,
  AlertCircle,
  Share2,
  Globe,
  Image as ImageIcon,
  Smile,
  Smartphone,
  Download,
  Languages,
  Github,
  ExternalLink
} from "lucide-react";

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const PLATFORMS = [
  { id: 'instagram', name: 'إنستغرام', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'linkedin', name: 'لينكد إن', icon: <Layout className="w-4 h-4" /> },
  { id: 'twitter', name: 'تويتر (X)', icon: <Hash className="w-4 h-4" /> },
  { id: 'facebook', name: 'فيسبوك', icon: <Share2 className="w-4 h-4" /> },
];

const TONES = [
  { id: 'professional', name: 'احترافي', emoji: '💼' },
  { id: 'funny', name: 'مرح', emoji: '😂' },
  { id: 'inspiring', name: 'ملهم', emoji: '✨' },
  { id: 'formal', name: 'رسمي', emoji: '👔' },
  { id: 'marketing', name: 'تسويقي', emoji: '🚀' },
];

const LANGUAGES = [
  { id: 'ar', name: 'العربية فقط' },
  { id: 'en', name: 'العربية + الإنجليزية' },
  { id: 'fr', name: 'العربية + الفرنسية' },
];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [improvedText, setImprovedText] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPlatform, setSelectedPlatform] = useState('instagram');
  const [selectedTone, setSelectedTone] = useState('professional');
  const [selectedLang, setSelectedLang] = useState('ar');

  // GitHub State
  const [githubUser, setGithubUser] = useState<any>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [pushSuccessUrl, setPushSuccessUrl] = useState<string | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        fetchGithubUser();
      }
    };
    window.addEventListener('message', handleMessage);
    fetchGithubUser();
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchGithubUser = async () => {
    try {
      const res = await fetch('/api/github/user');
      if (res.ok) {
        const data = await res.json();
        setGithubUser(data);
      }
    } catch (e) {}
  };

  const connectGithub = async () => {
    try {
      const res = await fetch('/api/auth/github/url');
      const { url } = await res.json();
      window.open(url, 'github_auth', 'width=600,height=700');
    } catch (e) {
      setError('فشل الاتصال بـ GitHub');
    }
  };

  const pushToGithub = async () => {
    setIsPushing(true);
    setPushSuccessUrl(null);
    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName: 'social-post-pro-' + Date.now() }),
      });
      const data = await res.json();
      if (data.success) {
        setPushSuccessUrl(data.url);
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      setError('فشل رفع المشروع: ' + e.message);
    } finally {
      setIsPushing(false);
    }
  };

  const improvePost = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
      const platformName = PLATFORMS.find(p => p.id === selectedPlatform)?.name;
      const toneName = TONES.find(t => t.id === selectedTone)?.name;
      const langName = LANGUAGES.find(l => l.id === selectedLang)?.name;

      const prompt = `أنت خبير تسويق رقمي محترف. قم بتحسين المنشور التالي لمنصة ${platformName} بنبرة صوت ${toneName}.
            
            النص الأصلي: "${inputText}"

            المطلوب منك هو إنتاج رد منظم يحتوي على:
            1. خطاف (Hook): جملة افتتاحية قوية تجذب الانتباه فوراً تناسب منصة ${platformName}.
            2. المحتوى: إعادة صياغة النص بشكل تفاعلي، جذاب، ومقسم إلى نقاط سهلة القراءة.
            3. الرموز التعبيرية: إضافة رموز تعبيرية (Emojis) مناسبة للسياق.
            4. الهاشتاجات: إضافة 5 هاشتاجات قوية وذات صلة.
            ${selectedLang !== 'ar' ? `5. الترجمة: قم بترجمة المنشور المحسن بالكامل إلى ${langName.split('+')[1].trim()} واجعله يبدو طبيعياً واحترافياً.` : ''}

            يرجى تقديم النتيجة النهائية فقط بوضوح. إذا طلبت ترجمة، ضع النص العربي أولاً ثم النص المترجم بوضوح.`;

      const model = genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const response = await model;
      const text = response.text;
      
      if (text) {
        setImprovedText(text);
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        throw new Error("لم يتم استلام رد من الذكاء الاصطناعي");
      }
    } catch (err) {
      console.error(err);
      setError("عذراً، حدث خطأ أثناء معالجة النص. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsLoading(false);
    }
  };

  const generateImage = async () => {
    if (!improvedText) return;
    setIsGeneratingImage(true);
    try {
      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `Create a high-quality, professional social media image for the following content: ${improvedText.substring(0, 500)}. Style: Modern, clean, and engaging. No text in the image.` },
          ],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error("Image generation error:", err);
      setError("فشل توليد الصورة، يرجى المحاولة لاحقاً.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(improvedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'social-post-image.png';
    link.click();
  };

  return (
    <div className="min-h-screen font-sans p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="bg-[#00FF00] p-2 brutal-border">
              <Sparkles className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tighter">
              POST <span className="text-stroke">PRO</span>
            </h1>
          </div>
          <p className="text-xl text-gray-600 font-medium max-w-xl">
            النسخة الاحترافية: تحسين، ترجمة، وتوليد صور بذكاء اصطناعي فائق.
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {!githubUser ? (
            <button onClick={connectGithub} className="brutal-button bg-white flex items-center gap-2 text-sm">
              <Github className="w-4 h-4" /> ربط حساب GitHub
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400">CONNECTED AS</p>
                <p className="font-mono text-sm font-bold">{githubUser.login}</p>
              </div>
              <img src={githubUser.avatar_url} className="w-10 h-10 brutal-border" alt="avatar" />
            </div>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Panel */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="brutal-card space-y-6">
            {/* Platform Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold uppercase mb-3">
                <Smartphone className="w-4 h-4" /> المنصة المستهدفة
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`flex items-center justify-center gap-2 p-2 border-2 border-black font-bold text-sm transition-all ${
                      selectedPlatform === p.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {p.icon} {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold uppercase mb-3">
                <Smile className="w-4 h-4" /> نبرة الصوت
              </label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTone(t.id)}
                    className={`px-3 py-1 border-2 border-black font-bold text-xs transition-all ${
                      selectedTone === t.id ? 'bg-[#00FF00] text-black' : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {t.emoji} {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold uppercase mb-3">
                <Languages className="w-4 h-4" /> الترجمة التلقائية
              </label>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="w-full p-2 border-2 border-black font-bold text-sm focus:outline-none bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {githubUser && (
            <div className="brutal-card bg-[#00FF00] space-y-4">
              <h3 className="font-bold uppercase flex items-center gap-2">
                <Github className="w-5 h-5" /> رفع المشروع لـ GitHub
              </h3>
              <p className="text-sm font-medium">سيتم إنشاء مستودع جديد ورفع كافة ملفات المشروع إليه.</p>
              <button 
                onClick={pushToGithub}
                disabled={isPushing}
                className="w-full brutal-button bg-white flex items-center justify-center gap-2"
              >
                {isPushing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isPushing ? 'جاري الرفع...' : 'رفع المشروع الآن'}
              </button>
              {pushSuccessUrl && (
                <a 
                  href={pushSuccessUrl} 
                  target="_blank" 
                  className="flex items-center justify-center gap-2 text-sm font-bold underline mt-2"
                >
                  عرض المستودع <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {error && (
            <div className="brutal-card bg-red-50 border-red-500 text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input */}
            <div className="brutal-card flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <Type className="w-5 h-5" />
                <h2 className="font-bold uppercase tracking-tight">النص الأصلي</h2>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب فكرتك هنا..."
                className="flex-grow w-full p-4 bg-gray-50 border-2 border-black focus:outline-none focus:bg-white min-h-[250px] text-lg leading-relaxed resize-none"
                dir="auto"
              />
              <button
                onClick={improvePost}
                disabled={isLoading || !inputText.trim()}
                className={`mt-4 brutal-button flex items-center justify-center gap-2 ${
                  isLoading ? 'opacity-50' : 'bg-[#00FF00]'
                }`}
              >
                {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span>{isLoading ? 'جاري التحسين...' : 'تحسين المنشور'}</span>
              </button>
            </div>

            {/* Output */}
            <div ref={resultRef} className="brutal-card flex flex-col h-full relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00FF00]" />
                  <h2 className="font-bold uppercase tracking-tight">النتيجة</h2>
                </div>
                {improvedText && (
                  <button onClick={copyToClipboard} className="text-gray-400 hover:text-black transition-colors">
                    {isCopied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                )}
              </div>
              
              <div className="flex-grow overflow-auto max-h-[400px] pr-2 custom-scrollbar">
                {!improvedText && !isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 py-10">
                    <Globe className="w-12 h-12 mb-2" />
                    <p className="text-sm">بانتظار إبداعك...</p>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-lg leading-relaxed font-medium" dir="auto">
                    {improvedText}
                  </div>
                )}
              </div>

              {improvedText && !isLoading && (
                <button
                  onClick={generateImage}
                  disabled={isGeneratingImage}
                  className="mt-4 brutal-button bg-white flex items-center justify-center gap-2 border-dashed"
                >
                  {isGeneratingImage ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                  <span>{isGeneratingImage ? 'جاري توليد الصورة...' : 'توليد صورة للمنشور'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Image Result */}
          <AnimatePresence>
            {generatedImage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="brutal-card bg-white"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold uppercase flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" /> الصورة المولدة بالذكاء الاصطناعي
                  </h3>
                  <button onClick={downloadImage} className="brutal-button py-1 px-3 text-xs flex items-center gap-2">
                    <Download className="w-3 h-3" /> تحميل الصورة
                  </button>
                </div>
                <div className="aspect-video w-full overflow-hidden border-2 border-black">
                  <img 
                    src={generatedImage} 
                    alt="Generated social media visual" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-20 pt-8 border-t-2 border-black flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-mono text-gray-500">
        <p>© 2024 POST PRO — POWERED BY GEMINI 3.0 & NANO BANANA</p>
        <div className="flex gap-6">
          <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> MULTI-LANGUAGE</span>
          <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> AI VISUALS</span>
        </div>
      </footer>
    </div>
  );
}
