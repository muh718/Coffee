"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Images, Calendar, User } from "lucide-react";
import Avatar from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";

interface RecordCardProps {
  id: string;
  name: string;
  coverImageUrl: string | null;
  imageCount: number;
  creatorName: string;
  creatorAvatar?: string | null;
  createdAt: string;
  index?: number;
}

export default function RecordCard({
  id,
  name,
  coverImageUrl,
  imageCount,
  creatorName,
  creatorAvatar,
  createdAt,
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
          {/* Cover Image */}
          <div className="relative w-full h-48 overflow-hidden bg-[var(--bg-tertiary)]">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Images className="w-12 h-12 text-[var(--text-tertiary)]" />
              </div>
            )}
            {/* Image Count Badge */}
            <div className="absolute top-3 end-3 glass rounded-lg px-2.5 py-1 flex items-center gap-1.5">
              <Images className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {imageCount}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 leading-relaxed group-hover:text-brand-500 transition-colors">
              {name}
            </h3>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
