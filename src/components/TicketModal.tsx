import React, { useState } from 'react';
import { 
  X, Download, Share2, CheckCircle2, 
  MapPin, Calendar, Clock, User, Users,
  CreditCard, QrCode, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language } from '../App';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  language: Language;
}

export const TicketModal: React.FC<TicketModalProps> = ({ isOpen, onClose, booking, language }) => {
  const t = TRANSLATIONS[language];
  const [copied, setCopied] = useState(false);
  if (!booking) return null;

  const handleDownload = () => {
    window.print();
  };

  const handleShare = async () => {
    const text = [
      `🎫 ${language === 'vi' ? 'Vé xe Daiichi Travel' : 'Daiichi Travel Ticket'}`,
      `📋 ${language === 'vi' ? 'Mã vé' : 'Ticket'}: #${booking.id}`,
      `🚌 ${booking.route}`,
      `📅 ${booking.date} ${booking.time}`,
      `💺 ${language === 'vi' ? 'Ghế' : 'Seat'}: ${(booking.seatIds && booking.seatIds.length > 1) ? booking.seatIds.join(', ') : booking.seatId}`,
      `👤 ${booking.customerName} - ${booking.phone}`,
      `💰 ${booking.amount.toLocaleString()}đ`,
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: language === 'vi' ? 'Vé xe Daiichi Travel' : 'Daiichi Travel Ticket', text });
      } catch {
        // user cancelled or share failed, fall through to clipboard
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard not available
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ticket-modal-root fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="ticket-card-print bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
          >
            {/* Success Header */}
            <div className="bg-green-500 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,white_0%,transparent_70%)]" />
              </div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold">{t.ticket_sent_title}</h3>
                <p className="text-white/80 text-sm mt-2">{t.ticket_sent_desc}</p>
              </div>
              <button onClick={onClose} className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Ticket Body */}
            <div className="p-8 space-y-8 relative overflow-y-auto flex-1 ticket-print-area">
              {/* Perforated Line */}
              <div className="absolute top-0 left-0 w-full flex justify-between px-4 -translate-y-1/2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-green-500 rounded-full" />
                ))}
              </div>

              {/* Company Logo */}
              <div className="flex items-center justify-center gap-3 pb-2 border-b border-gray-100">
                <img src="/icon-192.png" alt="Daiichi Travel" className="w-10 h-10 rounded-lg object-contain" />
                <div className="text-center">
                  <p className="text-lg font-bold text-daiichi-red tracking-wide">DAIICHI TRAVEL</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Vé xe khách' : language === 'ja' ? 'バスチケット' : 'Bus Ticket'}</p>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.ticket_code}</p>
                  <p className="text-xl font-mono font-bold text-daiichi-red">#{booking.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.payment_method}</p>
                  <div className="flex items-center justify-end gap-2 text-green-600 font-bold">
                    <CreditCard size={14} />
                    <span className="text-sm uppercase">{booking.paymentMethod}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <User size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t.passenger}</span>
                    </div>
                    <p className="font-bold text-gray-800">{booking.customerName}</p>
                    <p className="text-xs text-gray-500">{booking.phone}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Users size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t.passengers}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-700">{booking.adults} {t.adults}, {booking.children} {t.children}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <MapPin size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t.trip}</span>
                    </div>
                    <p className="font-bold text-gray-800">{booking.route}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <Calendar size={12} />
                      <span>{booking.date}</span>
                    </div>
                  </div>
                  {booking.pickupPoint && (
                    <div>
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <MapPin size={14} className="text-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.pickup_point}</span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-700 leading-tight">{booking.pickupPoint}</p>
                    </div>
                  )}
                  {booking.dropoffPoint && (
                    <div>
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <MapPin size={14} className="text-green-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.dropoff_point}</span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-700 leading-tight">{booking.dropoffPoint}</p>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t.departure}</span>
                    </div>
                    <p className="font-bold text-gray-800">{booking.time}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.seat}</p>
                  <p className="text-2xl font-bold text-daiichi-red">
                    {(booking.seatIds && booking.seatIds.length > 1) ? booking.seatIds.join(', ') : booking.seatId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.total_payment}</p>
                  <p className="text-2xl font-bold text-gray-800">{booking.amount.toLocaleString()}đ</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 pt-4">
                <div className="p-4 bg-white border-2 border-gray-50 rounded-3xl shadow-sm">
                  <QrCode size={120} className="text-gray-800" />
                </div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{language === 'vi' ? 'Quét mã để lên xe' : 'Scan to board'}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="ticket-actions-print p-8 bg-gray-50 flex gap-4 shrink-0">
              <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-100 transition-all">
                <Download size={20} />
                {language === 'vi' ? 'Tải xuống' : 'Download'}
              </button>
              <button onClick={handleShare} className={cn("flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold shadow-lg transition-all", copied ? "bg-green-500 text-white shadow-green-500/20" : "bg-daiichi-red text-white shadow-daiichi-red/20 hover:scale-[1.02]")}>
                {copied ? <Copy size={20} /> : <Share2 size={20} />}
                {copied ? (language === 'vi' ? 'Đã sao chép!' : 'Copied!') : (language === 'vi' ? 'Chia sẻ' : 'Share')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
