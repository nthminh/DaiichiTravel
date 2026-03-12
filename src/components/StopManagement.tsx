import React, { useState } from 'react';
import { Plus, Trash2, Edit3, MapPin, Search, Save, X } from 'lucide-react';
import { Language, TRANSLATIONS } from '../constants/translations';
import { Stop } from '../types';
import { transportService } from '../services/transportService';

interface StopManagementProps {
  language: Language;
  stops: Stop[];
  onUpdateStops: (stops: Stop[]) => void;
}

export const StopManagement: React.FC<StopManagementProps> = ({ language, stops, onUpdateStops }) => {
  const t = TRANSLATIONS[language];
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<Omit<Stop, 'id'>>({
    name: '',
    address: '',
    category: 'MAJOR',
    surcharge: 0
  });

  const handleAddStop = async () => {
    if (!formData.name || !formData.address) return;
    try {
      await transportService.addStop(formData);
    } catch {
      // Fallback to local state if Firebase is unavailable
      const newStop: Stop = { ...formData, id: Date.now().toString() };
      onUpdateStops([newStop, ...stops]);
    }
    resetForm();
  };

  const handleUpdateStop = async () => {
    if (!editingId || !formData.name || !formData.address) return;
    try {
      await transportService.updateStop(editingId, formData);
    } catch {
      // Fallback to local state if Firebase is unavailable
      onUpdateStops(stops.map(s => s.id === editingId ? { ...formData, id: editingId } : s));
    }
    resetForm();
  };

  const handleDeleteStop = async (id: string) => {
    if (confirm(language === 'vi' ? 'Bạn có chắc chắn muốn xóa điểm dừng này?' : 'Are you sure you want to delete this stop?')) {
      try {
        await transportService.deleteStop(id);
      } catch {
        // Fallback to local state if Firebase is unavailable
        onUpdateStops(stops.filter(s => s.id !== id));
      }
    }
  };

  const startEdit = (stop: Stop) => {
    setEditingId(stop.id);
    setFormData({
      name: stop.name,
      address: stop.address,
      category: stop.category,
      surcharge: stop.surcharge
    });
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', category: 'MAJOR', surcharge: 0 });
    setIsAdding(false);
    setEditingId(null);
  };

  const filteredStops = stops.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t.stop_management}</h2>
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Quản lý các điểm đón và trả khách trên toàn hệ thống' : 'Manage pickup and dropoff points across the system'}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 flex items-center gap-2 hover:scale-105 transition-all"
          >
            <Plus size={20} />
            {t.add_stop}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">{editingId ? (language === 'vi' ? 'Chỉnh sửa điểm dừng' : 'Edit Stop') : t.add_stop}</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.stop_name}</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder={language === 'vi' ? 'Ví dụ: Văn phòng Hà Nội' : 'e.g. Hanoi Office'}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.stop_address}</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder={language === 'vi' ? 'Địa chỉ chi tiết...' : 'Detailed address...'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Loại điểm' : 'Stop Category'}</label>
              <select 
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
              >
                <option value="MAJOR">{t.major_stop}</option>
                <option value="MINOR">{t.minor_stop}</option>
                <option value="TOLL">{t.toll_booth}</option>
                <option value="RESTAURANT">{t.restaurant}</option>
                <option value="QUICK">{t.quick_stop}</option>
                <option value="TRANSIT">{t.transit_point}</option>
                <option value="OFFICE">{t.ticket_office}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.surcharge} (đ)</label>
              <input 
                type="number" 
                value={formData.surcharge}
                onChange={e => setFormData(prev => ({ ...prev, surcharge: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button 
              onClick={resetForm}
              className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600"
            >
              {t.cancel}
            </button>
            <button 
              onClick={editingId ? handleUpdateStop : handleAddStop}
              disabled={!formData.name || !formData.address}
              className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
            >
              <Save size={18} />
              {editingId ? t.update : t.save}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder={language === 'vi' ? 'Tìm kiếm điểm dừng...' : 'Search stops...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <span className="px-4 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 border border-gray-100">
              {filteredStops.length} {language === 'vi' ? 'điểm dừng' : 'stops'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.stop_name}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Loại điểm' : 'Category'}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.stop_address}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.surcharge}</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStops.map((stop) => (
                <tr key={stop.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-daiichi-accent/20 rounded-xl flex items-center justify-center text-daiichi-red">
                        <MapPin size={20} />
                      </div>
                      <span className="font-bold text-gray-800">{stop.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                      {stop.category === 'MAJOR' ? t.major_stop : 
                       stop.category === 'MINOR' ? t.minor_stop : 
                       stop.category === 'TOLL' ? t.toll_booth : 
                       stop.category === 'RESTAURANT' ? t.restaurant : 
                       stop.category === 'QUICK' ? t.quick_stop : 
                       stop.category === 'TRANSIT' ? t.transit_point : 
                       t.ticket_office}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-500">{stop.address}</td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-bold text-daiichi-red">
                      {stop.surcharge > 0 ? `+${stop.surcharge.toLocaleString()}đ` : '0đ'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEdit(stop)}
                        className="p-2 text-gray-400 hover:text-daiichi-red hover:bg-daiichi-red/5 rounded-lg transition-all"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteStop(stop.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStops.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-gray-400">
                    {language === 'vi' ? 'Không tìm thấy điểm dừng nào' : 'No stops found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
