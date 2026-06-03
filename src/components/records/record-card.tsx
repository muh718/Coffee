"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Images } from "lucide-react";

interface RecordCardProps {
  id: string;
  name: string;
  coverImageUrl: string | null;
  imageCount: number;
  creatorName: string;
  creatorAvatar?: string | null;
  createdAt: string;
  countryOfOrigin?: string | null;
  brewType?: string | null;
  index?: number;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "البرازيل": "🇧🇷",
  "إثيوبيا": "🇪🇹",
  "سلفادور": "🇸🇻",
  "أوغندا": "🇺🇬",
  "كوستاريكا": "🇨🇷",
  "إندونيسيا": "🇮🇩",
  "كولمبيا": "🇨🇴",
  "بيرو": "🇵🇪",
  "اليمن": "🇾🇪",
};

export default function RecordCard({
  id,
  name,
  coverImageUrl,
  countryOfOrigin,
  brewType,
  index = 0,
}: RecordCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/records/${id}`} className="block group">
        <div className="card overflow-hidden">
          {/* Cover Image — full visible, no crop */}
          <div className="relative w-full aspect-[3/4] overflow-hidden bg-[var(--bg-tertiary)] flex items-center justify-center">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt={name}
                className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <Images className="w-12 h-12 text-[var(--text-tertiary)]" />
            )}
          </div>

          {/* Name + details */}
          <div className="px-3 py-3 space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] text-center line-clamp-1 group-hover:text-brand-500 transition-colors">
              {name}
            </h3>

            {/* Country on one side, brew type on the other */}
            {(countryOfOrigin || brewType) && (
              <div className="flex items-center justify-between text-sm text-[var(--text-tertiary)]">
                <span>
                  {countryOfOrigin
                    ? `${COUNTRY_FLAGS[countryOfOrigin] || "🌍"} ${countryOfOrigin}`
                    : ""}
                </span>
                <span>{brewType || ""}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
