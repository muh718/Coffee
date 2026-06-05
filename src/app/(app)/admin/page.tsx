"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  ScrollText,
  Shield,
  Search,
  Ticket,
  Copy,
  Check,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button";
import Avatar from "@/components/ui/avatar";
import Badge from "@/components/ui/badge";
import Input from "@/components/ui/input";
import Modal from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import {
  ROLE_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_LOGS_PER_PAGE,
} from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/utils";

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "invitations" | "logs">("users");

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("ليس لديك صلاحية الوصول لهذه الصفحة");
      router.push("/dashboard");
    }
  }, [user, router]);

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          إدارة النظام
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          إدارة المستخدمين والدعوات وعرض سجلات النشاط
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-tertiary)] w-fit">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "users"
              ? "gradient-brand text-white shadow-md"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Users className="w-4 h-4" />
          الأعضاء
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "invitations"
              ? "gradient-brand text-white shadow-md"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Ticket className="w-4 h-4" />
          الدعوات
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "logs"
              ? "gradient-brand text-white shadow-md"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <ScrollText className="w-4 h-4" />
          سجل النشاط
        </button>
      </div>

      {activeTab === "users" ? (
        <UserManagement />
      ) : activeTab === "invitations" ? (
        <InvitationManagement />
      ) : (
        <AuditLogs />
      )}
    </div>
  );
}

/* ═══════════ إدارة الدعوات ═══════════ */
function InvitationManagement() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [selectedRole, setSelectedRole] = useState<"user" | "admin">("user");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    fetchInvitations();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const fetchInvitations = async () => {
    try {
      const res = await fetch("/api/invitations");
      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch {
      console.error("Failed to fetch invitations");
    } finally {
      setIsLoading(false);
    }
  };

  const createInvitation = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = await res.json();

      if (data.success && data.invitation) {
        setNewCode(data.invitation.code);
        setNewExpiry(data.invitation.expires_at);
        setCountdown(3 * 60); // 3 minutes
        setCopied(false);
        fetchInvitations();
        toast.success("تم إنشاء كود الدعوة!");
      } else {
        toast.error("فشل إنشاء الدعوة");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setIsCreating(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(newCode);
    setCopied(true);
    toast.success("تم نسخ الكود!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getInvitationStatus = (inv: any) => {
    if (inv.used_by) return "used";
    if (new Date(inv.expires_at) < new Date()) return "expired";
    return "active";
  };

  return (
    <div className="space-y-6">
      {/* إنشاء دعوة */}
      <div className="card-static p-6 space-y-5">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          إنشاء دعوة جديدة
        </h3>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="space-y-2 flex-1">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              دور المدعو
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRole("user")}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedRole === "user"
                    ? "gradient-brand text-[#20120b] border-transparent shadow-md"
                    : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                عضو عادي
              </button>
              <button
                onClick={() => setSelectedRole("admin")}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedRole === "admin"
                    ? "gradient-brand text-[#20120b] border-transparent shadow-md"
                    : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <Shield className="w-4 h-4 inline me-1" />
                مدير
              </button>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={createInvitation}
            isLoading={isCreating}
            icon={<Ticket className="w-4 h-4" />}
          >
            إنشاء كود دعوة
          </Button>
        </div>

        {/* عرض الكود المُنشأ */}
        {newCode && countdown > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-center space-y-4"
          >
            <p className="text-sm text-[var(--text-secondary)]">
              شارك هذا الكود مع من تريد دعوته:
            </p>
            <div className="flex items-center justify-center gap-3">
              <span
                className="text-3xl font-mono font-bold tracking-[0.4em] text-[var(--text-primary)] select-all"
                dir="ltr"
              >
                {newCode}
              </span>
              <button
                onClick={copyCode}
                className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
                title="نسخ الكود"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Copy className="w-5 h-5 text-[var(--text-tertiary)]" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-amber-500 font-medium">
                ينتهي خلال {formatCountdown(countdown)}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* قائمة الدعوات السابقة */}
      <div className="card-static overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            الدعوات السابقة
          </h3>
        </div>
        <div className="divide-y divide-[var(--border-secondary)]">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-4 w-16 rounded-full" />
                <div className="flex-1" />
                <div className="skeleton h-4 w-20" />
              </div>
            ))
          ) : invitations.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="text-sm text-[var(--text-tertiary)]">
                لا توجد دعوات سابقة
              </p>
            </div>
          ) : (
            invitations.map((inv) => {
              const status = getInvitationStatus(inv);
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <span
                    className="font-mono font-bold text-sm tracking-wider text-[var(--text-primary)]"
                    dir="ltr"
                  >
                    {inv.code}
                  </span>
                  <Badge
                    variant={inv.invited_role === "admin" ? "brand" : "default"}
                    size="sm"
                  >
                    {ROLE_LABELS[inv.invited_role]}
                  </Badge>
                  <div className="flex-1" />
                  {status === "used" ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>مُستخدم</span>
                    </div>
                  ) : status === "expired" ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>منتهي</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-amber-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>نشط</span>
                    </div>
                  )}
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {formatRelativeTime(inv.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ إدارة المستخدمين ═══════════ */
function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleChangeUser, setRoleChangeUser] = useState<any>(null);
  const [isFounder, setIsFounder] = useState(false);
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    const fetchUsersAndFamily = async () => {
      const supabase = createClient();
      
      // Check if current user is founder
      if (currentUser?.family_id) {
        const { data: family } = await supabase
          .from("families")
          .select("owner_id")
          .eq("id", currentUser.family_id)
          .single();
        if (family && family.owner_id === currentUser.id) {
          setIsFounder(true);
        }
      }

      // Fetch users in the same family
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("family_id", currentUser?.family_id)
        .order("created_at", { ascending: false });
        
      setUsers(data || []);
      setIsLoading(false);
    };
    if (currentUser) fetchUsersAndFamily();
  }, [currentUser]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      toast.error("فشل تغيير الصلاحية");
      return;
    }

    await supabase.from("audit_logs").insert({
      user_id: currentUser!.id,
      action: "UPDATE_USER_ROLE",
      target_id: userId,
      details: { new_role: newRole },
    });

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setRoleChangeUser(null);
    toast.success("تم تغيير الصلاحية");
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في طرد ${userName} من العائلة؟`)) return;

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('remove_family_member', { target_user_id: userId });
      
      if (error) throw error;
      
      if (data && data.success) {
        toast.success(`تم طرد ${userName} بنجاح`);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        toast.error(data?.error || "حدث خطأ أثناء طرد العضو");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    }
  };

  return (
    <div className="card-static overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="text-start text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-6 py-4">
                المستخدم
              </th>
              <th className="text-start text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-6 py-4">
                البريد
              </th>
              <th className="text-start text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-6 py-4">
                الصلاحية
              </th>
              <th className="text-start text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-6 py-4">
                تاريخ الانضمام
              </th>
              <th className="text-start text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-6 py-4">
                إجراء
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border-secondary)]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="skeleton w-9 h-9 rounded-full" />
                        <div className="skeleton h-4 w-24" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="skeleton h-4 w-32" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-4 w-20" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-8 w-20 rounded-lg" /></td>
                  </tr>
                ))
              : users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} src={u.avatar_url} size="sm" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {u.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)]" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.role === "admin" ? "brand" : "default"}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-tertiary)]">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {u.id !== currentUser?.id && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRoleChangeUser(u)}
                          >
                            تغيير
                          </Button>
                          {isFounder && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveMember(u.id, u.name)}
                            >
                              طرد
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Role Change Modal */}
      <Modal
        isOpen={!!roleChangeUser}
        onClose={() => setRoleChangeUser(null)}
        title="تغيير صلاحية المستخدم"
        size="sm"
      >
        {roleChangeUser && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              تغيير صلاحية <strong>{roleChangeUser.name}</strong>:
            </p>
            <div className="flex gap-3">
              <Button
                variant={roleChangeUser.role === "admin" ? "ghost" : "primary"}
                className="flex-1"
                onClick={() => handleRoleChange(roleChangeUser.id, "admin")}
                disabled={roleChangeUser.role === "admin"}
              >
                <Shield className="w-4 h-4 me-1" />
                مدير
              </Button>
              <Button
                variant={roleChangeUser.role === "user" ? "ghost" : "secondary"}
                className="flex-1"
                onClick={() => handleRoleChange(roleChangeUser.id, "user")}
                disabled={roleChangeUser.role === "user"}
              >
                <Users className="w-4 h-4 me-1" />
                مستخدم
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ═══════════ سجل النشاط ═══════════ */
function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("audit_logs")
        .select("*, user:users!user_id(id, name, avatar_url)")
        .order("performed_at", { ascending: false })
        .limit(AUDIT_LOGS_PER_PAGE);
      setLogs(data || []);
      setIsLoading(false);
    };
    fetchLogs();
  }, []);

  const filteredLogs = filter
    ? logs.filter(
        (log) =>
          log.action.toLowerCase().includes(filter.toLowerCase()) ||
          log.user?.name?.includes(filter) ||
          AUDIT_ACTION_LABELS[log.action]?.includes(filter)
      )
    : logs;

  return (
    <div className="space-y-4">
      <Input
        placeholder="فلتر حسب الإجراء أو اسم المستخدم..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        icon={<Search className="w-4 h-4" />}
      />

      <div className="card-static divide-y divide-[var(--border-secondary)]">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="skeleton w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-48" />
                  <div className="skeleton h-3 w-24" />
                </div>
              </div>
            ))
          : filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-4 p-4 hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <Avatar
                  name={log.user?.name || "نظام"}
                  src={log.user?.avatar_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">
                    <span className="font-medium">{log.user?.name || "نظام"}</span>
                    {" — "}
                    <span className="text-[var(--text-secondary)]">
                      {AUDIT_ACTION_LABELS[log.action] || log.action}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {formatRelativeTime(log.performed_at)}
                    {log.ip_address && ` · ${log.ip_address}`}
                  </p>
                </div>
                <Badge
                  variant={
                    log.action.includes("DELETE")
                      ? "danger"
                      : log.action.includes("CREATE") || log.action.includes("UPLOAD")
                      ? "success"
                      : "default"
                  }
                  size="sm"
                >
                  {AUDIT_ACTION_LABELS[log.action]?.split(" ")[0] || log.action}
                </Badge>
              </div>
            ))}

        {!isLoading && filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <ScrollText className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">لا توجد سجلات نشاط</p>
          </div>
        )}
      </div>
    </div>
  );
}
