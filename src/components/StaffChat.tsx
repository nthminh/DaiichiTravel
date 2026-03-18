import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS } from '../constants/translations';
import type { Language } from '../constants/translations';
import { StaffMessage, Employee } from '../types';
import { transportService } from '../services/transportService';

interface StaffChatProps {
  language: Language;
  currentUserName: string;
  currentUserId: string;
  employees: Employee[];
  messages: StaffMessage[];
}

export const StaffChat: React.FC<StaffChatProps> = ({
  language,
  currentUserName,
  currentUserId,
  employees,
  messages,
}) => {
  const t = TRANSLATIONS[language];
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Count unread (messages not from me since last open) – simple badge
  const [lastReadCount, setLastReadCount] = useState(messages.length);
  const unread = isOpen ? 0 : Math.max(0, messages.length - lastReadCount);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Mark read when opened
  useEffect(() => {
    if (isOpen) setLastReadCount(messages.length);
  }, [isOpen, messages.length]);

  // ── @mention detection ─────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setInput(val);
    setCursorPos(pos);

    // Find @word being typed
    const textBefore = val.slice(0, pos);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionSearch(match[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const staffNames = employees
    .filter(e => e.status === 'ACTIVE')
    .map(e => e.name);

  const mentionSuggestions = mentionSearch === ''
    ? staffNames.slice(0, 8)
    : staffNames.filter(n => n.toLowerCase().includes(mentionSearch)).slice(0, 8);

  const insertMention = (name: string) => {
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    // Replace the partial @word with @name
    const replaced = textBefore.replace(/@\w*$/, `@${name} `);
    setInput(replaced + textAfter);
    setShowMentions(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Extract mentions from message content ──────────────────────────────────
  const extractMentions = (text: string): string[] => {
    // Only match single-word @mentions (no spaces) for simplicity
    const matches = text.match(/@(\w+)/g);
    if (!matches) return [];
    return matches.map(m => m.slice(1));
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await transportService.addStaffMessage({
        senderId: currentUserId,
        senderName: currentUserName,
        content,
        mentions: extractMentions(content),
        createdAt: new Date().toISOString(),
      });
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setShowMentions(false);
  };

  // ── Render message content with highlighted @mentions ─────────────────────
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="text-daiichi-red font-bold">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return language === 'vi' ? 'Hôm nay' : 'Today';
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return language === 'vi' ? 'Hôm qua' : 'Yesterday';
      return d.toLocaleDateString('vi-VN');
    } catch { return ''; }
  };

  // Group messages by date
  const groupedMessages: { date: string; items: StaffMessage[] }[] = [];
  for (const msg of messages) {
    const date = msg.createdAt.slice(0, 10);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.items.push(msg);
    } else {
      groupedMessages.push({ date, items: [msg] });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className="fixed bottom-8 right-24 z-40 w-14 h-14 rounded-full bg-daiichi-red text-white shadow-xl shadow-daiichi-red/30 flex items-center justify-center hover:bg-red-700 transition-colors"
        aria-label={t.staff_chat_title || 'Nhắn tin nội bộ'}
      >
        <MessageCircle size={24} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-28 right-24 z-40 w-[360px] bg-white rounded-[24px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
            style={{ maxHeight: '70vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-daiichi-red to-red-600">
              <div className="flex items-center gap-2.5 text-white">
                <MessageCircle size={18} />
                <span className="font-bold text-sm">{t.staff_chat_title || 'Nhắn tin nội bộ'}</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-gray-50/30">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-xs py-8">
                  <MessageCircle size={28} className="mx-auto mb-2 opacity-30" />
                  <p>{language === 'vi' ? 'Chưa có tin nhắn nào' : 'No messages yet'}</p>
                </div>
              )}
              {groupedMessages.map(group => (
                <div key={group.date}>
                  <div className="text-center my-3">
                    <span className="text-[10px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">
                      {formatDate(group.items[0]?.createdAt || group.date + 'T00:00:00')}
                    </span>
                  </div>
                  {group.items.map(msg => {
                    const isMe = msg.senderId === currentUserId || msg.senderName === currentUserName;
                    const isMentioned = msg.mentions.some(m => currentUserName.toLowerCase().includes(m.toLowerCase()));
                    return (
                      <div key={msg.id} className={cn('flex mb-2', isMe ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[80%]', isMe ? 'items-end' : 'items-start', 'flex flex-col gap-0.5')}>
                          {!isMe && (
                            <span className="text-[10px] font-bold text-gray-500 ml-1">{msg.senderName}</span>
                          )}
                          <div className={cn(
                            'px-3 py-2 rounded-2xl text-sm leading-relaxed',
                            isMe
                              ? 'bg-daiichi-red text-white rounded-tr-sm'
                              : isMentioned
                                ? 'bg-amber-50 border border-amber-200 text-gray-800 rounded-tl-sm'
                                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                          )}>
                            {renderContent(msg.content)}
                          </div>
                          <span className={cn('text-[10px] text-gray-400', isMe ? 'text-right mr-1' : 'ml-1')}>
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* @mention suggestions */}
            {showMentions && mentionSuggestions.length > 0 && (
              <div className="border-t border-gray-100 bg-white px-2 py-1.5 max-h-40 overflow-y-auto">
                {mentionSuggestions.map(name => (
                  <button
                    key={name}
                    onClick={() => insertMention(name)}
                    className="w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 flex items-center gap-2 transition-colors"
                  >
                    <AtSign size={13} className="text-daiichi-red shrink-0" />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-gray-100 px-4 py-3 bg-white flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={t.staff_chat_placeholder || 'Nhập tin nhắn... dùng @tên để nhắc ai đó'}
                className="flex-1 resize-none px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 max-h-24 overflow-y-auto"
                style={{ minHeight: '40px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="w-9 h-9 rounded-xl bg-daiichi-red text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-red-700 transition-colors"
                aria-label={t.staff_chat_send || 'Gửi'}
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
