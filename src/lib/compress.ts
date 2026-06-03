// ============================================
// Image Compression Utility
// ============================================

import imageCompression from "browser-image-compression";
import { COMPRESSED_MAX_SIZE_MB, COMPRESSED_MAX_WIDTH } from "./constants";

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: COMPRESSED_MAX_SIZE_MB,
    maxWidthOrHeight: COMPRESSED_MAX_WIDTH,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error("Image compression failed, using original:", error);
    return file;
  }
}
