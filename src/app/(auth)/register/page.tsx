"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, User, Sparkles, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("يرجى تعبئة جميع الحقول");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          full_name: name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      toast.error(error.message || "حدث خطأ أثناء إنشاء الحساب");
      setIsLoading(false);
      return;
    }

    setIsSuccess(true);
    setName("");
    setEmail("");
    setPassword("");
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="glass-strong rounded-3xl p-8 shadow-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-brand flex items-center justify-center shadow-lg animate-pulse-glow">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            إنشاء حساب جديد
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            انضم إلى الأرشيف الذكي
          </p>
        </div>

        {/* Form */}
        {!isSuccess ? (
          <form onSubmit={handleRegister} className="space-y-5">
            <Input
              label="الاسم الكامل"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="محمد أحمد"
              icon={<User className="w-4 h-4" />}
              autoComplete="name"
            />

            <Input
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              icon={<Mail className="w-4 h-4" />}
              dir="ltr"
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="كلمة المرور"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                icon={<Lock className="w-4 h-4" />}
                dir="ltr"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-[38px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
            >
              إنشاء الحساب
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-green-500">تم التسجيل بنجاح!</h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              تم إنشاء حسابك بنجاح. يرجى التحقق من بريدك الإلكتروني والضغط على رابط التأكيد لتفعيل الحساب.
            </p>
          </div>
        )}

        {/* Login Link */}
        <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
          لديك حساب بالفعل؟{" "}
          <Link
            href="/login"
            className="text-brand-500 hover:text-brand-400 font-medium transition-colors"
          >
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
