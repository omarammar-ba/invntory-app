import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFilterProps { searchQuery: string; onSearchChange: (query: string) => void; }
export const SearchFilter: React.FC<SearchFilterProps> = ({ searchQuery, onSearchChange }) => {
  const [inputValue, setInputValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (inputValue !== searchQuery) onSearchChange(inputValue); }, 300);
    return () => window.clearTimeout(timer);
  }, [inputValue, onSearchChange, searchQuery]);
  useEffect(() => { if (searchQuery !== inputValue) setInputValue(searchQuery); }, [searchQuery]);
  return <form className="stock-search" role="search" onSubmit={event => { event.preventDefault(); onSearchChange(inputValue); inputRef.current?.blur(); }}>
    <button type="submit" aria-label="بحث في الأصناف"><Search size={23} strokeWidth={1.65} /></button>
    <label><span className="sr-only">البحث في الأصناف</span><input ref={inputRef} type="search" enterKeyHint="search" autoComplete="off"
      placeholder="ابحث هنا عن أي صنف" value={inputValue} onChange={event => setInputValue(event.target.value)} /></label>
    {inputValue && <button type="button" aria-label="مسح البحث" onClick={() => { setInputValue(''); onSearchChange(''); inputRef.current?.focus(); }}><X size={17} /></button>}
  </form>;
};
export default SearchFilter;
