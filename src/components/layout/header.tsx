"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronDown, Menu, Sparkles, LayoutDashboard, Shield, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/ui/theme-toggle";
import Avatar from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function Header() {
  const { user } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setNavMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    router.push("/login");
  };

  const navItems = [
    {
      href: "/dashboard",
      label: "الصفحة الرئيسية",
      icon: LayoutDashboard,
    },
    {
      href: "/stats",
      label: "الإحصائيات",
      icon: BarChart3,
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "إدارة النظام",
            icon: Shield,
          },
        ]
      : []),
  ];

  return (
    <header className="h-[var(--header-height)] border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Logo & Navigation */}
      <div className="flex items-center gap-4">
        {/* Nav Menu */}
        <div ref={navMenuRef} className="relative">
          <button
            onClick={() => setNavMenuOpen(!navMenuOpen)}
            className="p-2 -ms-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {navMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute start-0 top-full mt-2 w-56 glass-strong rounded-xl shadow-xl overflow-hidden z-50 p-2 space-y-1"
              >
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setNavMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "gradient-brand text-white shadow-md"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      )}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm relative">
            <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
          </div>
          <h1 className="text-base font-bold gradient-brand-text hidden sm:block">
            {APP_NAME}
          </h1>
        </Link>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* User Menu */}
        {user && (
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Avatar name={user.name} src={user.avatar_url} size="sm" />
              <span className="text-sm font-medium text-[var(--text-primary)] hidden md:inline">
                {user.name}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute end-0 top-full mt-2 w-56 glass-strong rounded-xl shadow-xl overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-[var(--border-primary)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {user.name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {user.email}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      تسجيل الخروج
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
