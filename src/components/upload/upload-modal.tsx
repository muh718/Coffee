"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useCallback, useRef } from "react";
import { Upload, Camera, Image as ImageIcon, X, FileUp, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compress";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
} from "@/lib/constants";
import { generateStorageFileName } from "@/lib/utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId?: string; // If provided, adding to existing record
  onSuccess: (recordId: string) => void;
}

type Step = "upload" | "processing" | "review" | "saving";

export default function UploadModal({
  isOpen,
  onClose,
  recordId,
  onSuccess,
}: UploadModalProps) {
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [country, setCountry] = useState<string>("");
  const [brewType, setBrewType] = useState<string>("");
  const [roasteryName, setRoasteryName] = useState<string>("");
  const [uploadedUrl, setUploadedUrl] = useState<string>("");

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

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [similarRecords, setSimilarRecords] = useState<any[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isFirstImage = !recordId;

  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setPreview("");
    setSuggestedTitle("");
    setEditedTitle("");
    setRawText("");
    setCountry("");
    setBrewType("");
    setRoasteryName("");
    setUploadedUrl("");
    setIsProcessing(false);
    setSimilarRecords([]);
    setShowDuplicateDialog(false);
    setShowSourcePicker(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(selectedFile.type)) {
      toast.error("نوع الملف غير مدعوم. يرجى رفع صورة.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      toast.error("حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت.");
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));

    // Start processing
    setStep("processing");
    setIsProcessing(true);

    try {
      // Compress the image
      const compressed = await compressImage(selectedFile);

      // Upload to Supabase Storage
      const supabase = createClient();
      const fileName = generateStorageFileName(
        user!.id,
        selectedFile.name
      );
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

      setUploadedUrl(publicUrl);
      setIsProcessing(false);

      if (isFirstImage) {
        setStep("review");
        // Reset title for manual entry
        setEditedTitle("");
      } else {
        // Adding to existing record — save directly
        await saveImage(publicUrl);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("حدث خطأ أثناء رفع الصورة");
      setIsProcessing(false);
      setStep("upload");
    }
  };

  const checkSimilarNames = async () => {
    try {
      const res = await fetch("/api/check-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedName: editedTitle }),
      });
      const data = await res.json();

      if (data.matches && data.matches.length > 0) {
        const highMatches = data.matches.filter(
          (m: any) => m.is_highly_similar || m.is_exact_match
        );
        if (highMatches.length > 0) {
          setSimilarRecords(highMatches);
          setShowDuplicateDialog(true);
          return;
        }
      }
    } catch {
      // Similarity check failed — proceed anyway
    }
    await saveRecord();
  };

  const saveRecord = async () => {
    setStep("saving");
    const supabase = createClient();

    try {
      // Create the record
      const { data: record, error: recordError } = await supabase
        .from("records")
        .insert({
          name: editedTitle,
          cover_image_url: uploadedUrl,
          created_by: user!.id,
          country_of_origin: country || null,
          brew_type: brewType || null,
          roastery_name: roasteryName.trim() || "اخرى",
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // Save the first image with OCR data
      const { error: imageError } = await supabase.from("images").insert({
        record_id: record.id,
        image_url: uploadedUrl,
        raw_ocr_text: rawText,
        uploaded_by: user!.id,
      });

      if (imageError) throw imageError;

      // Log audit
      await supabase.from("audit_logs").insert({
        user_id: user!.id,
        action: "CREATE_RECORD",
        target_id: record.id,
        details: { title: editedTitle },
      });

      toast.success("تم إضافة المحصول بنجاح! 🎉");
      handleClose();
      onSuccess(record.id);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("حدث خطأ أثناء حفظ السجل");
      setStep("review");
    }
  };

  const saveImage = async (imageUrl: string) => {
    setStep("saving");
    const supabase = createClient();

    try {
      const { error } = await supabase.from("images").insert({
        record_id: recordId,
        image_url: imageUrl,
        raw_ocr_text: rawText,
        uploaded_by: user!.id,
      });

      if (error) throw error;

      await supabase.from("audit_logs").insert({
        user_id: user!.id,
        action: "UPLOAD_IMAGE",
        target_id: recordId,
      });

      toast.success("تمت إضافة الصورة بنجاح!");
      handleClose();
      onSuccess(recordId!);
    } catch (error) {
      console.error("Save image error:", error);
      toast.error("حدث خطأ أثناء حفظ الصورة");
      setStep("upload");
    }
  };

  const addToExistingRecord = async (existingRecordId: string) => {
    setShowDuplicateDialog(false);
    await saveImage(uploadedUrl);
    onSuccess(existingRecordId);
  };

  // Drag & Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={
          isFirstImage ? "إضافة محصول" : "إضافة صورة"
        }
        description={
          isFirstImage
            ? "ارفع صورة الوثيقة الأولى لإضافة محصول جديد باسم ذكي"
            : "أضف صورة جديدة لهذا المحصول"
        }
        size="lg"
      >
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (isMobile) {
                    setShowSourcePicker(true);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300",
                  isDragging
                    ? "border-brand-500 bg-brand-500/5 scale-[1.02]"
                    : "border-[var(--border-primary)] hover:border-brand-400 hover:bg-[var(--bg-tertiary)]"
                )}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-brand flex items-center justify-center">
                  <FileUp className="w-8 h-8 text-white" />
                </div>
                <p className="text-base font-semibold text-[var(--text-primary)] mb-1">
                  {isMobile ? "انقر لاختيار مصدر الصورة" : "اسحب الصورة هنا أو انقر للرفع"}
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  JPEG, PNG, WebP — حتى 10 ميجابايت
                </p>
              </div>

              {/* Hidden file input for gallery (no capture) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                  e.target.value = "";
                }}
                className="hidden"
              />

              {/* Hidden file input for camera (with capture) */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                  e.target.value = "";
                }}
                className="hidden"
              />

              {/* Mobile Source Picker Action Sheet */}
              <AnimatePresence>
                {showSourcePicker && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setShowSourcePicker(false);
                    }}
                  >
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 28, stiffness: 350 }}
                      className="w-full max-w-lg mx-4 mb-6 space-y-2"
                    >
                      {/* Action buttons group */}
                      <div className="rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-2xl">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSourcePicker(false);
                            cameraInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <div className="w-11 h-11 rounded-xl gradient-brand flex items-center justify-center flex-shrink-0">
                            <Camera className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-base font-semibold text-[var(--text-primary)]">
                              التقاط صورة عبر الكاميرا
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                              فتح الكاميرا لالتقاط صورة جديدة
                            </p>
                          </div>
                        </button>

                        <div className="h-px bg-[var(--border-primary)]" />

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSourcePicker(false);
                            fileInputRef.current?.click();
                          }}
                          className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <div className="w-11 h-11 rounded-xl bg-accent-500/10 flex items-center justify-center flex-shrink-0">
                            <ImagePlus className="w-5 h-5 text-accent-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-base font-semibold text-[var(--text-primary)]">
                              اختيار من الاستوديو
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                              اختيار صورة موجودة من المعرض
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Cancel button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSourcePicker(false);
                        }}
                        className="w-full rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-6 py-3.5 text-center font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors shadow-2xl"
                      >
                        إلغاء
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Step 2: Processing */}
          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 space-y-6"
            >
              {preview && (
                <div className="w-40 h-40 mx-auto rounded-2xl overflow-hidden shadow-lg">
                  <img
                    src={preview}
                    alt="Processing"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse [animation-delay:0.4s]" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  جاري معالجة الصورة...
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  تحضير الصورة للرفع
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review Title */}
          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex gap-4">
                {preview && (
                  <div className="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <Input
                    label="اسم المحصول"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="أدخل اسم المحصول"
                    hint="هذا الحقل إلزامي"
                  />
                  <Input
                    label="اسم المحمصة"
                    value={roasteryName}
                    onChange={(e) => setRoasteryName(e.target.value)}
                    placeholder="اخرى"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[var(--text-primary)]">
                        بلد المنشأ
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
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
                        value={brewType}
                        onChange={(e) => setBrewType(e.target.value)}
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
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="ghost" onClick={handleClose}>
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={checkSimilarNames}
                  disabled={!editedTitle.trim()}
                >
                  حفظ المحصول
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Saving */}
          {step === "saving" && (
            <motion.div
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full gradient-brand flex items-center justify-center animate-pulse-glow">
                <Upload className="w-6 h-6 text-white animate-bounce" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                جاري الحفظ...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* Duplicate Detection Dialog */}
      <Modal
        isOpen={showDuplicateDialog}
        onClose={() => setShowDuplicateDialog(false)}
        title="تم العثور على سجل مشابه!"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            يوجد سجل بعنوان مشابه جداً:
          </p>
          {similarRecords.map((record) => (
            <div
              key={record.record_id}
              className="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                &ldquo;{record.record_name}&rdquo;
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                نسبة التشابه: {Math.round(record.similarity_score * 100)}%
              </p>
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              onClick={() => {
                if (similarRecords[0]) {
                  addToExistingRecord(similarRecords[0].record_id);
                }
              }}
            >
              إضافة الصورة للسجل الموجود
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDuplicateDialog(false);
                saveRecord();
              }}
            >
              إضافة محصول جديد منفصل
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDuplicateDialog(false)}
            >
              العودة وتعديل العنوان
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
