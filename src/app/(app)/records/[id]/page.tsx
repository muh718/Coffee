"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Images as ImagesIcon,
} from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Avatar from "@/components/ui/avatar";
import Badge from "@/components/ui/badge";
import { DetailSkeleton } from "@/components/ui/skeleton";
import Modal from "@/components/ui/modal";
import ImageLightbox from "@/components/records/image-lightbox";
import UploadModal from "@/components/upload/upload-modal";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";

const COUNTRY_FLAGS: Record<string, string> = {
  "البرازيل": "🇧🇷",
  "إثيوبيا": "🇪🇹",
  "سلفادور": "🇸🇻",
  "أوغندا": "🇺🇬",
  "كوستاريكا": "🇨🇷",
  "إندونيسيا": "🇮🇩",
  "كولمبيا": "🇨🇴",
  "بيرو": "🇵🇪",
  "اليمن": "🇾🇪",
  "غواتيمالا": "🇬🇹",
};

const COUNTRIES = [
  { value: "البرازيل", label: "البرازيل", flag: "🇧🇷" },
  { value: "إثيوبيا", label: "إثيوبيا", flag: "🇪🇹" },
  { value: "سلفادور", label: "سلفادور", flag: "🇸🇻" },
  { value: "أوغندا", label: "أوغندا", flag: "🇺🇬" },
  { value: "غواتيمالا", label: "غواتيمالا", flag: "🇬🇹" },
  { value: "كوستاريكا", label: "كوستاريكا", flag: "🇨🇷" },
  { value: "إندونيسيا", label: "إندونيسيا", flag: "🇮🇩" },
  { value: "كولمبيا", label: "كولمبيا", flag: "🇨🇴" },
  { value: "بيرو", label: "بيرو", flag: "🇵🇪" },
  { value: "اليمن", label: "اليمن", flag: "🇾🇪" },
];

const BREW_TYPES = [
  { value: "فلتر", label: "فلتر" },
  { value: "اسبريسو", label: "اسبريسو" },
  { value: "فلتر & اسبريسو", label: "فلتر & اسبريسو" },
];

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.id as string;
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [record, setRecord] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoastery, setEditRoastery] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBrewType, setEditBrewType] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [slideIndex, setSlideIndex] = useState(0);

  /* ── Data fetching ── */
  const fetchRecord = async () => {
    const supabase = createClient();

    const [recordRes, imagesRes] = await Promise.all([
      supabase
        .from("records")
        .select("*, creator:users!created_by(id, name, email, avatar_url)")
        .eq("id", recordId)
        .single(),
      supabase
        .from("images")
        .select("*, uploader:users!uploaded_by(id, name, avatar_url)")
        .eq("record_id", recordId)
        .order("uploaded_at", { ascending: true }),
    ]);

    if (recordRes.error) {
      toast.error("لم يتم العثور على المحصول");
      router.push("/dashboard");
      return;
    }

    setRecord(recordRes.data);
    setEditName(recordRes.data.name);
    
    const loadedImages = imagesRes.data || [];
    setImages(loadedImages);
    setSlideIndex(loadedImages.length > 1 ? 1 : 0);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRecord();
  }, [recordId]);

  /* ── Actions ── */
  const openEditModal = () => {
    setEditName(record.name);
    setEditRoastery(record.roastery_name || "");
    setEditCountry(record.country_of_origin || "");
    setEditBrewType(record.brew_type || "");
    setShowEditModal(true);
  };

  const handleUpdateRecord = async () => {
    if (!editName.trim()) return;
    const supabase = createClient();

    const { error } = await supabase
      .from("records")
      .update({ 
        name: editName.trim(),
        roastery_name: editRoastery.trim() || "اخرى",
        country_of_origin: editCountry || null,
        brew_type: editBrewType || null,
      })
      .eq("id", recordId);

    if (error) {
      toast.error("فشل تحديث المحصول");
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: "UPDATE_RECORD",
      target_id: recordId,
      details: { old_name: record.name, new_name: editName.trim() },
    });

    setRecord({ 
      ...record, 
      name: editName.trim(),
      roastery_name: editRoastery.trim() || "اخرى",
      country_of_origin: editCountry || null,
      brew_type: editBrewType || null,
    });
    setShowEditModal(false);
    toast.success("تم تحديث المحصول بنجاح");
    router.refresh();
  };

  const handleDeleteRecord = async () => {
    const supabase = createClient();

    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", recordId);

    if (error) {
      toast.error("فشل حذف المحصول");
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: "DELETE_RECORD",
      target_id: recordId,
      details: { name: record.name },
    });

    toast.success("تم حذف المحصول");
    router.push("/dashboard");
  };

  const handleDeleteImage = async (imageId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("images")
      .delete()
      .eq("id", imageId);

    if (error) {
      toast.error("فشل حذف الصورة");
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: "DELETE_IMAGE",
      target_id: imageId,
    });

    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setDeleteImageId(null);
    toast.success("تم حذف الصورة");
  };

  /* ── Slider helpers ── */
  const slideImages = images;

  const goNextSlide = useCallback(() => {
    if (slideImages.length <= 1) return;
    setSlideIndex((prev) => (prev + 1) % slideImages.length);
  }, [slideImages.length]);

  const goPrevSlide = useCallback(() => {
    if (slideImages.length <= 1) return;
    setSlideIndex((prev) => (prev - 1 + slideImages.length) % slideImages.length);
  }, [slideImages.length]);

  if (isLoading) return <DetailSkeleton />;
  if (!record) return null;

  const countryFlag = record.country_of_origin
    ? COUNTRY_FLAGS[record.country_of_origin] || "🌍"
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in px-4 sm:px-0">
      {/* Back Button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
        العودة للصفحة الرئيسية
      </button>

      {/* ═══════════ Main Card ═══════════ */}
      <div className="card-static overflow-hidden">
        {/* ── 1. Crop Name ── */}
        <div className="p-4 sm:p-6 pb-0">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-relaxed">
              {record.name}
            </h1>
            {isAdmin && (
              <button
                onClick={openEditModal}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-brand-500 hover:bg-brand-500/10 transition-colors flex-shrink-0"
                title="تعديل المحصول"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Image Slider ── */}
        {slideImages.length > 0 && (
          <div className="relative w-full mt-4 bg-[var(--bg-tertiary)]">
            {/* Slide container */}
            <div className="relative w-full flex items-center justify-center" style={{ minHeight: "280px", maxHeight: "65vh" }}>
              <AnimatePresence mode="wait">
                <motion.img
                  key={slideImages[slideIndex]?.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  src={slideImages[slideIndex]?.image_url}
                  alt=""
                  className="max-w-full max-h-[65vh] object-contain cursor-grab active:cursor-grabbing select-none touch-pan-y"
                  onClick={() => {
                    const realIdx = images.findIndex((img) => img.id === slideImages[slideIndex]?.id);
                    setLightboxIndex(realIdx >= 0 ? realIdx : 0);
                  }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, { offset }) => {
                    const swipe = offset.x;
                    if (swipe < -50) goNextSlide();
                    else if (swipe > 50) goPrevSlide();
                  }}
                  draggable={false}
                />
              </AnimatePresence>

              {/* Delete Current Image */}
              {isAdmin && slideImages[slideIndex] && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteImageId(slideImages[slideIndex].id);
                  }}
                  className="absolute top-4 start-4 p-2 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors z-10"
                  title="حذف هذه الصورة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Nav arrows */}
              {slideImages.length > 1 && (
                <>
                  <button
                    onClick={goPrevSlide}
                    className="absolute start-2 sm:start-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors z-10"
                  >
                    <ChevronRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                  </button>
                  <button
                    onClick={goNextSlide}
                    className="absolute end-2 sm:end-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors z-10"
                  >
                    <ChevronLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                  </button>
                </>
              )}
            </div>

            {/* Dots */}
            {slideImages.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 py-3">
                {slideImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlideIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === slideIndex
                        ? "bg-brand-500 w-5"
                        : "bg-[var(--text-tertiary)]/40 hover:bg-[var(--text-tertiary)]"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 3. Details below image ── */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Country + Brew type */}
          {(record.country_of_origin || record.brew_type || record.roastery_name) && (
            <div className="flex items-center flex-wrap gap-2">
              {record.country_of_origin && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-1.5 rounded-lg">
                  <span>{countryFlag}</span>
                  <span>{record.country_of_origin}</span>
                </div>
              )}
              {record.brew_type && (
                <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-1.5 rounded-lg">
                  {record.brew_type}
                </div>
              )}
              {record.roastery_name && (
                <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-1.5 rounded-lg">
                  🏭 {record.roastery_name}
                </div>
              )}
            </div>
          )}

          {/* Add image button */}
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowUpload(true)}
          >
            إضافة صورة
          </Button>

          {/* ── Last row: creator + date on the right, delete icon on the left ── */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
            {/* Delete icon — bottom-left (start in RTL) */}
            <div>
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                  title="حذف المحصول"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Creator + Date — bottom-right (end in RTL) */}
            <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Avatar
                  name={record.creator?.name || ""}
                  src={record.creator?.avatar_url}
                  size="sm"
                />
                <span className="hidden sm:inline">{record.creator?.name || "غير معروف"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span>{formatDate(record.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Lightbox */}
      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        isOpen={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        recordId={recordId}
        onSuccess={() => fetchRecord()}
      />

      {/* Delete Record Confirmation */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="تأكيد حذف المحصول"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            هل أنت متأكد من حذف المحصول &ldquo;{record.name}&rdquo;؟ سيتم حذف جميع الصور
            المرتبطة نهائياً.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
            >
              إلغاء
            </Button>
            <Button variant="danger" onClick={handleDeleteRecord}>
              حذف نهائياً
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Image Confirmation */}
      <Modal
        isOpen={!!deleteImageId}
        onClose={() => setDeleteImageId(null)}
        title="تأكيد حذف الصورة"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            هل أنت متأكد من حذف هذه الصورة؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteImageId(null)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteImageId && handleDeleteImage(deleteImageId)}
            >
              حذف الصورة
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Record Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="تعديل المحصول"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="اسم المحصول"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="أدخل اسم المحصول"
            hint="هذا الحقل إلزامي"
          />
          <Input
            label="اسم المحمصة"
            value={editRoastery}
            onChange={(e) => setEditRoastery(e.target.value)}
            placeholder="اخرى"
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                بلد المنشأ
              </label>
              <select
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                className="w-full bg-white/5 border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none transition-all"
              >
                <option value="" disabled className="text-gray-500">اختر بلد المنشأ</option>
                {COUNTRIES.map(c => (
                  <option key={c.value} value={c.value} className="text-black dark:text-white bg-white dark:bg-gray-800">
                    {c.flag} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                نوع التحضير
              </label>
              <select
                value={editBrewType}
                onChange={(e) => setEditBrewType(e.target.value)}
                className="w-full bg-white/5 border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none transition-all"
              >
                <option value="" disabled className="text-gray-500">اختر نوع التحضير</option>
                {BREW_TYPES.map(t => (
                  <option key={t.value} value={t.value} className="text-black dark:text-white bg-white dark:bg-gray-800">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateRecord}
              disabled={!editName.trim()}
            >
              حفظ التعديلات
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
