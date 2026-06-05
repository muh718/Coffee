"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
          error: authError
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          console.error("Auth error:", authError);
          setLoading(false);
          router.push("/login");
          return;
        }

        // Fetch user profile from public.users
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*, families!users_family_id_fkey(name, owner_id)")
          .eq("id", authUser.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
           console.error("Profile fetch error:", JSON.stringify(profileError, null, 2), profileError.message);
        }

        if (profile) {
          // Normalize the families object to match the expected interface
          if (profile['families!users_family_id_fkey']) {
            profile.families = profile['families!users_family_id_fkey'];
            delete profile['families!users_family_id_fkey'];
          }
          setUser(profile);
        } else {
          // Profile not yet synced — use auth data
          setUser({
            id: authUser.id,
            name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "مستخدم",
            email: authUser.email || "",
            role: "user",
            avatar_url: authUser.user_metadata?.avatar_url || null,
            family_id: null,
            created_at: authUser.created_at,
          });
        }
      } catch (err) {
        console.error("Unexpected auth error:", err);
        setLoading(false);
        router.push("/login");
      }
    };

    fetchUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl gradient-brand flex items-center justify-center animate-pulse-glow">
            <svg
              className="w-6 h-6 text-white animate-spin-slow"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
