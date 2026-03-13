import React, { useState } from 'react';
import { StickyNote, X, Save } from 'lucide-react';
import { Language } from '../constants/translations';

interface NotePopoverProps {
  note?: string;
  onSave: (note: string) => void;
  language: Language;
}

export const NotePopover: React.FC<NotePopoverProps> = ({ note, onSave, language }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editValue, setEditValue] = useState('');

  const hasNote = !!(note && note.trim());

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(note || '');
    setShowModal(true);
    setShowTooltip(false);
  };

  const handleSave = () => {
    onSave(editValue.trim());
    setShowModal(false);
  };

  const handleDelete = () => {
    onSave('');
    setShowModal(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowModal(false);
    }
  };

  const label = language === 'vi'
    ? (hasNote ? 'Xem / sửa ghi chú' : 'Thêm ghi chú')
    : language === 'ja'
      ? (hasNote ? 'メモを見る / 編集' : 'メモを追加')
      : (hasNote ? 'View / edit note' : 'Add note');

  return (
    <>
      <div
        className="relative inline-block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={handleOpen}
          title={label}
          className={`p-1.5 rounded-lg transition-all ${
            hasNote
              ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
              : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50'
          }`}
        >
          <StickyNote size={18} />
        </button>

        {/* Hover tooltip – only shown when note exists and modal is closed */}
        {showTooltip && hasNote && !showModal && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none">
            <p className="font-bold text-amber-400 mb-1">
              {language === 'vi' ? 'Ghi chú' : language === 'ja' ? 'メモ' : 'Note'}
            </p>
            <p className="leading-relaxed line-clamp-5 whitespace-pre-wrap">{note}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
          </div>
        )}
      </div>

      {/* Edit / View modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-[24px] p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <StickyNote size={20} className="text-amber-500" />
                <h3 className="text-base font-bold text-gray-800">
                  {language === 'vi' ? 'Ghi chú' : language === 'ja' ? 'メモ' : 'Note'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              placeholder={
                language === 'vi'
                  ? 'Nhập ghi chú...'
                  : language === 'ja'
                    ? 'メモを入力...'
                    : 'Enter note...'
              }
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none leading-relaxed"
              autoFocus
            />

            <div className="flex items-center gap-3">
              {hasNote && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-bold text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  {language === 'vi' ? 'Xóa ghi chú' : language === 'ja' ? 'メモを削除' : 'Delete note'}
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600"
                >
                  {language === 'vi' ? 'Hủy' : language === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-amber-500 text-white text-sm rounded-xl font-bold hover:bg-amber-600 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Save size={15} />
                  {language === 'vi' ? 'Lưu' : language === 'ja' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
