import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { matchesSearch } from '../lib/searchUtils';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Optional secondary text for each option (e.g. address). Must match options array by index. */
  optionDetails?: string[];
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select or type...',
  className,
  inputClassName,
  disabled = false,
  optionDetails,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options
    .map((option, idx) => ({ option, detail: optionDetails?.[idx] ?? '' }))
    .filter(({ option, detail }) =>
      matchesSearch(option, searchTerm) || matchesSearch(detail, searchTerm)
    );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const val = e.target.value;
    setSearchTerm(val);
    onChange(val);
    setIsOpen(true);
  };

  const handleSelectOption = (option: string) => {
    if (disabled) return;
    onChange(option);
    setSearchTerm(option);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => { if (!disabled) setIsOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm pr-10",
            disabled && "opacity-50 cursor-not-allowed bg-gray-100",
            inputClassName
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
          {searchTerm && !disabled && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleInputChange({ target: { value: '' } } as any);
              }}
              className="hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={cn("transition-transform", isOpen && !disabled && "rotate-180")} />
        </div>
      </div>

      {isOpen && (searchTerm || filteredOptions.length > 0) && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(({ option, detail }, index) => (
              <button
                key={index}
                onClick={() => handleSelectOption(option)}
                className={cn(
                  "w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between group",
                  value === option ? "text-daiichi-red font-bold bg-daiichi-accent/10" : "text-gray-700"
                )}
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{option}</span>
                  {detail && <span className="text-[11px] text-gray-400 font-normal truncate">{detail}</span>}
                </span>
                {value === option && <div className="w-1.5 h-1.5 rounded-full bg-daiichi-red flex-shrink-0 ml-2" />}
              </button>
            ))
          ) : searchTerm && (
            <div className="px-4 py-3 text-xs text-gray-400 italic">
              No exact matches. Using custom input.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
