"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
}

export default function SearchInput({
  onSearch,
  placeholder = "ابحث في الأرشيف...",
  className,
  defaultValue = "",
}: SearchInputProps) {
  const [query, setQuery] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(value.trim());
      }, SEARCH_DEBOUNCE_MS);
    },
    [onSearch]
  );

  const handleClear = () => {
    setQuery("");
    onSearch("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative group",
        isFocused && "z-10",
        className
      )}
    >
      <div
        className={cn(
          "relative flex items-center rounded-2xl border bg-[var(--bg-card)] transition-all duration-300",
          isFocused
            ? "border-[var(--border-focus)] shadow-glow ring-2 ring-[var(--border-focus)]/20"
            : "border-[var(--border-primary)] hover:border-[var(--text-tertiary)]"
        )}
      >
        <Search
          className={cn(
            "absolute start-4 w-5 h-5 transition-colors",
            isFocused ? "text-brand-500" : "text-[var(--text-tertiary)]"
          )}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full bg-transparent ps-12 pe-10 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute end-3 p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
