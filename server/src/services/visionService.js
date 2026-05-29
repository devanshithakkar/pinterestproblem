import { Buffer } from "node:buffer";

const DEFAULT_ANALYSIS = {
  title: "Untitled inspiration",
  description: "AI-analyzed visual inspiration.",
  detectedTags: [],
  objects: [],
  style: [],
  colors: [],
  mood: [],
  category: "inspiration",
  suggestedBoardName: null,
  reasoning: "Vision analysis is unavailable, so PinMind used fallback image metadata.",
};

function compactList(value = []) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function safeJsonFromText(text = "") {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeVisionAnalysis(value = {}) {
  return {
    title: String(value.title || DEFAULT_ANALYSIS.title).trim(),
    description: String(value.description || DEFAULT_ANALYSIS.description).trim(),
    detectedTags: compactList(value.detectedTags || value.tags),
    objects: compactList(value.objects || value.subjects),
    style: compactList(value.style || value.aesthetic),
    colors: compactList(value.colors),
    mood: compactList(value.mood),
    category: String(value.category || DEFAULT_ANALYSIS.category).trim().toLowerCase(),
    suggestedBoardName: value.suggestedBoardName ? String(value.suggestedBoardName).trim() : null,
    reasoning: String(value.reasoning || DEFAULT_ANALYSIS.reasoning).trim(),
  };
}

function dataUrlFromBase64(imageBase64, mimeType = "image/jpeg") {
  if (!imageBase64) return null;
  if (String(imageBase64).startsWith("data:image/")) return imageBase64;
  return `data:${mimeType};base64,${imageBase64}`;
}

function prompt() {
  return `Analyze this image for a Pinterest-style smart board organizer.
Return only valid JSON with:
{
  "title": "short useful pin title",
  "description": "one sentence visual description",
  "detectedTags": ["visual", "tags"],
  "objects": ["main objects or subjects"],
  "style": ["aesthetic/style words"],
  "colors": ["dominant colors"],
  "mood": ["mood words"],
  "category": "single broad category",
  "suggestedBoardName": "short board name or null",
  "reasoning": "why these labels fit"
}
Do not ask the user for manual tags or descriptions.`;
}

function imageWords({ imageUrl = "", fileName = "" }) {
  return `${imageUrl} ${fileName}`
    .split(/[/?#&=._-]/)
    .join(" ")
    .toLowerCase();
}

function metadataTags(input = {}) {
  return [...new Set(imageWords(input)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !["https", "http", "www", "com", "jpg", "jpeg", "png", "webp", "unknown", "example"].includes(word)))]
    .slice(0, 8);
}

function mockVisionAnalyzer(input = {}) {
  const words = imageWords(input);
  const groups = [
    {
      category: "coding",
      test: /coding|code|dashboard|laptop|developer|terminal|workspace|interface|analytics|desk/,
      title: "Developer workspace reference",
      tags: ["coding", "laptop", "dashboard", "workspace", "interface"],
      objects: ["laptop", "desk", "screen"],
      style: ["productive", "minimal", "technical"],
      colors: ["neutral", "dark", "green"],
      mood: ["focused", "modern"],
      board: "Coding Ideas",
    },
    {
      category: "fashion",
      test: /fashion|outfit|dress|streetwear|jewelry|linen|wardrobe|shoe|style/,
      title: "Outfit inspiration",
      tags: ["fashion", "outfit", "style", "wardrobe", "texture"],
      objects: ["clothing", "accessories"],
      style: ["editorial", "layered"],
      colors: ["neutral"],
      mood: ["confident", "polished"],
      board: "Outfit Ideas",
    },
    {
      category: "decor",
      test: /room|decor|interior|plant|lamp|sofa|bedroom|shelf|rug|lighting/,
      title: "Interior decor inspiration",
      tags: ["decor", "interior", "room", "lighting", "plant"],
      objects: ["furniture", "decor", "lighting"],
      style: ["cozy", "minimal"],
      colors: ["warm", "neutral"],
      mood: ["calm", "homey"],
      board: "Room Decor Ideas",
    },
    {
      category: "food",
      test: /food|recipe|pasta|tomato|basil|kitchen|breakfast|dessert|plate|baking/,
      title: "Recipe inspiration",
      tags: ["food", "recipe", "plate", "kitchen", "meal"],
      objects: ["dish", "plate", "ingredients"],
      style: ["fresh", "homemade"],
      colors: ["warm", "red", "green"],
      mood: ["cozy", "appetizing"],
      board: "Recipe Ideas",
    },
  ];

  const match = groups.find((group) => group.test.test(words));
  if (match) {
    return normalizeVisionAnalysis({
      title: match.title,
      description: `The image appears to show ${match.tags.slice(0, 3).join(", ")} inspiration.`,
      detectedTags: match.tags,
      objects: match.objects,
      style: match.style,
      colors: match.colors,
      mood: match.mood,
      category: match.category,
      suggestedBoardName: match.board,
      reasoning: "Mock vision matched semantic words from the image URL or uploaded file name.",
    });
  }

  const tags = metadataTags(input);
  return normalizeVisionAnalysis({
    title: "Fresh visual inspiration",
    description: tags.length
      ? `The image appears related to ${tags.slice(0, 4).join(", ")} and may need its own board.`
      : "The image appears to represent a distinct visual idea that may need its own board.",
    detectedTags: tags.length ? tags : ["inspiration", "visual", "reference"],
    objects: tags.slice(0, 3).length ? tags.slice(0, 3) : ["subject"],
    style: ["curated"],
    colors: ["mixed"],
    mood: ["open-ended"],
    category: "new idea",
    suggestedBoardName: tags[0] ? `${tags[0][0].toUpperCase()}${tags[0].slice(1)} Ideas` : "Fresh Ideas",
    reasoning: "Mock vision could not identify a strong existing category from metadata.",
  });
}

async function analyzeWithOpenAI({ imageUrl, imageBase64, mimeType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt() },
            { type: "input_image", image_url: imageUrl || dataUrlFromBase64(imageBase64, mimeType), detail: "low" },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI vision request failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.text)?.text;
  return normalizeVisionAnalysis(safeJsonFromText(text) || {});
}

async function analyzeWithGemini({ imageUrl, imageBase64, mimeType }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  let base64 = imageBase64;
  let mediaType = mimeType || "image/jpeg";
  if (!base64 && imageUrl) {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error(`Unable to fetch image for Gemini: ${imageResponse.status}`);
    mediaType = imageResponse.headers.get("content-type") || mediaType;
    base64 = Buffer.from(await imageResponse.arrayBuffer()).toString("base64");
  }

  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt() },
              { inline_data: { mime_type: mediaType, data: base64 } },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini vision request failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  return normalizeVisionAnalysis(safeJsonFromText(text) || {});
}

export async function analyzeImageWithVision({ imageUrl, imageBase64, mimeType, fileName } = {}) {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();

  try {
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      return await analyzeWithOpenAI({ imageUrl, imageBase64, mimeType });
    }
    if (provider === "gemini" && process.env.GEMINI_API_KEY) {
      return await analyzeWithGemini({ imageUrl, imageBase64, mimeType });
    }
  } catch (error) {
    console.warn(`[Vision] ${provider} failed, falling back to mock analyzer.`, error.message);
  }

  return mockVisionAnalyzer({ imageUrl, imageBase64, mimeType, fileName });
}

export { mockVisionAnalyzer };
