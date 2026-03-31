import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Image as ImageIcon, Loader2, Edit3, X, Moon, Coffee,
  Search, Youtube, Copy, Calendar, ChevronDown, ChevronRight,
  MapPin, Clock, BedDouble
} from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Language } from '../App';
import { User, UserRole } from '../types';
import { transportService } from '../services/transportService';
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
}

interface TourManagementProps {
  language: Language;
  currentUser?: User | null;
}

const emptyRoomType = (): TourRoomType => ({
  id: crypto.randomUUID(),
  name: '',
  capacity: 2,
  // PER_PERSON is the default as most tour packages price per traveller
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !storage) {
      if (!storage) alert('Firebase Storage is not configured.');
      return;
    }
    if (isEdit) setEditUploading(true);
    else setUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File;
        const compressed = await compressImage(file, 0.75, 1280);
        const storageRef = ref(storage, `tours/${Date.now()}_${compressed.name}`);
        const uploadTask = uploadBytesResumable(storageRef, compressed);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              if (!isEdit) {
                const progress = ((i + snapshot.bytesTransferred / snapshot.totalBytes) / files.length) * 100;
                setUploadProgress(progress);
              }
            },
            (error) => { console.error('Upload failed:', error); reject(error); },
            async () => { urls.push(await getDownloadURL(uploadTask.snapshot.ref)); resolve(); }
          );
        });
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
      alert('Upload failed. Please check your Firebase configuration.');
    }
    e.target.value = '';
  };

  const handleRoomImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    roomIdx: number,
    isEdit: boolean
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !storage) return;
    setUploadingRoomIdx(roomIdx);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const compressed = await compressImage(file, 0.75, 1280);
        const storageRef = ref(storage, `tours/rooms/${Date.now()}_${compressed.name}`);
        const uploadTask = uploadBytesResumable(storageRef, compressed);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', null,
            (error) => { console.error('Room upload failed:', error); reject(error); },
            async () => { urls.push(await getDownloadURL(uploadTask.snapshot.ref)); resolve(); }
          );
        });
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
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Số trẻ em (>4 tuổi)' : 'Children (>4 yrs)'}</label>
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
        <button
          onClick={() => { setIsAdding(true); setExpandedTourId(null); setEditingTour(null); }}
          className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 flex items-center gap-2 self-start md:self-auto"
        >
          <Plus size={20} />
          {language === 'vi' ? 'Thêm Tour mới' : 'Add New Tour'}
        </button>
      </div>

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
                  ? `${tour.departureTime}${tour.startDate ? ` · ${tour.startDate}` : ''}`
                  : tour.startDate || '—';
                const roomTypesDisplay = tour.roomTypes && tour.roomTypes.length > 0
                  ? (() => {
                      const capacities = tour.roomTypes.map(r => r.capacity);
                      const minCap = Math.min(...capacities);
                      const maxCap = Math.max(...capacities);
                      const capRange = minCap === maxCap ? `${minCap}` : `${minCap}-${maxCap}`;
                      return `${tour.roomTypes.length} ${language === 'vi' ? 'loại' : 'types'} · ${capRange} ${language === 'vi' ? 'người' : 'guests'}`;
                    })()
                  : '—';

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
                              {tour.startDate}{tour.startDate && tour.endDate ? ' → ' : ''}{tour.endDate}
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
                          <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-medium">
                            <BedDouble size={10} />
                            {roomTypesDisplay}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-daiichi-red">{fromPrice.toLocaleString()}đ</p>
                        {tour.discountPercent && tour.discountPercent > 0 && (
                          <p className="text-[10px] text-gray-400 line-through">
                            {Math.round(fromPrice / (1 - tour.discountPercent / 100)).toLocaleString()}đ
                          </p>
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
