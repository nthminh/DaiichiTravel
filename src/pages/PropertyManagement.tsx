import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Image as ImageIcon, Loader2, Edit3, X,
  Search, ChevronDown, ChevronRight, Building2, Ship, Home,
  Clock, Users, Grid3X3, Calendar, MapPin,
  BedDouble
} from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Language } from '../App';
import { User, Property, PropertyRoomType, PropertyRoomSurcharge } from '../types';
import { transportService } from '../services/transportService';
import { compressImage } from '../lib/imageUtils';

interface PropertyManagementProps {
  language: Language;
  currentUser?: User | null;
}

// ─── empty helpers ────────────────────────────────────────────────────────────

const emptyPropertyForm = (): Omit<Property, 'id' | 'createdAt'> => ({
  name: '',
  ownerId: '',
  country: 'Việt Nam',
  type: 'cruise',
  address: '',
  description: '',
  images: [],
});

const emptyRoomTypeForm = (): Omit<PropertyRoomType, 'id'> => ({
  name: '',
  capacityAdults: 2,
  capacityChildren: 1,
  areaSqm: 20,
  basePrice: 0,
  surcharges: [],
  checkinTime: '14:00',
  checkoutTime: '12:00',
  amenities: [],
  images: [],
  totalUnits: 1,
});

const emptySurcharge = (): PropertyRoomSurcharge => ({
  id: crypto.randomUUID(),
  label: '',
  startDate: '',
  endDate: '',
  amount: 0,
  note: '',
});

// Preset amenity suggestions
const AMENITY_PRESETS = [
  'Điều hòa', 'Wifi', 'Bồn tắm', 'Ban công', 'View biển',
  'Tivi', 'Tủ lạnh', 'Két an toàn', 'Minibar', 'Bàn làm việc',
  'Máy sấy tóc', 'Khăn tắm', 'Dép đi trong phòng', 'Đồ dùng vệ sinh',
  'Ấm đun nước', 'Máy pha cà phê', 'Phòng tắm đứng', 'Bồn tắm Jacuzzi',
];

const PROPERTY_TYPES = [
  { value: 'cruise', label: { vi: 'Du thuyền', en: 'Cruise', ja: 'クルーズ' } },
  { value: 'homestay', label: { vi: 'Homestay', en: 'Homestay', ja: 'ホームステイ' } },
  { value: 'resort', label: { vi: 'Resort', en: 'Resort', ja: 'リゾート' } },
] as const;

const COUNTRY_OPTIONS = [
  'Việt Nam', 'Úc', 'Nhật Bản', 'Hàn Quốc', 'Thái Lan', 'Singapore',
  'Mỹ', 'Pháp', 'Ý', 'Tây Ban Nha', 'Khác'
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const PropertyManagement: React.FC<PropertyManagementProps> = ({ language }) => {
  const t = {
    title: language === 'vi' ? 'Quản lý tài sản' : language === 'ja' ? '資産管理' : 'Property Management',
    addProperty: language === 'vi' ? 'Thêm tài sản' : 'Add Property',
    search: language === 'vi' ? 'Tìm kiếm...' : 'Search...',
    name: language === 'vi' ? 'Tên tài sản' : 'Property Name',
    owner: language === 'vi' ? 'Chủ sở hữu (ID)' : 'Owner ID',
    country: language === 'vi' ? 'Quốc gia' : 'Country',
    type: language === 'vi' ? 'Loại tài sản' : 'Type',
    address: language === 'vi' ? 'Địa chỉ' : 'Address',
    description: language === 'vi' ? 'Mô tả' : 'Description',
    images: language === 'vi' ? 'Hình ảnh' : 'Images',
    save: language === 'vi' ? 'Lưu' : 'Save',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    update: language === 'vi' ? 'Cập nhật' : 'Update',
    delete: language === 'vi' ? 'Xóa' : 'Delete',
    edit: language === 'vi' ? 'Sửa' : 'Edit',
    confirmDelete: language === 'vi' ? 'Xác nhận xóa?' : 'Confirm delete?',
    roomTypes: language === 'vi' ? 'Loại phòng' : 'Room Types',
    addRoomType: language === 'vi' ? 'Thêm loại phòng' : 'Add Room Type',
    noProperties: language === 'vi' ? 'Chưa có tài sản nào.' : 'No properties yet.',
    noRoomTypes: language === 'vi' ? 'Chưa có loại phòng nào.' : 'No room types yet.',
    amenities: language === 'vi' ? 'Tiện nghi' : 'Amenities',
    surcharges: language === 'vi' ? 'Phụ thu theo thời gian' : 'Time-period Surcharges',
    checkin: language === 'vi' ? 'Giờ check-in' : 'Check-in time',
    checkout: language === 'vi' ? 'Giờ check-out' : 'Check-out time',
    basePrice: language === 'vi' ? 'Giá cơ bản (đ/đêm)' : 'Base price (VND/night)',
    capacity: language === 'vi' ? 'Sức chứa' : 'Capacity',
    adults: language === 'vi' ? 'Người lớn' : 'Adults',
    children: language === 'vi' ? 'Trẻ em' : 'Children',
    area: language === 'vi' ? 'Diện tích (m²)' : 'Area (m²)',
    totalUnits: language === 'vi' ? 'Số lượng phòng' : 'Total units',
    surchargeLabel: language === 'vi' ? 'Tên phụ thu' : 'Label',
    surchargeAmount: language === 'vi' ? 'Phụ thu (đ)' : 'Surcharge (VND)',
    surchargeFrom: language === 'vi' ? 'Từ ngày' : 'From',
    surchargeTo: language === 'vi' ? 'Đến ngày' : 'To',
    addSurcharge: language === 'vi' ? 'Thêm phụ thu' : 'Add surcharge',
    manageRoomTypes: language === 'vi' ? 'Quản lý loại phòng' : 'Manage Room Types',
    viewRoomTypes: language === 'vi' ? 'Xem loại phòng' : 'View room types',
    saving: language === 'vi' ? 'Đang lưu...' : 'Saving...',
    loading: language === 'vi' ? 'Đang tải...' : 'Loading...',
  };

  // ── state ──────────────────────────────────────────────────────────────────
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'' | 'cruise' | 'homestay' | 'resort'>('');

  // Add-new form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyPropertyForm());
  const [addSaving, setAddSaving] = useState(false);
  const [uploadingAddImages, setUploadingAddImages] = useState(false);

  // Expanded row edit
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, Omit<Property, 'id' | 'createdAt'>>>({});
  const [editSaving, setEditSaving] = useState<Record<string, boolean>>({});
  const [uploadingEditImages, setUploadingEditImages] = useState<Record<string, boolean>>({});

  // Room types panel
  const [roomTypesPanelId, setRoomTypesPanelId] = useState<string | null>(null);
  const [roomTypesByProperty, setRoomTypesByProperty] = useState<Record<string, PropertyRoomType[]>>({});
  // Use a ref to track active subscriptions (avoids stale closure issues in effects)
  const roomTypeUnsubsRef = useRef<Record<string, () => void>>({});

  // Add room type form
  const [showAddRoomTypeForm, setShowAddRoomTypeForm] = useState<string | null>(null);
  const [addRoomTypeForm, setAddRoomTypeForm] = useState(emptyRoomTypeForm());
  const [addRoomTypeSaving, setAddRoomTypeSaving] = useState(false);
  const [uploadingRoomTypeImages, setUploadingRoomTypeImages] = useState(false);

  // Edit room type
  const [editRoomTypeForms, setEditRoomTypeForms] = useState<Record<string, Omit<PropertyRoomType, 'id'>>>({});
  const [editRoomTypeSaving, setEditRoomTypeSaving] = useState<Record<string, boolean>>({});
  const [uploadingEditRoomTypeImages, setUploadingEditRoomTypeImages] = useState<Record<string, boolean>>({});

  // Error feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── subscribe to properties ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = transportService.subscribeToProperties((data) => {
      setProperties(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── subscribe to room types when panel opens ───────────────────────────────
  useEffect(() => {
    if (!roomTypesPanelId) return;
    if (roomTypeUnsubsRef.current[roomTypesPanelId]) return; // already subscribed
    const id = roomTypesPanelId;
    const unsub = transportService.subscribeToPropertyRoomTypes(id, (rts) => {
      setRoomTypesByProperty(prev => ({ ...prev, [id]: rts }));
    });
    roomTypeUnsubsRef.current[id] = unsub;
  }, [roomTypesPanelId]);

  // ── cleanup all subscriptions on unmount ──────────────────────────────────
  useEffect(() => {
    const unsubsRef = roomTypeUnsubsRef;
    return () => { Object.values(unsubsRef.current).forEach(fn => fn()); };
  }, []);

  // ── image upload helpers ───────────────────────────────────────────────────
  const uploadImages = useCallback(async (files: FileList, pathPrefix: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file, 0.75, 1280);
      const storageRef = ref(storage!, `${pathPrefix}/${Date.now()}_${compressed.name}`);
      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, compressed);
        task.on('state_changed', null, reject, async () => {
          const url = await getDownloadURL(storageRef);
          urls.push(url);
          resolve();
        });
      });
    }
    return urls;
  }, []);

  const handleAddPropertyImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !storage) return;
    setUploadingAddImages(true);
    try {
      const urls = await uploadImages(e.target.files, 'properties');
      setAddForm(prev => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch (err) {
      console.error('[PropertyManagement] add property image upload failed:', err);
      setErrorMsg(language === 'vi' ? 'Tải ảnh thất bại. Vui lòng thử lại.' : 'Image upload failed. Please try again.');
    } finally { setUploadingAddImages(false); e.target.value = ''; }
  };

  const handleEditPropertyImages = async (e: React.ChangeEvent<HTMLInputElement>, propId: string) => {
    if (!e.target.files?.length || !storage) return;
    setUploadingEditImages(prev => ({ ...prev, [propId]: true }));
    try {
      const urls = await uploadImages(e.target.files, 'properties');
      setEditForms(prev => ({ ...prev, [propId]: { ...prev[propId], images: [...(prev[propId].images ?? []), ...urls] } }));
    } catch (err) {
      console.error('[PropertyManagement] edit property image upload failed:', err);
      setErrorMsg(language === 'vi' ? 'Tải ảnh thất bại. Vui lòng thử lại.' : 'Image upload failed. Please try again.');
    } finally { setUploadingEditImages(prev => ({ ...prev, [propId]: false })); e.target.value = ''; }
  };

  const handleAddRoomTypeImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !storage) return;
    setUploadingRoomTypeImages(true);
    try {
      const urls = await uploadImages(e.target.files, 'room_types');
      setAddRoomTypeForm(prev => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch (err) {
      console.error('[PropertyManagement] add room type image upload failed:', err);
      setErrorMsg(language === 'vi' ? 'Tải ảnh thất bại. Vui lòng thử lại.' : 'Image upload failed. Please try again.');
    } finally { setUploadingRoomTypeImages(false); e.target.value = ''; }
  };

  const handleEditRoomTypeImages = async (e: React.ChangeEvent<HTMLInputElement>, rtId: string) => {
    if (!e.target.files?.length || !storage) return;
    setUploadingEditRoomTypeImages(prev => ({ ...prev, [rtId]: true }));
    try {
      const urls = await uploadImages(e.target.files, 'room_types');
      setEditRoomTypeForms(prev => ({ ...prev, [rtId]: { ...prev[rtId], images: [...(prev[rtId].images ?? []), ...urls] } }));
    } catch (err) {
      console.error('[PropertyManagement] edit room type image upload failed:', err);
      setErrorMsg(language === 'vi' ? 'Tải ảnh thất bại. Vui lòng thử lại.' : 'Image upload failed. Please try again.');
    } finally { setUploadingEditRoomTypeImages(prev => ({ ...prev, [rtId]: false })); e.target.value = ''; }
  };

  // ── property CRUD ──────────────────────────────────────────────────────────
  const handleAddProperty = async () => {
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    try {
      await transportService.addProperty(addForm);
      setAddForm(emptyPropertyForm());
      setShowAddForm(false);
    } catch (err) {
      console.error('[PropertyManagement] add property failed:', err);
      setErrorMsg(language === 'vi' ? 'Lưu thất bại. Vui lòng thử lại.' : 'Save failed. Please try again.');
    } finally { setAddSaving(false); }
  };

  const handleEditProperty = async (propId: string) => {
    if (!editForms[propId]) return;
    setEditSaving(prev => ({ ...prev, [propId]: true }));
    try {
      await transportService.updateProperty(propId, editForms[propId]);
      setExpandedPropertyId(null);
    } catch (err) {
      console.error('[PropertyManagement] update property failed:', err);
      setErrorMsg(language === 'vi' ? 'Cập nhật thất bại. Vui lòng thử lại.' : 'Update failed. Please try again.');
    } finally { setEditSaving(prev => ({ ...prev, [propId]: false })); }
  };

  const handleDeleteProperty = async (propId: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    await transportService.deleteProperty(propId);
    if (expandedPropertyId === propId) setExpandedPropertyId(null);
    if (roomTypesPanelId === propId) setRoomTypesPanelId(null);
  };

  const openEditForm = (prop: Property) => {
    const { id: _id, createdAt: _ca, ...rest } = prop;
    setEditForms(prev => ({ ...prev, [prop.id]: rest }));
    setExpandedPropertyId(prop.id);
    setRoomTypesPanelId(null);
  };

  // ── room type CRUD ─────────────────────────────────────────────────────────
  const handleAddRoomType = async (propertyId: string) => {
    if (!addRoomTypeForm.name.trim()) return;
    setAddRoomTypeSaving(true);
    try {
      await transportService.addPropertyRoomType(propertyId, addRoomTypeForm);
      setAddRoomTypeForm(emptyRoomTypeForm());
      setShowAddRoomTypeForm(null);
    } catch (err) {
      console.error('[PropertyManagement] add room type failed:', err);
      setErrorMsg(language === 'vi' ? 'Lưu thất bại. Vui lòng thử lại.' : 'Save failed. Please try again.');
    } finally { setAddRoomTypeSaving(false); }
  };

  const openEditRoomType = (rt: PropertyRoomType) => {
    const { id: _id, ...rest } = rt;
    setEditRoomTypeForms(prev => ({ ...prev, [rt.id]: rest }));
  };

  const handleEditRoomType = async (propertyId: string, rtId: string) => {
    if (!editRoomTypeForms[rtId]) return;
    setEditRoomTypeSaving(prev => ({ ...prev, [rtId]: true }));
    try {
      await transportService.updatePropertyRoomType(propertyId, rtId, editRoomTypeForms[rtId]);
      setEditRoomTypeForms(prev => { const next = { ...prev }; delete next[rtId]; return next; });
    } catch (err) {
      console.error('[PropertyManagement] update room type failed:', err);
      setErrorMsg(language === 'vi' ? 'Cập nhật thất bại. Vui lòng thử lại.' : 'Update failed. Please try again.');
    } finally { setEditRoomTypeSaving(prev => ({ ...prev, [rtId]: false })); }
  };

  const handleDeleteRoomType = async (propertyId: string, rtId: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    await transportService.deletePropertyRoomType(propertyId, rtId);
  };

  // ── filter / search ────────────────────────────────────────────────────────
  const filtered = properties.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.country.toLowerCase().includes(q);
    const matchesType = !filterType || p.type === filterType;
    return matchesSearch && matchesType;
  });

  // ── helpers ────────────────────────────────────────────────────────────────
  const typeIcon = (type: Property['type']) => {
    if (type === 'cruise') return <Ship size={14} className="text-blue-500" />;
    if (type === 'resort') return <Building2 size={14} className="text-green-500" />;
    return <Home size={14} className="text-orange-500" />;
  };

  const typeLabel = (type: Property['type']) =>
    PROPERTY_TYPES.find(t => t.value === type)?.label[language as 'vi' | 'en' | 'ja'] ?? type;

  // ─── Amenity toggle helper ─────────────────────────────────────────────────
  const toggleAmenity = (
    amenity: string,
    current: string[],
    setter: (fn: (prev: string[]) => string[]) => void
  ) => {
    setter(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  // ── Render room type form ──────────────────────────────────────────────────
  const renderRoomTypeForm = (
    form: Omit<PropertyRoomType, 'id'>,
    setForm: React.Dispatch<React.SetStateAction<Omit<PropertyRoomType, 'id'>>>,
    onSave: () => void,
    onCancel: () => void,
    saving: boolean,
    uploadingImages: boolean,
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    isEdit = false
  ) => (
    <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {language === 'vi' ? 'Tên loại phòng' : 'Room Type Name'}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
            placeholder={language === 'vi' ? 'VD: Phòng Suite VIP, Cabin Double Ocean View' : 'e.g. Suite VIP, Double Ocean View Cabin'}
          />
        </div>

        {/* Capacity adults */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.adults}
          </label>
          <input
            type="number" min="1" value={form.capacityAdults}
            onChange={e => setForm(prev => ({ ...prev, capacityAdults: parseInt(e.target.value) || 1 }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>

        {/* Capacity children */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.children}
          </label>
          <input
            type="number" min="0" value={form.capacityChildren}
            onChange={e => setForm(prev => ({ ...prev, capacityChildren: parseInt(e.target.value) || 0 }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>

        {/* Area */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.area}
          </label>
          <input
            type="number" min="1" value={form.areaSqm}
            onChange={e => setForm(prev => ({ ...prev, areaSqm: parseFloat(e.target.value) || 1 }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>

        {/* Total units */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.totalUnits}
          </label>
          <input
            type="number" min="1" value={form.totalUnits}
            onChange={e => setForm(prev => ({ ...prev, totalUnits: parseInt(e.target.value) || 1 }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>

        {/* Base price */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.basePrice}
          </label>
          <input
            type="number" min="0" value={form.basePrice}
            onChange={e => setForm(prev => ({ ...prev, basePrice: parseInt(e.target.value) || 0 }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>

        {/* Check-in time */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.checkin}
          </label>
          <input
            type="time" value={form.checkinTime}
            onChange={e => setForm(prev => ({ ...prev, checkinTime: e.target.value }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>

        {/* Check-out time */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.checkout}
          </label>
          <input
            type="time" value={form.checkoutTime}
            onChange={e => setForm(prev => ({ ...prev, checkoutTime: e.target.value }))}
            className="w-full mt-1 px-3 py-2 bg-white border border-teal-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
          />
        </div>
      </div>

      {/* Amenities */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-2">
          {t.amenities}
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {AMENITY_PRESETS.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAmenity(a, form.amenities, (fn) => setForm(prev => ({ ...prev, amenities: fn(prev.amenities) })))}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                form.amenities.includes(a)
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        {/* Custom amenity input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tiện nghi khác...' : 'Other amenity...'}
            className="flex-1 px-3 py-1.5 bg-white border border-teal-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                const val = e.currentTarget.value.trim();
                if (!form.amenities.includes(val)) {
                  setForm(prev => ({ ...prev, amenities: [...prev.amenities, val] }));
                }
                e.currentTarget.value = '';
                e.preventDefault();
              }
            }}
          />
        </div>
        {/* Selected custom amenities (non-preset) */}
        {form.amenities.filter(a => !AMENITY_PRESETS.includes(a)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.amenities.filter(a => !AMENITY_PRESETS.includes(a)).map(a => (
              <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white rounded-lg text-xs font-medium">
                {a}
                <button type="button" onClick={() => setForm(prev => ({ ...prev, amenities: prev.amenities.filter(x => x !== a) }))}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Time-period Surcharges */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            {t.surcharges}
          </label>
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, surcharges: [...prev.surcharges, emptySurcharge()] }))}
            className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus size={11} />
            {t.addSurcharge}
          </button>
        </div>
        {form.surcharges.length === 0 ? (
          <p className="text-xs text-teal-500 text-center py-2">
            {language === 'vi' ? 'Chưa có phụ thu nào.' : 'No surcharges set.'}
          </p>
        ) : (
          <div className="space-y-2">
            {form.surcharges.map((s, si) => (
              <div key={s.id} className="bg-white rounded-xl border border-teal-100 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text" value={s.label} placeholder={t.surchargeLabel}
                    onChange={e => setForm(prev => ({ ...prev, surcharges: prev.surcharges.map((x, i) => i === si ? { ...x, label: e.target.value } : x) }))}
                    className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" value={s.amount} placeholder={t.surchargeAmount}
                      onChange={e => setForm(prev => ({ ...prev, surcharges: prev.surcharges.map((x, i) => i === si ? { ...x, amount: parseInt(e.target.value) || 0 } : x) }))}
                      className="flex-1 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                    />
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, surcharges: prev.surcharges.filter((_, i) => i !== si) }))} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold ml-1">{t.surchargeFrom}</label>
                    <input
                      type="date" value={s.startDate}
                      onChange={e => setForm(prev => ({ ...prev, surcharges: prev.surcharges.map((x, i) => i === si ? { ...x, startDate: e.target.value } : x) }))}
                      className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold ml-1">{t.surchargeTo}</label>
                    <input
                      type="date" value={s.endDate}
                      onChange={e => setForm(prev => ({ ...prev, surcharges: prev.surcharges.map((x, i) => i === si ? { ...x, endDate: e.target.value } : x) }))}
                      className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                    />
                  </div>
                </div>
                <input
                  type="text" value={s.note ?? ''} placeholder={language === 'vi' ? 'Ghi chú (tùy chọn)' : 'Note (optional)'}
                  onChange={e => setForm(prev => ({ ...prev, surcharges: prev.surcharges.map((x, i) => i === si ? { ...x, note: e.target.value } : x) }))}
                  className="w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Room images */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-2">
          {t.images}
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          {form.images.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden group">
              <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, images: prev.images.filter((_, ii) => ii !== i) }))}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
          <label className={`w-16 h-16 rounded-xl border-2 border-dashed border-teal-200 flex flex-col items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors ${uploadingImages ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploadingImages
              ? <Loader2 size={16} className="text-teal-500 animate-spin" />
              : <><ImageIcon size={16} className="text-teal-400" /><span className="text-[10px] text-teal-400 mt-1">{language === 'vi' ? 'Thêm' : 'Add'}</span></>
            }
            <input type="file" accept="image/*" multiple className="hidden" onChange={onImageUpload} />
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-teal-100">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? t.saving : isEdit ? t.update : t.save}
        </button>
      </div>
    </div>
  );

  // ── Render property form fields (add & edit shared) ────────────────────────
  const renderPropertyFormFields = (
    form: Omit<Property, 'id' | 'createdAt'>,
    setForm: React.Dispatch<React.SetStateAction<Omit<Property, 'id' | 'createdAt'>>>,
    onSave: () => void,
    onCancel: () => void,
    saving: boolean,
    uploadingImages: boolean,
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    isEdit = false
  ) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.name}</label>
          <input
            type="text" value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
            placeholder={language === 'vi' ? 'VD: Du thuyền Daiichi 01' : 'e.g. Daiichi Cruise 01'}
          />
        </div>

        {/* Owner ID */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.owner}</label>
          <input
            type="text" value={form.ownerId}
            onChange={e => setForm(prev => ({ ...prev, ownerId: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
            placeholder="user_123"
          />
        </div>

        {/* Country */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.country}</label>
          <select
            value={form.country}
            onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
          >
            {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.type}</label>
          <div className="flex gap-2 mt-1">
            {PROPERTY_TYPES.map(pt => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: pt.value }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                  form.type === pt.value
                    ? 'bg-daiichi-red text-white border-daiichi-red'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-daiichi-red/40'
                }`}
              >
                {pt.value === 'cruise' && <Ship size={13} />}
                {pt.value === 'resort' && <Building2 size={13} />}
                {pt.value === 'homestay' && <Home size={13} />}
                {pt.label[language as 'vi' | 'en' | 'ja'] ?? pt.label.vi}
              </button>
            ))}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.address}</label>
          <input
            type="text" value={form.address}
            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
            placeholder={language === 'vi' ? 'Địa chỉ chi tiết...' : 'Detailed address...'}
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.description}</label>
          <textarea
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm resize-none"
            placeholder={language === 'vi' ? 'Mô tả chi tiết về tài sản...' : 'Detailed description of the property...'}
          />
        </div>

        {/* Images */}
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 block mb-2">{t.images}</label>
          <div className="flex flex-wrap gap-2 items-center">
            {form.images.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-daiichi-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                    {language === 'vi' ? 'Ảnh chính' : 'Main'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, images: prev.images.filter((_, ii) => ii !== i) }))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            <label className={`w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-daiichi-red/40 hover:bg-red-50 transition-colors ${uploadingImages ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploadingImages
                ? <Loader2 size={18} className="text-daiichi-red animate-spin" />
                : <><ImageIcon size={18} className="text-gray-400" /><span className="text-[10px] text-gray-400 mt-1">{language === 'vi' ? 'Thêm ảnh' : 'Add photo'}</span></>
              }
              <input type="file" accept="image/*" multiple className="hidden" onChange={onImageUpload} />
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-daiichi-red text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? t.saving : isEdit ? t.update : t.save}
        </button>
      </div>
    </div>
  );

  // ── main render ────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="flex-shrink-0 text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
            <Building2 size={24} className="text-daiichi-red" />
            {t.title}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'vi'
              ? `${filtered.length} tài sản · Du thuyền, Resort, Homestay`
              : `${filtered.length} properties · Cruise, Resort, Homestay`}
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setExpandedPropertyId(null); setRoomTypesPanelId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-daiichi-red text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-daiichi-red/30"
        >
          <Plus size={16} />
          {t.addProperty}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.search}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(['', 'cruise', 'homestay', 'resort'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors ${
                filterType === type
                  ? 'bg-daiichi-red text-white border-daiichi-red'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-daiichi-red/40'
              }`}
            >
              {type === '' ? (language === 'vi' ? 'Tất cả' : 'All') : typeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Add property form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <Plus size={16} className="text-daiichi-red" />
            {t.addProperty}
          </h2>
          {renderPropertyFormFields(
            addForm, setAddForm,
            handleAddProperty, () => { setShowAddForm(false); setAddForm(emptyPropertyForm()); },
            addSaving, uploadingAddImages, handleAddPropertyImages
          )}
        </div>
      )}

      {/* Properties list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-semibold">{t.noProperties}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(prop => {
            const isExpanded = expandedPropertyId === prop.id;
            const hasRoomPanel = roomTypesPanelId === prop.id;
            const roomTypes = roomTypesByProperty[prop.id] ?? [];
            const editForm = editForms[prop.id];

            return (
              <div key={prop.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Property row */}
                <div className="flex items-center gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {prop.images?.[0]
                      ? <img src={prop.images[0]} alt={prop.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <div className="w-full h-full flex items-center justify-center">{typeIcon(prop.type)}</div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {typeIcon(prop.type)}
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{typeLabel(prop.type)}</span>
                    </div>
                    <h3 className="font-bold text-gray-800 truncate">{prop.name}</h3>
                    <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                      <MapPin size={11} />
                      {prop.address || prop.country}
                    </p>
                  </div>

                  {/* Room types badge */}
                  <div className="hidden sm:flex flex-col items-center">
                    <span className="text-lg font-extrabold text-gray-700">
                      {roomTypesByProperty[prop.id] !== undefined
                        ? roomTypesByProperty[prop.id].length
                        : roomTypesPanelId === prop.id ? <Loader2 size={14} className="animate-spin" /> : '–'}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">{language === 'vi' ? 'Loại phòng' : 'Room types'}</span>
                  </div>

                  {/* Country */}
                  <div className="hidden md:flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-600">{prop.country}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">{language === 'vi' ? 'Quốc gia' : 'Country'}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (hasRoomPanel) { setRoomTypesPanelId(null); }
                        else { setRoomTypesPanelId(prop.id); setExpandedPropertyId(null); }
                      }}
                      className={`p-2 rounded-xl transition-colors text-xs font-bold flex items-center gap-1 ${hasRoomPanel ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'}`}
                      title={t.manageRoomTypes}
                    >
                      <BedDouble size={15} />
                      <span className="hidden sm:inline">{language === 'vi' ? 'Phòng' : 'Rooms'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (isExpanded) { setExpandedPropertyId(null); }
                        else { openEditForm(prop); }
                      }}
                      className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                      title={t.edit}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteProperty(prop.id)}
                      className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      title={t.delete}
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (hasRoomPanel) { setRoomTypesPanelId(null); }
                        else if (isExpanded) { setExpandedPropertyId(null); }
                        else { openEditForm(prop); }
                      }}
                      className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {(isExpanded || hasRoomPanel) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                  </div>
                </div>

                {/* Edit form */}
                {isExpanded && editForm && (
                  <div className="border-t border-gray-100 p-5">
                    <h3 className="font-bold text-gray-600 mb-4 flex items-center gap-2">
                      <Edit3 size={15} className="text-blue-500" />
                      {language === 'vi' ? `Chỉnh sửa: ${prop.name}` : `Edit: ${prop.name}`}
                    </h3>
                    {renderPropertyFormFields(
                      editForm,
                      (fn) => setEditForms(prev => ({ ...prev, [prop.id]: typeof fn === 'function' ? fn(prev[prop.id]) : fn })),
                      () => handleEditProperty(prop.id),
                      () => setExpandedPropertyId(null),
                      editSaving[prop.id] ?? false,
                      uploadingEditImages[prop.id] ?? false,
                      (e) => handleEditPropertyImages(e, prop.id),
                      true
                    )}
                  </div>
                )}

                {/* Room types panel */}
                {hasRoomPanel && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-600 flex items-center gap-2">
                        <BedDouble size={15} className="text-teal-600" />
                        {t.roomTypes} — <span className="text-teal-600">{prop.name}</span>
                      </h3>
                      <button
                        onClick={() => { setShowAddRoomTypeForm(prop.id); setAddRoomTypeForm(emptyRoomTypeForm()); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors"
                      >
                        <Plus size={13} />
                        {t.addRoomType}
                      </button>
                    </div>

                    {/* Add room type form */}
                    {showAddRoomTypeForm === prop.id && (
                      <div className="mb-4">
                        <h4 className="text-sm font-bold text-teal-700 mb-2">{t.addRoomType}</h4>
                        {renderRoomTypeForm(
                          addRoomTypeForm,
                          setAddRoomTypeForm,
                          () => handleAddRoomType(prop.id),
                          () => setShowAddRoomTypeForm(null),
                          addRoomTypeSaving,
                          uploadingRoomTypeImages,
                          handleAddRoomTypeImages
                        )}
                      </div>
                    )}

                    {/* Room types list */}
                    {roomTypes.length === 0 && showAddRoomTypeForm !== prop.id ? (
                      <div className="text-center py-8 text-gray-400">
                        <BedDouble size={36} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">{t.noRoomTypes}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {roomTypes.map(rt => {
                          const isEditingRt = !!editRoomTypeForms[rt.id];
                          const rtEditForm = editRoomTypeForms[rt.id];

                          return (
                            <div key={rt.id} className="bg-white rounded-2xl border border-teal-100 overflow-hidden">
                              {/* Room type header */}
                              <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-bold text-gray-800">{rt.name}</h4>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                      <span className="flex items-center gap-1"><Users size={11} /> {rt.capacityAdults}+{rt.capacityChildren}</span>
                                      <span className="flex items-center gap-1"><Grid3X3 size={11} /> {rt.areaSqm}m²</span>
                                      <span className="flex items-center gap-1"><BedDouble size={11} /> {rt.totalUnits} {language === 'vi' ? 'phòng' : 'units'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                      <span className="flex items-center gap-1"><Clock size={11} /> {rt.checkinTime} – {rt.checkoutTime}</span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-extrabold text-daiichi-red">{rt.basePrice.toLocaleString()}đ</p>
                                    <p className="text-[10px] text-gray-400">{language === 'vi' ? '/đêm' : '/night'}</p>
                                  </div>
                                </div>

                                {/* Amenities preview */}
                                {rt.amenities.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {rt.amenities.slice(0, 5).map(a => (
                                      <span key={a} className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded-md text-[10px] font-medium">{a}</span>
                                    ))}
                                    {rt.amenities.length > 5 && (
                                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-medium">+{rt.amenities.length - 5}</span>
                                    )}
                                  </div>
                                )}

                                {/* Surcharges preview */}
                                {rt.surcharges.length > 0 && (
                                  <div className="mb-2">
                                    {rt.surcharges.map(s => (
                                      <div key={s.id} className="flex items-center gap-2 text-[10px] text-orange-600 bg-orange-50 rounded-lg px-2 py-1 mb-1">
                                        <Calendar size={10} />
                                        <span className="font-bold">{s.label}:</span>
                                        <span>+{s.amount.toLocaleString()}đ</span>
                                        <span className="text-gray-400">({s.startDate} → {s.endDate})</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Images preview */}
                                {rt.images.length > 0 && (
                                  <div className="flex gap-1.5 mb-2">
                                    {rt.images.slice(0, 4).map((url, i) => (
                                      <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover" referrerPolicy="no-referrer" />
                                    ))}
                                    {rt.images.length > 4 && (
                                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                        +{rt.images.length - 4}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Row actions */}
                                <div className="flex gap-2 pt-2 border-t border-gray-50">
                                  <button
                                    onClick={() => isEditingRt ? setEditRoomTypeForms(prev => { const n = { ...prev }; delete n[rt.id]; return n; }) : openEditRoomType(rt)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${isEditingRt ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                  >
                                    <Edit3 size={12} />
                                    {isEditingRt ? t.cancel : t.edit}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRoomType(prop.id, rt.id)}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                    {t.delete}
                                  </button>
                                </div>
                              </div>

                              {/* Edit room type form */}
                              {isEditingRt && rtEditForm && (
                                <div className="border-t border-teal-100 p-4">
                                  {renderRoomTypeForm(
                                    rtEditForm,
                                    (fn) => setEditRoomTypeForms(prev => ({ ...prev, [rt.id]: typeof fn === 'function' ? fn(prev[rt.id]) : fn })),
                                    () => handleEditRoomType(prop.id, rt.id),
                                    () => setEditRoomTypeForms(prev => { const n = { ...prev }; delete n[rt.id]; return n; }),
                                    editRoomTypeSaving[rt.id] ?? false,
                                    uploadingEditRoomTypeImages[rt.id] ?? false,
                                    (e) => handleEditRoomTypeImages(e, rt.id),
                                    true
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
