import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Image as ImageIcon, Loader2, Edit3, X, Moon, Coffee, Search, Youtube, Copy, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Language } from '../App';
import { transportService } from '../services/transportService';
import { compressImage } from '../lib/imageUtils';

interface TourAddon {
  id: string;
  name: string;
  price: number;
  description?: string;
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
}

interface TourManagementProps {
  language: Language;
}

const emptyForm = {
  title: '',
  description: '',
  price: 0,
  imageUrl: '',
  images: [] as string[],
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
  itinerary: [] as { day: number; content: string }[],
  addons: [] as TourAddon[],
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

export const TourManagement: React.FC<TourManagementProps> = ({ language }) => {
  const [tours, setTours] = useState<Tour[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null);
  const [newTour, setNewTour] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const filteredTours = useMemo(() => {
    return tours.filter(tour => {
      const q = searchTerm.toLowerCase();
      if (q && !(
        tour.title.toLowerCase().includes(q) ||
        (tour.description || '').toLowerCase().includes(q) ||
        (tour.duration || '').toLowerCase().includes(q)
      )) return false;

      if (durationFilter.trim() && !(tour.duration || '').toLowerCase().includes(durationFilter.toLowerCase())) return false;

      const effectivePrice = tour.priceAdult || tour.price;
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
      if (!storage) alert('Firebase Storage is not configured. Please check your environment variables.');
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
            (error) => {
              console.error('Upload failed:', error);
              reject(error);
            },
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              urls.push(url);
              resolve();
            }
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

  const handleAddTour = async () => {
    if (!newTour.title || !newTour.imageUrl) return;
    setSaving(true);
    const computedPrice = computeTourPrice(
      newTour.priceAdult, newTour.numAdults || 1,
      newTour.priceChild || 0, newTour.numChildren || 0,
      newTour.nights || 0, newTour.pricePerNight || 0,
      newTour.breakfastCount || 0, newTour.pricePerBreakfast || 0,
      newTour.surcharge || 0,
    );
    try {
      await transportService.addTour({
        title: newTour.title,
        description: newTour.description,
        price: computedPrice,
        imageUrl: newTour.imageUrl,
        images: newTour.images.length > 0 ? newTour.images : undefined,
        discountPercent: newTour.discountPercent || 0,
        priceAdult: newTour.priceAdult || undefined,
        priceChild: newTour.priceChild || undefined,
        numAdults: newTour.numAdults || undefined,
        numChildren: newTour.numChildren || undefined,
        duration: newTour.duration || undefined,
        nights: newTour.nights || undefined,
        pricePerNight: newTour.pricePerNight || undefined,
        breakfastCount: newTour.breakfastCount || undefined,
        pricePerBreakfast: newTour.pricePerBreakfast || undefined,
        surcharge: newTour.surcharge || undefined,
        surchargeNote: newTour.surchargeNote || undefined,
        youtubeUrl: newTour.youtubeUrl || undefined,
        startDate: newTour.startDate || undefined,
        endDate: newTour.endDate || undefined,
        itinerary: newTour.itinerary.length > 0 ? newTour.itinerary : undefined,
        addons: newTour.addons.length > 0 ? newTour.addons : undefined,
      });
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
    });
    setIsAdding(false);
  };

  const handleUpdateTour = async () => {
    if (!editingTour || !editForm.title || !editForm.imageUrl) return;
    setSaving(true);
    const computedPrice = computeTourPrice(
      editForm.priceAdult, editForm.numAdults || 1,
      editForm.priceChild || 0, editForm.numChildren || 0,
      editForm.nights || 0, editForm.pricePerNight || 0,
      editForm.breakfastCount || 0, editForm.pricePerBreakfast || 0,
      editForm.surcharge || 0,
    );
    try {
      await transportService.updateTour(editingTour.id, {
        title: editForm.title,
        description: editForm.description,
        price: computedPrice,
        imageUrl: editForm.images[0] || editForm.imageUrl,
        images: editForm.images.length > 0 ? editForm.images : undefined,
        discountPercent: editForm.discountPercent || 0,
        priceAdult: editForm.priceAdult || undefined,
        priceChild: editForm.priceChild || undefined,
        numAdults: editForm.numAdults || undefined,
        numChildren: editForm.numChildren || undefined,
        duration: editForm.duration || undefined,
        nights: editForm.nights || undefined,
        pricePerNight: editForm.pricePerNight || undefined,
        breakfastCount: editForm.breakfastCount || undefined,
        pricePerBreakfast: editForm.pricePerBreakfast || undefined,
        surcharge: editForm.surcharge || undefined,
        surchargeNote: editForm.surchargeNote || undefined,
        youtubeUrl: editForm.youtubeUrl || undefined,
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
        itinerary: editForm.itinerary.length > 0 ? editForm.itinerary : undefined,
        addons: editForm.addons.length > 0 ? editForm.addons : undefined,
      });
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

  const renderFormFields = (
    form: typeof emptyForm,
    setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>,
    isNew: boolean,
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Nội dung phụ phí' : 'Surcharge Description'}</label>
              <input type="text" value={form.surchargeNote}
                onChange={e => setForm(prev => ({ ...prev, surchargeNote: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-white border border-green-100 rounded-xl focus:ring-2 focus:ring-green-200 focus:outline-none"
                placeholder={language === 'vi' ? 'Ví dụ: Phụ phí xăng dầu' : 'e.g. Fuel surcharge'} />
            </div>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mô tả' : 'Description'}</label>
          <textarea value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none h-28 resize-none" />
        </div>
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-2">
          <div className="flex items-center gap-2">
            <Youtube size={16} className="text-red-500" />
            <p className="text-xs font-bold text-red-600 uppercase tracking-widest">{language === 'vi' ? 'Video YouTube (tuỳ chọn)' : 'YouTube Video (optional)'}</p>
          </div>
          <input type="url" value={form.youtubeUrl}
            onChange={e => setForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
            className="w-full px-4 py-3 bg-white border border-red-100 rounded-xl focus:ring-2 focus:ring-red-200 focus:outline-none text-sm"
            placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-500 font-bold">📋</span>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">{language === 'vi' ? 'Lịch trình (tuỳ chọn)' : 'Itinerary (optional)'}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({
                ...prev,
                itinerary: [...prev.itinerary, { day: prev.itinerary.length + 1, content: '' }]
              }))}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Plus size={12} /> {language === 'vi' ? 'Thêm ngày' : 'Add day'}
            </button>
          </div>
          {form.itinerary.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2">{item.day}</span>
              <input
                type="text"
                value={item.content}
                onChange={e => setForm(prev => {
                  const it = [...prev.itinerary];
                  it[idx] = { ...it[idx], content: e.target.value };
                  return { ...prev, itinerary: it };
                })}
                className="flex-1 px-3 py-2 bg-white border border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                placeholder={language === 'vi' ? `Nội dung ngày ${item.day}...` : `Day ${item.day} activities...`}
              />
              <button
                type="button"
                onClick={() => setForm(prev => ({
                  ...prev,
                  itinerary: prev.itinerary.filter((_, i) => i !== idx).map((it, i) => ({ ...it, day: i + 1 }))
                }))}
                className="p-2 text-gray-400 hover:text-red-500 mt-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {form.itinerary.length === 0 && (
            <p className="text-xs text-blue-400">{language === 'vi' ? 'Chưa có lịch trình. Nhấn "+ Thêm ngày" để bắt đầu.' : 'No itinerary yet. Click "+ Add day" to start.'}</p>
          )}
        </div>
        <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-500 font-bold">⭐</span>
              <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">{language === 'vi' ? 'Dịch vụ thêm (tuỳ chọn)' : 'Optional Add-on Services'}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({
                ...prev,
                addons: [...prev.addons, { id: crypto.randomUUID(), name: '', price: 0, description: '' }]
              }))}
              className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              <Plus size={12} /> {language === 'vi' ? 'Thêm dịch vụ' : 'Add service'}
            </button>
          </div>
          {form.addons.map((addon, idx) => (
            <div key={addon.id} className="bg-white rounded-xl border border-purple-100 p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addon.name}
                  onChange={e => setForm(prev => {
                    const ads = [...prev.addons];
                    ads[idx] = { ...ads[idx], name: e.target.value };
                    return { ...prev, addons: ads };
                  })}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:outline-none"
                  placeholder={language === 'vi' ? 'Tên dịch vụ...' : 'Service name...'}
                />
                <input
                  type="number"
                  min="0"
                  value={addon.price}
                  onChange={e => setForm(prev => {
                    const ads = [...prev.addons];
                    ads[idx] = { ...ads[idx], price: parseInt(e.target.value) || 0 };
                    return { ...prev, addons: ads };
                  })}
                  className="w-28 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-purple-200 focus:outline-none"
                  placeholder={language === 'vi' ? 'Giá đ/người' : 'Price/person'}
                />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, addons: prev.addons.filter((_, i) => i !== idx) }))}
                  className="p-2 text-gray-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                type="text"
                value={addon.description || ''}
                onChange={e => setForm(prev => {
                  const ads = [...prev.addons];
                  ads[idx] = { ...ads[idx], description: e.target.value };
                  return { ...prev, addons: ads };
                })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-purple-200 focus:outline-none"
                placeholder={language === 'vi' ? 'Mô tả ngắn (tuỳ chọn)...' : 'Short description (optional)...'}
              />
            </div>
          ))}
          {form.addons.length === 0 && (
            <p className="text-xs text-purple-400">{language === 'vi' ? 'Chưa có dịch vụ thêm. Ví dụ: Thuê xe đạp, Tham quan hang động...' : 'No add-ons yet. E.g. Bike rental, Cave tour...'}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Hình ảnh Tour (có thể tải nhiều ảnh)' : 'Tour Images (multiple allowed)'}</label>
        {form.images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {form.images.map((url, idx) => (
              <div key={idx} className="relative h-24 rounded-2xl overflow-hidden group">
                <img src={url} alt={`Tour ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  onClick={() => setForm(prev => {
                    const imgs = prev.images.filter((_, i) => i !== idx);
                    return { ...prev, images: imgs, imageUrl: imgs[0] || '' };
                  })}
                  className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-daiichi-red text-white px-1.5 py-0.5 rounded-full">{language === 'vi' ? 'Chính' : 'Main'}</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="relative h-36 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center overflow-hidden">
          {(isNew ? uploading : editUploading) ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-daiichi-red" size={28} />
              <p className="text-sm font-bold text-gray-500">{isNew ? `${Math.round(uploadProgress)}%` : (language === 'vi' ? 'Đang tải & nén...' : 'Compressing & uploading...')}</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-400 mx-auto mb-2">
                <ImageIcon size={24} />
              </div>
              <p className="text-xs text-gray-500 mb-2">{language === 'vi' ? 'Chọn nhiều ảnh (sẽ nén trước khi tải lên)' : 'Select images (compressed before upload)'}</p>
              <input type="file" accept="image/*" multiple onChange={e => handleImageUpload(e, !isNew)} className="absolute inset-0 opacity-0 cursor-pointer" />
              <button className="px-5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                {language === 'vi' ? 'Chọn ảnh' : 'Select Images'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
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
                <th className="px-4 py-3 text-left whitespace-nowrap">{language === 'vi' ? 'Lịch hoạt động' : 'Schedule'}</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">{language === 'vi' ? 'Giá NL' : 'Adult Price'}</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">{language === 'vi' ? 'Giá tour' : 'Tour Price'}</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">{language === 'vi' ? 'Giảm giá' : 'Discount'}</th>
                <th className="px-4 py-3 text-center">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTours.map(tour => {
                const thumb = (tour.images && tour.images.length > 0) ? tour.images[0] : tour.imageUrl;
                const effectivePrice = tour.priceAdult || tour.price;
                const discountedPrice = tour.discountPercent && tour.discountPercent > 0
                  ? Math.round(effectivePrice * (1 - tour.discountPercent / 100))
                  : null;
                const isExpanded = expandedTourId === tour.id;
                const schedule = (tour.startDate && tour.endDate)
                  ? `${tour.startDate} → ${tour.endDate}`
                  : tour.startDate
                    ? `${tour.startDate} →`
                    : tour.endDate
                      ? `→ ${tour.endDate}`
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
                      <td className="px-4 py-3 text-xs text-gray-500">{schedule}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-gray-700">{effectivePrice.toLocaleString()}đ</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {discountedPrice ? (
                          <div>
                            <p className="font-bold text-daiichi-red">{Math.round((tour.price || 0) * (1 - (tour.discountPercent ?? 0) / 100)).toLocaleString()}đ</p>
                            <p className="text-[10px] text-gray-400 line-through">{(tour.price || 0).toLocaleString()}đ</p>
                          </div>
                        ) : (
                          <p className="font-bold text-daiichi-red">{(tour.price || 0).toLocaleString()}đ</p>
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
                            onClick={e => { e.stopPropagation(); handleDeleteTour(tour.id); }}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            title={language === 'vi' ? 'Xóa' : 'Delete'}
                          >
                            <Trash2 size={15} />
                          </button>
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
