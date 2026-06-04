"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  FileText,
  Images,
  TrendingUp,
  Search,
} from "lucide-react";
import SearchInput from "@/components/ui/search-input";
import Button from "@/components/ui/button";
import RecordCard from "@/components/records/record-card";
import { RecordCardSkeleton } from "@/components/ui/skeleton";
import UploadModal from "@/components/upload/upload-modal";
import { createClient } from "@/lib/supabase/client";
import { RECORDS_PER_PAGE } from "@/lib/constants";

export default function DashboardPage() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showUpload, setShowUpload] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchRecords = useCallback(
    async (reset = false) => {
      const currentPage = reset ? 0 : page;
      const offset = currentPage * RECORDS_PER_PAGE;

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}&limit=${RECORDS_PER_PAGE}&offset=${offset}&sort=${sortBy}`
        );
        const data = await res.json();
        const newRecords = data.records || [];

        if (reset) {
          setRecords(newRecords);
          setPage(1);
        } else {
          setRecords((prev) => [...prev, ...newRecords]);
          setPage((p) => p + 1);
        }

        setHasMore(newRecords.length === RECORDS_PER_PAGE);
      } catch (error) {
        console.error("Fetch records error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, page]
  );

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    setPage(0);
    fetchRecords(true);
  }, [searchQuery, sortBy]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchRecords(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, fetchRecords]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleUploadSuccess = (recordId: string) => {
    fetchRecords(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <SearchInput
          onSearch={handleSearch}
          placeholder="ابحث بالعنوان أو بأي نص داخل الصور..."
          className="flex-1"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-white/5 border border-[var(--border-primary)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none"
        >
          <option value="name">الاسم</option>
          <option value="country">البلد ثم الاسم</option>
          <option value="type">النوع</option>
        </select>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowUpload(true)}
        >
          إضافة محصول
        </Button>
      </div>

      {/* Records Grid */}
      {isLoading && records.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <RecordCardSkeleton key={i} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
            {searchQuery ? (
              <Search className="w-8 h-8 text-[var(--text-tertiary)]" />
            ) : (
              <FileText className="w-8 h-8 text-[var(--text-tertiary)]" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {searchQuery ? "لا توجد نتائج" : "لا توجد محاصيل بعد"}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)] mb-6">
            {searchQuery
              ? "جرب كلمات بحث مختلفة"
              : "ابدأ بإضافة أول محصول عبر رفع صورة"}
          </p>
          {!searchQuery && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowUpload(true)}
            >
              إضافة أول محصول
            </Button>
          )}
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {records.map((record, i) => (
              <RecordCard
                key={record.id || record.record_id}
                id={record.id || record.record_id}
                name={record.name || record.record_name}
                coverImageUrl={record.cover_image_url}
                imageCount={record.image_count || 0}
                creatorName={record.creator?.name || record.creator_name || "غير معروف"}
                creatorAvatar={record.creator?.avatar_url}
                createdAt={record.created_at}
                countryOfOrigin={record.country_of_origin}
                brewType={record.brew_type}
                index={i}
              />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          {hasMore && (
            <div ref={observerRef} className="flex justify-center py-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-6 end-6 w-14 h-14 rounded-full gradient-brand shadow-lg shadow-brand-500/30 flex items-center justify-center text-white sm:hidden z-30 active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
