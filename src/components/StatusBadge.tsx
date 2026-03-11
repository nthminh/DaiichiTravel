import React from 'react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, TripStatus } from '../App';

export const StatusBadge = ({ status, language }: { status: TripStatus, language: Language }) => {
  const t = TRANSLATIONS[language];
  const styles = {
    [TripStatus.WAITING]: "bg-blue-100 text-blue-600",
    [TripStatus.RUNNING]: "bg-yellow-100 text-yellow-600",
    [TripStatus.COMPLETED]: "bg-green-100 text-green-600",
  };
  const labels = {
    [TripStatus.WAITING]: t.status_waiting,
    [TripStatus.RUNNING]: t.status_running,
    [TripStatus.COMPLETED]: t.status_completed,
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", styles[status])}>
      {labels[status]}
    </span>
  );
};
