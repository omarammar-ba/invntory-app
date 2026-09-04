import React, { useState, useEffect } from 'react';
import { SearchIcon } from '@/components/ui/Icons';

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({ searchQuery, onSearchChange }) => {
  const [inputValue, setInputValue] = useState(searchQuery);

  useEffect(() => {
    const timerId = setTimeout(() => {
      if (inputValue !== searchQuery) {
        onSearchChange(inputValue);
      }
    }, 300);
    return () => clearTimeout(timerId);
  }, [inputValue, onSearchChange, searchQuery]);
  
  useEffect(() => {
    if (searchQuery !== inputValue) {
      setInputValue(searchQuery);
    }
  }, [searchQuery]);

  return (
    <div className="relative w-full flex items-center shadow-xs rounded-[16px] overflow-hidden border border-slate-200/70 dark:border-white/[0.07] bg-white dark:bg-neutral-900 no-print transition-all focus-within:border-slate-400 dark:focus-within:border-slate-500 h-[44px]">
      
      {/* Search Icon */}
      <div className="pr-3.5 pl-2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
        <SearchIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
      </div>

      {/* Input Field */}
      <input
        type="text"
        placeholder="ابحث عن صنف، مقاس، كود شيد..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="flex-grow py-2 px-1 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-transparent border-none focus:ring-0 focus:outline-none text-xs sm:text-sm font-semibold"
      />

      {/* Clear Search Button */}
      {inputValue && (
        <button
          type="button"
          onClick={() => { setInputValue(''); onSearchChange(''); }}
          className="p-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer active:scale-95 flex items-center justify-center pl-3"
          title="مسح البحث"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchFilter;
