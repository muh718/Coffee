"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CheckCircle, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";

interface CreateFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (familyName: string, familyId: string) => void;
}

export default function CreateFamilyModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateFamilyModalProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("يرجى إدخال اسم العائلة");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/family/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "حدث خطأ أثناء إنشاء العائلة");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);

      // إعادة تحميل الصفحة بعد التحديث
      setTimeout(() => {
        onSuccess(data.name, data.family_id);
        handleClose();
      }, 1500);
    } catch {
      setError("حدث خطأ في الاتصال");
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setError("");
    setSuccess(false);
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="إنشاء عائلة جديدة"
      description="أدخل اسم العائلة للبدء بإضافة السجلات ودعوة الأعضاء"
      size="sm"
    >
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-4"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--text-primary)]">
                تم الإنشاء بنجاح! 🎉
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                جاري التحديث...
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            {/* حقل الإدخال */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                اسم العائلة
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-[var(--text-tertiary)]">
                  <Users className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="مثال: عائلة أحمد"
                  dir="rtl"
                  className="w-full rounded-xl border bg-[#fdfbf2] px-4 py-3 ps-10 text-base text-[#20120b] placeholder:text-[#20120b]/40 border-[var(--border-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 transition-all duration-200 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>
            </div>

            {/* رسالة الخطأ */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-500">{error}</p>
              </motion.div>
            )}

            {/* الأزرار */}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={handleClose}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={!name.trim() || isLoading}
                isLoading={isLoading}
              >
                إنشاء العائلة
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
