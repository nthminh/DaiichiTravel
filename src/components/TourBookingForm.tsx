import React, { useState } from 'react';
import { Calendar, ChevronRight, CheckCircle2, BedDouble, Users, ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserRole, Language, TRANSLATIONS } from '../constants/translations';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  PAYMENT_METHOD_TRANSLATION_KEYS,
} from '../constants/paymentMethods';
import { transportService } from '../services/transportService';
import type { Agent } from '../types';
import type { User } from '../App';

// ─── Local types ──────────────────────────────────────────────────────────────

export interface TourAddonItem {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface TourRoomTypeItem {
  id: string;
  name: string;
  capacity: number;
  pricingMode: 'PER_ROOM' | 'PER_PERSON';
  price: number;
  totalRooms: number;
  description: string;
  images: string[];
}

export interface TourItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  images?: string[];
  discountPercent?: number;
  priceAdult?: number;
  priceChild?: number;
  numAdults?: number;
  numChildren?: number;
  duration?: string;
  nights?: number;
  pricePerNight?: number;
  breakfastCount?: number;
  pricePerBreakfast?: number;
  surcharge?: number;
  surchargeNote?: string;
  youtubeUrl?: string;
  itinerary?: { day: number; content: string }[];
  addons?: TourAddonItem[];
  startDate?: string;
  endDate?: string;
  roomTypes?: TourRoomTypeItem[];
  departureTime?: string;
  departureLocation?: string;
  returnTime?: string;
  returnLocation?: string;
  linkedPropertyId?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TourBookingFormProps {
  // data
  selectedTour: TourItem | null;
  agents: Agent[];
  currentUser: User | null;
  language: Language;

  // form state
  tourBookingName: string;
  setTourBookingName: (v: string) => void;
  tourBookingPhone: string;
  setTourBookingPhone: (v: string) => void;
  tourBookingEmail: string;
  setTourBookingEmail: (v: string) => void;
  tourBookingDate: string;
  setTourBookingDate: (v: string) => void;
  tourBookingAdults: number;
  setTourBookingAdults: (v: number) => void;
  tourBookingChildren: number;
  setTourBookingChildren: (v: number) => void;
  tourBookingNights: number;
  setTourBookingNights: (v: number) => void;
  tourBookingBreakfasts: number;
  setTourBookingBreakfasts: (v: number) => void;
  tourSelectedAddons: Set<string>;
  setTourSelectedAddons: (fn: (prev: Set<string>) => Set<string>) => void;
  tourNotes: string;
  setTourNotes: (v: string) => void;
  tourPaymentMethod: PaymentMethod;
  setTourPaymentMethod: (v: PaymentMethod) => void;

  // room selection
  selectedRoomTypeId: string;
  setSelectedRoomTypeId: (v: string) => void;
  tourRoomBookingCounts: Record<string, number>;

  // booking result state
  tourBookingSuccess: boolean;
  setTourBookingSuccess: (v: boolean) => void;
  tourBookingError: string;
  setTourBookingError: (v: string) => void;
  tourBookingId: string;
  setTourBookingId: (v: string) => void;
  lastTourBooking: any;
  setLastTourBooking: (v: any) => void;
  isTourBookingLoading: boolean;
  setIsTourBookingLoading: (v: boolean) => void;
  tourBookingStatus: 'PENDING' | 'CONFIRMED';
  setTourBookingStatus: (v: 'PENDING' | 'CONFIRMED') => void;

  // callbacks
  onBackToTours: () => void;
  onViewTicket: (booking: any) => void;
  onGoHome: () => void;
  getLocalDateString: (offsetDays?: number) => string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TourBookingForm({
  selectedTour,
  agents,
  currentUser,
  language,
  tourBookingName,
  setTourBookingName,
  tourBookingPhone,
  setTourBookingPhone,
  tourBookingEmail,
  setTourBookingEmail,
  tourBookingDate,
  setTourBookingDate,
  tourBookingAdults,
  setTourBookingAdults,
  tourBookingChildren,
  setTourBookingChildren,
  tourBookingNights,
  setTourBookingNights,
  tourBookingBreakfasts,
  setTourBookingBreakfasts,
  tourSelectedAddons,
  setTourSelectedAddons,
  tourNotes,
  setTourNotes,
  tourPaymentMethod,
  setTourPaymentMethod,
  selectedRoomTypeId,
  setSelectedRoomTypeId,
  tourRoomBookingCounts,
  tourBookingSuccess,
  setTourBookingSuccess,
  tourBookingError,
  setTourBookingError,
  tourBookingId,
  setTourBookingId,
  lastTourBooking,
  setLastTourBooking,
  isTourBookingLoading,
  setIsTourBookingLoading,
  tourBookingStatus,
  setTourBookingStatus,
  onBackToTours,
  onViewTicket,
  onGoHome,
  getLocalDateString,
}: TourBookingFormProps) {
  const t = TRANSLATIONS[language];

  // ── Room image carousel state ──────────────────────────────────────────────
  const [roomImageIdx, setRoomImageIdx] = useState<Record<string, number>>({});

  // ── Price calculation ──────────────────────────────────────────────────────

  const totalPersons = tourBookingAdults + tourBookingChildren;
  const hasRoomTypes = (selectedTour?.roomTypes?.length ?? 0) > 0;
  const selectedRoomType = selectedTour?.roomTypes?.find(rt => rt.id === selectedRoomTypeId) ?? null;

  // When a room is selected, use its price as the base (overrides per-person pricing)
  const pricePerAdult = selectedTour?.priceAdult ?? selectedTour?.price ?? 0;
  const pricePerChild = selectedTour?.priceChild ?? Math.round(pricePerAdult * 0.5);

  // Room-based pricing: if a room type is selected and priced per-room, that is the base
  const roomBasedPrice = selectedRoomType
    ? (selectedRoomType.pricingMode === 'PER_ROOM'
        ? selectedRoomType.price
        : selectedRoomType.price * totalPersons)
    : null;

  const baseTourPrice = roomBasedPrice !== null
    ? roomBasedPrice
    : (tourBookingAdults * pricePerAdult + tourBookingChildren * pricePerChild);

  // Overnight stays: unit price is fixed by admin, customer adjusts quantity
  const tourPricePerNight = selectedTour?.pricePerNight ?? 0;
  const hasNightsOption = (selectedTour?.nights ?? 0) > 0 && tourPricePerNight > 0 && !selectedRoomType;
  const nightsCost = tourBookingNights * tourPricePerNight;

  // Breakfasts: unit price is fixed by admin, customer adjusts quantity
  const pricePerBreakfast = selectedTour?.pricePerBreakfast ?? 0;
  const hasBreakfastOption = (selectedTour?.breakfastCount ?? 0) > 0 && pricePerBreakfast > 0;
  const breakfastCost = tourBookingBreakfasts * pricePerBreakfast;

  // Surcharge (flat fee defined by admin)
  const surchargeAmount = selectedTour?.surcharge ?? 0;

  // Selected addons cost
  const addonsCost = (selectedTour?.addons ?? [])
    .filter(a => tourSelectedAddons.has(a.id))
    .reduce((sum, a) => sum + a.price * totalPersons, 0);

  const accomCost = hasNightsOption ? nightsCost : 0;
  const mealCost = hasBreakfastOption ? breakfastCost : 0;

  // Discount is applied to the full tour subtotal
  const tourSubtotal = baseTourPrice + accomCost + mealCost + surchargeAmount + addonsCost;
  const discountAmount = selectedTour?.discountPercent
    ? Math.round(tourSubtotal * selectedTour.discountPercent / 100)
    : 0;
  const tourTotal = tourSubtotal - discountAmount;

  // Agent commission: calculate and subtract commission amount based on commission rate when agent is logged in
  const isTourAgentBooking = currentUser?.role === UserRole.AGENT;
  const agentData = isTourAgentBooking ? agents.find(a => a.id === currentUser!.id) : null;
  const agentCommissionRate = agentData?.commissionRate ?? 0;
  const agentPaymentType = agentData?.paymentType ?? 'PREPAID';
  const agentCommissionAmount = isTourAgentBooking && agentCommissionRate > 0
    ? Math.round(tourTotal * agentCommissionRate / 100)
    : 0;
  const finalTourTotal = tourTotal - agentCommissionAmount;

  // ── Booking handler ────────────────────────────────────────────────────────

  const handleTourBooking = async (bookStatus: 'PENDING' | 'CONFIRMED') => {
    if (!selectedTour || !tourBookingName.trim() || !tourBookingPhone.trim() || !tourBookingDate) return;
    // Require room selection when the tour has room types
    if (hasRoomTypes && !selectedRoomTypeId) {
      setTourBookingError(language === 'vi'
        ? 'Vui lòng chọn loại phòng/cabin trước khi đặt tour.'
        : 'Please select a room/cabin type before booking.');
      return;
    }
    setTourBookingStatus(bookStatus);
    setIsTourBookingLoading(true);
    setTourBookingError('');
    const tourAgentName = isTourAgentBooking
      ? (currentUser!.name || currentUser!.address || currentUser!.agentCode || (language === 'vi' ? 'Đại lý' : 'Agent'))
      : 'Trực tiếp';
    const bookingData = {
      type: 'TOUR',
      customerName: tourBookingName.trim(),
      phone: tourBookingPhone.trim(),
      email: tourBookingEmail.trim(),
      tourId: selectedTour.id,
      route: selectedTour.title,
      date: tourBookingDate,
      adults: tourBookingAdults,
      children: tourBookingChildren,
      accommodation: 'none',
      mealPlan: 'none',
      nightsBooked: hasNightsOption ? tourBookingNights : 0,
      breakfastsBooked: hasBreakfastOption ? tourBookingBreakfasts : 0,
      selectedAddons: [...tourSelectedAddons],
      surcharge: surchargeAmount,
      surchargeNote: selectedTour.surcharge ? (selectedTour.surchargeNote || '') : '',
      duration: selectedTour.duration || '',
      nights: tourBookingNights,
      notes: tourNotes,
      amount: finalTourTotal,
      paymentMethod: bookStatus === 'CONFIRMED'
        ? (isTourAgentBooking && agentPaymentType === 'PREPAID' ? 'Chuyển khoản QR' : tourPaymentMethod)
        : (language === 'vi' ? 'Thanh toán sau' : 'Pay later'),
      agent: tourAgentName,
      agentId: isTourAgentBooking ? currentUser!.id : undefined,
      ...(agentCommissionAmount > 0 ? { agentCommissionRate, agentCommissionAmount } : {}),
      ...(selectedRoomType ? { selectedRoomTypeId: selectedRoomType.id, selectedRoomTypeName: selectedRoomType.name } : {}),
      status: bookStatus,
    };
    try {
      const result = await transportService.createBooking(bookingData);
      const savedBooking = { ...bookingData, id: result.id || '', ticketCode: result.ticketCode || '' };
      setTourBookingId(result.ticketCode || result.id || '');
      setLastTourBooking(savedBooking);
      setTourBookingSuccess(true);
    } catch (err) {
      console.error('Failed to save tour booking:', err);
      setTourBookingError(language === 'vi'
        ? 'Đã xảy ra lỗi khi đặt tour. Vui lòng thử lại.'
        : 'An error occurred while booking. Please try again.');
    } finally {
      setIsTourBookingLoading(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────

  if (tourBookingSuccess) {
    const isReserved = tourBookingStatus === 'PENDING';
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isReserved ? 'bg-blue-100' : 'bg-green-100'}`}>
          <CheckCircle2 className={isReserved ? 'text-blue-500' : 'text-green-500'} size={40} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">
            {isReserved ? (t.tour_reserved_success || (language === 'vi' ? 'Giữ chỗ thành công!' : 'Reservation placed!')) : t.tour_booking_success}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isReserved
              ? (t.tour_reserve_note || (language === 'vi' ? 'Chúng tôi sẽ liên hệ xác nhận và hướng dẫn thanh toán sau.' : 'We will contact you to confirm and guide payment.'))
              : (language === 'vi' ? `Xác nhận thanh toán sẽ được gửi đến ${tourBookingPhone}` : `Payment confirmation will be sent to ${tourBookingPhone}`)}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 w-full max-w-sm space-y-3">
          {tourBookingId && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium">{language === 'vi' ? 'Mã đặt tour' : 'Booking ID'}</span>
              <span className="font-bold text-daiichi-red">{tourBookingId}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">{language === 'vi' ? 'Trạng thái' : 'Status'}</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${isReserved ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
              {isReserved ? (language === 'vi' ? 'Giữ chỗ' : 'Reserved') : (language === 'vi' ? 'Đã xác nhận' : 'Confirmed')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">{language === 'vi' ? 'Tour' : 'Tour'}</span>
            <span className="font-bold text-gray-700 text-right max-w-[180px] truncate">{selectedTour?.title}</span>
          </div>
          {selectedTour?.duration && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium">{language === 'vi' ? 'Thời gian' : 'Duration'}</span>
              <span className="font-bold text-gray-700">{selectedTour.duration}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">{language === 'vi' ? 'Ngày khởi hành' : 'Departure'}</span>
            <span className="font-bold text-gray-700">{tourBookingDate}</span>
          </div>
          {selectedRoomType && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium">{language === 'vi' ? 'Loại phòng' : 'Room Type'}</span>
              <span className="font-bold text-gray-700">{selectedRoomType.name}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">{language === 'vi' ? 'Khách hàng' : 'Customer'}</span>
            <span className="font-bold text-gray-700">{tourBookingName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">{language === 'vi' ? 'Số điện thoại' : 'Phone'}</span>
            <span className="font-bold text-gray-700">{tourBookingPhone}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 font-medium">{language === 'vi' ? 'Số người' : 'Persons'}</span>
            <span className="font-bold text-gray-700">
              {tourBookingAdults} {language === 'vi' ? 'người lớn' : 'adults'}
              {tourBookingChildren > 0 && `, ${tourBookingChildren} ${language === 'vi' ? 'trẻ em' : 'children'}`}
            </span>
          </div>
          <div className="border-t border-gray-100 pt-3 flex justify-between">
            <span className="text-sm font-bold text-gray-500 uppercase">{t.total_amount}</span>
            <span className="text-lg font-bold text-daiichi-red">{finalTourTotal.toLocaleString()}đ</span>
          </div>
        </div>
        <div className="flex gap-4 flex-wrap justify-center">
          <button
            onClick={() => { if (lastTourBooking) { onViewTicket(lastTourBooking); } }}
            className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {language === 'vi' ? 'Tải vé xác nhận' : 'Download Ticket'}
          </button>
          <button
            onClick={() => { setTourBookingSuccess(false); setTourBookingId(''); setLastTourBooking(null); onBackToTours(); }}
            className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
          >
            {language === 'vi' ? 'Xem thêm tour' : 'Browse more tours'}
          </button>
          <button
            onClick={() => { setTourBookingSuccess(false); setTourBookingId(''); setLastTourBooking(null); onGoHome(); }}
            className="px-6 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20"
          >
            {t.home}
          </button>
        </div>
      </div>
    );
  }

  // ── Booking form ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBackToTours} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
          <ChevronRight className="rotate-180" size={22} />
        </button>
        <div>
          <h2 className="text-2xl font-bold">{t.tour_booking_title}</h2>
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Xem tour và tùy chỉnh chuyến đi của bạn' : 'View tour and customize your trip'}</p>
        </div>
      </div>

      {/* Tour Detail Hero */}
      {selectedTour && (() => {
        const allImages = selectedTour.images && selectedTour.images.length > 0
          ? selectedTour.images
          : (selectedTour.imageUrl ? [selectedTour.imageUrl] : []);
        return (
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            {/* Image carousel */}
            {allImages.length > 0 && (
              <div className="relative h-56 overflow-hidden bg-gray-100">
                <img
                  src={allImages[0]}
                  alt={selectedTour.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {allImages.length > 1 && (
                  <div className="absolute bottom-3 right-3 flex gap-1">
                    {allImages.slice(0, 5).map((img, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/70 cursor-pointer"
                        style={{ opacity: i === 0 ? 1 : 0.75 }}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                    {allImages.length > 5 && (
                      <div className="w-10 h-10 rounded-lg bg-black/50 border-2 border-white/70 flex items-center justify-center text-white text-[10px] font-bold">
                        +{allImages.length - 5}
                      </div>
                    )}
                  </div>
                )}
                {(selectedTour.discountPercent ?? 0) > 0 && (
                  <div className="absolute top-4 left-4 bg-daiichi-red text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                    -{selectedTour.discountPercent}% {language === 'vi' ? 'GIẢM' : 'OFF'}
                  </div>
                )}
                {selectedTour.duration && (
                  <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold">
                    {selectedTour.duration}
                  </div>
                )}
              </div>
            )}
            <div className="p-5 space-y-3">
              <h3 className="text-xl font-bold text-gray-800">{selectedTour.title}</h3>
              <p className="text-sm text-gray-600">{selectedTour.description}</p>
              {/* Highlights */}
              <div className="flex flex-wrap gap-2">
                {(selectedTour.nights ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                    🌙 {selectedTour.nights} {language === 'vi' ? 'đêm' : 'nights'}
                  </span>
                )}
                {(selectedTour.breakfastCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    ☕ {selectedTour.breakfastCount} {language === 'vi' ? 'bữa sáng' : 'breakfasts'}
                  </span>
                )}
                {(selectedTour.surcharge ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                    + {selectedTour.surchargeNote || (language === 'vi' ? 'Phụ phí' : 'Surcharge')}
                  </span>
                )}
              </div>
              {/* Price */}
              <div>
                <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Giá tour' : 'Tour Price'}</p>
                {(selectedTour.discountPercent ?? 0) > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-daiichi-red">
                      {Math.round((selectedTour.price || 0) * (1 - (selectedTour.discountPercent ?? 0) / 100)).toLocaleString()}đ
                    </p>
                    <p className="text-xs text-gray-400 line-through">{(selectedTour.price || 0).toLocaleString()}đ</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-daiichi-red">{(selectedTour.price || 0).toLocaleString()}đ</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Itinerary */}
      {selectedTour?.itinerary && selectedTour.itinerary.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            📋 {t.tour_itinerary || (language === 'vi' ? 'Lịch trình tour' : 'Tour Itinerary')}
          </h4>
          <div className="space-y-3">
            {selectedTour.itinerary.map((item) => (
              <div key={item.day} className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-daiichi-red text-white rounded-full flex items-center justify-center text-xs font-bold">{item.day}</div>
                <p className="text-sm text-gray-600 pt-0.5">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Room / Cabin selection ──────────────────────────────────────────── */}
      {hasRoomTypes && selectedTour && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <BedDouble size={16} className="text-teal-600" />
            {language === 'vi' ? 'Chọn loại phòng / Cabin' : 'Select Room / Cabin Type'}
            <span className="text-red-500">*</span>
          </h4>
          <div className="space-y-3">
            {(selectedTour.roomTypes ?? []).map((rt) => {
              const bookedCount = tourRoomBookingCounts[rt.id] ?? 0;
              const available = rt.totalRooms - bookedCount;
              const isFullyBooked = available <= 0;
              const isSelected = selectedRoomTypeId === rt.id;
              const imgIdx = roomImageIdx[rt.id] ?? 0;
              const roomImages = rt.images ?? [];
              return (
                <button
                  key={rt.id}
                  type="button"
                  disabled={isFullyBooked}
                  onClick={() => !isFullyBooked && setSelectedRoomTypeId(isSelected ? '' : rt.id)}
                  className={`w-full text-left rounded-2xl border-2 transition-all overflow-hidden ${
                    isFullyBooked
                      ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50'
                      : isSelected
                        ? 'border-teal-500 bg-teal-50/40 shadow-md'
                        : 'border-gray-100 bg-white hover:border-teal-300 hover:shadow-sm'
                  }`}
                >
                  {/* Room image gallery */}
                  {roomImages.length > 0 && (
                    <div className="relative h-40 overflow-hidden bg-gray-100">
                      <img
                        src={roomImages[imgIdx]}
                        alt={rt.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {roomImages.length > 1 && (
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                          {roomImages.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setRoomImageIdx(prev => ({ ...prev, [rt.id]: i }));
                              }}
                              className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${
                                i === imgIdx ? 'bg-white text-gray-700' : 'bg-white/50 text-gray-500 hover:bg-white'
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      )}
                      {isFullyBooked && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                            {language === 'vi' ? 'Hết phòng' : 'Fully Booked'}
                          </span>
                        </div>
                      )}
                      {isSelected && !isFullyBooked && (
                        <div className="absolute top-2 right-2 bg-teal-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                          ✓ {language === 'vi' ? 'Đã chọn' : 'Selected'}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Room details */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-gray-800 text-sm">{rt.name}</p>
                      <p className="text-sm font-extrabold text-teal-700 whitespace-nowrap">
                        {rt.price.toLocaleString('vi-VN')}đ
                        <span className="text-[10px] font-semibold text-gray-400 ml-0.5">
                          {rt.pricingMode === 'PER_ROOM'
                            ? (language === 'vi' ? '/phòng' : '/room')
                            : (language === 'vi' ? '/người' : '/person')}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-0.5">
                        <Users size={11} />
                        {language === 'vi' ? `Tối đa ${rt.capacity} người` : `Max ${rt.capacity} guests`}
                      </span>
                      {rt.totalRooms > 0 && (
                        <span className={`font-semibold ${isFullyBooked ? 'text-red-500' : available <= 2 ? 'text-amber-500' : 'text-green-600'}`}>
                          {isFullyBooked
                            ? (language === 'vi' ? 'Hết phòng' : 'Fully booked')
                            : (language === 'vi' ? `Còn ${available} phòng` : `${available} left`)}
                        </span>
                      )}
                    </div>
                    {rt.description && (
                      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{rt.description}</p>
                    )}
                    {roomImages.length > 0 && roomImages.length > 1 && (
                      <div className="flex gap-1 mt-1">
                        {roomImages.slice(0, 6).map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setRoomImageIdx(prev => ({ ...prev, [rt.id]: i }));
                            }}
                            className={`w-10 h-10 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                              i === imgIdx ? 'border-teal-400' : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                        {roomImages.length > 6 && (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-transparent flex items-center justify-center">
                            <ImageIcon size={14} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {hasRoomTypes && !selectedRoomTypeId && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1">
              ⚠️ {language === 'vi' ? 'Vui lòng chọn loại phòng để tiếp tục.' : 'Please select a room type to continue.'}
            </p>
          )}
        </div>
      )}

      {/* Section: Customize trip */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          ✈️ {t.tour_configure_trip || (language === 'vi' ? 'Tùy chỉnh chuyến đi' : 'Customize your trip')}
        </h4>

        {/* Departure date */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">{t.tour_departure_date}</label>
          {(selectedTour?.startDate || selectedTour?.endDate) && (
            <p className="text-[11px] text-indigo-500 mt-0.5 mb-1">
              {language === 'vi' ? '📅 Tour hoạt động' : '📅 Tour operates'}:{' '}
              {selectedTour.startDate ? selectedTour.startDate : '?'} → {selectedTour.endDate ? selectedTour.endDate : '?'}
            </p>
          )}
          <div className="relative mt-1">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="date"
              value={tourBookingDate}
              min={(() => { const today = getLocalDateString(0); return selectedTour?.startDate && selectedTour.startDate > today ? selectedTour.startDate : today; })()}
              max={selectedTour?.endDate || undefined}
              onChange={(e) => setTourBookingDate(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
            />
          </div>
        </div>

        {/* Adults & children steppers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{t.adults}</label>
            <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
              <button type="button" onClick={() => setTourBookingAdults(Math.max(1, tourBookingAdults - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none">−</button>
              <span className="flex-1 text-center font-bold text-gray-800">{tourBookingAdults}</span>
              <button type="button" onClick={() => setTourBookingAdults(tourBookingAdults + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none">+</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{t.children} <span className="text-gray-400 font-normal normal-case">{language === 'vi' ? '(từ 4 tuổi)' : '(4+ yrs)'}</span></label>
            <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
              <button type="button" onClick={() => setTourBookingChildren(Math.max(0, tourBookingChildren - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none">−</button>
              <span className="flex-1 text-center font-bold text-gray-800">{tourBookingChildren}</span>
              <button type="button" onClick={() => setTourBookingChildren(tourBookingChildren + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-daiichi-red text-white font-bold text-lg leading-none">+</button>
            </div>
          </div>
        </div>

        {/* Nights & Breakfasts steppers (pre-filled from tour, price is read-only) */}
        {(hasNightsOption || hasBreakfastOption) && (
          <div className="grid grid-cols-2 gap-4">
            {hasNightsOption && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">
                  🌙 {language === 'vi' ? 'Số đêm' : 'Nights'}
                </label>
                <p className="text-[10px] text-indigo-500 mt-0.5">{tourPricePerNight.toLocaleString()}đ/{language === 'vi' ? 'đêm' : 'night'}</p>
                <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <button type="button" onClick={() => setTourBookingNights(Math.max(0, tourBookingNights - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-indigo-200 text-indigo-600 font-bold text-lg leading-none">−</button>
                  <span className="flex-1 text-center font-bold text-gray-800">{tourBookingNights}</span>
                  <button type="button" onClick={() => setTourBookingNights(tourBookingNights + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500 text-white font-bold text-lg leading-none">+</button>
                </div>
              </div>
            )}
            {hasBreakfastOption && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">
                  ☕ {language === 'vi' ? 'Bữa sáng' : 'Breakfasts'}
                </label>
                <p className="text-[10px] text-amber-500 mt-0.5">{pricePerBreakfast.toLocaleString()}đ/{language === 'vi' ? 'bữa' : 'meal'}</p>
                <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                  <button type="button" onClick={() => setTourBookingBreakfasts(Math.max(0, tourBookingBreakfasts - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-amber-200 text-amber-600 font-bold text-lg leading-none">−</button>
                  <span className="flex-1 text-center font-bold text-gray-800">{tourBookingBreakfasts}</span>
                  <button type="button" onClick={() => setTourBookingBreakfasts(tourBookingBreakfasts + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-lg leading-none">+</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Optional add-on services */}
        {selectedTour?.addons && selectedTour.addons.length > 0 && (
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">
              {t.tour_optional_services || (language === 'vi' ? 'Dịch vụ thêm (tuỳ chọn)' : 'Optional add-on services')}
            </label>
            <div className="mt-2 space-y-2">
              {selectedTour.addons.map((addon) => {
                const isSelected = tourSelectedAddons.has(addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'bg-daiichi-red/5 border-daiichi-red/30' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setTourSelectedAddons(prev => {
                          const next = new Set(prev);
                          if (next.has(addon.id)) next.delete(addon.id);
                          else next.add(addon.id);
                          return next;
                        });
                      }}
                      className="mt-0.5 accent-daiichi-red"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{addon.name}</p>
                      {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                    </div>
                    <span className="text-sm font-bold text-daiichi-red">
                      +{addon.price.toLocaleString()}đ/{language === 'vi' ? 'người' : 'person'}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Surcharge info (always shown if set) */}
        {surchargeAmount > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-700">
                {t.tour_surcharge_label || (language === 'vi' ? 'Phụ phí' : 'Surcharge')}
              </p>
              {selectedTour?.surchargeNote && (
                <p className="text-[10px] text-amber-600">{selectedTour.surchargeNote}</p>
              )}
            </div>
            <span className="font-bold text-amber-700">{surchargeAmount.toLocaleString()}đ</span>
          </div>
        )}
      </div>

      {/* Section: Contact info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          👤 {t.tour_contact_info || (language === 'vi' ? 'Thông tin liên hệ' : 'Contact information')}
        </h4>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">{t.customer_name}</label>
          <input
            type="text"
            value={tourBookingName}
            onChange={(e) => setTourBookingName(e.target.value)}
            placeholder={t.enter_name}
            className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">{t.phone_number}</label>
          <input
            type="tel"
            value={tourBookingPhone}
            onChange={(e) => setTourBookingPhone(e.target.value)}
            placeholder={t.enter_phone}
            className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">{t.customer_email || 'Email'}</label>
          <input
            type="email"
            value={tourBookingEmail}
            onChange={(e) => setTourBookingEmail(e.target.value)}
            placeholder={t.enter_email || 'Email...'}
            className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">{t.tour_notes}</label>
          <textarea
            value={tourNotes}
            onChange={(e) => setTourNotes(e.target.value)}
            rows={3}
            placeholder={language === 'vi' ? 'Nhập yêu cầu đặc biệt, dị ứng thức ăn...' : 'Special requests, dietary requirements...'}
            className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 resize-none"
          />
        </div>
      </div>

      {/* Price summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase mb-3">{language === 'vi' ? 'Chi tiết giá' : 'Price breakdown'}</p>
        {selectedRoomType ? (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              {selectedRoomType.name} ({selectedRoomType.pricingMode === 'PER_ROOM'
                ? (language === 'vi' ? 'theo phòng' : 'per room')
                : `${totalPersons} ${language === 'vi' ? 'người' : 'persons'}`})
            </span>
            <span className="font-bold">{roomBasedPrice!.toLocaleString()}đ</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.tour_price_per_adult} × {tourBookingAdults}</span>
              <span className="font-bold">{(pricePerAdult * tourBookingAdults).toLocaleString()}đ</span>
            </div>
            {tourBookingChildren > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t.tour_price_per_child} × {tourBookingChildren}</span>
                <span className="font-bold">{(pricePerChild * tourBookingChildren).toLocaleString()}đ</span>
              </div>
            )}
          </>
        )}
        {accomCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{language === 'vi' ? `Lưu trú × ${tourBookingNights} đêm` : `Accommodation × ${tourBookingNights} nights`}</span>
            <span className="font-bold">{accomCost.toLocaleString()}đ</span>
          </div>
        )}
        {mealCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{language === 'vi' ? `Bữa sáng × ${tourBookingBreakfasts} bữa` : `Breakfast × ${tourBookingBreakfasts} meals`}</span>
            <span className="font-bold">{mealCost.toLocaleString()}đ</span>
          </div>
        )}
        {addonsCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t.tour_addons_label || (language === 'vi' ? 'Dịch vụ thêm' : 'Add-ons')}</span>
            <span className="font-bold">{addonsCost.toLocaleString()}đ</span>
          </div>
        )}
        {surchargeAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{selectedTour?.surchargeNote || (language === 'vi' ? 'Phụ phí' : 'Surcharge')}</span>
            <span className="font-bold">{surchargeAmount.toLocaleString()}đ</span>
          </div>
        )}
        {discountAmount > 0 && (
          <>
            <div className="flex justify-between text-sm text-gray-400">
              <span>{language === 'vi' ? 'Tạm tính' : 'Subtotal'}</span>
              <span>{tourSubtotal.toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between text-sm text-green-600 font-medium">
              <span>{language === 'vi' ? `Giảm giá ${selectedTour?.discountPercent}%` : `Discount ${selectedTour?.discountPercent}%`}</span>
              <span>-{discountAmount.toLocaleString()}đ</span>
            </div>
          </>
        )}
        {agentCommissionAmount > 0 && (
          <div className="flex justify-between text-sm text-orange-600 font-medium">
            <span>{language === 'vi' ? `Chiết khấu đại lý ${agentCommissionRate}%` : `Agent commission ${agentCommissionRate}%`}</span>
            <span>-{agentCommissionAmount.toLocaleString()}đ</span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-3 flex justify-between">
          <span className="text-sm font-bold text-gray-500 uppercase">{t.total_amount}</span>
          <span className="text-xl font-bold text-daiichi-red">{finalTourTotal.toLocaleString()}đ</span>
        </div>
      </div>

      {tourBookingError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
          {tourBookingError}
        </div>
      )}

      {/* Action buttons */}
      {(!tourBookingDate || !tourBookingName.trim() || !tourBookingPhone.trim() || (hasRoomTypes && !selectedRoomTypeId)) ? (
        <p className="text-center text-xs text-gray-400">
          {!tourBookingDate || !tourBookingName.trim() || !tourBookingPhone.trim()
            ? (language === 'vi' ? '* Vui lòng điền ngày khởi hành, tên và số điện thoại trước khi đặt.' : '* Please fill in departure date, name and phone before booking.')
            : (language === 'vi' ? '* Vui lòng chọn loại phòng trước khi đặt.' : '* Please select a room type before booking.')}
        </p>
      ) : null}
      <div className={cn("grid gap-3 grid-cols-1", !(isTourAgentBooking && agentPaymentType === 'PREPAID') && "sm:grid-cols-2")}>
        {/* Reserve – hidden for PREPAID agents who must pay immediately */}
        {!(isTourAgentBooking && agentPaymentType === 'PREPAID') && (
          <button
            type="button"
            disabled={isTourBookingLoading || !tourBookingName.trim() || !tourBookingPhone.trim() || !tourBookingDate || !selectedTour || (hasRoomTypes && !selectedRoomTypeId)}
            onClick={() => handleTourBooking('PENDING')}
            className={cn(
              "w-full py-4 rounded-xl font-bold border-2 flex items-center justify-center gap-2 transition-all",
              !isTourBookingLoading && tourBookingName.trim() && tourBookingPhone.trim() && tourBookingDate && selectedTour && !(hasRoomTypes && !selectedRoomTypeId)
                ? "border-daiichi-red text-daiichi-red hover:bg-daiichi-red/5"
                : "border-gray-200 text-gray-300 cursor-not-allowed"
            )}
          >
            🔒 {isTourBookingLoading && tourBookingStatus === 'PENDING'
              ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...')
              : (t.tour_reserve || (language === 'vi' ? 'Giữ chỗ (miễn phí)' : 'Reserve (Free)'))}
          </button>
        )}
        {/* Pay now */}
        <div className="space-y-2">
          {isTourAgentBooking && agentPaymentType === 'PREPAID' ? (
            /* PREPAID agent: locked to QR payment, no other options */
            <div className="w-full px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm font-medium text-orange-700 flex items-center gap-2">
              📱 {language === 'vi' ? 'Chuyển khoản QR (số dư đại lý sẽ bị trừ)' : 'QR Transfer (agent balance will be deducted)'}
            </div>
          ) : (
            <select
              value={tourPaymentMethod}
              onChange={(e) => setTourPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{t[PAYMENT_METHOD_TRANSLATION_KEYS[m]]}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={isTourBookingLoading || !tourBookingName.trim() || !tourBookingPhone.trim() || !tourBookingDate || !selectedTour || (hasRoomTypes && !selectedRoomTypeId)}
            onClick={() => handleTourBooking('CONFIRMED')}
            className={cn(
              "w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all",
              !isTourBookingLoading && tourBookingName.trim() && tourBookingPhone.trim() && tourBookingDate && selectedTour && !(hasRoomTypes && !selectedRoomTypeId)
                ? "bg-daiichi-red text-white shadow-daiichi-red/20 hover:scale-[1.01]"
                : "bg-gray-300 text-white shadow-gray-200 cursor-not-allowed"
            )}
          >
            💳 {isTourBookingLoading && tourBookingStatus === 'CONFIRMED'
              ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...')
              : (t.tour_pay_now || (language === 'vi' ? 'Thanh toán ngay' : 'Pay Now'))}
          </button>
        </div>
      </div>
    </div>
  );
}
