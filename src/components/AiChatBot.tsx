import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, RefreshCw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import type { Language } from '../constants/translations';
import type { Route, Trip, Stop } from '../types';

interface AiChatBotProps {
  language: Language;
  routes: Route[];
  trips: Trip[];
  stops: Stop[];
  onNavigateToBookTicket?: (from?: string, to?: string, date?: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Hidden limits – never exposed to the user
const MAX_USER_MESSAGES = 30;
const MAX_OFFTOPIC_BEFORE_BLOCK = 5;

const UI_TEXT: Record<Language, {
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  welcome: string;
  thinking: string;
  error: string;
  clear: string;
  openBtn: string;
  close: string;
  voiceStart: string;
  voiceStop: string;
  voiceUnsupported: string;
  ttsToggle: string;
  limitReached: string;
}> = {
  vi: {
    title: 'Trợ lý AI Daiichi',
    subtitle: 'Tìm chuyến xe nhanh chóng',
    placeholder: 'Hỏi về chuyến xe, tuyến đường...',
    send: 'Gửi',
    welcome: 'Xin chào! Tôi là trợ lý AI của Daiichi Travel 🚌\n\nTôi có thể giúp bạn:\n• Tìm chuyến xe phù hợp\n• Tra cứu tuyến đường & giá vé\n• Tư vấn lịch trình\n\nBạn muốn đi đâu?',
    thinking: 'Đang suy nghĩ...',
    error: 'Rất tiếc, tôi gặp sự cố kết nối. Vui lòng thử lại.',
    clear: 'Xoá cuộc trò chuyện',
    openBtn: 'Trợ lý AI',
    close: 'Đóng',
    voiceStart: 'Nhấn để nói',
    voiceStop: 'Dừng ghi âm',
    voiceUnsupported: 'Trình duyệt không hỗ trợ giọng nói',
    ttsToggle: 'Bật/tắt đọc phản hồi',
    limitReached: 'Xin lỗi, hệ thống đang bận. Vui lòng liên hệ trực tiếp để được hỗ trợ thêm. Cảm ơn bạn đã sử dụng dịch vụ của Daiichi Travel! 🙏',
  },
  en: {
    title: 'Daiichi AI Assistant',
    subtitle: 'Find your trip quickly',
    placeholder: 'Ask about trips, routes...',
    send: 'Send',
    welcome: 'Hello! I\'m the AI assistant for Daiichi Travel 🚌\n\nI can help you:\n• Find suitable trips\n• Look up routes & ticket prices\n• Plan your itinerary\n\nWhere would you like to go?',
    thinking: 'Thinking...',
    error: 'Sorry, I encountered a connection issue. Please try again.',
    clear: 'Clear conversation',
    openBtn: 'AI Assistant',
    close: 'Close',
    voiceStart: 'Tap to speak',
    voiceStop: 'Stop recording',
    voiceUnsupported: 'Voice not supported by this browser',
    ttsToggle: 'Toggle voice response',
    limitReached: 'Sorry, the system is currently busy. Please contact us directly for further assistance. Thank you for using Daiichi Travel! 🙏',
  },
  ja: {
    title: 'Daiichi AIアシスタント',
    subtitle: '素早く乗車券を検索',
    placeholder: '便・路線について質問...',
    send: '送信',
    welcome: 'こんにちは！Daiichi TravelのAIアシスタントです 🚌\n\nお手伝いできること：\n• 適切な便を検索\n• 路線・料金の案内\n• 旅程のご提案\n\nどちらへお出かけですか？',
    thinking: '考え中...',
    error: '接続に問題が発生しました。再度お試しください。',
    clear: '会話をクリア',
    openBtn: 'AIアシスタント',
    close: '閉じる',
    voiceStart: 'タップして話す',
    voiceStop: '録音停止',
    voiceUnsupported: 'このブラウザは音声入力に対応していません',
    ttsToggle: '音声応答の切替',
    limitReached: '申し訳ありませんが、システムが混雑しています。引き続きサポートが必要な場合は直接お問い合わせください。Daiichi Travelをご利用いただきありがとうございます！🙏',
  },
};

function buildSystemPrompt(routes: Route[], trips: Trip[], stops: Stop[], language: Language): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

  // Summarize available routes
  const routeSummaries = routes.slice(0, 50).map(r =>
    `- Tuyến: ${r.name} | Từ: ${r.departurePoint} → ${r.arrivalPoint} | Giá: ${r.price.toLocaleString('vi-VN')}đ${r.duration ? ` | Thời gian: ${r.duration}` : ''}`
  ).join('\n');

  // Summarize upcoming trips (next 14 days)
  const upcomingTrips = trips
    .filter(t => {
      if (!t.date) return false;
      return t.date >= today;
    })
    .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1)
    .slice(0, 60)
    .map(t => {
      const availableSeats = t.seats.filter(s => s.status === 'EMPTY').length;
      return `- Tuyến: ${t.route} | Ngày: ${t.date} | Giờ: ${t.time} | Ghế trống: ${availableSeats} | Giá: ${t.price.toLocaleString('vi-VN')}đ`;
    })
    .join('\n');

  // Stop names for reference
  const stopNames = stops.slice(0, 30).map(s => s.name).join(', ');

  const langNote = language === 'vi'
    ? 'Hãy trả lời bằng tiếng Việt.'
    : language === 'ja'
      ? '日本語で回答してください。'
      : 'Reply in English.';

  return `Bạn là trợ lý AI thông minh của Daiichi Travel – một công ty vận tải hành khách. ${langNote}

Nhiệm vụ của bạn là giúp khách hàng và thành viên tìm chuyến xe phù hợp, tra cứu tuyến đường, giá vé và lịch trình.

Hôm nay là: ${today}

CÁC TUYẾN ĐƯỜNG HIỆN CÓ:
${routeSummaries || 'Chưa có thông tin tuyến đường.'}

CÁC CHUYẾN XE SẮP TỚI (14 ngày tới):
${upcomingTrips || 'Chưa có thông tin chuyến xe.'}

CÁC ĐIỂM DỪNG:
${stopNames || 'Chưa có thông tin điểm dừng.'}

HƯỚNG DẪN:
- Khi khách hỏi về chuyến xe, hãy tra cứu từ dữ liệu trên và đề xuất các chuyến phù hợp.
- Nếu không tìm thấy chuyến xe phù hợp, hãy báo với khách và gợi ý liên hệ để được tư vấn thêm.
- Trả lời ngắn gọn, thân thiện và hữu ích.
- Luôn đề cập giá vé khi có thể.
- Nếu khách muốn đặt vé, hướng dẫn họ dùng tính năng "Mua vé" trên ứng dụng.
- Không bịa đặt thông tin không có trong dữ liệu trên.
- CHỈ trả lời các câu hỏi liên quan đến dịch vụ vận tải, lịch trình, tuyến đường, đặt vé và thông tin hành trình của Daiichi Travel.
- Nếu khách hỏi về chủ đề không liên quan đến dịch vụ vận tải (ví dụ: tin tức, chính trị, công thức nấu ăn, lập trình, v.v.), hãy lịch sự từ chối và nhắc nhở khách rằng bạn chỉ hỗ trợ về dịch vụ xe khách Daiichi Travel.`;
}

export const AiChatBot: React.FC<AiChatBotProps> = ({
  language,
  routes,
  trips,
  stops,
  onNavigateToBookTicket,
}) => {
  const ui = UI_TEXT[language];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hidden message counters
  const userMessageCountRef = useRef(0);
  const offTopicCountRef = useRef(0);
  const isBlockedRef = useRef(false);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const voiceSupportedRef = useRef<boolean>(
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );

  // Text-to-speech toggle (default off)
  const [ttsEnabled, setTtsEnabled] = useState(false);

  // Initialise with welcome message when first opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: ui.welcome,
        timestamp: new Date(),
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Speak text using Web Speech Synthesis
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US';
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  }, [ttsEnabled, language]);

  // Stop TTS when chat closes
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  // Voice recognition helpers
  const startListening = useCallback(() => {
    if (!voiceSupportedRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRecognitionCtor();
    recognition.lang = language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [language]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Silently block if limit is reached
    if (isBlockedRef.current) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ui.limitReached,
        timestamp: new Date(),
      }]);
      setInput('');
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Increment hidden user message counter
    userMessageCountRef.current += 1;

    // Block silently if hard limit reached
    if (userMessageCountRef.current >= MAX_USER_MESSAGES) {
      isBlockedRef.current = true;
    }

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY is not configured');
      }

      const { GoogleGenAI } = await import('@google/genai');
      const genai = new GoogleGenAI({ apiKey });

      const systemPrompt = buildSystemPrompt(routes, trips, stops, language);

      // Build conversation history for the model
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));

      const chat = genai.chats.create({
        model: 'gemini-2.0-flash',
        config: { systemInstruction: systemPrompt },
        history,
      });

      const response = await chat.sendMessage({ message: text });
      const assistantText = response.text ?? '';

      // Detect off-topic reply (AI politely refusing) and increment hidden counter
      const lowerReply = assistantText.toLowerCase();
      const offTopicSignals = [
        'không thuộc phạm vi', 'ngoài phạm vi', 'chỉ hỗ trợ', 'not within',
        'outside my scope', 'only assist', 'only support', '専門外', 'サポート外',
      ];
      if (offTopicSignals.some(s => lowerReply.includes(s))) {
        offTopicCountRef.current += 1;
        if (offTopicCountRef.current >= MAX_OFFTOPIC_BEFORE_BLOCK) {
          isBlockedRef.current = true;
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantText,
        timestamp: new Date(),
      }]);

      speak(assistantText);

      // Detect if user wants to book a ticket and navigate automatically
      if (onNavigateToBookTicket) {
        const lower = assistantText.toLowerCase() + text.toLowerCase();
        if (lower.includes('đặt vé') || lower.includes('mua vé') || lower.includes('book') || lower.includes('予約')) {
          onNavigateToBookTicket();
        }
      }
    } catch (err) {
      console.error('[AiChatBot] Gemini error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ui.error,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    // Reset conversation display only – hidden limits persist across clears
    setMessages([{
      id: 'welcome-reset',
      role: 'assistant',
      content: ui.welcome,
      timestamp: new Date(),
    }]);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString(language === 'ja' ? 'ja-JP' : language === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderContent = (text: string) => {
    // Simple markdown-like newline rendering
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <>
      {/* Floating toggle button – bottom-right */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="fixed bottom-8 right-4 z-[60] flex items-center gap-2 px-4 h-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 hover:scale-105 transition-all"
        aria-label={ui.openBtn}
        title={ui.openBtn}
      >
        {isOpen ? <X size={20} /> : <Bot size={20} />}
        <span className="text-sm font-semibold hidden sm:block">{ui.openBtn}</span>
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ai-chat-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-28 right-4 z-[60] w-[calc(100vw-32px)] sm:w-[380px] bg-white rounded-[24px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shrink-0">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">{ui.title}</p>
                <p className="text-[11px] text-white/70 truncate">{ui.subtitle}</p>
              </div>
              {/* TTS toggle */}
              <button
                onClick={() => {
                  if (ttsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                  setTtsEnabled(v => !v);
                }}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title={ui.ttsToggle}
                aria-label={ui.ttsToggle}
              >
                {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button
                onClick={handleClear}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title={ui.clear}
                aria-label={ui.clear}
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label={ui.close}
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
              {messages.map(msg => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={13} className="text-white" />
                      </div>
                    )}
                    <div className="max-w-[80%]">
                      <div
                        className={cn(
                          'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                          isUser
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm'
                            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm',
                        )}
                      >
                        {renderContent(msg.content)}
                      </div>
                      <span className={cn('text-[10px] text-gray-400 mt-0.5 block', isUser ? 'text-right mr-1' : 'ml-1')}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={13} className="text-white" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-gray-100 px-4 py-3 bg-white flex items-end gap-2 shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={ui.placeholder}
                disabled={isLoading}
                className="flex-1 resize-none px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-h-24 overflow-y-auto disabled:opacity-50"
                style={{ minHeight: '40px' }}
              />
              {/* Voice input button */}
              {voiceSupportedRef.current && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading}
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40',
                  )}
                  title={isListening ? ui.voiceStop : ui.voiceStart}
                  aria-label={isListening ? ui.voiceStop : ui.voiceStart}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
                aria-label={ui.send}
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
