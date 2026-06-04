import { NextRequest, NextResponse } from "next/server";
import Tesseract from "tesseract.js";

// Generate a clean title from OCR text
function generateTitle(rawText: string): string {
  if (!rawText || rawText.trim().length === 0) {
    const dateStr = new Date().toISOString().split("T")[0];
    return `أرشيف بدون عنوان - ${dateStr}`;
  }

  // Clean the text
  const cleaned = rawText
    .replace(/[\n\r]+/g, " ") // Remove newlines
    .replace(/\s+/g, " ") // Normalize spaces
    .replace(/[^\p{L}\p{N}\s\-\/\.:,،؛]/gu, "") // Keep letters, numbers, basic punctuation
    .trim();

  // Take the first meaningful line/sentence
  const lines = cleaned.split(/[.\n،؛]/).filter((l) => l.trim().length > 3);
  let title = lines[0]?.trim() || cleaned;

  // Limit length
  if (title.length > 80) {
    title = title.substring(0, 80).trim();
    // Don't cut in the middle of a word
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > 40) {
      title = title.substring(0, lastSpace);
    }
  }

  // If title is too short, add date
  if (title.length < 5) {
    const dateStr = new Date().toISOString().split("T")[0];
    return `${title} - ${dateStr}`;
  }

  return title;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, isFirstImage } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "No image URL provided", suggestedTitle: "", rawText: "" },
        { status: 400 }
      );
    }

    // Run OCR with Tesseract.js (supports Arabic + English)
    let rawText = "";
    try {
      const result = await Tesseract.recognize(imageUrl, "ara+eng", {
        logger: () => {}, // Suppress logs
      });
      rawText = result.data.text || "";
    } catch (ocrError) {
      console.error("Tesseract OCR error:", ocrError);
      // OCR failed — continue with empty text
    }

    // Generate title from extracted text
    const suggestedTitle = isFirstImage ? generateTitle(rawText) : "";

    return NextResponse.json({
      success: true,
      rawText: rawText.trim(),
      suggestedTitle,
    });
  } catch (error) {
    console.error("OCR API error:", error);
    const dateStr = new Date().toISOString().split("T")[0];
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        suggestedTitle: `أرشيف بدون عنوان - ${dateStr}`,
        rawText: "",
      },
      { status: 500 }
    );
  }
}
