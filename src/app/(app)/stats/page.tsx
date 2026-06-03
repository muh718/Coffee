"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Images, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function StatsPage() {
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalImages: 0,
    recentCount: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient();
      
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const [recordsRes, imagesRes, recentRes] = await Promise.all([
        supabase.from("records").select("id", { count: "exact", head: true }),
        supabase.from("images").select("id", { count: "exact", head: true }),
        supabase.from("records").select("id", { count: "exact", head: true }).gte('created_at', sevenDaysAgo),
      ]);
      
      setStats({
        totalRecords: recordsRes.count || 0,
        totalImages: imagesRes.count || 0,
        recentCount: recentRes.count || 0,
      });
    };
    fetchStats();
  }, []);

  const statCards = [
    {
      label: "إجمالي السجلات",
      value: stats.totalRecords,
      icon: FileText,
      color: "from-brand-500 to-brand-600",
    },
    {
      label: "إجمالي الصور",
      value: stats.totalImages,
      icon: Images,
      color: "from-accent-500 to-accent-600",
    },
    {
      label: "سجلات آخر 7 أيام",
      value: stats.recentCount,
      icon: TrendingUp,
      color: "from-emerald-500 to-emerald-600",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          الإحصائيات
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          نظرة عامة على محاصيل القهوة والصور المضافة
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card-static p-5 flex items-center gap-4"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}
            >
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {stat.value.toLocaleString("ar-SA")}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {stat.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
