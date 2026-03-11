import React, { useState } from 'react';
import { Plus, Trash2, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Language, TRANSLATIONS } from '../App';

interface Tour {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
}

interface TourManagementProps {
  language: Language;
}

export const TourManagement: React.FC<TourManagementProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const [tours, setTours] = useState<Tour[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTour, setNewTour] = useState({ title: '', description: '', price: 0, imageUrl: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage) {
      if (!storage) alert('Firebase Storage is not configured. Please check your environment variables.');
      return;
    }

    setUploading(true);
    const storageRef = ref(storage, `tours/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload failed:", error);
        setUploading(false);
        alert('Upload failed. Please check your Firebase configuration.');
      }, 
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setNewTour(prev => ({ ...prev, imageUrl: downloadURL }));
          setUploading(false);
          setUploadProgress(0);
        });
      }
    );
  };

  const handleAddTour = () => {
    if (!newTour.title || !newTour.imageUrl) return;
    const tour: Tour = {
      ...newTour,
      id: Date.now().toString()
    };
    setTours(prev => [...prev, tour]);
    setNewTour({ title: '', description: '', price: 0, imageUrl: '' });
    setIsAdding(false);
  };

  const handleDeleteTour = (id: string) => {
    setTours(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{language === 'vi' ? 'Quản lý Tour' : 'Tour Management'}</h2>
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Thiết kế và đăng tải các tour du lịch mới' : 'Design and publish new tours'}</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 flex items-center gap-2"
        >
          <Plus size={20} />
          {language === 'vi' ? 'Thêm Tour mới' : 'Add New Tour'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-xl font-bold">{language === 'vi' ? 'Thông tin Tour mới' : 'New Tour Details'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên Tour' : 'Tour Title'}</label>
                <input 
                  type="text" 
                  value={newTour.title}
                  onChange={e => setNewTour(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10"
                  placeholder={language === 'vi' ? 'Ví dụ: Tour Cát Bà 2 ngày 1 đêm' : 'e.g. Cat Ba 2D1N Tour'}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá (VNĐ)' : 'Price (VND)'}</label>
                <input 
                  type="number" 
                  value={newTour.price}
                  onChange={e => setNewTour(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mô tả' : 'Description'}</label>
                <textarea 
                  value={newTour.description}
                  onChange={e => setNewTour(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 h-32"
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
                          onChange={handleImageUpload}
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
              disabled={!newTour.title || !newTour.imageUrl || uploading}
              className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {language === 'vi' ? 'Lưu Tour' : 'Save Tour'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tours.map(tour => (
          <div key={tour.id} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <div className="relative h-48 overflow-hidden">
              <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              <div className="absolute top-4 right-4 flex gap-2">
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
              <div className="flex justify-between items-center">
                <p className="text-xl font-bold text-daiichi-red">{tour.price.toLocaleString()}đ</p>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">Active</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
