// ============================================
// TypeScript Type Definitions
// ============================================

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  family_id: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  family_id: string;
  code: string;
  invited_role: UserRole;
  created_by: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  // Joined fields
  creator?: User;
}

export interface DocRecord {
  id: string;
  name: string;
  cover_image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  country_of_origin: string | null;
  brew_type: string | null;
  // Joined fields
  creator?: User;
  image_count?: number;
}

export interface Image {
  id: string;
  record_id: string;
  image_url: string;
  raw_ocr_text: string;
  uploaded_by: string;
  uploaded_at: string;
  // Joined fields
  uploader?: User;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_id: string | null;
  details: { [key: string]: unknown } | null;
  ip_address: string | null;
  performed_at: string;
  // Joined fields
  user?: User;
}

export interface SimilarRecord {
  record_id: string;
  record_name: string;
  similarity_score: number;
  is_exact_match: boolean;
  is_highly_similar: boolean;
}

export interface SearchResult {
  record_id: string;
  record_name: string;
  cover_image_url: string | null;
  created_by: string;
  creator_name: string;
  image_count: number;
  created_at: string;
  relevance: number;
}

export interface OCRResult {
  suggestedTitle: string;
  rawText: string;
  success: boolean;
  error?: string;
}

export interface UploadState {
  step: "idle" | "compressing" | "uploading" | "processing" | "reviewing" | "saving" | "done" | "error";
  progress: number;
  suggestedTitle: string;
  rawText: string;
  imageUrl: string;
  error?: string;
}

export type AuditAction =
  | "CREATE_RECORD"
  | "UPDATE_RECORD"
  | "DELETE_RECORD"
  | "UPLOAD_IMAGE"
  | "DELETE_IMAGE"
  | "VIEW_IMAGE"
  | "DOWNLOAD_IMAGE"
  | "UPDATE_USER_ROLE"
  | "CREATE_INVITATION"
  | "REDEEM_INVITATION"
  | "LOGIN"
  | "LOGOUT";

