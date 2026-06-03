// ============================================
// Supabase Edge Function: OCR Pipeline
// ============================================
// Processes uploaded images through OCR and AI title generation
// Endpoint: POST /functions/v1/ocr-pipeline

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OCRRequest {
  imageUrl: string;
  recordId?: string;
  isFirstImage: boolean;
}

interface OCRResponse {
  suggestedTitle: string;
  rawText: string;
  imageId?: string;
  success: boolean;
  error?: string;
}

// Extract text using Google Cloud Vision API
async function extractTextWithVision(
  imageBase64: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [
              { type: "TEXT_DETECTION", maxResults: 1 },
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
            ],
            imageContext: {
              languageHints: ["ar", "en"],
            },
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (data.responses?.[0]?.error) {
    throw new Error(
      `Vision API error: ${data.responses[0].error.message}`
    );
  }

  // Prefer DOCUMENT_TEXT_DETECTION for structured text
  const fullTextAnnotation = data.responses?.[0]?.fullTextAnnotation;
  if (fullTextAnnotation?.text) {
    return fullTextAnnotation.text;
  }

  // Fallback to TEXT_DETECTION
  const textAnnotations = data.responses?.[0]?.textAnnotations;
  if (textAnnotations?.length > 0) {
    return textAnnotations[0].description || "";
  }

  return "";
}

// Generate a clean title using OpenAI
async function generateTitle(
  rawText: string,
  apiKey: string
): Promise<string> {
  if (!rawText || rawText.trim().length < 3) {
    return "UNTITLED";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a document title generator. Given OCR-extracted text from a document image, generate a clean, structured title.

Rules:
- Fix OCR typos and glitches
- Format: "[Document Type] - [Entity/Company] - [Date]" when applicable
- If the text is mostly Arabic, generate an Arabic title
- If the text is mostly English, generate an English title
- If text quality is very poor or meaningless, respond with exactly "UNTITLED"
- Keep the title under 100 characters
- Do not add quotes around the title
- Respond with ONLY the title, nothing else`,
        },
        {
          role: "user",
          content: `Extract a document title from this OCR text:\n\n${rawText.substring(0, 2000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    }),
  });

  const data = await response.json();
  const title = data.choices?.[0]?.message?.content?.trim();

  if (!title || title === "UNTITLED") {
    return "UNTITLED";
  }

  return title;
}

// Download image and convert to base64
async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }

  return btoa(binary);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrl, recordId, isFirstImage } =
      (await req.json()) as OCRRequest;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API keys from environment
    const visionApiKey = Deno.env.get("GOOGLE_VISION_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    // Download and convert image
    const imageBase64 = await imageUrlToBase64(imageUrl);

    // Step 1: OCR Extraction
    let rawText = "";
    if (visionApiKey) {
      try {
        rawText = await extractTextWithVision(imageBase64, visionApiKey);
      } catch (e) {
        console.error("Vision API error, proceeding with empty text:", e);
      }
    }

    // Step 2: AI Title Generation (only for first image)
    let suggestedTitle = "";
    if (isFirstImage) {
      if (openaiApiKey && rawText.trim().length > 0) {
        try {
          suggestedTitle = await generateTitle(rawText, openaiApiKey);
        } catch (e) {
          console.error("OpenAI error:", e);
          suggestedTitle = "UNTITLED";
        }
      } else {
        suggestedTitle = "UNTITLED";
      }

      // Fallback title with date
      if (suggestedTitle === "UNTITLED") {
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        suggestedTitle = `أرشيف بدون عنوان - ${dateStr}`;
      }
    }

    const response: OCRResponse = {
      suggestedTitle,
      rawText,
      success: true,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("OCR Pipeline error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        suggestedTitle: "",
        rawText: "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
