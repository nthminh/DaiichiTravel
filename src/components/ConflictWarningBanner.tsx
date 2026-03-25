import React from 'react';

interface ConflictWarningBannerProps {
  language: 'vi' | 'en' | 'ja';
  isSaving?: boolean;
  onCancel: () => void;
  onForceOverwrite: () => void;
}

/**
 * Reusable banner shown when an optimistic-lock conflict is detected:
 * another user saved the same record while the current user had it open.
 *
 * Follows the same visual style as the route conflict warning in RouteManagementPage.tsx.
 */
export function ConflictWarningBanner({
  language,
  isSaving = false,
  onCancel,
  onForceOverwrite,
}: ConflictWarningBannerProps) {
  const isVi = language === 'vi';

  return (
    <div className="mx-1 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-xl text-sm text-yellow-800 space-y-3">
      <p className="font-semibold">
        {isVi
          ? '⚠️ Xung đột dữ liệu: bản ghi này vừa được người khác chỉnh sửa trong khi bạn đang mở.'
          : '⚠️ Data conflict: this record was modified by someone else while you had it open.'}
      </p>
      <p className="text-xs text-yellow-700">
        {isVi
          ? 'Nhấn "Ghi đè" để lưu thay đổi của bạn lên trên (sẽ mất các thay đổi của người kia), hoặc nhấn "Hủy" để đóng và tải lại dữ liệu mới nhất.'
          : "Click \"Overwrite\" to save your changes on top (the other person's changes will be lost), or click \"Cancel\" to close and reload the latest data."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="px-5 py-2 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          {isVi ? 'Hủy & tải lại' : 'Cancel & reload'}
        </button>
        <button
          onClick={onForceOverwrite}
          disabled={isSaving}
          className="px-5 py-2 text-sm font-bold text-white bg-yellow-500 rounded-xl hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
        >
          {isVi ? 'Ghi đè' : 'Overwrite'}
        </button>
      </div>
    </div>
  );
}
