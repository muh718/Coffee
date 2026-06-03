"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Download,
  Calendar,
  User,
  Images as ImagesIcon,
} from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import Avatar from "@/components/ui/avatar";
import Badge from "@/components/ui/badge";
import { DetailSkeleton } from "@/components/ui/skeleton";
import Modal from "@/components/ui/modal";
import ImageLightbox from "@/components/records/image-lightbox";
import UploadModal from "@/components/upload/upload-modal";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";

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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(-1);

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
      toast.error("لم يتم العثور على السجل");
      router.push("/dashboard");
      return;
    }

    setRecord(recordRes.data);
    setEditName(recordRes.data.name);
    setImages(imagesRes.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRecord();
  }, [recordId]);

  const handleRename = async () => {
    if (!editName.trim()) return;
    const supabase = createClient();

    const { error } = await supabase
      .from("records")
      .update({ name: editName.trim() })
      .eq("id", recordId);

    if (error) {
      toast.error("فشل تحديث الاسم");
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: "UPDATE_RECORD",
      target_id: recordId,
      details: { old_name: record.name, new_name: editName.trim() },
    });

    setRecord({ ...record, name: editName.trim() });
    setIsEditing(false);
    toast.success("تم تحديث اسم السجل");
  };

  const handleDeleteRecord = async () => {
    const supabase = createClient();

    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", recordId);

    if (error) {
      toast.error("فشل حذف السجل");
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: "DELETE_RECORD",
      target_id: recordId,
      details: { name: record.name },
    });

    toast.success("تم حذف السجل");
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

  if (isLoading) return <DetailSkeleton />;
  if (!record) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
        العودة للوحة التحكم
      </button>

      {/* Record Header */}
      <div className="card-static p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Cover Image */}
          <div className="w-full md:w-72 h-52 rounded-xl overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
            {record.cover_image_url ? (
              <img
                src={record.cover_image_url}
                alt={record.name}
                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                onClick={() => setLightboxIndex(0)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImagesIcon className="w-12 h-12 text-[var(--text-tertiary)]" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex-1 space-y-4">
            {/* Title */}
            <div className="flex items-start gap-3">
              {isEditing ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 text-xl font-bold bg-transparent border-b-2 border-brand-500 outline-none text-[var(--text-primary)] pb-1"
                    autoFocus
                  />
                  <button
                    onClick={handleRename}
                    className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(record.name);
                    }}
                    className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-[var(--text-primary)] leading-relaxed">
                    {record.name}
                  </h1>
                </div>
              )}
              {isAdmin && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                  title="تعديل الاسم"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Avatar
                  name={record.creator?.name || ""}
                  src={record.creator?.avatar_url}
                  size="sm"
                />
                <span>{record.creator?.name || "غير معروف"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span>{formatDate(record.created_at)}</span>
              </div>
              <Badge variant="brand">
                <ImagesIcon className="w-3 h-3 me-1" />
                {images.length} صورة
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowUpload(true)}
              >
                إضافة صورة
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  حذف السجل
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          معرض الصور
        </h2>
        {images.length === 0 ? (
          <div className="text-center py-12 card-static">
            <ImagesIcon className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">
              لا توجد صور في هذا السجل
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-tertiary)] cursor-pointer"
                onClick={() => setLightboxIndex(index)}
              >
                <img
                  src={image.image_url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                  <span className="text-[10px] text-white/80">
                    {formatDate(image.uploaded_at)}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteImageId(image.id);
                      }}
                      className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
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
        title="تأكيد حذف السجل"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            هل أنت متأكد من حذف السجل &ldquo;{record.name}&rdquo;؟ سيتم حذف جميع الصور
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
    </div>
  );
}
