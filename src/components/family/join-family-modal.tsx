"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";

interface JoinFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JoinFamilyModal({
  isOpen,
  onClose,
  onSuccess,
}: JoinFamilyModalProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      setError("يرجى إدخال كود الدعوة");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/invitations/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "كود الدعوة غير صحيح");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);

      // إعادة تحميل الصفحة بعد ثانية
      setTimeout(() => {
        onSuccess();
        handleClose();
        window.location.reload();
      }, 1500);
    } catch {
      setError("حدث خطأ في الاتصال");
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setError("");
    setSuccess(false);
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="الانضمام إلى عائلة"
      description="أدخل كود الدعوة الذي حصلت عليه من مدير العائلة"
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
                تم الانضمام بنجاح! 🎉
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                جاري تحديث الصفحة...
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
            {/* تحذير */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ عند الانضمام لعائلة جديدة، ستنتقل إلى سجلات العائلة
                الجديدة. سجلاتك القديمة ستبقى مع عائلتك السابقة.
              </p>
            </div>

            {/* حقل الإدخال */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                كود الدعوة
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-[var(--text-tertiary)]">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="مثال: A3X9K2"
                  maxLength={8}
                  dir="ltr"
                  className="w-full rounded-xl border bg-[#fdfbf2] px-4 py-3 ps-10 text-center text-lg font-mono font-bold tracking-[0.3em] text-[#20120b] placeholder:text-[#20120b]/40 border-[var(--border-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 transition-all duration-200 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRedeem();
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
                onClick={handleRedeem}
                disabled={!code.trim() || isLoading}
                isLoading={isLoading}
              >
                انضمام
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
