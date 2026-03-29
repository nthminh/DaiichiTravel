import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, Edit3, Trash2, X, Save,
  ChevronUp, ChevronDown, Image as ImageIcon,
  Loader2, AlignLeft, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { cn } from '../lib/utils';
import { formatDateVN } from '../lib/vnDate';
import { Language, TRANSLATIONS, UserRole } from '../App';
import { transportService } from '../services/transportService';
import { UserGuide as UserGuideType, GuideBlock } from '../types';

interface UserGuideProps {
  language: Language;
  currentUser: { role: string; name: string } | null;
  userGuides: UserGuideType[];
}

const ROLE_OPTIONS = [
  { value: 'MANAGER', labelKey: 'guide_for_manager', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'AGENT', labelKey: 'guide_for_agent', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'DRIVER', labelKey: 'guide_for_driver', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'STAFF', labelKey: 'guide_for_staff', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'ACCOUNTANT', labelKey: 'guide_for_accountant', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'CUSTOMER', labelKey: 'guide_for_customer', color: 'bg-gray-50 text-gray-700 border-gray-200' },
];

const emptyGuide = (): Omit<UserGuideType, 'id'> => ({
  role: '',
  title: '',
  blocks: [{ type: 'text', content: '' }],
  updatedAt: Date.now(),
});

export const UserGuide: React.FC<UserGuideProps> = ({ language, currentUser, userGuides: guides }) => {
  const t = TRANSLATIONS[language];
  const isManager = currentUser?.role === UserRole.MANAGER;

  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<Omit<UserGuideType, 'id'>>(emptyGuide());
  const [saving, setSaving] = useState(false);
  const [uploadingBlockIdx, setUploadingBlockIdx] = useState<number | null>(null);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('ALL');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingImageBlockIdx = useRef<number | null>(null);

  // Auto-set role filter for non-managers to show their own guide
  useEffect(() => {
    if (!isManager && currentUser) {
      setActiveRoleFilter(currentUser.role);
    }
  }, [isManager, currentUser]);

  const roleLabel = (roleValue: string) => {
    const opt = ROLE_OPTIONS.find(o => o.value === roleValue);
    return opt ? (t[opt.labelKey] ?? opt.labelKey) : roleValue;
  };

  const roleColor = (roleValue: string) => {
    return ROLE_OPTIONS.find(o => o.value === roleValue)?.color ?? 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const visibleGuides = guides.filter(g => {
    if (activeRoleFilter === 'ALL') return true;
    return g.role === activeRoleFilter;
  });

  const selectedGuide = guides.find(g => g.id === selectedGuideId) ?? null;

  // ─── Editor helpers ────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditForm(emptyGuide());
    setIsAdding(true);
    setIsEditing(false);
    setSelectedGuideId(null);
  };

  const openEdit = (guide: UserGuideType) => {
    setEditForm({ role: guide.role, title: guide.title, blocks: guide.blocks.map(b => ({ ...b })), updatedAt: guide.updatedAt });
    setIsEditing(true);
    setIsAdding(false);
  };

  const closeEditor = () => {
    setIsEditing(false);
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!editForm.title.trim() || !editForm.role) return;
    setSaving(true);
    try {
      const payload = { ...editForm, updatedAt: Date.now() };
      if (isAdding) {
        const docRef = await transportService.addUserGuide(payload);
        setSelectedGuideId(docRef.id);
      } else if (isEditing && selectedGuideId) {
        await transportService.updateUserGuide(selectedGuideId, payload);
      }
      closeEditor();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (guide: UserGuideType) => {
    if (!window.confirm(t.confirm_delete_guide ?? 'Bạn có chắc muốn xóa hướng dẫn này?')) return;
    await transportService.deleteUserGuide(guide.id);
    if (selectedGuideId === guide.id) setSelectedGuideId(null);
  };

  // ─── Block editor helpers ──────────────────────────────────────────────────

  const addTextBlock = () => {
    setEditForm(f => ({ ...f, blocks: [...f.blocks, { type: 'text', content: '' }] }));
  };

  const addImageBlockPlaceholder = (afterIdx: number) => {
    if (!storage) { alert(t.storage_not_configured ?? 'Firebase Storage chưa được cấu hình.'); return; }
    const newBlocks = [...editForm.blocks];
    newBlocks.splice(afterIdx + 1, 0, { type: 'image', content: '' });
    setEditForm(f => ({ ...f, blocks: newBlocks }));
    const newIdx = afterIdx + 1;
    pendingImageBlockIdx.current = newIdx;
    // Trigger file input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
      imageInputRef.current.click();
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = pendingImageBlockIdx.current;
    if (!file || idx === null || !storage) return;

    setUploadingBlockIdx(idx);
    const storageRef = ref(storage, `userGuides/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed',
      null,
      (err) => {
        console.error('Upload failed:', err);
        setUploadingBlockIdx(null);
        // Remove the placeholder block on error
        setEditForm(f => ({
          ...f,
          blocks: f.blocks.filter((_, i) => i !== idx),
        }));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setEditForm(f => {
          const blocks = f.blocks.map((b, i) => i === idx ? { type: 'image' as const, content: url } : b);
          return { ...f, blocks };
        });
        setUploadingBlockIdx(null);
        pendingImageBlockIdx.current = null;
      }
    );
  };

  const updateBlock = (idx: number, content: string) => {
    setEditForm(f => ({ ...f, blocks: f.blocks.map((b, i) => i === idx ? { ...b, content } : b) }));
  };

  const deleteBlock = (idx: number) => {
    setEditForm(f => ({ ...f, blocks: f.blocks.filter((_, i) => i !== idx) }));
  };

  const moveBlock = (idx: number, direction: 'up' | 'down') => {
    const blocks = [...editForm.blocks];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= blocks.length) return;
    [blocks[idx], blocks[swapIdx]] = [blocks[swapIdx], blocks[idx]];
    setEditForm(f => ({ ...f, blocks }));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const renderBlocksReadonly = (blocks: GuideBlock[]) => (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        block.type === 'image'
          ? (block.content
              ? <img key={i} src={block.content} alt="" className="max-w-full rounded-2xl border border-gray-100 shadow-sm" />
              : null)
          : <p key={i} className="text-gray-700 leading-relaxed whitespace-pre-wrap">{block.content}</p>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen size={24} className="text-daiichi-red" />
            {t.user_guide ?? 'Hướng dẫn sử dụng'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">{t.user_guide_desc ?? 'Tài liệu hướng dẫn chi tiết cho từng đối tượng'}</p>
        </div>
        {isManager && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-daiichi-red text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
          >
            <Plus size={16} />
            {t.add_guide ?? 'Thêm hướng dẫn'}
          </button>
        )}
      </div>

      {/* Role filter tabs */}
      <div className="flex flex-wrap gap-2">
        {isManager && (
          <button
            onClick={() => setActiveRoleFilter('ALL')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold border transition-colors',
              activeRoleFilter === 'ALL'
                ? 'bg-daiichi-red text-white border-daiichi-red'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            )}
          >
            <Users size={14} className="inline mr-1" />
            {t.all_roles ?? 'Tất cả'}
          </button>
        )}
        {ROLE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setActiveRoleFilter(opt.value)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold border transition-colors',
              activeRoleFilter === opt.value
                ? 'bg-daiichi-red text-white border-daiichi-red'
                : cn('bg-white hover:border-gray-300', opt.color)
            )}
          >
            {t[opt.labelKey] ?? opt.labelKey}
          </button>
        ))}
      </div>

      {/* Guide list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guide list */}
        <div className="lg:col-span-1 space-y-3">
          {visibleGuides.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-gray-400 text-sm">
              {t.no_guides_yet ?? 'Chưa có hướng dẫn nào.'}
            </div>
          ) : (
            visibleGuides.map(guide => (
              <div
                key={guide.id}
                onClick={() => { setSelectedGuideId(guide.id); closeEditor(); }}
                className={cn(
                  'bg-white p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md',
                  selectedGuideId === guide.id
                    ? 'border-daiichi-red shadow-lg shadow-red-100'
                    : 'border-gray-100'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border mb-1.5', roleColor(guide.role))}>
                      {roleLabel(guide.role)}
                    </span>
                    <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">{guide.title}</h3>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {t.guide_last_updated ?? 'Cập nhật'}: {formatDateVN(guide.updatedAt)}
                    </p>
                  </div>
                  {isManager && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedGuideId(guide.id); openEdit(guide); }}
                        className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t.edit_guide ?? 'Chỉnh sửa'}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(guide); }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t.delete_guide ?? 'Xóa'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Content panel */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {(isAdding || isEditing) ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-3xl p-6 space-y-5 border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">
                    {isAdding ? (t.add_guide ?? 'Thêm hướng dẫn') : (t.edit_guide ?? 'Chỉnh sửa')}
                  </h3>
                  <button onClick={closeEditor} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {t.guide_title ?? 'Tiêu đề'}
                  </label>
                  <input
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Nhập tiêu đề hướng dẫn..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30 focus:border-daiichi-red"
                  />
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {t.guide_target_role ?? 'Đối tượng'}
                  </label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/30 focus:border-daiichi-red bg-white"
                  >
                    <option value="">{t.select_role_placeholder ?? 'Chọn đối tượng...'}</option>
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{t[opt.labelKey] ?? opt.labelKey}</option>
                    ))}
                  </select>
                </div>

                {/* Content blocks */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                    {t.guide_content ?? 'Nội dung'}
                  </label>
                  <div className="space-y-3">
                    {editForm.blocks.map((block, idx) => (
                      <div key={idx} className="flex gap-2 items-start group">
                        <div className="flex-1">
                          {block.type === 'text' ? (
                            <textarea
                              value={block.content}
                              onChange={e => updateBlock(idx, e.target.value)}
                              placeholder="Nhập nội dung văn bản..."
                              rows={4}
                              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-daiichi-red/30 focus:border-daiichi-red"
                            />
                          ) : (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                              {uploadingBlockIdx === idx ? (
                                <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
                                  <Loader2 size={16} className="animate-spin" />
                                  {t.uploading_image ?? 'Đang tải ảnh...'}
                                </div>
                              ) : block.content ? (
                                <img src={block.content} alt="" className="max-w-full max-h-64 object-contain" />
                              ) : (
                                <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
                                  <ImageIcon size={16} />
                                  {t.no_image_yet ?? 'Chưa có ảnh'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Block controls */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-1">
                          <button
                            onClick={() => moveBlock(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-100 rounded-lg"
                            title={t.move_up ?? 'Lên'}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => moveBlock(idx, 'down')}
                            disabled={idx === editForm.blocks.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-100 rounded-lg"
                            title={t.move_down ?? 'Xuống'}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={() => deleteBlock(idx)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title={t.delete_block ?? 'Xóa khối'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Block add buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={addTextBlock}
                      className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-xl border border-blue-200 hover:border-blue-400 bg-blue-50 transition-colors"
                    >
                      <AlignLeft size={13} />
                      {t.add_text_block ?? 'Thêm đoạn văn'}
                    </button>
                    <button
                      onClick={() => addImageBlockPlaceholder(editForm.blocks.length - 1)}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 px-3 py-2 rounded-xl border border-emerald-200 hover:border-emerald-400 bg-emerald-50 transition-colors"
                    >
                      <ImageIcon size={13} />
                      {t.add_image_block ?? 'Chèn ảnh'}
                    </button>
                  </div>
                  {/* Hidden file input for image upload */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !editForm.title.trim() || !editForm.role}
                    className="flex-1 flex items-center justify-center gap-2 bg-daiichi-red text-white rounded-xl py-3 font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {t.save_guide ?? 'Lưu hướng dẫn'}
                  </button>
                  <button
                    onClick={closeEditor}
                    className="flex-1 border border-gray-200 rounded-xl py-3 font-bold text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    {t.cancel ?? 'Hủy'}
                  </button>
                </div>
              </motion.div>
            ) : selectedGuide ? (
              <motion.div
                key={selectedGuide.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-3xl p-6 space-y-5 border border-gray-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border mb-2', roleColor(selectedGuide.role))}>
                      {roleLabel(selectedGuide.role)}
                    </span>
                    <h2 className="text-xl font-bold text-gray-800">{selectedGuide.title}</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      {t.guide_last_updated ?? 'Cập nhật'}: {new Date(selectedGuide.updatedAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  {isManager && (
                    <button
                      onClick={() => openEdit(selectedGuide)}
                      className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800 px-3 py-2 rounded-xl border border-blue-200 hover:border-blue-400 bg-blue-50 transition-colors shrink-0"
                    >
                      <Edit3 size={14} />
                      {t.edit_guide ?? 'Chỉnh sửa'}
                    </button>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-4">
                  {renderBlocksReadonly(selectedGuide.blocks)}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-3xl p-12 text-center text-gray-400 border border-gray-100"
              >
                <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t.select_guide_prompt ?? 'Chọn một hướng dẫn từ danh sách để xem nội dung.'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
