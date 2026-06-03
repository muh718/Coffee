"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Sparkles, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("يرجى تعبئة جميع الحقول");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.");
      setIsLoading(false);
      return;
    }

    toast.success("مرحباً بك! 👋");
    router.push("/dashboard");
    router.refresh();
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
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg relative">
            <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
          </div>
          <h1 className="text-2xl font-bold gradient-brand-text mb-2">
            {APP_NAME}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            سجل دخولك أو أنشئ حساباً جديداً
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
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
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              dir="ltr"
              autoComplete="current-password"
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
            تسجيل الدخول
          </Button>
        </form>

        {/* Register Link */}
        <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
          ليس لديك حساب؟{" "}
          <Link
            href="/register"
            className="text-brand-500 hover:text-brand-400 font-medium transition-colors"
          >
            إنشاء حساب جديد
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
