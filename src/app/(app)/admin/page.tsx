"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  ScrollText,
  Shield,
  ChevronDown,
  Search,
  Calendar,
  Filter,
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
  const [activeTab, setActiveTab] = useState<"users" | "logs">("users");

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
          إدارة المستخدمين وعرض سجلات النشاط
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
          المستخدمين
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

      {activeTab === "users" ? <UserManagement /> : <AuditLogs />}
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleChangeUser, setRoleChangeUser] = useState<any>(null);
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      setUsers(data || []);
      setIsLoading(false);
    };
    fetchUsers();
  }, []);

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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRoleChangeUser(u)}
                        >
                          تغيير
                        </Button>
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
