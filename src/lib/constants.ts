// ============================================
// Application Constants
// ============================================

export const APP_NAME = "محاصيل القهوة";
export const APP_NAME_EN = "Coffee Crops";
export const APP_DESCRIPTION = "نظام إدارة محاصيل القهوة";

// Image upload limits
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const COMPRESSED_MAX_SIZE_MB = 2;
export const COMPRESSED_MAX_WIDTH = 800;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
];

// Fuzzy matching thresholds
export const SIMILARITY_HIGH_THRESHOLD = 0.8;
export const SIMILARITY_MIN_THRESHOLD = 0.3;

// Pagination
export const RECORDS_PER_PAGE = 20;
export const AUDIT_LOGS_PER_PAGE = 50;

// Search
export const SEARCH_DEBOUNCE_MS = 300;

// Supabase Storage
export const STORAGE_BUCKET = "documents";

// Invitations
export const INVITATION_EXPIRY_MINUTES = 3;
export const INVITATION_CODE_LENGTH = 6;

// Audit log action labels (Arabic)
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_RECORD: "إنشاء سجل",
  UPDATE_RECORD: "تعديل سجل",
  DELETE_RECORD: "حذف سجل",
  UPLOAD_IMAGE: "رفع صورة",
  DELETE_IMAGE: "حذف صورة",
  VIEW_IMAGE: "عرض صورة",
  DOWNLOAD_IMAGE: "تحميل صورة",
  UPDATE_USER_ROLE: "تغيير صلاحية مستخدم",
  CREATE_INVITATION: "إنشاء دعوة",
  REDEEM_INVITATION: "استخدام دعوة",
  LOGIN: "تسجيل دخول",
  LOGOUT: "تسجيل خروج",
};

// Role labels
export const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  user: "مستخدم",
};

