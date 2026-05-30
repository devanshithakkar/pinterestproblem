import { Buffer } from "node:buffer";

const DEFAULT_ANALYSIS = {
  title: "Untitled inspiration",
  description: "AI-analyzed visual inspiration.",
  primarySubject: "visual inspiration",
  primaryCategory: "inspiration",
  secondaryCategories: [],
  detectedTags: [],
  detectedObjects: [],
  objects: [],
  style: [],
  colors: [],
  mood: [],
  environment: "unknown",
  isPerson: false,
  isAnimal: false,
  isInterior: false,
  isFood: false,
  isFashion: false,
  isTech: false,
  isAnimeOrIllustration: false,
  isMusicOrConcert: false,
  isVehicle: false,
  isCampusOrFriends: false,
  eventType: null,
  peopleCount: null,
  confidenceNotes: "Vision analysis is unavailable.",
  category: "inspiration",
  suggestedBoardName: null,
  suggestedBoardDescription: null,
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
  const primaryCategory = String(value.primaryCategory || value.category || DEFAULT_ANALYSIS.primaryCategory)
    .trim()
    .toLowerCase();
  const detectedObjects = compactList(value.detectedObjects || value.objects || value.subjects);
  return {
    title: String(value.title || DEFAULT_ANALYSIS.title).trim(),
    description: String(value.description || DEFAULT_ANALYSIS.description).trim(),
    primarySubject: String(value.primarySubject || detectedObjects[0] || DEFAULT_ANALYSIS.primarySubject).trim(),
    primaryCategory,
    secondaryCategories: compactList(value.secondaryCategories || value.categories),
    detectedTags: compactList(value.detectedTags || value.tags),
    detectedObjects,
    objects: detectedObjects,
    style: compactList(value.style || value.aesthetic),
    colors: compactList(value.colors),
    mood: compactList(value.mood),
    environment: String(value.environment || DEFAULT_ANALYSIS.environment).trim().toLowerCase(),
    isPerson: Boolean(value.isPerson),
    isAnimal: Boolean(value.isAnimal),
    isInterior: Boolean(value.isInterior),
    isFood: Boolean(value.isFood),
    isFashion: Boolean(value.isFashion),
    isTech: Boolean(value.isTech),
    isAnimeOrIllustration: Boolean(value.isAnimeOrIllustration),
    isMusicOrConcert: Boolean(value.isMusicOrConcert),
    isVehicle: Boolean(value.isVehicle),
    isCampusOrFriends: Boolean(value.isCampusOrFriends),
    eventType: value.eventType ? String(value.eventType).trim().toLowerCase() : null,
    peopleCount: value.peopleCount ? String(value.peopleCount).trim().toLowerCase() : null,
    confidenceNotes: String(value.confidenceNotes || DEFAULT_ANALYSIS.confidenceNotes).trim(),
    category: primaryCategory,
    suggestedBoardName: value.suggestedBoardName ? String(value.suggestedBoardName).trim() : null,
    suggestedBoardDescription: value.suggestedBoardDescription ? String(value.suggestedBoardDescription).trim() : null,
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
Return only valid JSON. Do not include markdown. Identify the main subject first and do not over-focus on the background.
If the image is an animal, pet, person, food, fashion item, concert, music event, campus/friends photo, tech/UI screenshot, anime character, vehicle, or illustration, make that the primary category even when the background contains unrelated objects.
Do not infer a vehicle from metadata or background unless a car, motorcycle, bicycle, truck, bus, or vehicle is the primary subject.
Concert images should be music/concert/event. Dress/outfit images should be fashion/outfit/style. Campus group photos should be campus life/friends/college memories.
Use the exact JSON shape below:
{
  "title": "short useful pin title",
  "description": "one sentence visual description",
  "primarySubject": "the main subject, not the background",
  "primaryCategory": "animal|pet|wildlife|nature|concert|music event|campus life|friends|interior|room decor|food|fashion|tech|coding|ui design|anime|illustration|art|travel|fitness|vehicle|other",
  "secondaryCategories": ["other relevant categories"],
  "detectedObjects": ["main objects or subjects"],
  "detectedTags": ["visual", "tags"],
  "style": ["aesthetic/style words"],
  "colors": ["dominant colors"],
  "mood": ["mood words"],
  "environment": "where the subject appears, such as studio, home, outdoors, screen, unknown",
  "eventType": "concert|festival|campus|wedding|sports|null",
  "peopleCount": "none|one|small group|crowd|null",
  "isPerson": false,
  "isAnimal": false,
  "isInterior": false,
  "isFood": false,
  "isFashion": false,
  "isTech": false,
  "isAnimeOrIllustration": false,
  "isMusicOrConcert": false,
  "isVehicle": false,
  "isCampusOrFriends": false,
  "confidenceNotes": "short note about uncertainty or strong visual evidence",
  "suggestedBoardName": "short board name or null",
  "suggestedBoardDescription": "short board description or null",
  "reasoning": "why these labels fit"
}
Do not ask the user for manual tags or descriptions.`;
}

function imageWords({ fileName = "" }) {
  return `${fileName}`
    .split(/[/?#&=._-]/)
    .join(" ")
    .toLowerCase();
}

function metadataTags(input = {}) {
  return [...new Set(imageWords(input)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
        .filter(
          (word) =>
            word.length > 2 &&
            word.length < 18 &&
            !/^[a-f0-9-]{12,}$/i.test(word) &&
            !["https", "http", "www", "com", "jpg", "jpeg", "png", "webp", "unknown", "example", "supabase", "storage"].includes(word),
        ))]
    .slice(0, 8);
}

function mockVisionAnalyzer(input = {}) {
  const words = imageWords(input);
  const groups = [
    {
      primaryCategory: "coding",
      test: /coding|code|dashboard|laptop|developer|terminal|workspace|interface|analytics|desk/,
      title: "Developer workspace reference",
      subject: "developer screen setup",
      tags: ["coding", "laptop", "dashboard", "workspace", "interface"],
      objects: ["laptop", "desk", "screen"],
      style: ["productive", "minimal", "technical"],
      colors: ["neutral", "dark", "green"],
      mood: ["focused", "modern"],
      board: "Coding Ideas",
      flags: { isTech: true },
    },
    {
      primaryCategory: "fashion",
      test: /fashion|outfit|dress|streetwear|jewelry|linen|wardrobe|shoe|style/,
      title: "Outfit inspiration",
      subject: "outfit styling",
      tags: ["fashion", "outfit", "style", "wardrobe", "texture"],
      objects: ["clothing", "accessories"],
      style: ["editorial", "layered"],
      colors: ["neutral"],
      mood: ["confident", "polished"],
      board: "Outfit Ideas",
      flags: { isFashion: true, isPerson: true },
    },
    {
      primaryCategory: "interior",
      test: /room|decor|interior|plant|lamp|sofa|bedroom|shelf|rug|lighting/,
      title: "Interior decor inspiration",
      subject: "interior decor",
      tags: ["decor", "interior", "room", "lighting", "plant"],
      objects: ["furniture", "decor", "lighting"],
      style: ["cozy", "minimal"],
      colors: ["warm", "neutral"],
      mood: ["calm", "homey"],
      board: "Room Decor Ideas",
      flags: { isInterior: true },
    },
    {
      primaryCategory: "food",
      test: /food|recipe|pasta|tomato|basil|kitchen|breakfast|dessert|plate|baking/,
      title: "Recipe inspiration",
      subject: "prepared food",
      tags: ["food", "recipe", "plate", "kitchen", "meal"],
      objects: ["dish", "plate", "ingredients"],
      style: ["fresh", "homemade"],
      colors: ["warm", "red", "green"],
      mood: ["cozy", "appetizing"],
      board: "Recipe Ideas",
      flags: { isFood: true },
    },
    {
      primaryCategory: "animal",
      test: /animal|pet|cat|dog|puppy|kitten|bird|wildlife|horse|rabbit|cute/,
      title: "Animal photography",
      subject: "animal",
      tags: ["animal", "pet", "wildlife", "cute", "portrait"],
      objects: ["animal"],
      style: ["natural", "expressive"],
      colors: ["mixed"],
      mood: ["playful", "warm"],
      board: "Animal Photography",
      flags: { isAnimal: true },
    },
    {
      primaryCategory: "anime",
      test: /anime|manga|character|illustration|wallpaper|cartoon|drawing|fanart/,
      title: "Anime character inspiration",
      subject: "anime character",
      tags: ["anime", "illustration", "character", "art", "wallpaper"],
      objects: ["character", "illustration"],
      style: ["illustrated", "anime"],
      colors: ["vibrant"],
      mood: ["expressive"],
      board: "Anime Aesthetic",
      flags: { isAnimeOrIllustration: true },
    },
    {
      primaryCategory: "concert",
      test: /concert|music|stage|singer|band|festival|crowd|performance/,
      title: "Concert moment",
      subject: "live music performance",
      tags: ["concert", "music", "stage", "performance", "event"],
      objects: ["stage", "performer", "crowd"],
      style: ["cinematic", "live"],
      colors: ["dark", "vibrant"],
      mood: ["energetic"],
      board: "Concerts / Music Events",
      flags: { isMusicOrConcert: true, eventType: "concert", peopleCount: "crowd" },
    },
    {
      primaryCategory: "campus life",
      test: /campus|college|student|friends|group|university|classmate/,
      title: "Campus friends",
      subject: "group of friends",
      tags: ["campus", "friends", "college", "student life"],
      objects: ["people", "friends"],
      style: ["candid", "social"],
      colors: ["mixed"],
      mood: ["friendly", "nostalgic"],
      board: "Campus Life / Friends",
      flags: { isCampusOrFriends: true, isPerson: true, peopleCount: "small group" },
    },
    {
      primaryCategory: "vehicle",
      test: /vehicle|car|motorcycle|bicycle|truck|bus|automotive/,
      title: "Vehicle inspiration",
      subject: "vehicle",
      tags: ["vehicle", "car", "automotive"],
      objects: ["vehicle"],
      style: ["mechanical"],
      colors: ["mixed"],
      mood: ["dynamic"],
      board: "Vehicles",
      flags: { isVehicle: true },
    },
  ];

  const match = groups.find((group) => group.test.test(words));
  if (match) {
    return normalizeVisionAnalysis({
      title: match.title,
      description: `The image appears to show ${match.tags.slice(0, 3).join(", ")} inspiration.`,
      primarySubject: match.subject,
      primaryCategory: match.primaryCategory,
      secondaryCategories: match.tags.slice(0, 3),
      detectedTags: match.tags,
      detectedObjects: match.objects,
      style: match.style,
      colors: match.colors,
      mood: match.mood,
      environment: words.includes("outdoor") ? "outdoors" : "unknown",
      suggestedBoardName: match.board,
      confidenceNotes: "Mock vision matched strong semantic words from metadata.",
      reasoning: "Mock vision matched semantic words from the image URL or uploaded file name.",
      ...match.flags,
    });
  }

  const tags = metadataTags(input);
  return normalizeVisionAnalysis({
    title: "Fresh visual inspiration",
    description: tags.length
      ? `The image appears related to ${tags.slice(0, 4).join(", ")} and may need its own board.`
      : "The image appears to represent a distinct visual idea that may need its own board.",
    primarySubject: tags[0] || "visual subject",
    primaryCategory: "other",
    secondaryCategories: tags.slice(1, 4),
    detectedTags: tags.length ? tags : ["inspiration", "visual", "reference"],
    detectedObjects: tags.slice(0, 3).length ? tags.slice(0, 3) : ["subject"],
    style: ["curated"],
    colors: ["mixed"],
    mood: ["open-ended"],
    environment: "unknown",
    suggestedBoardName: tags[0] ? `${tags[0][0].toUpperCase()}${tags[0].slice(1)} Ideas` : "Fresh Ideas",
    suggestedBoardDescription: "General visual inspiration that needs a safe fallback board.",
    confidenceNotes: "Mock vision found only weak metadata clues.",
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
            { type: "input_image", image_url: dataUrlFromBase64(imageBase64, mimeType) || imageUrl, detail: "low" },
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
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(18_000) });
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
