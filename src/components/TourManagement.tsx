import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Image as ImageIcon, Loader2, Edit3, X, Moon, Coffee, Search, ChevronLeft, ChevronRight, Youtube } from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Language, TRANSLATIONS } from '../App';
import { transportService } from '../services/transportService';
import { compressImage } from '../lib/imageUtils';

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
  duration?: string;
  nights?: number;
  pricePerNight?: number;
  breakfastCount?: number;
  pricePerBreakfast?: number;
  youtubeUrl?: string;
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
  duration: '',
  nights: 0,
  pricePerNight: 0,
  breakfastCount: 0,
  pricePerBreakfast: 0,
  youtubeUrl: '',
};

// Computes the per-adult tour price by summing all included per-person cost components
const computeTourPrice = (
  priceAdult: number,
  nights: number,
  pricePerNight: number,
  breakfastCount: number,
  pricePerBreakfast: number,
): number => priceAdult + nights * pricePerNight + breakfastCount * pricePerBreakfast;

// Carousel card for a single tour shown in the management grid
const TourCard: React.FC<{
  tour: Tour;
  allImages: string[];
  effectivePrice: number;
  discountedPrice: number | null;
  language: Language;
  onEdit: (t: Tour) => void;
  onDelete: (id: string) => void;
}> = ({ tour, allImages, effectivePrice, discountedPrice, language, onEdit, onDelete }) => {
  const [imgIdx, setImgIdx] = useState(0);
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setImgIdx(i => (i - 1 + allImages.length) % allImages.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setImgIdx(i => (i + 1) % allImages.length); };
  return (
    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
      <div className="relative h-48 overflow-hidden">
        <img
          src={allImages[imgIdx] || ''}
          alt={tour.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        {/* Carousel controls – only shown when there are multiple images */}
        {allImages.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors z-10">
              <ChevronLeft size={16} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors z-10">
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {allImages.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}
        {tour.discountPercent && tour.discountPercent > 0 ? (
          <div className="absolute top-4 left-4 bg-daiichi-red text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            -{tour.discountPercent}%
          </div>
        ) : null}
        {tour.youtubeUrl && (
          <div className="absolute bottom-4 left-4 bg-black/60 text-white px-2 py-1 rounded-full flex items-center gap-1">
            <Youtube size={12} className="text-red-400" />
            <span className="text-[10px] font-bold">Video</span>
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={() => onEdit(tour)} className="p-2 bg-white/80 backdrop-blur-sm rounded-xl text-blue-500 hover:bg-white transition-all shadow-sm">
            <Edit3 size={18} />
          </button>
          <button onClick={() => onDelete(tour.id)} className="p-2 bg-white/80 backdrop-blur-sm rounded-xl text-red-500 hover:bg-white transition-all shadow-sm">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="p-6">
        <h4 className="text-lg font-bold mb-1">{tour.title}</h4>
        {tour.duration && <p className="text-xs text-indigo-600 font-medium mb-1">{tour.duration}</p>}
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{tour.description}</p>
        {((tour.nights ?? 0) > 0 || (tour.breakfastCount ?? 0) > 0) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(tour.nights ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                <Moon size={10} /> {tour.nights} {language === 'vi' ? 'đêm' : 'nights'}
                {(tour.pricePerNight ?? 0) > 0 && <span className="text-indigo-400 ml-1">{(tour.pricePerNight ?? 0).toLocaleString()}đ/đêm</span>}
              </span>
            )}
            {(tour.breakfastCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <Coffee size={10} /> {tour.breakfastCount} {language === 'vi' ? 'bữa sáng' : 'breakfasts'}
                {(tour.pricePerBreakfast ?? 0) > 0 && <span className="text-amber-400 ml-1">{(tour.pricePerBreakfast ?? 0).toLocaleString()}đ/bữa</span>}
              </span>
            )}
          </div>
        )}
        <div className="flex justify-between items-end">
          <div>
            {tour.priceAdult ? (
              <>
                <p className="text-xs text-gray-400">{language === 'vi' ? 'Người lớn' : 'Adult'}</p>
                {discountedPrice ? (
                  <>
                    <p className="text-xl font-bold text-daiichi-red">{discountedPrice.toLocaleString()}đ</p>
                    <p className="text-xs text-gray-400 line-through">{effectivePrice.toLocaleString()}đ</p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-daiichi-red">{effectivePrice.toLocaleString()}đ</p>
                )}
                {tour.priceChild ? (
                  <p className="text-xs text-gray-500">{language === 'vi' ? 'Trẻ em' : 'Child'}: {tour.priceChild.toLocaleString()}đ</p>
                ) : null}
              </>
            ) : discountedPrice ? (
              <>
                <p className="text-xl font-bold text-daiichi-red">{discountedPrice.toLocaleString()}đ</p>
                <p className="text-xs text-gray-400 line-through">{effectivePrice.toLocaleString()}đ</p>
              </>
            ) : (
              <p className="text-xl font-bold text-daiichi-red">{effectivePrice.toLocaleString()}đ</p>
            )}
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">Active</span>
        </div>
      </div>
    </div>
  );
};

export const TourManagement: React.FC<TourManagementProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const [tours, setTours] = useState<Tour[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [newTour, setNewTour] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTours = useMemo(() => {
    if (!searchTerm.trim()) return tours;
    const q = searchTerm.toLowerCase();
    return tours.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.duration || '').toLowerCase().includes(q)
    );
  }, [tours, searchTerm]);

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
        // Compress to medium quality before uploading
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
    // Reset file input so the same file can be re-selected
    e.target.value = '';
  };

  const handleAddTour = async () => {
    if (!newTour.title || !newTour.imageUrl) return;
    setSaving(true);
    // Auto-compute tour price = adult price + nights × pricePerNight + breakfasts × pricePerBreakfast
    const computedPrice = computeTourPrice(newTour.priceAdult, newTour.nights || 0, newTour.pricePerNight || 0, newTour.breakfastCount || 0, newTour.pricePerBreakfast || 0);
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
        duration: newTour.duration || undefined,
        nights: newTour.nights || undefined,
        pricePerNight: newTour.pricePerNight || undefined,
        breakfastCount: newTour.breakfastCount || undefined,
        pricePerBreakfast: newTour.pricePerBreakfast || undefined,
        youtubeUrl: newTour.youtubeUrl || undefined,
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
      duration: tour.duration || '',
      nights: tour.nights || 0,
      pricePerNight: tour.pricePerNight || 0,
      breakfastCount: tour.breakfastCount || 0,
      pricePerBreakfast: tour.pricePerBreakfast || 0,
      youtubeUrl: tour.youtubeUrl || '',
    });
    setIsAdding(false);
  };

  const handleUpdateTour = async () => {
    if (!editingTour || !editForm.title || !editForm.imageUrl) return;
    setSaving(true);
    // Auto-compute tour price = adult price + nights × pricePerNight + breakfasts × pricePerBreakfast
    const computedPrice = computeTourPrice(editForm.priceAdult, editForm.nights || 0, editForm.pricePerNight || 0, editForm.breakfastCount || 0, editForm.pricePerBreakfast || 0);
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
        duration: editForm.duration || undefined,
        nights: editForm.nights || undefined,
        pricePerNight: editForm.pricePerNight || undefined,
        breakfastCount: editForm.breakfastCount || undefined,
        pricePerBreakfast: editForm.pricePerBreakfast || undefined,
        youtubeUrl: editForm.youtubeUrl || undefined,
      });
      setEditingTour(null);
      setEditForm(emptyForm);
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
    } catch (err) {
      console.error('Failed to delete tour:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{language === 'vi' ? 'Quản lý Tour' : 'Tour Management'}</h2>
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Thiết kế và đăng tải các tour du lịch mới' : 'Design and publish new tours'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={language === 'vi' ? 'Tìm tên hoặc mô tả tour...' : 'Search tours...'}
              className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 w-56"
            />
          </div>
          <button 
            onClick={() => { setIsAdding(true); setEditingTour(null); }}
            className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 flex items-center gap-2"
          >
            <Plus size={20} />
            {language === 'vi' ? 'Thêm Tour mới' : 'Add New Tour'}
          </button>
        </div>
      </div>

      {/* Add Tour Form */}
      {isAdding && (
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">{language === 'vi' ? 'Thông tin Tour mới' : 'New Tour Details'}</h3>
            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên Tour' : 'Tour Title'}</label>
                <input type="text" value={newTour.title}
                  onChange={e => setNewTour(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                  placeholder={language === 'vi' ? 'Ví dụ: Tour Cát Bà 2 ngày 1 đêm' : 'e.g. Cat Ba 2D1N Tour'} />
              </div>
              {/* Duration */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Thời gian tour' : 'Duration'}</label>
                <input type="text" value={newTour.duration}
                  onChange={e => setNewTour(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                  placeholder={language === 'vi' ? 'Ví dụ: 3 ngày 2 đêm' : 'e.g. 3 days 2 nights'} />
              </div>
              {/* Price Adult / Child */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá người lớn (đ)' : 'Adult Price (VND)'}</label>
                  <input type="number" min="0" value={newTour.priceAdult}
                    onChange={e => setNewTour(prev => ({ ...prev, priceAdult: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá trẻ em (đ)' : 'Child Price (VND)'}</label>
                  <input type="number" min="0" value={newTour.priceChild}
                    onChange={e => setNewTour(prev => ({ ...prev, priceChild: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
                </div>
              </div>
              {/* Tour Price (auto-computed) / Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá tour (đ)' : 'Tour Price (VND)'}</label>
                  <div className="w-full mt-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-bold text-sm select-none cursor-default">
                    {computeTourPrice(newTour.priceAdult, newTour.nights || 0, newTour.pricePerNight || 0, newTour.breakfastCount || 0, newTour.pricePerBreakfast || 0).toLocaleString()}đ
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 ml-1">{language === 'vi' ? 'Tự tính: người lớn + đêm + bữa sáng' : 'Auto: adult + nights + breakfast'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giảm giá (%)' : 'Discount (%)'}</label>
                  <input type="number" min="0" max="100" value={newTour.discountPercent}
                    onChange={e => setNewTour(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" placeholder="0" />
                  {newTour.discountPercent > 0 && (
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
                    <input type="number" min="0" value={newTour.nights}
                      onChange={e => setNewTour(prev => ({ ...prev, nights: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá/đêm/người (đ)' : 'Price/Night/Person'}</label>
                    <input type="number" min="0" value={newTour.pricePerNight}
                      onChange={e => setNewTour(prev => ({ ...prev, pricePerNight: parseInt(e.target.value) || 0 }))}
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
                    <input type="number" min="0" value={newTour.breakfastCount}
                      onChange={e => setNewTour(prev => ({ ...prev, breakfastCount: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-200 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá/bữa/người (đ)' : 'Price/Breakfast/Person'}</label>
                    <input type="number" min="0" value={newTour.pricePerBreakfast}
                      onChange={e => setNewTour(prev => ({ ...prev, pricePerBreakfast: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-200 focus:outline-none" />
                  </div>
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mô tả' : 'Description'}</label>
                <textarea value={newTour.description}
                  onChange={e => setNewTour(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none h-28 resize-none" />
              </div>
              {/* YouTube URL */}
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-2">
                <div className="flex items-center gap-2">
                  <Youtube size={16} className="text-red-500" />
                  <p className="text-xs font-bold text-red-600 uppercase tracking-widest">{language === 'vi' ? 'Video YouTube (tuỳ chọn)' : 'YouTube Video (optional)'}</p>
                </div>
                <input type="url" value={newTour.youtubeUrl}
                  onChange={e => setNewTour(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-red-100 rounded-xl focus:ring-2 focus:ring-red-200 focus:outline-none text-sm"
                  placeholder="https://www.youtube.com/watch?v=..." />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Hình ảnh Tour (có thể tải nhiều ảnh)' : 'Tour Images (multiple allowed)'}</label>
              {/* Existing images grid */}
              {newTour.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {newTour.images.map((url, idx) => (
                    <div key={idx} className="relative h-24 rounded-2xl overflow-hidden group">
                      <img src={url} alt={`Tour ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        onClick={() => setNewTour(prev => {
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
              {/* Upload area */}
              <div className="relative h-36 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center overflow-hidden">
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-daiichi-red" size={28} />
                    <p className="text-sm font-bold text-gray-500">{Math.round(uploadProgress)}%</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-400 mx-auto mb-2">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{language === 'vi' ? 'Chọn nhiều ảnh (sẽ nén trước khi tải lên)' : 'Select images (compressed before upload)'}</p>
                    <input type="file" accept="image/*" multiple onChange={e => handleImageUpload(e, false)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <button className="px-5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                      {language === 'vi' ? 'Chọn ảnh' : 'Select Images'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
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

      {/* Edit Tour Form */}
      {editingTour && (
        <div className="bg-white p-8 rounded-[32px] border-2 border-daiichi-red/20 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">{language === 'vi' ? 'Chỉnh sửa Tour' : 'Edit Tour'}</h3>
            <button onClick={() => setEditingTour(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên Tour' : 'Tour Title'}</label>
                <input type="text" value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
              </div>
              {/* Duration */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Thời gian tour' : 'Duration'}</label>
                <input type="text" value={editForm.duration}
                  onChange={e => setEditForm(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                  placeholder={language === 'vi' ? 'Ví dụ: 3 ngày 2 đêm' : 'e.g. 3 days 2 nights'} />
              </div>
              {/* Price Adult / Child */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá người lớn (đ)' : 'Adult Price (VND)'}</label>
                  <input type="number" min="0" value={editForm.priceAdult}
                    onChange={e => setEditForm(prev => ({ ...prev, priceAdult: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá trẻ em (đ)' : 'Child Price (VND)'}</label>
                  <input type="number" min="0" value={editForm.priceChild}
                    onChange={e => setEditForm(prev => ({ ...prev, priceChild: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
                </div>
              </div>
              {/* Tour Price (auto-computed) / Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá tour (đ)' : 'Tour Price (VND)'}</label>
                  <div className="w-full mt-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-bold text-sm select-none cursor-default">
                    {computeTourPrice(editForm.priceAdult, editForm.nights || 0, editForm.pricePerNight || 0, editForm.breakfastCount || 0, editForm.pricePerBreakfast || 0).toLocaleString()}đ
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 ml-1">{language === 'vi' ? 'Tự tính: người lớn + đêm + bữa sáng' : 'Auto: adult + nights + breakfast'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giảm giá (%)' : 'Discount (%)'}</label>
                  <input type="number" min="0" max="100" value={editForm.discountPercent}
                    onChange={e => setEditForm(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none" />
                  {editForm.discountPercent > 0 && (
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
                    <input type="number" min="0" value={editForm.nights}
                      onChange={e => setEditForm(prev => ({ ...prev, nights: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá/đêm/người (đ)' : 'Price/Night/Person'}</label>
                    <input type="number" min="0" value={editForm.pricePerNight}
                      onChange={e => setEditForm(prev => ({ ...prev, pricePerNight: parseInt(e.target.value) || 0 }))}
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
                    <input type="number" min="0" value={editForm.breakfastCount}
                      onChange={e => setEditForm(prev => ({ ...prev, breakfastCount: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-200 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá/bữa/người (đ)' : 'Price/Breakfast/Person'}</label>
                    <input type="number" min="0" value={editForm.pricePerBreakfast}
                      onChange={e => setEditForm(prev => ({ ...prev, pricePerBreakfast: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-200 focus:outline-none" />
                  </div>
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mô tả' : 'Description'}</label>
                <textarea value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none h-28 resize-none" />
              </div>
              {/* YouTube URL */}
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-2">
                <div className="flex items-center gap-2">
                  <Youtube size={16} className="text-red-500" />
                  <p className="text-xs font-bold text-red-600 uppercase tracking-widest">{language === 'vi' ? 'Video YouTube (tuỳ chọn)' : 'YouTube Video (optional)'}</p>
                </div>
                <input type="url" value={editForm.youtubeUrl}
                  onChange={e => setEditForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-red-100 rounded-xl focus:ring-2 focus:ring-red-200 focus:outline-none text-sm"
                  placeholder="https://www.youtube.com/watch?v=..." />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Hình ảnh Tour (có thể tải nhiều ảnh)' : 'Tour Images (multiple allowed)'}</label>
              {/* Existing images grid */}
              {editForm.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {editForm.images.map((url, idx) => (
                    <div key={idx} className="relative h-24 rounded-2xl overflow-hidden group">
                      <img src={url} alt={`Tour ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        onClick={() => setEditForm(prev => {
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
              {/* Upload area */}
              <div className="relative h-36 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center overflow-hidden">
                {editUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-daiichi-red" size={28} />
                    <p className="text-sm font-bold text-gray-500">{language === 'vi' ? 'Đang tải & nén...' : 'Compressing & uploading...'}</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-400 mx-auto mb-2">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{language === 'vi' ? 'Thêm ảnh (sẽ nén trước khi tải lên)' : 'Add images (compressed before upload)'}</p>
                    <input type="file" accept="image/*" multiple onChange={e => handleImageUpload(e, true)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <button className="px-5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                      {language === 'vi' ? 'Chọn ảnh' : 'Select Images'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button onClick={() => setEditingTour(null)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button onClick={handleUpdateTour} disabled={!editForm.title || editForm.images.length === 0 || editUploading || saving}
              className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {language === 'vi' ? 'Cập nhật Tour' : 'Update Tour'}
            </button>
          </div>
        </div>
      )}

      {filteredTours.length === 0 && tours.length > 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{language === 'vi' ? 'Không tìm thấy tour phù hợp' : 'No tours match your search'}</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTours.map(tour => {
          const allImages = tour.images && tour.images.length > 0 ? tour.images : (tour.imageUrl ? [tour.imageUrl] : []);
          const effectivePrice = tour.priceAdult || tour.price;
          const discountedPrice = tour.discountPercent && tour.discountPercent > 0
            ? Math.round(effectivePrice * (1 - tour.discountPercent / 100))
            : null;
          return (
            <TourCard
              key={tour.id}
              tour={tour}
              allImages={allImages}
              effectivePrice={effectivePrice}
              discountedPrice={discountedPrice}
              language={language}
              onEdit={handleStartEdit}
              onDelete={handleDeleteTour}
            />
          );
        })}
      </div>
      )}
    </div>
  );
};
