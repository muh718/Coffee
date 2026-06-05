"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronDown, Menu, LayoutDashboard, Shield, BarChart3, UserPlus, Users, MinusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/ui/theme-toggle";
import Avatar from "@/components/ui/avatar";
import JoinFamilyModal from "@/components/family/join-family-modal";
import CreateFamilyModal from "@/components/family/create-family-modal";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

export default function Header() {
  const { user: storeUser, setUser } = useAuthStore();
  const [localUser, setLocalUser] = useState<User | null>(storeUser);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [showJoinFamily, setShowJoinFamily] = useState(false);
  const [showCreateFamily, setShowCreateFamily] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<{ id: string; name: string; avatar_url: string | null; role: string; family_role: string }[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const displayUser = localUser || storeUser;
  const isAdmin = displayUser?.role === "admin";
  const isFounder = displayUser?.families?.owner_id === displayUser?.id;

  // FETCH REAL DATA logic as requested
  useEffect(() => {
    const fetchRealData = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      
      const { data: profile } = await supabase
        .from('users')
        .select('*, families!users_family_id_fkey(name, owner_id)')
        .eq('id', authUser.id)
        .single();
        
      if (profile) {
        // Normalize the families object
        if (profile['families!users_family_id_fkey']) {
          profile.families = profile['families!users_family_id_fkey'];
          delete profile['families!users_family_id_fkey'];
        }
        setLocalUser(profile);
        setUser(profile); // Sync global store
      }
    };
    fetchRealData();
  }, [setUser]);


  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setShowMembers(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setNavMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Remove familyData from useState since we fetch it globally
  // We only fetch familyMembers when showMembers is true
  const fetchFamilyMembers = async () => {
    if (!displayUser?.family_id) return;
    const supabase = createClient();
    const { data: members } = await supabase
      .from('users')
      .select('id, name, avatar_url, role, family_role')
      .eq('family_id', displayUser.family_id)
      .order('created_at', { ascending: true });
    
    if (members) setFamilyMembers(members);
  };

  const handleToggleMembers = () => {
    if (!showMembers && familyMembers.length === 0) {
      fetchFamilyMembers();
    }
    setShowMembers(!showMembers);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    router.push("/login");
  };



  const handleLeaveFamily = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في الخروج من العائلة؟ إذا كنت المالك، سيتم نقل الملكية لأقدم عضو.")) return;
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('leave_family');
      
      if (error) throw error;
      
      if (data && data.success) {
        // Refresh local UI to hide dropdown immediately
        if (displayUser) {
          const updatedUser: User = {
            ...displayUser,
            family_id: null,
            families: undefined
          };
          setLocalUser(updatedUser);
          setUser(updatedUser);
          setFamilyMembers([]);
          setShowMembers(false);
        }
        toast.success("تمت مغادرة العائلة بنجاح");
        router.refresh();
      }
    } catch (error) {
      console.error('Leave family error:', error);
      toast.error("حدث خطأ غير متوقع");
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("هل أنت متأكد من أنك تريد حذف حسابك نهائياً؟ هذا الإجراء لا يمكن التراجع عنه وسيحذف جميع بياناتك!")) {
      try {
        const response = await fetch('/api/user/delete', { method: 'POST' });
        const result = await response.json();
        if (!result.success) {
          toast.error(result.error || "فشل في حذف الحساب");
        } else {
          toast.success("تم حذف الحساب بنجاح");
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Delete account error:', error);
        toast.error("حدث خطأ أثناء محاولة حذف الحساب");
      }
    }
  };

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (window.confirm(`هل أنت متأكد من إزالة ${memberName} من العائلة؟`)) {
      try {
        const response = await fetch('/api/family/kick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: memberId })
        });
        const result = await response.json();
        if (!result.success) {
          toast.error(result.error || "فشل في إزالة العضو");
        } else {
          toast.success(`تم إزالة ${memberName} بنجاح`);
          fetchFamilyMembers(); // Refresh members list
        }
      } catch (error) {
        console.error('Kick member error:', error);
        toast.error("حدث خطأ أثناء محاولة إزالة العضو");
      }
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch('/api/family/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: memberId, role: newRole })
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error || "فشل في تحديث الصلاحية");
      } else {
        toast.success("تم تحديث الصلاحية بنجاح");
        fetchFamilyMembers(); // Refresh members list
      }
    } catch (error) {
      console.error('Change role error:', error);
      toast.error("حدث خطأ أثناء محاولة تحديث الصلاحية");
    }
  };

  const handleCreateFamilySuccess = (familyName: string, familyId: string) => {
    if (displayUser) {
      const updatedUser: User = {
        ...displayUser,
        family_id: familyId,
        role: 'admin' as "admin" | "user",
        families: { name: familyName, owner_id: displayUser.id }
      };
      setLocalUser(updatedUser);
      setUser(updatedUser);
    }
    toast.success(`تم إنشاء عائلة ${familyName} بنجاح!`);
    window.location.reload();
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
    <>
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
              <Image src="/logo.png" alt="Logo" fill className="object-cover" />
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
          {displayUser && (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Avatar name={displayUser.name} src={displayUser.avatar_url} size="sm" />
                <span className="text-sm font-medium text-[var(--text-primary)] hidden md:inline">
                  {displayUser.name}
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
                        {displayUser?.name}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {displayUser?.email}
                      </p>
                      {displayUser?.family_id && displayUser?.families && (
                        <button
                           onClick={handleToggleMembers}
                           className="mt-1 w-full text-start flex items-center justify-between text-xs font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary)]/80 transition-colors"
                        >
                           <span>{displayUser.families.name}</span>
                           <ChevronDown className={`w-3 h-3 transition-transform ${showMembers ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {showMembers && familyMembers.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]"
                        >
                          <div className="p-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {familyMembers.map((m) => (
                              <div key={m.id} className="flex flex-col gap-1 px-2 py-1.5 rounded-md hover:bg-[var(--bg-card-hover)] border-b border-[var(--border-primary)] last:border-0">
                                <div className="flex items-center gap-2">
                                  <Avatar name={m.name} src={m.avatar_url} size="sm" className="w-5 h-5 text-[10px]" />
                                  <span className="text-xs text-[var(--text-secondary)]">
                                    {m.name} {m.id === displayUser.families?.owner_id && "👑"}
                                  </span>
                                </div>
                                
                                {isFounder && m.id !== displayUser.id && (
                                  <div className="flex items-center gap-2 mt-1 justify-between ps-7">
                                    <select
                                      value={m.family_role || 'member'}
                                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                      className="text-[10px] bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-1 py-0.5 text-[var(--text-secondary)] focus:outline-none"
                                    >
                                      <option value="member">عضو</option>
                                      <option value="admin">مدير</option>
                                    </select>
                                    
                                    <button 
                                      onClick={() => handleKickMember(m.id, m.name)}
                                      className="text-[10px] text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-full flex items-center gap-1 transition-colors"
                                    >
                                      إزالة
                                      <MinusCircle className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="p-2 border-t border-[var(--border-primary)]">
                             <button
                               onClick={() => {
                                 setUserMenuOpen(false);
                                 handleLeaveFamily();
                               }}
                               className="w-full flex items-center gap-2 justify-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                             >
                               <LogOut className="w-3 h-3" />
                               مغادرة العائلة
                             </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="py-1">
                      {/* Family Actions */}
                      {!displayUser?.family_id ? (
                        <>
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              setShowCreateFamily(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                            إنشاء عائلة جديدة
                          </button>
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              setShowJoinFamily(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                            الانضمام إلى عائلة
                          </button>
                        </>
                      ) : (
                        <>
                          {isFounder ? (
                            <Link
                              href="/admin"
                              onClick={() => setUserMenuOpen(false)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--brand-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <UserPlus className="w-4 h-4" />
                              إرسال دعوة للانضمام إلى العائلة
                            </Link>
                          ) : (
                            <button
                               onClick={handleToggleMembers}
                               className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                               <Users className="w-4 h-4" />
                               أنت عضو في {displayUser?.families?.name}
                            </button>
                          )}
                        </>
                      )}

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors border-t border-[var(--border-primary)] mt-1"
                      >
                        <LogOut className="w-4 h-4" />
                        تسجيل الخروج
                      </button>

                      <button
                        onClick={handleDeleteAccount}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        حذف الحساب نهائياً
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      {/* Join Family Modal */}
      <JoinFamilyModal
        isOpen={showJoinFamily}
        onClose={() => setShowJoinFamily(false)}
        onSuccess={() => {
          toast.success("تم الانضمام للعائلة بنجاح!");
        }}
      />

      {/* Create Family Modal */}
      <CreateFamilyModal
        isOpen={showCreateFamily}
        onClose={() => setShowCreateFamily(false)}
        onSuccess={handleCreateFamilySuccess}
      />
    </>
  );
}
