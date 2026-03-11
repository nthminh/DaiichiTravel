import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Image as ImageIcon, Loader2, Edit3, X } from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Language, TRANSLATIONS } from '../App';
import { transportService } from '../services/transportService';

interface Tour {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  discountPercent?: number;
}

interface TourManagementProps {
  language: Language;
}

const emptyForm = { title: '', description: '', price: 0, imageUrl: '', discountPercent: 0 };

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

  useEffect(() => {
    const unsubscribe = transportService.subscribeToTours(setTours);
    return unsubscribe;
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file || !storage) {
      if (!storage) alert('Firebase Storage is not configured. Please check your environment variables.');
      return;
    }

    if (isEdit) setEditUploading(true);
    else setUploading(true);

    const storageRef = ref(storage, `tours/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (!isEdit) setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload failed:", error);
        if (isEdit) setEditUploading(false);
        else setUploading(false);
        alert('Upload failed. Please check your Firebase configuration.');
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          if (isEdit) {
            setEditForm(prev => ({ ...prev, imageUrl: downloadURL }));
            setEditUploading(false);
          } else {
            setNewTour(prev => ({ ...prev, imageUrl: downloadURL }));
            setUploading(false);
            setUploadProgress(0);
          }
        });
      }
    );
  };

  const handleAddTour = async () => {
    if (!newTour.title || !newTour.imageUrl) return;
    setSaving(true);
    try {
      await transportService.addTour({
        title: newTour.title,
        description: newTour.description,
        price: newTour.price,
        imageUrl: newTour.imageUrl,
        discountPercent: newTour.discountPercent || 0,
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
      discountPercent: tour.discountPercent || 0,
    });
    setIsAdding(false);
  };

  const handleUpdateTour = async () => {
    if (!editingTour || !editForm.title || !editForm.imageUrl) return;
    setSaving(true);
    try {
      await transportService.updateTour(editingTour.id, {
        title: editForm.title,
        description: editForm.description,
        price: editForm.price,
        imageUrl: editForm.imageUrl,
        discountPercent: editForm.discountPercent || 0,
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{language === 'vi' ? 'Quản lý Tour' : 'Tour Management'}</h2>
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Thiết kế và đăng tải các tour du lịch mới' : 'Design and publish new tours'}</p>
        </div>
        <button 
          onClick={() => { setIsAdding(true); setEditingTour(null); }}
          className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 flex items-center gap-2"
        >
          <Plus size={20} />
          {language === 'vi' ? 'Thêm Tour mới' : 'Add New Tour'}
        </button>
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
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên Tour' : 'Tour Title'}</label>
                <input 
                  type="text" 
                  value={newTour.title}
                  onChange={e => setNewTour(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                  placeholder={language === 'vi' ? 'Ví dụ: Tour Cát Bà 2 ngày 1 đêm' : 'e.g. Cat Ba 2D1N Tour'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá (VNĐ)' : 'Price (VND)'}</label>
                  <input 
                    type="number" 
                    value={newTour.price}
                    onChange={e => setNewTour(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giảm giá (%)' : 'Discount (%)'}</label>
                  <input 
                    type="number" 
                    min="0" max="100"
                    value={newTour.discountPercent}
                    onChange={e => setNewTour(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mô tả' : 'Description'}</label>
                <textarea 
                  value={newTour.description}
                  onChange={e => setNewTour(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none h-32"
                />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Hình ảnh Tour' : 'Tour Image'}</label>
              <div className="relative h-64 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center overflow-hidden">
                {newTour.imageUrl ? (
                  <>
                    <img src={newTour.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => setNewTour(prev => ({ ...prev, imageUrl: '' }))}
                      className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-xl text-red-500 hover:bg-white transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-6">
                    {uploading ? (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-daiichi-red" size={32} />
                        <p className="text-sm font-bold text-gray-500">{Math.round(uploadProgress)}%</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-400 mx-auto mb-4">
                          <ImageIcon size={32} />
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{language === 'vi' ? 'Kéo thả hoặc chọn ảnh để tải lên' : 'Drag & drop or click to upload'}</p>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => handleImageUpload(e, false)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <button className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                          {language === 'vi' ? 'Chọn ảnh' : 'Select Image'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button 
              onClick={handleAddTour}
              disabled={!newTour.title || !newTour.imageUrl || uploading || saving}
              className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
            >
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
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên Tour' : 'Tour Title'}</label>
                <input 
                  type="text" 
                  value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá (VNĐ)' : 'Price (VND)'}</label>
                  <input 
                    type="number" 
                    value={editForm.price}
                    onChange={e => setEditForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giảm giá (%)' : 'Discount (%)'}</label>
                  <input 
                    type="number" 
                    min="0" max="100"
                    value={editForm.discountPercent}
                    onChange={e => setEditForm(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mô tả' : 'Description'}</label>
                <textarea 
                  value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none h-32"
                />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Hình ảnh Tour' : 'Tour Image'}</label>
              <div className="relative h-64 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center overflow-hidden">
                {editForm.imageUrl ? (
                  <>
                    <img src={editForm.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <label className="cursor-pointer p-2 bg-white/80 backdrop-blur-sm rounded-xl text-blue-500 hover:bg-white transition-all">
                        <ImageIcon size={18} />
                        <input type="file" accept="image/*" onChange={e => handleImageUpload(e, true)} className="hidden" />
                      </label>
                      <button 
                        onClick={() => setEditForm(prev => ({ ...prev, imageUrl: '' }))}
                        className="p-2 bg-white/80 backdrop-blur-sm rounded-xl text-red-500 hover:bg-white transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    {editUploading ? (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-daiichi-red" size={32} />
                        <p className="text-sm font-bold text-gray-500">{language === 'vi' ? 'Đang tải...' : 'Uploading...'}</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-400 mx-auto mb-4">
                          <ImageIcon size={32} />
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{language === 'vi' ? 'Kéo thả hoặc chọn ảnh để tải lên' : 'Drag & drop or click to upload'}</p>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => handleImageUpload(e, true)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <button className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                          {language === 'vi' ? 'Chọn ảnh' : 'Select Image'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button 
              onClick={() => setEditingTour(null)}
              className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button 
              onClick={handleUpdateTour}
              disabled={!editForm.title || !editForm.imageUrl || editUploading || saving}
              className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {language === 'vi' ? 'Cập nhật Tour' : 'Update Tour'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tours.map(tour => {
          const discountedPrice = tour.discountPercent && tour.discountPercent > 0
            ? Math.round(tour.price * (1 - tour.discountPercent / 100))
            : null;
          return (
            <div key={tour.id} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="relative h-48 overflow-hidden">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                {tour.discountPercent && tour.discountPercent > 0 ? (
                  <div className="absolute top-4 left-4 bg-daiichi-red text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    -{tour.discountPercent}%
                  </div>
                ) : null}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => handleStartEdit(tour)}
                    className="p-2 bg-white/80 backdrop-blur-sm rounded-xl text-blue-500 hover:bg-white transition-all shadow-sm"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteTour(tour.id)}
                    className="p-2 bg-white/80 backdrop-blur-sm rounded-xl text-red-500 hover:bg-white transition-all shadow-sm"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <h4 className="text-lg font-bold mb-2">{tour.title}</h4>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{tour.description}</p>
                <div className="flex justify-between items-end">
                  <div>
                    {discountedPrice ? (
                      <>
                        <p className="text-xl font-bold text-daiichi-red">{discountedPrice.toLocaleString()}đ</p>
                        <p className="text-xs text-gray-400 line-through">{tour.price.toLocaleString()}đ</p>
                      </>
                    ) : (
                      <p className="text-xl font-bold text-daiichi-red">{tour.price.toLocaleString()}đ</p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">Active</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
