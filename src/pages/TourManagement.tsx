import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Image as ImageIcon, Loader2, Edit3, X, Moon, Coffee,
  Search, Youtube, Copy, Calendar, ChevronDown, ChevronRight,
  MapPin, Clock, BedDouble, Zap, Building2, FileText
} from 'lucide-react';
import { uploadFile } from '../lib/supabase';
import { Language } from '../App';
import { User, UserRole, Property, Booking } from '../types';
import { transportService } from '../services/transportService';
import { formatBookingDate } from '../lib/vnDate';
import { compressImage } from '../lib/imageUtils';

interface TourAddon {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface TourRoomType {
  id: string;
  name: string;
  capacity: number;
  pricingMode: 'PER_ROOM' | 'PER_PERSON';
  price: number;
  totalRooms: number;
  description: string;
  images: string[];
}

interface Tour {
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
  startDate?: string;
  endDate?: string;
  itinerary?: { day: number; content: string }[];
  addons?: TourAddon[];
  roomTypes?: TourRoomType[];
  departureTime?: string;
  departureLocation?: string;
  returnTime?: string;
  returnLocation?: string;
  linkedPropertyId?: string;
}

interface TourManagementProps {
  language: Language;
  currentUser?: User | null;
}

const emptyRoomType = (): TourRoomType => ({
  id: crypto.randomUUID(),
  name: '',
  capacity: 2,
  // PER_PERSON is the default as most tour packages price per traveler
  pricingMode: 'PER_PERSON',
  price: 0,
  totalRooms: 1,
  description: '',
  images: [],
});

type FormState = {
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  images: string[];
  discountPercent: number;
  priceAdult: number;
  priceChild: number;
  numAdults: number;
  numChildren: number;
  duration: string;
  nights: number;
  pricePerNight: number;
  breakfastCount: number;
  pricePerBreakfast: number;
  surcharge: number;
  surchargeNote: string;
  youtubeUrl: string;
  startDate: string;
  endDate: string;
  itinerary: { day: number; content: string }[];
  addons: TourAddon[];
  roomTypes: TourRoomType[];
  departureTime: string;
  departureLocation: string;
  returnTime: string;
  returnLocation: string;
  linkedPropertyId: string;
};

const emptyForm: FormState = {
  title: '',
  description: '',
  price: 0,
  imageUrl: '',
  images: [],
  discountPercent: 0,
  priceAdult: 0,
  priceChild: 0,
  numAdults: 1,
  numChildren: 0,
  duration: '',
  nights: 0,
  pricePerNight: 0,
  breakfastCount: 0,
  pricePerBreakfast: 0,
  surcharge: 0,
  surchargeNote: '',
  youtubeUrl: '',
  startDate: '',
  endDate: '',
  itinerary: [],
  addons: [],
  roomTypes: [],
  departureTime: '',
  departureLocation: '',
  returnTime: '',
  returnLocation: '',
  linkedPropertyId: '',
};

// Computes the total tour price by summing all cost components for the defined group
const computeTourPrice = (
  priceAdult: number,
  numAdults: number,
  priceChild: number,
  numChildren: number,
  nights: number,
  pricePerNight: number,
  breakfastCount: number,
  pricePerBreakfast: number,
  surcharge: number,
): number =>
  priceAdult * numAdults +
  priceChild * numChildren +
  nights * pricePerNight +
  breakfastCount * pricePerBreakfast +
  surcharge;

const DEFAULT_BATCH_TOUR_FORM = {
  templateId: '',
  title: '',
  duration: '',
  nights: 0,
  departureTime: '',
  departureLocation: '',
  returnTime: '',
  returnLocation: '',
  priceAdult: 0,
  priceChild: 0,
  propertyId: '',
};

export const TourManagement: React.FC<TourManagementProps> = ({ language, currentUser }) => {
  const isAdmin = currentUser?.role === UserRole.MANAGER;
  const [tours, setTours] = useState<Tour[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null);
  const [newTour, setNewTour] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [uploadingRoomIdx, setUploadingRoomIdx] = useState<number | null>(null);
  // tourId → { roomTypeId → bookedCount }
  const [roomBookingCounts, setRoomBookingCounts] = useState<Record<string, Record<string, number>>>({});

  // ── Properties for asset linking ───────────────────────────────────────────
  const [properties, setProperties] = useState<Property[]>([]);

  // ── Batch tour creation state ──────────────────────────────────────────────
  const [showBatchAddTour, setShowBatchAddTour] = useState(false);
  const [batchTourLoading, setBatchTourLoading] = useState(false);
  const [batchProperties, setBatchProperties] = useState<Property[]>([]);
  const [batchTourForm, setBatchTourForm] = useState({ ...DEFAULT_BATCH_TOUR_FORM });
  // Each entry is a departure date (YYYY-MM-DD)
  const [batchDepartureDates, setBatchDepartureDates] = useState<string[]>(['']);
  // Date range helper state
  const [batchDateFrom, setBatchDateFrom] = useState('');
  const [batchDateTo, setBatchDateTo] = useState('');

  /** Open batch modal with a clean initial state */
  const handleOpenBatchModal = () => {
    setBatchTourForm({ ...DEFAULT_BATCH_TOUR_FORM });
    setBatchDepartureDates(['']);
    setBatchDateFrom('');
    setBatchDateTo('');
    setShowBatchAddTour(true);
  };

  /** Add consecutive dates from batchDateFrom → batchDateTo */
  const handleAddDateRange = () => {
    if (!batchDateFrom || !batchDateTo || batchDateFrom > batchDateTo) return;
    const result: string[] = [];
    const cur = new Date(batchDateFrom + 'T00:00:00');
    const end = new Date(batchDateTo + 'T00:00:00');
    while (cur <= end) {
      const d = cur.toISOString().split('T')[0];
      if (!batchDepartureDates.includes(d)) result.push(d);
      cur.setDate(cur.getDate() + 1);
    }
    setBatchDepartureDates(prev => {
      const merged = [...prev.filter(d => d !== ''), ...result];
      return merged.length ? merged : [''];
    });
    setBatchDateFrom('');
    setBatchDateTo('');
  };

  /** Apply template tour fields when user picks a template */
  const applyBatchTemplate = (tourId: string) => {
    const t = tours.find(t => t.id === tourId);
    if (!t) {
      setBatchTourForm(p => ({ ...p, templateId: '' }));
      return;
    }
    setBatchTourForm(p => ({
      ...p,
      templateId: tourId,
      title: t.title,
      duration: t.duration || '',
      nights: t.nights || 0,
      departureTime: t.departureTime || '',
      departureLocation: t.departureLocation || '',
      returnTime: t.returnTime || '',
      returnLocation: t.returnLocation || '',
      priceAdult: t.priceAdult || t.price || 0,
      priceChild: t.priceChild || 0,
    }));
  };

  /** Submit batch tour creation */
  const handleBatchAddTours = async () => {
    const validDates = batchDepartureDates.filter(d => d.trim() !== '');
    if (validDates.length === 0 || !batchTourForm.title) return;
    setBatchTourLoading(true);
    try {
      // Build the template data (from selected tour or form values)
      const template = tours.find(t => t.id === batchTourForm.templateId);
      const toursToCreate = validDates.map(startDate => {
        // Compute endDate from startDate + nights
        let endDate = startDate;
        if (batchTourForm.nights > 0) {
          const d = new Date(startDate + 'T00:00:00');
          d.setDate(d.getDate() + batchTourForm.nights);
          endDate = d.toISOString().split('T')[0];
        }
        return {
          title: batchTourForm.title,
          description: template?.description || '',
          price: batchTourForm.priceAdult,
          imageUrl: template?.imageUrl || '',
          images: template?.images || [],
          discountPercent: template?.discountPercent || 0,
          priceAdult: batchTourForm.priceAdult,
          priceChild: batchTourForm.priceChild,
          numAdults: template?.numAdults || 1,
          numChildren: template?.numChildren || 0,
          duration: batchTourForm.duration,
          nights: batchTourForm.nights,
          pricePerNight: template?.pricePerNight || 0,
          breakfastCount: template?.breakfastCount || 0,
          pricePerBreakfast: template?.pricePerBreakfast || 0,
          surcharge: template?.surcharge || 0,
          surchargeNote: template?.surchargeNote || '',
          youtubeUrl: template?.youtubeUrl || '',
          startDate,
          endDate,
          departureTime: batchTourForm.departureTime,
          departureLocation: batchTourForm.departureLocation,
          returnTime: batchTourForm.returnTime,
          returnLocation: batchTourForm.returnLocation,
          itinerary: template?.itinerary || [],
          addons: template?.addons || [],
          roomTypes: template?.roomTypes || [],
          ...(batchTourForm.propertyId ? { linkedPropertyId: batchTourForm.propertyId } : {}),
        };
      });
      await transportService.addToursBatch(toursToCreate);
      setShowBatchAddTour(false);
      setBatchTourForm({ ...DEFAULT_BATCH_TOUR_FORM });
      setBatchDepartureDates(['']);
      setBatchDateFrom('');
      setBatchDateTo('');
    } catch (err) {
      console.error('Failed to batch create tours:', err);
    } finally {
      setBatchTourLoading(false);
    }
  };

  // Load properties for the asset-link picker whenever batch modal opens
  useEffect(() => {
    if (!showBatchAddTour) return;
    const unsub = transportService.subscribeToProperties(setBatchProperties);
    return unsub;
  }, [showBatchAddTour]);

  const filteredTours = useMemo(() => {
    return tours.filter(tour => {
      const q = searchTerm.toLowerCase();
      if (q && !(
        tour.title.toLowerCase().includes(q) ||
        (tour.description || '').toLowerCase().includes(q) ||
        (tour.duration || '').toLowerCase().includes(q)
      )) return false;
      if (durationFilter.trim() && !(tour.duration || '').toLowerCase().includes(durationFilter.toLowerCase())) return false;
      const effectivePrice = tour.roomTypes && tour.roomTypes.length > 0
        ? Math.min(...tour.roomTypes.map(r => r.price))
        : (tour.priceAdult || tour.price);
      if (priceMin !== '' && effectivePrice < Number(priceMin)) return false;
      if (priceMax !== '' && effectivePrice > Number(priceMax)) return false;
      return true;
    });
  }, [tours, searchTerm, durationFilter, priceMin, priceMax]);

  useEffect(() => {
    const unsubscribe = transportService.subscribeToTours(setTours);
    return unsubscribe;
  }, []);

  // Stable string of tour IDs – only changes when the set of tours actually changes,
  // preventing getMultipleTourRoomBookingCounts from re-running on every tour data update.
  const tourIdsKey = useMemo(() => tours.map(t => t.id).join(','), [tours]);

  // Fetch room booking counts whenever the set of tour IDs changes
  useEffect(() => {
    if (!tourIdsKey) { setRoomBookingCounts({}); return; }
    const ids = tourIdsKey.split(',').filter(Boolean);
    transportService.getMultipleTourRoomBookingCounts(ids.map(id => ({ tourId: id, date: '' }))).then(counts => {
      setRoomBookingCounts(counts);
    }).catch(err => { console.error('Failed to load room booking counts:', err); });
  }, [tourIdsKey]);

  // Subscribe to properties for the asset-link picker
  useEffect(() => {
    const unsub = transportService.subscribeToProperties(setProperties);
    return unsub;
  }, []);

  /**
   * When a property is selected for a form, load its room types and convert them
   * to TourRoomType format so they can be managed within the tour.
   */
  const handleLinkProperty = async (
    propertyId: string,
    setForm: React.Dispatch<React.SetStateAction<FormState>>
  ) => {
    setForm(prev => ({ ...prev, linkedPropertyId: propertyId }));
    if (!propertyId) return;
    try {
      const propRoomTypes = await transportService.getPropertyRoomTypes(propertyId);
      if (propRoomTypes.length === 0) return;
      const converted: TourRoomType[] = propRoomTypes.map(prt => ({
        id: prt.id,
        name: prt.name,
        capacity: prt.capacityAdults + prt.capacityChildren,
        pricingMode: 'PER_ROOM' as const,
        price: prt.basePrice,
        totalRooms: prt.totalUnits,
        description: prt.amenities.join(', '),
        images: prt.images,
      }));
      setForm(prev => ({ ...prev, roomTypes: converted }));
    } catch (err) {
      console.error('Failed to load property room types:', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (isEdit) setEditUploading(true);
    else setUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File;
        const compressed = await compressImage(file, 0.75, 1280);
        const path = `tours/${Date.now()}_${compressed.name}`;
        if (!isEdit) setUploadProgress(((i + 0.5) / files.length) * 100);
        const url = await uploadFile('tours', path, compressed);
        urls.push(url);
        if (!isEdit) setUploadProgress(((i + 1) / files.length) * 100);
      }
      if (isEdit) {
        setEditForm(prev => {
          const combined = [...(prev.images || []), ...urls];
          return { ...prev, images: combined, imageUrl: combined[0] || prev.imageUrl };
        });
        setEditUploading(false);
      } else {
        setNewTour(prev => {
          const combined = [...(prev.images || []), ...urls];
          return { ...prev, images: combined, imageUrl: combined[0] || prev.imageUrl };
        });
        setUploading(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      if (isEdit) setEditUploading(false);
      else setUploading(false);
      alert('Upload failed. Please check your Supabase configuration.');
    }
    e.target.value = '';
  };

  const handleRoomImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    roomIdx: number,
    isEdit: boolean
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingRoomIdx(roomIdx);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const compressed = await compressImage(file, 0.75, 1280);
        const path = `tours/rooms/${Date.now()}_${compressed.name}`;
        const url = await uploadFile('tours', path, compressed);
        urls.push(url);
      }
      const setter = isEdit ? setEditForm : setNewTour;
      setter(prev => {
        const updated = prev.roomTypes.map((rt, idx) =>
          idx === roomIdx ? { ...rt, images: [...rt.images, ...urls] } : rt
        );
        return { ...prev, roomTypes: updated };
      });
    } catch (error) {
      console.error('Room image upload failed:', error);
    }
    setUploadingRoomIdx(null);
    e.target.value = '';
  };

  const buildTourPayload = (form: FormState) => {
    const computedPrice = computeTourPrice(
      form.priceAdult, form.numAdults || 1,
      form.priceChild || 0, form.numChildren || 0,
      form.nights || 0, form.pricePerNight || 0,
      form.breakfastCount || 0, form.pricePerBreakfast || 0,
      form.surcharge || 0,
    );
    return {
      title: form.title,
      description: form.description,
      price: computedPrice,
      imageUrl: form.images[0] || form.imageUrl,
      images: form.images.length > 0 ? form.images : undefined,
      discountPercent: form.discountPercent || 0,
      priceAdult: form.priceAdult || undefined,
      priceChild: form.priceChild || undefined,
      numAdults: form.numAdults || undefined,
      numChildren: form.numChildren || undefined,
      duration: form.duration || undefined,
      nights: form.nights || undefined,
      pricePerNight: form.pricePerNight || undefined,
      breakfastCount: form.breakfastCount || undefined,
      pricePerBreakfast: form.pricePerBreakfast || undefined,
      surcharge: form.surcharge || undefined,
      surchargeNote: form.surchargeNote || undefined,
      youtubeUrl: form.youtubeUrl || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      itinerary: form.itinerary.length > 0 ? form.itinerary : undefined,
      addons: form.addons.length > 0 ? form.addons : undefined,
      roomTypes: form.roomTypes.length > 0 ? form.roomTypes : undefined,
      departureTime: form.departureTime || undefined,
      departureLocation: form.departureLocation || undefined,
      returnTime: form.returnTime || undefined,
      returnLocation: form.returnLocation || undefined,
      linkedPropertyId: form.linkedPropertyId || undefined,
    };
  };

  const handleAddTour = async () => {
    if (!newTour.title || !newTour.imageUrl) return;
    setSaving(true);
    try {
      await transportService.addTour(buildTourPayload(newTour));
      setNewTour(emptyForm);
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to save tour:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (tour: Tour) => {
    setEditingTour(tour);
    setEditForm({
      title: tour.title,
      description: tour.description,
      price: tour.price,
      imageUrl: tour.imageUrl,
      images: tour.images || (tour.imageUrl ? [tour.imageUrl] : []),
      discountPercent: tour.discountPercent || 0,
      priceAdult: tour.priceAdult || 0,
      priceChild: tour.priceChild || 0,
      numAdults: tour.numAdults ?? 1,
      numChildren: tour.numChildren ?? 0,
      duration: tour.duration || '',
      nights: tour.nights || 0,
      pricePerNight: tour.pricePerNight || 0,
      breakfastCount: tour.breakfastCount || 0,
      pricePerBreakfast: tour.pricePerBreakfast || 0,
      surcharge: tour.surcharge || 0,
      surchargeNote: tour.surchargeNote || '',
      youtubeUrl: tour.youtubeUrl || '',
      startDate: tour.startDate || '',
      endDate: tour.endDate || '',
      itinerary: tour.itinerary || [],
      addons: tour.addons || [],
      roomTypes: tour.roomTypes || [],
      departureTime: tour.departureTime || '',
      departureLocation: tour.departureLocation || '',
      returnTime: tour.returnTime || '',
      returnLocation: tour.returnLocation || '',
      linkedPropertyId: tour.linkedPropertyId || '',
    });
    setIsAdding(false);
  };

  const handleUpdateTour = async () => {
    if (!editingTour || !editForm.title || !editForm.imageUrl) return;
    setSaving(true);
    try {
      await transportService.updateTour(editingTour.id, buildTourPayload(editForm));
      setEditingTour(null);
      setEditForm(emptyForm);
      setExpandedTourId(null);
    } catch (err) {
      console.error('Failed to update tour:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTour = async (id: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa tour này?' : 'Are you sure you want to delete this tour?')) return;
    try {
      await transportService.deleteTour(id);
      if (expandedTourId === id) setExpandedTourId(null);
    } catch (err) {
      console.error('Failed to delete tour:', err);
    }
  };

  const handleCopyTour = (tour: Tour) => {
    const copyPrefix = language === 'vi' ? 'Bản sao - ' : 'Copy - ';
    const baseTitle = tour.title.startsWith('Bản sao - ')
      ? tour.title.replace(/^Bản sao - /, '')
      : tour.title.startsWith('Copy - ')
        ? tour.title.replace(/^Copy - /, '')
        : tour.title;
    setNewTour({
      title: `${copyPrefix}${baseTitle}`,
      description: tour.description,
      price: tour.price,
      imageUrl: tour.imageUrl,
      images: tour.images || (tour.imageUrl ? [tour.imageUrl] : []),
      discountPercent: tour.discountPercent || 0,
      priceAdult: tour.priceAdult || 0,
      priceChild: tour.priceChild || 0,
      numAdults: tour.numAdults ?? 1,
      numChildren: tour.numChildren ?? 0,
      duration: tour.duration || '',
      nights: tour.nights || 0,
      pricePerNight: tour.pricePerNight || 0,
      breakfastCount: tour.breakfastCount || 0,
      pricePerBreakfast: tour.pricePerBreakfast || 0,
      surcharge: tour.surcharge || 0,
      surchargeNote: tour.surchargeNote || '',
      youtubeUrl: tour.youtubeUrl || '',
      startDate: tour.startDate || '',
      endDate: tour.endDate || '',
      itinerary: tour.itinerary ? tour.itinerary.map(i => ({ ...i })) : [],
      addons: tour.addons ? tour.addons.map(a => ({ ...a })) : [],
      roomTypes: tour.roomTypes ? tour.roomTypes.map(r => ({ ...r, id: crypto.randomUUID() })) : [],
      departureTime: tour.departureTime || '',
      departureLocation: tour.departureLocation || '',
      returnTime: tour.returnTime || '',
      returnLocation: tour.returnLocation || '',
      linkedPropertyId: tour.linkedPropertyId || '',
    });
    setIsAdding(true);
    setExpandedTourId(null);
  };

  const handleRowClick = (tour: Tour) => {
    if (expandedTourId === tour.id) {
      setExpandedTourId(null);
      setEditingTour(null);
    } else {
      setExpandedTourId(tour.id);
      handleStartEdit(tour);
    }
    setIsAdding(false);
  };

  const handleExportPdf = async (tour: Tour) => {
    const win = window.open('', '_blank', 'width=1100,height=750');
    if (!win) {
      alert(language === 'vi' ? 'Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép pop-up và thử lại.' : 'Pop-up blocked. Please allow pop-ups and try again.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tour.title}</title></head><body style="font-family:Arial,sans-serif;padding:24px;color:#555"><p>⏳ Đang tải danh sách khách...</p></body></html>`);
    win.document.close();

    const esc = (v: unknown) => {
      if (v == null) return '';
      return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    };

    try {
      const bookings = await transportService.getTourBookings(tour.id);
      const statusLabel = (s: string) => {
        if (s === 'CONFIRMED') return language === 'vi' ? 'Đã xác nhận' : 'Confirmed';
        if (s === 'CANCELLED') return language === 'vi' ? 'Đã hủy' : 'Cancelled';
        return language === 'vi' ? 'Chờ xác nhận' : 'Pending';
      };
      const statusColor = (s: string) => {
        if (s === 'CONFIRMED') return '#15803d';
        if (s === 'CANCELLED') return '#dc2626';
        return '#d97706';
      };
      const statusBg = (s: string) => {
        if (s === 'CONFIRMED') return '#dcfce7';
        if (s === 'CANCELLED') return '#fee2e2';
        return '#fef3c7';
      };
      const confirmedCount = bookings.filter((b: Booking) => b.status === 'CONFIRMED').length;
      const cancelledCount = bookings.filter((b: Booking) => b.status === 'CANCELLED').length;
      const pendingCount = bookings.length - confirmedCount - cancelledCount;
      const totalPax = bookings.reduce((s: number, b: Booking) => s + (b.adults ?? 0) + (b.children ?? 0), 0);

      const rows = bookings.map((b: Booking, i: number) => {
        const phone = esc((b as any).phone || b.customerPhone);
        const email = esc((b as any).email || (b as any).customerEmail);
        const amount = (b as any).amount ?? b.totalAmount;
        const ticketCode = esc((b as any).ticketCode);
        const notes = esc((b as any).notes);
        const agent = esc((b as any).agent || (b as any).bookedByName);
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280">${i + 1}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-family:monospace;font-size:11px;color:#7c3aed">${ticketCode}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;font-weight:600">${esc(b.customerName)}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb">${phone}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;color:#2563eb">${email}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb">${esc(b.selectedRoomTypeName)}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:center">${b.adults ?? 0}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:center">${b.children ?? 0}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:600">${amount ? Number(amount).toLocaleString('vi-VN') + 'đ' : ''}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;text-align:center"><span style="padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${statusColor(b.status)};background:${statusBg(b.status)}">${statusLabel(b.status)}</span></td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;color:#6b7280;font-size:11px">${agent}</td>
          <td style="padding:7px 10px;border:1px solid #e5e7eb;color:#6b7280;font-size:11px">${notes}</td>
        </tr>`;
      }).join('');

      const departureLine = [tour.departureTime, tour.startDate ? tour.startDate.split('-').reverse().join('/') : '', tour.departureLocation].filter(Boolean).join(' – ');
      const returnLine = [tour.returnTime, tour.endDate ? tour.endDate.split('-').reverse().join('/') : '', tour.returnLocation].filter(Boolean).join(' – ');
      const printedAt = new Date().toLocaleString('vi-VN');
      const logoUrl = 'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724';

      const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${esc(tour.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #111; margin: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #c0392b; padding-bottom: 12px; margin-bottom: 16px; }
    .header img { height: 52px; object-fit: contain; }
    .header-title { text-align: center; flex: 1; }
    .header-title h1 { font-size: 18px; color: #c0392b; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 1px; }
    .header-title p { font-size: 12px; color: #6b7280; margin: 0; }
    .header-meta { text-align: right; font-size: 11px; color: #6b7280; min-width: 160px; }
    .tour-info { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
    .tour-info p { margin: 3px 0; font-size: 12px; color: #374151; }
    .tour-info b { color: #111; }
    .stats { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .stat-box { background: #f3f4f6; border-radius: 6px; padding: 8px 16px; text-align: center; min-width: 110px; }
    .stat-box .val { font-size: 22px; font-weight: 700; color: #c0392b; }
    .stat-box .lbl { font-size: 11px; color: #6b7280; margin-top: 2px; }
    h2 { font-size: 14px; color: #374151; margin: 20px 0 8px; border-left: 4px solid #c0392b; padding-left: 8px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 8px; font-size: 12px; }
    th { background: #c0392b; color: #fff; padding: 8px 10px; border: 1px solid #a93226; text-align: left; font-size: 12px; white-space: nowrap; }
    td { padding: 7px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    @media print { button { display: none !important; } body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="Daiichi Travel" onerror="this.style.display='none'">
    <div class="header-title">
      <h1>DANH SÁCH HÀNH KHÁCH</h1>
      <p>${esc(tour.title)}</p>
    </div>
    <div class="header-meta">
      <div>In lúc: ${printedAt}</div>
      <div>Tour ID: ${esc(tour.id)}</div>
    </div>
  </div>

  <div class="tour-info">
    ${departureLine ? `<p><b>🚀 Khởi hành:</b> ${esc(departureLine)}</p>` : ''}
    ${returnLine ? `<p><b>🏁 Về:</b> ${esc(returnLine)}</p>` : ''}
    ${tour.duration ? `<p><b>⏱ Thời gian:</b> ${esc(tour.duration)}</p>` : ''}
    ${tour.departureLocation ? `<p><b>📍 Điểm xuất phát:</b> ${esc(tour.departureLocation)}</p>` : ''}
  </div>

  <div class="stats">
    <div class="stat-box"><div class="val">${bookings.length}</div><div class="lbl">Tổng đặt chỗ</div></div>
    <div class="stat-box"><div class="val" style="color:#15803d">${confirmedCount}</div><div class="lbl">Đã xác nhận</div></div>
    <div class="stat-box"><div class="val" style="color:#d97706">${pendingCount}</div><div class="lbl">Chờ xác nhận</div></div>
    <div class="stat-box"><div class="val" style="color:#dc2626">${cancelledCount}</div><div class="lbl">Đã hủy</div></div>
    <div class="stat-box"><div class="val">${totalPax}</div><div class="lbl">Tổng hành khách</div></div>
  </div>

  <h2>📋 Danh sách hành khách</h2>
  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Mã vé</th>
        <th>Họ tên</th>
        <th>Số điện thoại</th>
        <th>Email</th>
        <th>Loại phòng</th>
        <th style="width:42px">NL</th>
        <th style="width:42px">TE</th>
        <th>Tổng tiền</th>
        <th>Trạng thái</th>
        <th>Đặt bởi</th>
        <th>Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="12" style="text-align:center;color:#9ca3af;padding:20px">Chưa có đặt chỗ nào</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <span>Daiichi Travel – daiichitravel.vn</span>
    <span>In lúc: ${printedAt}</span>
  </div>

  <script>
    /* Delay print to allow logo image to finish loading before dialog opens */
    window.onload = function() { window.focus(); setTimeout(function(){ window.print(); }, 500); };
  <\/script>
</body>
</html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err) {
      win.document.open();
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial;padding:24px;color:#dc2626"><b>Lỗi tải dữ liệu:</b> ${esc(String(err))}</body></html>`);
      win.document.close();
    }
  };

  const renderRoomTypesSection = (
    form: FormState,
    setForm: React.Dispatch<React.SetStateAction<FormState>>,
    isNew: boolean
  ) => (
    <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BedDouble size={16} className="text-teal-600" />
          <p className="text-xs font-bold text-teal-700 uppercase tracking-widest">
            {language === 'vi' ? 'Loại phòng / Cabin' : 'Room / Cabin Types'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(prev => ({ ...prev, roomTypes: [...prev.roomTypes, emptyRoomType()] }))}
          className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={13} />
          {language === 'vi' ? 'Thêm loại phòng' : 'Add Room Type'}
        </button>
      </div>

      {/* Property asset link */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-1">
          <Building2 size={11} />
          {language === 'vi' ? 'Liên kết tài sản (tự động lấy phòng)' : 'Link to Property Asset (auto-import rooms)'}
        </label>
        <select
          value={form.linkedPropertyId}
          onChange={e => handleLinkProperty(e.target.value, setForm)}
          className="w-full mt-0.5 px-2 py-1.5 bg-white border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
        >
          <option value="">{language === 'vi' ? '— Không liên kết tài sản —' : '— No property linked —'}</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {form.linkedPropertyId && (
          <p className="text-[10px] text-teal-600 mt-0.5 ml-1">
            {language === 'vi'
              ? '✓ Phòng được lấy từ tài sản. Bạn vẫn có thể chỉnh sửa số lượng/giá bên dưới.'
              : '✓ Rooms imported from property. You can still adjust quantities/prices below.'}
          </p>
        )}
      </div>

      {form.roomTypes.length === 0 ? (
        <p className="text-xs text-teal-500 text-center py-3">
          {language === 'vi' ? 'Chưa có loại phòng nào. Nhấn "+ Thêm loại phòng" để thêm.' : 'No room types yet. Click "+ Add Room Type" to add.'}
        </p>
      ) : (
        <div className="space-y-3">
          {form.roomTypes.map((rt, idx) => (
            <div key={rt.id} className="bg-white rounded-xl border border-teal-100 p-3 space-y-2 relative">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.filter((_, i) => i !== idx) }))}
                className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title={language === 'vi' ? 'Xóa loại phòng' : 'Delete room type'}
              >
                <X size={14} />
              </button>

              {/* Row 1: Name + Capacity */}
              <div className="grid grid-cols-2 gap-2 pr-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    {language === 'vi' ? 'Tên phòng' : 'Room Name'}
                  </label>
                  <input
                    type="text"
                    value={rt.name}
                    onChange={e => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, name: e.target.value } : r) }))}
                    className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                    placeholder={language === 'vi' ? 'Cabin Deluxe' : 'Cabin Deluxe'}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    {language === 'vi' ? 'Sức chứa (người)' : 'Capacity (guests)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={rt.capacity}
                    onChange={e => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, capacity: parseInt(e.target.value) || 1 } : r) }))}
                    className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Pricing mode toggle */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  {language === 'vi' ? 'Hình thức tính giá' : 'Pricing Mode'}
                </label>
                <div className="flex gap-1 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, pricingMode: 'PER_ROOM' } : r) }))}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${rt.pricingMode === 'PER_ROOM' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'}`}
                  >
                    {language === 'vi' ? 'Theo phòng' : 'Per Room'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, pricingMode: 'PER_PERSON' } : r) }))}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${rt.pricingMode === 'PER_PERSON' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'}`}
                  >
                    {language === 'vi' ? 'Theo người' : 'Per Person'}
                  </button>
                </div>
              </div>

              {/* Row 3: Price + Total rooms */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    {rt.pricingMode === 'PER_ROOM'
                      ? (language === 'vi' ? 'Giá / phòng (đ)' : 'Price / room (VND)')
                      : (language === 'vi' ? 'Giá / người (đ)' : 'Price / person (VND)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={rt.price}
                    onChange={e => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, price: parseInt(e.target.value) || 0 } : r) }))}
                    className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    {language === 'vi' ? 'Tổng số phòng' : 'Total Rooms'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={rt.totalRooms}
                    onChange={e => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, totalRooms: parseInt(e.target.value) || 1 } : r) }))}
                    className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Description */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  {language === 'vi' ? 'Mô tả tiện nghi' : 'Amenities Description'}
                </label>
                <textarea
                  value={rt.description}
                  onChange={e => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, description: e.target.value } : r) }))}
                  rows={2}
                  className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none resize-none"
                  placeholder={language === 'vi' ? 'Mô tả tiện nghi, thiết bị...' : 'Describe amenities, equipment...'}
                />
              </div>

              {/* Row 5: Room images */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  {language === 'vi' ? 'Ảnh phòng' : 'Room Images'}
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                  {rt.images.map((imgUrl, imgIdx) => (
                    <div key={imgIdx} className="relative w-14 h-14 rounded-lg overflow-hidden group">
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, roomTypes: prev.roomTypes.map((r, i) => i === idx ? { ...r, images: r.images.filter((_, ii) => ii !== imgIdx) } : r) }))}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                  <label className={`w-14 h-14 rounded-lg border-2 border-dashed border-teal-200 flex flex-col items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors ${uploadingRoomIdx === idx ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingRoomIdx === idx
                      ? <Loader2 size={14} className="text-teal-500 animate-spin" />
                      : <><ImageIcon size={14} className="text-teal-400" /><span className="text-[9px] text-teal-400 mt-0.5">{language === 'vi' ? 'Thêm' : 'Add'}</span></>
                    }
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => handleRoomImageUpload(e, idx, !isNew)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFormFields = (
    form: FormState,
    setForm: React.Dispatch<React.SetStateAction<FormState>>,
    isNew: boolean,
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* LEFT COLUMN */}
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên Tour' : 'Tour Title'}</label>
          <input type="text" value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
            placeholder={language === 'vi' ? 'Ví dụ: Tour Cát Bà 2 ngày 1 đêm' : 'e.g. Cat Ba 2D1N Tour'} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Thời gian tour' : 'Duration'}</label>
          <input type="text" value={form.duration}
            onChange={e => setForm(prev => ({ ...prev, duration: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
            placeholder={language === 'vi' ? 'Ví dụ: 3 ngày 2 đêm' : 'e.g. 3 days 2 nights'} />
        </div>

        {/* Schedule section */}
        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-orange-500" />
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">📅 {language === 'vi' ? 'Lịch hoạt động tour' : 'Tour Schedule'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ngày bắt đầu' : 'Start Date'}</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ngày kết thúc' : 'End Date'}</label>
              <input type="date" value={form.endDate}
                onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:outline-none text-sm" />
            </div>
          </div>
        </div>

        {/* Departure section */}
        <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-teal-600" />
            <p className="text-xs font-bold text-teal-700 uppercase tracking-widest">🚌 {language === 'vi' ? 'Thông tin xuất phát' : 'Departure Info'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giờ khởi hành' : 'Departure Time'}</label>
              <input type="time" value={form.departureTime}
                onChange={e => setForm(prev => ({ ...prev, departureTime: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl focus:ring-2 focus:ring-teal-200 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giờ kết thúc' : 'Return Time'}</label>
              <input type="time" value={form.returnTime}
                onChange={e => setForm(prev => ({ ...prev, returnTime: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl focus:ring-2 focus:ring-teal-200 focus:outline-none text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Điểm xuất phát' : 'Departure Location'}</label>
            <input type="text" value={form.departureLocation}
              onChange={e => setForm(prev => ({ ...prev, departureLocation: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl focus:ring-2 focus:ring-teal-200 focus:outline-none text-sm"
              placeholder={language === 'vi' ? 'Bến xe Mỹ Đình, Hà Nội' : 'e.g. My Dinh Bus Station, Hanoi'} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Điểm kết thúc / trả khách' : 'Return Location'}</label>
            <input type="text" value={form.returnLocation}
              onChange={e => setForm(prev => ({ ...prev, returnLocation: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl focus:ring-2 focus:ring-teal-200 focus:outline-none text-sm"
              placeholder={language === 'vi' ? 'Điểm trả khách...' : 'Drop-off point...'} />
          </div>
        </div>

        {/* Group size */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số người lớn' : 'Number of Adults'}</label>
            <input type="number" min="1" value={form.numAdults}
              onChange={e => setForm(prev => ({ ...prev, numAdults: parseInt(e.target.value) || 1 }))}
              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số trẻ em (từ 4 tuổi)' : 'Children (age 4+)'}</label>
            <input type="number" min="0" value={form.numChildren}
              onChange={e => setForm(prev => ({ ...prev, numChildren: parseInt(e.target.value) || 0 }))}
              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
          </div>
        </div>

        {/* Adult/child pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá người lớn (đ)' : 'Adult Price (VND)'}</label>
            <input type="number" min="0" value={form.priceAdult}
              onChange={e => setForm(prev => ({ ...prev, priceAdult: parseInt(e.target.value) || 0 }))}
              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá trẻ em (đ)' : 'Child Price (VND)'}</label>
            <input type="number" min="0" value={form.priceChild}
              onChange={e => setForm(prev => ({ ...prev, priceChild: parseInt(e.target.value) || 0 }))}
              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
          </div>
        </div>

        {/* Auto-calculated price + discount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá tour (đ)' : 'Tour Price (VND)'}</label>
            <div className="w-full mt-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-bold text-sm select-none cursor-default">
              {computeTourPrice(form.priceAdult, form.numAdults || 1, form.priceChild || 0, form.numChildren || 0, form.nights || 0, form.pricePerNight || 0, form.breakfastCount || 0, form.pricePerBreakfast || 0, form.surcharge || 0).toLocaleString()}đ
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5 ml-1">{language === 'vi' ? 'Tự tính: NL×giá NL + TE×giá TE + đêm + bữa sáng + phụ phí' : 'Auto: adults×price + children×price + nights + breakfast + surcharge'}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giảm giá (%)' : 'Discount (%)'}</label>
            <input type="number" min="0" max="100" value={form.discountPercent || ''}
              onChange={e => setForm(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" placeholder="" />
            {form.discountPercent > 0 && (
              <p className="text-[10px] text-daiichi-red mt-0.5 ml-1 font-medium">
                {language === 'vi' ? 'Áp dụng trên giá tour' : 'Applied to tour price'}
              </p>
            )}
          </div>
        </div>

        {/* Overnight stays */}
        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
          <div className="flex items-center gap-2">
            <Moon size={16} className="text-indigo-500" />
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{language === 'vi' ? 'Lưu trú qua đêm' : 'Overnight Stays'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số đêm' : 'Nights'}</label>
              <input type="number" min="0" value={form.nights}
                onChange={e => setForm(prev => ({ ...prev, nights: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá/đêm/người (đ)' : 'Price/Night/Person'}</label>
              <input type="number" min="0" value={form.pricePerNight}
                onChange={e => setForm(prev => ({ ...prev, pricePerNight: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Breakfast */}
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
          <div className="flex items-center gap-2">
            <Coffee size={16} className="text-amber-500" />
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">{language === 'vi' ? 'Bữa sáng' : 'Breakfast'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số bữa sáng' : 'Breakfast Count'}</label>
              <input type="number" min="0" value={form.breakfastCount}
                onChange={e => setForm(prev => ({ ...prev, breakfastCount: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-200 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá/bữa/người (đ)' : 'Price/Breakfast/Person'}</label>
              <input type="number" min="0" value={form.pricePerBreakfast}
                onChange={e => setForm(prev => ({ ...prev, pricePerBreakfast: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-200 focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Surcharge */}
        <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 font-bold text-base">+</span>
            <p className="text-xs font-bold text-green-700 uppercase tracking-widest">{language === 'vi' ? 'Phụ phí' : 'Surcharge'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số tiền phụ phí (đ)' : 'Surcharge Amount (VND)'}</label>
              <input type="number" min="0" value={form.surcharge}
                onChange={e => setForm(prev => ({ ...prev, surcharge: parseInt(e.target.value) || 0 }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-green-100 rounded-xl focus:ring-2 focus:ring-green-200 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ghi chú phụ phí' : 'Surcharge Note'}</label>
              <input type="text" value={form.surchargeNote}
                onChange={e => setForm(prev => ({ ...prev, surchargeNote: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-green-100 rounded-xl focus:ring-2 focus:ring-green-200 focus:outline-none text-sm"
                placeholder={language === 'vi' ? 'Lý do phụ phí...' : 'Reason for surcharge...'} />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mô tả' : 'Description'}</label>
          <textarea rows={3} value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none resize-none"
            placeholder={language === 'vi' ? 'Mô tả chi tiết về tour...' : 'Detailed description of the tour...'} />
        </div>

        {/* YouTube URL */}
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-2">
          <div className="flex items-center gap-2">
            <Youtube size={16} className="text-red-500" />
            <p className="text-xs font-bold text-red-600 uppercase tracking-widest">YouTube</p>
          </div>
          <input type="url" value={form.youtubeUrl}
            onChange={e => setForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
            className="w-full px-3 py-2 bg-white border border-red-100 rounded-xl focus:ring-2 focus:ring-red-200 focus:outline-none text-sm"
            placeholder="https://youtu.be/..." />
        </div>

        {/* Itinerary */}
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue-500" />
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">{language === 'vi' ? 'Lịch trình' : 'Itinerary'}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, itinerary: [...prev.itinerary, { day: prev.itinerary.length + 1, content: '' }] }))}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={12} />
              {language === 'vi' ? 'Thêm ngày' : 'Add Day'}
            </button>
          </div>
          {form.itinerary.length === 0 ? (
            <p className="text-xs text-blue-400 text-center py-1">{language === 'vi' ? 'Chưa có lịch trình' : 'No itinerary yet'}</p>
          ) : (
            <div className="space-y-2">
              {form.itinerary.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded-lg px-2 py-2 min-w-[52px] text-center mt-0.5">
                    {language === 'vi' ? `Ngày ${item.day}` : `Day ${item.day}`}
                  </span>
                  <textarea
                    value={item.content}
                    onChange={e => setForm(prev => ({ ...prev, itinerary: prev.itinerary.map((it, i) => i === idx ? { ...it, content: e.target.value } : it) }))}
                    rows={2}
                    className="flex-1 px-3 py-2 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-200 focus:outline-none text-sm resize-none"
                    placeholder={language === 'vi' ? 'Hoạt động trong ngày...' : 'Activities for the day...'}
                  />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, itinerary: prev.itinerary.filter((_, i) => i !== idx).map((it, i) => ({ ...it, day: i + 1 })) }))}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add-ons */}
        <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-500 font-bold">✦</span>
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">{language === 'vi' ? 'Dịch vụ thêm' : 'Add-on Services'}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, addons: [...prev.addons, { id: crypto.randomUUID(), name: '', price: 0, description: '' }] }))}
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus size={12} />
              {language === 'vi' ? 'Thêm dịch vụ' : 'Add Service'}
            </button>
          </div>
          {form.addons.length === 0 ? (
            <p className="text-xs text-purple-400 text-center py-1">{language === 'vi' ? 'Chưa có dịch vụ thêm' : 'No add-ons yet'}</p>
          ) : (
            <div className="space-y-2">
              {form.addons.map((addon, idx) => (
                <div key={addon.id} className="bg-white rounded-xl border border-purple-100 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={addon.name}
                        onChange={e => setForm(prev => ({ ...prev, addons: prev.addons.map((a, i) => i === idx ? { ...a, name: e.target.value } : a) }))}
                        className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:outline-none"
                        placeholder={language === 'vi' ? 'Tên dịch vụ' : 'Service name'}
                      />
                      <input
                        type="number"
                        min="0"
                        value={addon.price}
                        onChange={e => setForm(prev => ({ ...prev, addons: prev.addons.map((a, i) => i === idx ? { ...a, price: parseInt(e.target.value) || 0 } : a) }))}
                        className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:outline-none"
                        placeholder={language === 'vi' ? 'Giá (đ)' : 'Price (VND)'}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, addons: prev.addons.filter((_, i) => i !== idx) }))}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <textarea
                    value={addon.description || ''}
                    onChange={e => setForm(prev => ({ ...prev, addons: prev.addons.map((a, i) => i === idx ? { ...a, description: e.target.value } : a) }))}
                    rows={1}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:outline-none resize-none"
                    placeholder={language === 'vi' ? 'Mô tả dịch vụ...' : 'Service description...'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-4">
        {/* Main tour images */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ảnh tour (đầu tiên = thumbnail)' : 'Tour Images (first = thumbnail)'}</label>
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            {form.images.map((imgUrl, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                <img src={imgUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                {idx === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-daiichi-red/80 text-white text-[9px] text-center py-0.5 font-bold">
                    {language === 'vi' ? 'Thumbnail' : 'Thumb'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const updated = form.images.filter((_, i) => i !== idx);
                    setForm(prev => ({ ...prev, images: updated, imageUrl: updated[0] || '' }));
                  }}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <label className={`w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-daiichi-red hover:bg-red-50 transition-colors ${(isNew ? uploading : editUploading) ? 'opacity-50 pointer-events-none' : ''}`}>
              {(isNew ? uploading : editUploading)
                ? <Loader2 size={20} className="text-daiichi-red animate-spin" />
                : <><ImageIcon size={20} className="text-gray-300" /><span className="text-[10px] text-gray-400 mt-1">{language === 'vi' ? 'Thêm ảnh' : 'Add photo'}</span></>
              }
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e, !isNew)} />
            </label>
          </div>
          {isNew && uploading && uploadProgress > 0 && (
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-daiichi-red h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          {form.images.length === 0 && (
            <p className="text-xs text-red-400 mt-1 ml-1">{language === 'vi' ? 'Bắt buộc: cần ít nhất 1 ảnh' : 'Required: at least 1 image'}</p>
          )}
        </div>

        {/* Room Types */}
        {renderRoomTypesSection(form, setForm, isNew)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{language === 'vi' ? 'Quản lý Tour' : 'Tour Management'}</h2>
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Thiết kế và đăng tải các tour du lịch mới' : 'Design and publish new tours'}</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={handleOpenBatchModal}
            className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Zap size={18} />
            {language === 'vi' ? 'Tạo nhiều tour' : 'Batch Create Tours'}
          </button>
          <button
            onClick={() => { setIsAdding(true); setExpandedTourId(null); setEditingTour(null); }}
            className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 flex items-center gap-2"
          >
            <Plus size={20} />
            {language === 'vi' ? 'Thêm Tour mới' : 'Add New Tour'}
          </button>
        </div>
      </div>

      {/* Batch Create Tours Modal */}
      {showBatchAddTour && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Zap size={22} className="text-blue-500" />
                  {language === 'vi' ? 'Tạo nhiều tour cùng lúc' : 'Batch Create Tours'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {language === 'vi'
                    ? 'Chọn tour mẫu và nhiều ngày khởi hành để tạo nhiều tour cùng lúc'
                    : 'Select a tour template and multiple departure dates to create tours at once'}
                </p>
              </div>
              <button onClick={() => setShowBatchAddTour(false)} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>

            {/* Template selector */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                {language === 'vi' ? 'Tour mẫu (tuỳ chọn)' : 'Template Tour (optional)'}
              </label>
              <select
                value={batchTourForm.templateId}
                onChange={e => applyBatchTemplate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">{language === 'vi' ? '-- Không dùng mẫu --' : '-- No template --'}</option>
                {tours.map(t => (
                  <option key={t.id} value={t.id}>{t.title}{t.duration ? ` (${t.duration})` : ''}</option>
                ))}
              </select>
              {batchTourForm.templateId && (
                <p className="text-xs text-blue-600 mt-1 ml-1">
                  {language === 'vi' ? '✓ Đã áp dụng thông tin từ tour mẫu. Bạn có thể điều chỉnh bên dưới.' : '✓ Template applied. You can adjust fields below.'}
                </p>
              )}
            </div>

            {/* Tour name */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                {language === 'vi' ? 'Tên tour *' : 'Tour Name *'}
              </label>
              <input
                type="text"
                value={batchTourForm.title}
                onChange={e => setBatchTourForm(p => ({ ...p, title: e.target.value }))}
                placeholder={language === 'vi' ? 'VD: Tour Hà Nội - Hạ Long 3N2Đ' : 'e.g. Hanoi - Ha Long Bay 3D2N'}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* Duration & Nights */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  {language === 'vi' ? 'Thời lượng' : 'Duration'}
                </label>
                <input
                  type="text"
                  value={batchTourForm.duration}
                  onChange={e => setBatchTourForm(p => ({ ...p, duration: e.target.value }))}
                  placeholder={language === 'vi' ? 'VD: 3 ngày 2 đêm' : 'e.g. 3 days 2 nights'}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  {language === 'vi' ? 'Số đêm (để tính ngày về)' : 'Nights (for end date)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={batchTourForm.nights}
                  onChange={e => setBatchTourForm(p => ({ ...p, nights: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* Departure & Return */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  <Clock size={10} className="inline mr-1" />{language === 'vi' ? 'Giờ khởi hành' : 'Departure Time'}
                </label>
                <input
                  type="time"
                  value={batchTourForm.departureTime}
                  onChange={e => setBatchTourForm(p => ({ ...p, departureTime: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  <Clock size={10} className="inline mr-1" />{language === 'vi' ? 'Giờ trở về' : 'Return Time'}
                </label>
                <input
                  type="time"
                  value={batchTourForm.returnTime}
                  onChange={e => setBatchTourForm(p => ({ ...p, returnTime: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  <MapPin size={10} className="inline mr-1" />{language === 'vi' ? 'Điểm xuất phát' : 'Departure Location'}
                </label>
                <input
                  type="text"
                  value={batchTourForm.departureLocation}
                  onChange={e => setBatchTourForm(p => ({ ...p, departureLocation: e.target.value }))}
                  placeholder={language === 'vi' ? 'VD: 123 Lê Lợi, Hà Nội' : 'e.g. 123 Le Loi St, Hanoi'}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  <MapPin size={10} className="inline mr-1" />{language === 'vi' ? 'Điểm trả khách' : 'Return Location'}
                </label>
                <input
                  type="text"
                  value={batchTourForm.returnLocation}
                  onChange={e => setBatchTourForm(p => ({ ...p, returnLocation: e.target.value }))}
                  placeholder={language === 'vi' ? 'VD: Bến xe Hà Nội' : 'e.g. Hanoi Bus Terminal'}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  {language === 'vi' ? 'Giá người lớn (đ)' : 'Adult Price (đ)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={batchTourForm.priceAdult}
                  onChange={e => setBatchTourForm(p => ({ ...p, priceAdult: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">
                  {language === 'vi' ? 'Giá trẻ em (đ)' : 'Child Price (đ)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={batchTourForm.priceChild}
                  onChange={e => setBatchTourForm(p => ({ ...p, priceChild: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* Property / Asset link */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1 flex items-center gap-1">
                <Building2 size={10} />
                {language === 'vi' ? 'Liên kết tài sản (cơ sở lưu trú)' : 'Link to Asset (Accommodation)'}
              </label>
              <select
                value={batchTourForm.propertyId}
                onChange={e => setBatchTourForm(p => ({ ...p, propertyId: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">{language === 'vi' ? '-- Không liên kết --' : '-- None --'}</option>
                {batchProperties.map(prop => (
                  <option key={prop.id} value={prop.id}>
                    {prop.name} ({prop.type === 'cruise' ? (language === 'vi' ? 'Du thuyền' : 'Cruise') : prop.type === 'homestay' ? 'Homestay' : 'Resort'})
                  </option>
                ))}
              </select>
              {batchProperties.length === 0 && (
                <p className="text-xs text-gray-400 mt-1 ml-1">
                  {language === 'vi' ? 'Chưa có tài sản nào. Thêm tài sản trong "Quản lý tài sản".' : 'No properties found. Add one in Asset Management.'}
                </p>
              )}
            </div>

            {/* Departure date slots */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-2">
                {language === 'vi' ? 'Ngày khởi hành *' : 'Departure Dates *'}
              </label>
              <div className="space-y-2">
                {batchDepartureDates.map((date, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={date}
                      onChange={e => {
                        const updated = [...batchDepartureDates];
                        updated[idx] = e.target.value;
                        setBatchDepartureDates(updated);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    {batchDepartureDates.length > 1 && (
                      <button
                        onClick={() => setBatchDepartureDates(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setBatchDepartureDates(prev => [...prev, ''])}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl border border-dashed border-blue-200"
                >
                  <Plus size={14} />
                  {language === 'vi' ? 'Thêm ngày' : 'Add date'}
                </button>
              </div>

              {/* Date range helper */}
              <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">
                  {language === 'vi' ? 'Hoặc thêm nhiều ngày theo khoảng' : 'Or add a date range'}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">{language === 'vi' ? 'Từ ngày' : 'From'}</label>
                    <input
                      type="date"
                      value={batchDateFrom}
                      onChange={e => setBatchDateFrom(e.target.value)}
                      className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">{language === 'vi' ? 'Đến ngày' : 'To'}</label>
                    <input
                      type="date"
                      value={batchDateTo}
                      min={batchDateFrom}
                      onChange={e => setBatchDateTo(e.target.value)}
                      className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddDateRange}
                    disabled={!batchDateFrom || !batchDateTo || batchDateFrom > batchDateTo}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition-colors"
                  >
                    {language === 'vi' ? 'Thêm khoảng' : 'Add Range'}
                  </button>
                </div>
              </div>
            </div>

            {/* Summary */}
            {batchDepartureDates.filter(d => d !== '').length > 0 && batchTourForm.title && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-sm text-green-800">
                <p className="font-bold">
                  {language === 'vi'
                    ? `✓ Sẽ tạo ${batchDepartureDates.filter(d => d !== '').length} tour "${batchTourForm.title}"`
                    : `✓ Will create ${batchDepartureDates.filter(d => d !== '').length} tours for "${batchTourForm.title}"`}
                </p>
                <p className="text-xs mt-1 text-green-700">
                  {language === 'vi' ? 'Các ngày: ' : 'Dates: '}
                  {batchDepartureDates.filter(d => d !== '').sort().join(', ')}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowBatchAddTour(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-50"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={handleBatchAddTours}
                disabled={batchTourLoading || batchDepartureDates.filter(d => d !== '').length === 0 || !batchTourForm.title}
                className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
              >
                {batchTourLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {language === 'vi'
                  ? `Tạo ${batchDepartureDates.filter(d => d !== '').length} tour`
                  : `Create ${batchDepartureDates.filter(d => d !== '').length} tours`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={language === 'vi' ? 'Tìm tên hoặc mô tả...' : 'Search tours...'}
            className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 w-52"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">{language === 'vi' ? 'Thời gian' : 'Duration'}</label>
          <input
            type="text"
            value={durationFilter}
            onChange={e => setDurationFilter(e.target.value)}
            placeholder={language === 'vi' ? 'VD: 2 ngày...' : 'e.g. 2 days...'}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 w-36"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">{language === 'vi' ? 'Giá từ (đ)' : 'Price from'}</label>
          <input
            type="number"
            value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
            placeholder=""
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 w-32"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-1">{language === 'vi' ? 'Giá đến (đ)' : 'Price to'}</label>
          <input
            type="number"
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
            placeholder="∞"
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 w-32"
          />
        </div>
        {(searchTerm || durationFilter || priceMin || priceMax) && (
          <button
            onClick={() => { setSearchTerm(''); setDurationFilter(''); setPriceMin(''); setPriceMax(''); }}
            className="px-3 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl bg-white"
          >
            {language === 'vi' ? 'Xóa lọc' : 'Clear filters'}
          </button>
        )}
      </div>

      {/* Add new tour form */}
      {isAdding && (
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">{language === 'vi' ? 'Thông tin Tour mới' : 'New Tour Details'}</h3>
            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={20} /></button>
          </div>
          {renderFormFields(newTour, setNewTour, true)}
          <div className="flex justify-end gap-4 pt-4">
            <button onClick={() => setIsAdding(false)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button onClick={handleAddTour} disabled={!newTour.title || newTour.images.length === 0 || uploading || saving}
              className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {language === 'vi' ? 'Lưu Tour' : 'Save Tour'}
            </button>
          </div>
        </div>
      )}

      {/* Tours table */}
      {tours.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium">{language === 'vi' ? 'Chưa có tour nào. Nhấn "Thêm Tour mới" để bắt đầu.' : 'No tours yet. Click "Add New Tour" to get started.'}</p>
        </div>
      ) : filteredTours.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{language === 'vi' ? 'Không tìm thấy tour phù hợp' : 'No tours match your search'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[24px] border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left w-8"></th>
                <th className="px-4 py-3 text-left w-14">{language === 'vi' ? 'Ảnh' : 'Img'}</th>
                <th className="px-4 py-3 text-left">{language === 'vi' ? 'Tên tour' : 'Tour Name'}</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">{language === 'vi' ? 'Thời gian' : 'Duration'}</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">{language === 'vi' ? 'Xuất phát' : 'Departure'}</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">{language === 'vi' ? 'Loại phòng' : 'Room Types'}</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">{language === 'vi' ? 'Giá từ' : 'From Price'}</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">{language === 'vi' ? 'Giảm giá' : 'Discount'}</th>
                <th className="px-4 py-3 text-center">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTours.map(tour => {
                const thumb = (tour.images && tour.images.length > 0) ? tour.images[0] : tour.imageUrl;
                const fromPrice = tour.roomTypes && tour.roomTypes.length > 0
                  ? Math.min(...tour.roomTypes.map(r => r.price))
                  : (tour.priceAdult || tour.price);
                const isExpanded = expandedTourId === tour.id;
                const departureDisplay = tour.departureTime
                  ? `${tour.departureTime}${tour.startDate ? ` · ${formatBookingDate(tour.startDate)}` : ''}`
                  : (tour.startDate ? formatBookingDate(tour.startDate) : '—');
                return (
                  <React.Fragment key={tour.id}>
                    <tr
                      onClick={() => handleRowClick(tour)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(tour); } }}
                      role="button"
                      tabIndex={0}
                      className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-orange-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded
                          ? <ChevronDown size={16} className="text-daiichi-red" />
                          : <ChevronRight size={16} />
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          {thumb
                            ? <img src={thumb} alt={tour.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={18} /></div>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800 line-clamp-1">{tour.title}</p>
                        {tour.youtubeUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-medium mt-0.5">
                            <Youtube size={10} /> Video
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-indigo-600 text-xs font-medium">{tour.duration || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600">
                          {tour.departureTime && (
                            <span className="flex items-center gap-1 text-teal-700 font-medium">
                              <Clock size={10} />
                              {tour.departureTime}
                            </span>
                          )}
                          {(tour.startDate || tour.endDate) && (
                            <span className="text-gray-400 text-[10px]">
                              {tour.startDate ? formatBookingDate(tour.startDate) : ''}{tour.startDate && tour.endDate ? ' → ' : ''}{tour.endDate ? formatBookingDate(tour.endDate) : ''}
                            </span>
                          )}
                          {!tour.departureTime && !tour.startDate && !tour.endDate && '—'}
                        </div>
                        {tour.departureLocation && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                            <MapPin size={9} />
                            <span className="truncate max-w-[120px]">{tour.departureLocation}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tour.roomTypes && tour.roomTypes.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {tour.roomTypes.map(rt => {
                              const booked = roomBookingCounts[tour.id]?.[rt.id] ?? 0;
                              const remaining = rt.totalRooms - booked;
                              return (
                                <span key={rt.id} className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-medium">
                                  <BedDouble size={10} />
                                  <span className="truncate max-w-[100px]" title={rt.name}>{rt.name}</span>
                                  <span className={`ml-0.5 font-bold ${remaining <= 0 ? 'text-red-500' : remaining <= 2 ? 'text-amber-600' : 'text-teal-700'}`}>
                                    ({booked}/{rt.totalRooms})
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tour.discountPercent && tour.discountPercent > 0 ? (
                          <>
                            <p className="font-bold text-daiichi-red">
                              {Math.round(fromPrice * (1 - tour.discountPercent / 100)).toLocaleString()}đ
                            </p>
                            <p className="text-[10px] text-gray-400 line-through">{fromPrice.toLocaleString()}đ</p>
                          </>
                        ) : (
                          <p className="font-bold text-daiichi-red">{fromPrice.toLocaleString()}đ</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tour.discountPercent && tour.discountPercent > 0 ? (
                          <span className="inline-block bg-daiichi-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">-{tour.discountPercent}%</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); handleRowClick(tour); }}
                            className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                            title={language === 'vi' ? 'Chỉnh sửa' : 'Edit'}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleCopyTour(tour); }}
                            className="p-2 rounded-lg text-green-500 hover:bg-green-50 transition-colors"
                            title={language === 'vi' ? 'Sao chép' : 'Copy'}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleExportPdf(tour); }}
                            className="p-2 rounded-lg text-orange-500 hover:bg-orange-50 transition-colors"
                            title={language === 'vi' ? 'Xuất PDF danh sách khách' : 'Export passenger list PDF'}
                          >
                            <FileText size={15} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteTour(tour.id); }}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title={language === 'vi' ? 'Xóa' : 'Delete'}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && editingTour && editingTour.id === tour.id && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className="p-6 bg-gray-50 border-b border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-bold text-gray-800">{language === 'vi' ? 'Chỉnh sửa Tour' : 'Edit Tour'}</h3>
                              <button
                                onClick={() => { setExpandedTourId(null); setEditingTour(null); }}
                                className="p-2 hover:bg-gray-200 rounded-xl text-gray-400"
                              >
                                <X size={18} />
                              </button>
                            </div>
                            {renderFormFields(editForm, setEditForm, false)}
                            <div className="flex justify-end gap-4 pt-6">
                              <button
                                onClick={() => { setExpandedTourId(null); setEditingTour(null); }}
                                className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600"
                              >
                                {language === 'vi' ? 'Hủy' : 'Cancel'}
                              </button>
                              <button
                                onClick={handleUpdateTour}
                                disabled={!editForm.title || editForm.images.length === 0 || editUploading || saving}
                                className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
                              >
                                {saving && <Loader2 size={16} className="animate-spin" />}
                                {language === 'vi' ? 'Cập nhật Tour' : 'Update Tour'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
