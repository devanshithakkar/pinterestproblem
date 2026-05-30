import express from "express";
import multer from "multer";
import { readDb } from "../db/jsonStore.js";
import { analyzeImageForBoards, predictBoard, getRecommendations } from "../services/aiService.js";
import { uploadImageBuffer } from "../services/storageService.js";
import { analyzeImageWithVision } from "../services/visionService.js";
import { searchImageLibrary } from "../services/imageLibraryService.js";
import { createPinterestPin, isPinterestConfigured } from "../services/pinterestService.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createBoard,
  createPin,
  deleteBoard,
  deletePin,
  getAiTrainingData,
  getBoardWithPins,
  getBoards,
  getProfile,
  getProfileByUsername,
  getPinWithBoard,
  getPins,
  getVisibleBoardsForProfile,
  getVisibleBoardWithPins,
  movePin,
  savePrediction,
  searchPublicUsers,
  updateBoard,
  updateProfile,
  updatePin,
  updatePinPinterestStatus,
} from "../services/databaseService.js";

export const apiRouter = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype?.startsWith("image/")) return callback(new Error("Only image uploads are supported."));
    callback(null, true);
  },
});

function uploadSingleImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Images must be 8MB or smaller after compression."
        : error.message || "Only image uploads are supported.";
    return res.status(400).json({ message });
  });
}

function sendSupabaseReadError(res, resource, error) {
  console.error(`Failed to load ${resource} from Supabase`, error);
  res.status(500).json({ message: `Unable to load ${resource}. Please check the Supabase configuration.` });
}

function sendSupabaseWriteError(res, resource, error) {
  console.error(`Failed to create ${resource} in Supabase`, error);
  res.status(500).json({ message: `Unable to create ${resource}. Please check the Supabase configuration.` });
}

function buildAiContext(boards, pins) {
  return {
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      description: board.description,
      tags: board.tags || [],
      aesthetic: board.aesthetic,
    })),
    pins: pins.map((pin) => ({
      id: pin.id,
      boardId: pin.boardId,
      title: pin.title,
      caption: pin.caption,
      tags: pin.tags || [],
    })),
    corrections: [],
    recommendations: [],
  };
}

async function getAiContextForUser(userId) {
  return getAiTrainingData(userId);
}

function aiImagePayload(body = {}) {
  return {
    imageUrl: body.imageUrl || body.image_url,
    fileName: body.fileName || body.file_name,
    title: body.title,
    description: body.description,
    caption: body.caption || body.description,
    tags: body.tags,
    providerTags: body.providerTags || body.provider_tags,
    dominantColor: body.dominantColor || body.dominant_color,
    source: body.source,
    height: body.height,
  };
}

function visionPayloadForBoardMatching(visionAnalysis, body = {}) {
  return {
    imageUrl: body.imageUrl || body.image_url,
    fileName: body.fileName || body.file_name,
    title: visionAnalysis.title || body.title,
    description: visionAnalysis.description || body.description,
    caption: visionAnalysis.description || body.caption || body.description,
    primarySubject: visionAnalysis.primarySubject,
    primaryCategory: visionAnalysis.primaryCategory,
    secondaryCategories: visionAnalysis.secondaryCategories,
    detectedObjects: visionAnalysis.detectedObjects || visionAnalysis.objects,
    tags: visionAnalysis.detectedTags || body.tags,
    objects: visionAnalysis.objects,
    style: visionAnalysis.style,
    colors: visionAnalysis.colors,
    mood: visionAnalysis.mood,
    environment: visionAnalysis.environment,
    isPerson: visionAnalysis.isPerson,
    isAnimal: visionAnalysis.isAnimal,
    isInterior: visionAnalysis.isInterior,
    isFood: visionAnalysis.isFood,
    isFashion: visionAnalysis.isFashion,
    isTech: visionAnalysis.isTech,
    isAnimeOrIllustration: visionAnalysis.isAnimeOrIllustration,
    isMusicOrConcert: visionAnalysis.isMusicOrConcert,
    isVehicle: visionAnalysis.isVehicle,
    isCampusOrFriends: visionAnalysis.isCampusOrFriends,
    eventType: visionAnalysis.eventType,
    peopleCount: visionAnalysis.peopleCount,
    category: visionAnalysis.category,
    suggestedBoardName: visionAnalysis.suggestedBoardName,
    source: body.source,
    height: body.height,
  };
}

function normalizeDecision(boardDecision, visionAnalysis) {
  const suggestedBoardName =
    boardDecision.action === "suggest_new_board"
      ? visionAnalysis.suggestedBoardName || boardDecision.suggestedBoardName
      : boardDecision.suggestedBoardName || visionAnalysis.suggestedBoardName;
  return {
    action: boardDecision.action,
    predictedBoard: boardDecision.predictedBoard,
    predictedBoardId: boardDecision.predictedBoardId,
    predictedBoardName: boardDecision.predictedBoardName,
    confidence: boardDecision.confidence,
    confidencePercent: boardDecision.confidencePercent,
    detectedTags: boardDecision.detectedTags,
    reasoning: boardDecision.reasoning,
    suggestedBoardName,
    suggestedBoardDescription:
      boardDecision.suggestedBoardDescription ||
      (suggestedBoardName ? `AI-created board for ${visionAnalysis.detectedTags.slice(0, 5).join(", ")} inspiration.` : null),
    suggestedKeywords: boardDecision.suggestedKeywords || visionAnalysis.detectedTags?.slice(0, 8) || [],
    suggestedTitle: visionAnalysis.title,
    suggestedCaption: visionAnalysis.description,
    scores: boardDecision.scores || [],
  };
}

async function analyzeAndDecide(userId, body = {}) {
  const imageUrl = body.imageUrl || body.image_url;
  const imageBase64 = body.imageBase64 || body.image_base64;
  const mimeType = body.mimeType || body.mime_type;
  const fileName = body.fileName || body.file_name;
  if (!imageUrl && !imageBase64) throw new Error("imageUrl or imageBase64 is required.");

  const visionAnalysis = await analyzeImageWithVision({ imageUrl, imageBase64, mimeType, fileName });
  const { boards, pins, predictions } = await getAiContextForUser(userId);
  const boardDecision = analyzeImageForBoards({
    boards,
    pins,
    predictions,
    image: visionPayloadForBoardMatching(visionAnalysis, body),
  });
  const decision = normalizeDecision(boardDecision, visionAnalysis);
  return { analysis: visionAnalysis, decision };
}

function legacyPredictionPayload(analysis, decision) {
  return {
    ...decision,
    detectedTags: analysis.detectedTags,
    suggestedTitle: analysis.title,
    suggestedCaption: analysis.description,
    reasoning: decision.reasoning,
  };
}

function pinPayloadFromAi({ body, analysis, decision, boardId }) {
  return {
    title: analysis.title || body.title?.trim() || decision.suggestedTitle || "Smart AI save",
    caption: analysis.description || body.caption?.trim() || body.description?.trim() || decision.suggestedCaption || "",
    tags: analysis.detectedTags || decision.detectedTags || [],
    imageUrl: body.imageUrl || body.image_url,
    fileName: body.fileName || body.file_name,
    source: body.source || "AI vision save",
    height: body.height || 580,
    boardId,
    ai: {
      ...decision,
      ...analysis,
      predictedBoardId: decision.predictedBoard?.id,
      selectedBoardId: boardId,
      signals: analysis.detectedTags || decision.detectedTags,
      explanation: decision.reasoning,
      confidence: decision.confidence,
    },
  };
}

function smartSaveResponse({ action, analysis, decision, uploadResult, createdPin = null, createdBoard = null }) {
  return {
    action,
    confidence: decision.confidence,
    analysis,
    decision,
    predictedBoard: decision.predictedBoard || null,
    suggestedBoardName: decision.suggestedBoardName || null,
    suggestedBoardDescription: decision.suggestedBoardDescription || null,
    suggestedBoard:
      action === "suggest_new_board"
        ? {
            name: decision.suggestedBoardName,
            description: decision.suggestedBoardDescription,
            tags: decision.suggestedKeywords || analysis.detectedTags?.slice(0, 8) || [],
          }
        : null,
    image: uploadResult,
    createdPin,
    createdBoard,
    pin: createdPin,
    board: createdBoard,
  };
}

const genericBoardNames = new Set([
  "image idea",
  "image ideas",
  "untitled",
  "untitled board",
  "new board",
  "smart save",
  "misc",
  "miscellaneous",
  "fresh ideas",
  "visual inspiration",
]);

const categoryBoardMap = [
  {
    name: "Animals",
    description: "Animal, pet, and wildlife inspiration saved by PinMind.",
    keywords: ["animal", "animals", "pet", "pets", "wildlife", "dog", "cat", "bird", "puppy", "kitten", "horse", "rabbit"],
  },
  {
    name: "Nature",
    description: "Flowers, forests, mountains, beaches, and landscape inspiration.",
    keywords: ["nature", "flower", "flowers", "forest", "mountain", "beach", "landscape", "outdoors", "garden", "plant", "plants"],
  },
  {
    name: "Concerts / Music Events",
    description: "Concerts, live music, festivals, stages, performers, and music event memories.",
    keywords: ["concert", "concerts", "music", "stage", "singer", "band", "festival", "performance", "crowd", "event"],
    flags: ["isMusicOrConcert"],
  },
  {
    name: "Campus Life / Friends",
    description: "Campus memories, friends, college life, group photos, and student moments.",
    keywords: ["campus", "college", "student", "students", "friends", "friend", "group", "university", "classmate", "memories"],
    flags: ["isCampusOrFriends"],
  },
  {
    name: "Anime / Digital Art",
    description: "Anime, manga, illustration, character art, and digital art inspiration.",
    keywords: ["anime", "manga", "illustration", "illustrated", "digital", "art", "character", "cartoon", "fanart", "wallpaper"],
  },
  {
    name: "Movies / Cinema",
    description: "Movie posters, cinematic stills, film scenes, and cinema references.",
    keywords: ["movie", "movies", "cinema", "film", "poster", "cinematic", "scene", "actor", "actress"],
  },
  {
    name: "Fashion",
    description: "Outfits, streetwear, accessories, and fashion styling inspiration.",
    keywords: ["fashion", "outfit", "outfits", "streetwear", "accessories", "style", "dress", "shoe", "wardrobe", "clothing"],
  },
  {
    name: "Coding / Tech",
    description: "Coding, dashboards, UI screenshots, laptops, and technical workspace ideas.",
    keywords: ["code", "coding", "tech", "technology", "ui", "dashboard", "laptop", "developer", "screen", "interface", "software"],
  },
  {
    name: "Room Decor",
    description: "Interior rooms, furniture, decor, lighting, and home styling ideas.",
    keywords: ["interior", "room", "decor", "furniture", "home", "sofa", "lamp", "bedroom", "living", "shelf"],
  },
  {
    name: "Food",
    description: "Food, drinks, desserts, recipes, and meal inspiration.",
    keywords: ["food", "drink", "drinks", "dessert", "recipe", "meal", "plate", "pasta", "breakfast", "kitchen"],
  },
  {
    name: "Vehicles",
    description: "Cars, bikes, motorcycles, and vehicle design inspiration.",
    keywords: ["vehicle", "vehicles", "car", "cars", "bike", "bicycle", "motorcycle", "truck", "bus", "automotive"],
    flags: ["isVehicle"],
  },
  {
    name: "Fitness / Sports",
    description: "Fitness, gym, workout, sports, and active lifestyle inspiration.",
    keywords: ["sport", "sports", "fitness", "gym", "workout", "training", "yoga", "running", "athlete"],
  },
  {
    name: "Architecture / Travel",
    description: "Architecture, cities, buildings, travel, and destination inspiration.",
    keywords: ["architecture", "building", "buildings", "city", "travel", "street", "hotel", "landmark", "urban"],
  },
];

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s/]+/g, " ")
    .replace(/\bideas?\b/g, "")
    .replace(/\binspiration\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksRandomToken(value = "") {
  const compact = String(value).replace(/\s+ideas?$/i, "").replace(/[^a-z0-9]/gi, "");
  if (compact.length >= 16 && /^[a-z0-9]+$/i.test(compact)) {
    const vowelRatio = (compact.match(/[aeiou]/gi) || []).length / compact.length;
    if (vowelRatio < 0.32 || /\d/.test(compact)) return true;
  }
  if (/^[0-9a-f]{8,}$/i.test(compact)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(String(value))) return true;
  return false;
}

function metadataWords(analysis = {}, imageMetadata = {}) {
  const weakContextWords = new Set([
    "aesthetic",
    "background",
    "beautiful",
    "green",
    "grass",
    "idea",
    "ideas",
    "image",
    "inspiration",
    "light",
    "natural",
    "outdoor",
    "outdoors",
    "photo",
    "photography",
    "sunlight",
    "tree",
    "trees",
  ]);
  return [
    analysis.title,
    analysis.description,
    analysis.primarySubject,
    analysis.primaryCategory,
    analysis.category,
    analysis.eventType,
    analysis.peopleCount,
    ...(analysis.secondaryCategories || []),
    ...(analysis.detectedTags || []),
    ...(analysis.detectedObjects || analysis.objects || []),
    ...(analysis.style || []),
    ...(analysis.mood || []),
    imageMetadata.title,
    imageMetadata.description,
    imageMetadata.caption,
    imageMetadata.fileName,
    imageMetadata.file_name,
    imageMetadata.source,
    ...(Array.isArray(imageMetadata.tags) ? imageMetadata.tags : String(imageMetadata.tags || "").split(",")),
    ...(Array.isArray(imageMetadata.providerTags) ? imageMetadata.providerTags : String(imageMetadata.providerTags || "").split(",")),
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !weakContextWords.has(word));
}

function priorityCategoryFromAnalysis(analysis = {}) {
  const primary = String(analysis.primaryCategory || analysis.category || "").toLowerCase();
  const subject = String(analysis.primarySubject || "").toLowerCase();
  const objects = (analysis.detectedObjects || analysis.objects || []).map((item) => String(item).toLowerCase());
  const tags = (analysis.detectedTags || []).map((item) => String(item).toLowerCase());
  const hasAny = (...terms) => [primary, subject, ...objects, ...tags].some((value) => terms.some((term) => value.includes(term)));

  if (analysis.isMusicOrConcert || hasAny("concert", "music", "festival", "stage", "singer", "band")) return "Concerts / Music Events";
  if (analysis.isCampusOrFriends || hasAny("campus", "college", "university", "student", "friends", "group photo")) {
    return "Campus Life / Friends";
  }
  if (analysis.isFashion || hasAny("fashion", "outfit", "dress", "streetwear", "clothing", "accessory")) return "Fashion";
  if (analysis.isAnimal || hasAny("animal", "pet", "dog", "cat", "wildlife", "bird", "horse")) return "Animals";
  if (analysis.isTech || hasAny("coding", "code", "dashboard", "laptop", "interface", "software", "tech")) return "Coding / Tech";
  if (analysis.isFood || hasAny("food", "dessert", "drink", "meal", "recipe", "restaurant")) return "Food";
  if (analysis.isAnimeOrIllustration || hasAny("anime", "manga", "illustration", "digital art", "character art")) {
    return "Anime / Digital Art";
  }
  if (analysis.isVehicle || /^(vehicle|transportation|car|motorcycle|bike|bicycle|truck|bus)$/.test(primary)) return "Vehicles";
  if (analysis.isInterior || hasAny("interior", "room", "furniture", "decor", "home")) return "Room Decor";
  if (hasAny("flower", "forest", "mountain", "beach", "landscape", "plant", "garden", "nature")) return "Nature";
  if (hasAny("sport", "fitness", "gym", "workout")) return "Fitness / Sports";
  if (hasAny("architecture", "building", "city", "travel", "landmark")) return "Architecture / Travel";
  if (hasAny("movie", "cinema", "film", "poster")) return "Movies / Cinema";
  return null;
}

function getSuggestedBoardFromAnalysis(analysis = {}, imageMetadata = {}) {
  const words = metadataWords(analysis, imageMetadata);
  const wordSet = new Set(words);
  const flagMatch = categoryBoardMap.find((category) => (category.flags || []).some((flag) => analysis[flag]));
  const priorityName = priorityCategoryFromAnalysis(analysis);
  const priorityCategory = priorityName ? categoryBoardMap.find((category) => category.name === priorityName) : null;
  const primary = String(analysis.primaryCategory || analysis.category || "").toLowerCase();
  const subject = String(analysis.primarySubject || "").toLowerCase();
  const strictVehicle =
    analysis.isVehicle ||
    /^(vehicle|transportation|car|motorcycle|bike|bicycle|truck|bus)$/i.test(primary) ||
    ["car", "vehicle", "motorcycle", "bicycle", "truck", "bus"].some((term) => subject.includes(term)) ||
    (analysis.detectedObjects || analysis.objects || []).some((item) => /^(car|vehicle|motorcycle|bicycle|truck|bus)$/i.test(String(item)));
  const scored = categoryBoardMap
    .map((category) => ({
      ...category,
      score:
        (flagMatch?.name === category.name ? 20 : 0) +
        category.keywords.reduce((sum, keyword) => sum + (wordSet.has(keyword) ? 1 : 0), 0),
    }))
    .filter((category) => category.name !== "Vehicles" || strictVehicle)
    .sort((a, b) => b.score - a.score);
  const requested = normalizeName(analysis.suggestedBoardName || imageMetadata.suggestedBoardName || "");
  const isGeneric = !requested || genericBoardNames.has(requested) || looksRandomToken(requested);
  const category = scored[0]?.score > 0 ? scored[0] : null;

  if (priorityCategory) {
    return {
      name: priorityCategory.name,
      description: priorityCategory.description,
      keywords: priorityCategory.keywords.slice(0, 10),
      rejectedGenericName: isGeneric ? analysis.suggestedBoardName || imageMetadata.suggestedBoardName || null : null,
    };
  }

  if (category && (isGeneric || scored[0].score >= 1)) {
    return {
      name: category.name,
      description: category.description,
      keywords: category.keywords.slice(0, 10),
      rejectedGenericName: isGeneric ? analysis.suggestedBoardName || imageMetadata.suggestedBoardName || null : null,
    };
  }

  if (!isGeneric) {
    return {
      name: analysis.suggestedBoardName || imageMetadata.suggestedBoardName,
      description:
        imageMetadata.boardDescription ||
        `AI-created board for ${(analysis.detectedTags || words).slice(0, 5).join(", ")} inspiration.`,
      keywords: [...new Set([...(analysis.detectedTags || []), ...words])].slice(0, 10),
      rejectedGenericName: null,
    };
  }

  return {
    name: "Visual Inspiration",
    description: "General visual inspiration that does not fit a more specific category yet.",
    keywords: ["visual", "inspiration", ...words].slice(0, 10),
    rejectedGenericName: analysis.suggestedBoardName || imageMetadata.suggestedBoardName || null,
  };
}

function sanitizeBoardName(candidateName, analysis = {}, metadata = {}) {
  const normalized = normalizeName(candidateName);
  if (!normalized || genericBoardNames.has(normalized) || looksRandomToken(candidateName)) {
    return getSuggestedBoardFromAnalysis(analysis, { ...metadata, suggestedBoardName: candidateName }).name;
  }
  return String(candidateName).trim();
}

function findReusableBoard(boards = [], suggestion) {
  const suggestedName = normalizeName(suggestion.name);
  const suggestedTokens = new Set(metadataWords({}, { tags: [suggestion.name, ...(suggestion.keywords || [])] }));

  return boards.find((board) => {
    const boardName = normalizeName(board.name);
    if (!boardName) return false;
    if (boardName === suggestedName || boardName.replace(/s$/, "") === suggestedName.replace(/s$/, "")) return true;
    const boardTokens = new Set(metadataWords({}, { tags: [board.name, board.description, ...(board.tags || [])] }));
    const overlap = [...suggestedTokens].filter((token) => boardTokens.has(token));
    const aliasGroups = [
      ["animals", "animal photography", "pets wildlife", "pets and wildlife"],
      ["concerts music events", "music", "concerts", "music events"],
      ["fashion", "outfits", "style"],
      ["campus life friends", "friends", "college memories", "campus life"],
      ["anime digital art", "anime", "digital art"],
      ["coding tech", "coding", "tech", "ui design"],
    ];
    if (aliasGroups.some((group) => group.includes(boardName) && group.includes(suggestedName))) return true;
    return overlap.length >= 2 || (overlap.length >= 1 && (boardName.includes(suggestedName) || suggestedName.includes(boardName)));
  });
}

async function createAutonomousSave({ userId, body, analysis, decision, uploadResult = null }) {
  const predictedScore = (decision.scores || []).find((score) => score.boardId === decision.predictedBoard?.id);
  const predictedBoardIsSafe =
    predictedScore &&
    predictedScore.categoryCompatible !== false &&
    Number(predictedScore.penalty || 0) < 32 &&
    Number(predictedScore.categoryScore || 0) >= 45;
  const saveToExisting =
    decision.predictedBoard?.id && decision.confidence >= 0.78 && decision.action !== "suggest_new_board" && predictedBoardIsSafe;
  if (saveToExisting) {
    const createdPin = await createPin(
      userId,
      pinPayloadFromAi({ body, analysis, decision, boardId: decision.predictedBoard.id }),
    );
    return {
      status: 201,
      payload: {
        action: "saved_to_existing_board",
        confidence: decision.confidence,
        analysis,
        matchedBoard: decision.predictedBoard,
        createdBoard: null,
        createdPin,
        pin: createdPin,
        board: decision.predictedBoard,
        image: uploadResult,
        reasoning: decision.reasoning,
        rejectedBoards: decision.scores || [],
        undoTokenOrIds: { pinId: createdPin.id, boardId: createdPin.boardId, createdNewBoard: false },
        debug:
          process.env.NODE_ENV === "production"
            ? undefined
            : {
                analysisSummary: `${analysis.primarySubject || ""} / ${analysis.primaryCategory || ""}`.trim(),
                chosenBoardName: decision.predictedBoard.name,
                reusedExistingBoard: true,
                createdNewBoard: false,
                topBoardScores: decision.scores || [],
                rejectedBoardNames: (decision.scores || []).map((score) => score.boardName),
                rejectedReasons: (decision.scores || []).map((score) => score.rejectedReason).filter(Boolean),
                categoryDecision: decision.predictedBoard.name,
                sanitizedBoardName: decision.predictedBoard.name,
              },
      },
    };
  }

  const boards = await getBoards(userId);
  const suggestion = getSuggestedBoardFromAnalysis(analysis, {
    ...body,
    suggestedBoardName: decision.suggestedBoardName,
  });
  suggestion.name = sanitizeBoardName(suggestion.name, analysis, body);
  const reusableBoard = findReusableBoard(boards, suggestion);

  if (reusableBoard) {
    const createdPin = await createPin(userId, pinPayloadFromAi({ body, analysis, decision, boardId: reusableBoard.id }));
    return {
      status: 201,
      payload: {
        action: "saved_to_existing_board",
        confidence: decision.confidence,
        analysis,
        matchedBoard: reusableBoard,
        createdBoard: null,
        createdPin,
        pin: createdPin,
        board: reusableBoard,
        image: uploadResult,
        reasoning: `Reused existing board "${reusableBoard.name}" because it matched the suggested category "${suggestion.name}".${
          suggestion.rejectedGenericName ? ` Rejected generic board name "${suggestion.rejectedGenericName}".` : ""
        }`,
        rejectedBoards: decision.scores || [],
        undoTokenOrIds: { pinId: createdPin.id, boardId: createdPin.boardId, createdNewBoard: false },
        debug:
          process.env.NODE_ENV === "production"
            ? undefined
            : {
                analysisSummary: `${analysis.primarySubject || ""} / ${analysis.primaryCategory || ""}`.trim(),
                chosenBoardName: reusableBoard.name,
                reusedExistingBoard: true,
                createdNewBoard: false,
                rejectedBoardNames: (decision.scores || []).map((score) => score.boardName),
                rejectedReasons: (decision.scores || []).map((score) => score.rejectedReason).filter(Boolean),
                categoryDecision: suggestion.name,
                sanitizedBoardName: suggestion.name,
              },
      },
    };
  }

  const board = await createBoard(userId, {
    name: suggestion.name,
    description: suggestion.description || decision.suggestedBoardDescription,
    tags: suggestion.keywords || decision.suggestedKeywords || analysis.detectedTags || [],
    aesthetic: [...(analysis.style || []), ...(analysis.mood || [])].join(", ") || "AI-generated visual identity",
    coverImageUrl: body.imageUrl || body.image_url || null,
  });
  const createdPin = await createPin(userId, pinPayloadFromAi({ body, analysis, decision, boardId: board.id }));

  return {
    status: 201,
    payload: {
      action: "created_new_board_and_saved",
      confidence: decision.confidence,
      analysis,
      matchedBoard: null,
      createdBoard: board,
      createdPin,
      pin: createdPin,
      board,
      image: uploadResult,
      reasoning: `Created category board "${board.name}" for this image.${
        suggestion.rejectedGenericName ? ` Rejected generic board name "${suggestion.rejectedGenericName}".` : ""
      } ${decision.reasoning || ""}`.trim(),
      rejectedBoards: decision.scores || [],
      undoTokenOrIds: { pinId: createdPin.id, boardId: board.id, createdNewBoard: true },
      debug:
        process.env.NODE_ENV === "production"
          ? undefined
          : {
              analysisSummary: `${analysis.primarySubject || ""} / ${analysis.primaryCategory || ""}`.trim(),
              chosenBoardName: board.name,
              reusedExistingBoard: false,
              createdNewBoard: true,
              rejectedBoardNames: (decision.scores || []).map((score) => score.boardName),
              rejectedReasons: (decision.scores || []).map((score) => score.rejectedReason).filter(Boolean),
              categoryDecision: suggestion.name,
              sanitizedBoardName: board.name,
            },
    },
  };
}

async function getLegacyRecommendationsForBoard(board) {
  const db = await readDb();
  const legacyBoard = db.boards.find((item) => item.name.toLowerCase() === board.name.toLowerCase());
  return legacyBoard ? getRecommendations(db, legacyBoard.id) : [];
}

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "smart-board-organizer-api" });
});

apiRouter.use(requireAuth);

apiRouter.post("/uploads/image", uploadSingleImage, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: "Image file is required." });

    const uploadResult = await uploadImageBuffer({
      buffer: req.file.buffer,
      userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    res.status(201).json(uploadResult);
  } catch (error) {
    console.error("Failed to upload image", error);
    res.status(500).json({ message: error.message || "Unable to upload this image." });
  }
});

apiRouter.post("/ai/smart-save-upload", uploadSingleImage, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: "Image file is required." });

    console.log(`[AI] Smart-save upload started for user ${userId}: ${req.file.originalname}`);
    const uploadResult = await uploadImageBuffer({
      buffer: req.file.buffer,
      userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    const body = {
      imageUrl: uploadResult.imageUrl,
      fileName: req.file.originalname,
      mimeType: uploadResult.mimeType || req.file.mimetype,
      storagePath: uploadResult.storagePath,
      source: "Supabase Storage upload",
      height: Number(req.body.height) || 580,
    };
    const { analysis, decision } = await analyzeAndDecide(userId, body);
    console.log(`[AI] Smart-save upload decision action=${decision.action} confidence=${decision.confidencePercent}`);

    if (decision.action === "auto_save" && decision.predictedBoard?.id) {
      const createdPin = await createPin(
        userId,
        pinPayloadFromAi({ body, analysis, decision, boardId: decision.predictedBoard.id }),
      );
      return res.status(201).json(
        smartSaveResponse({
          action: "auto_save",
          analysis,
          decision,
          uploadResult,
          createdPin,
        }),
      );
    }

    await savePrediction(null, {
      ...decision,
      userId,
      predictedBoardId: decision.predictedBoard?.id,
      selectedBoardId: null,
      inputTitle: analysis.title,
      inputCaption: analysis.description,
      inputTags: analysis.detectedTags,
      inputFileName: req.file.originalname,
    });

    return res.json(
      smartSaveResponse({
        action: decision.action,
        analysis,
        decision,
        uploadResult,
      }),
    );
  } catch (error) {
    console.error("Failed to smart-save uploaded image", error);
    res.status(500).json({ message: error.message || "Unable to smart-save this image." });
  }
});

apiRouter.post("/ai/autonomous-save-upload", uploadSingleImage, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: "Image file is required." });

    console.log(`[AI] Autonomous save upload started for user ${userId}: ${req.file.originalname}`);
    const uploadResult = await uploadImageBuffer({
      buffer: req.file.buffer,
      userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    const body = {
      imageUrl: uploadResult.imageUrl,
      fileName: req.file.originalname,
      mimeType: uploadResult.mimeType || req.file.mimetype,
      storagePath: uploadResult.storagePath,
      source: "Autonomous Smart Save",
      height: Number(req.body.height) || 580,
    };
    const { analysis, decision } = await analyzeAndDecide(userId, body);
    const result = await createAutonomousSave({ userId, body, analysis, decision, uploadResult });
    console.log(`[AI] Autonomous save ${result.payload.action} confidence=${Math.round((decision.confidence || 0) * 100)}`);
    res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Failed to autonomous-save uploaded image", error);
    res.status(500).json({ message: error.message || "Unable to autonomous-save this image." });
  }
});

apiRouter.post("/ai/autonomous-save", async (req, res) => {
  try {
    const userId = req.user.id;
    const body = aiImagePayload(req.body);
    if (!body.imageUrl) return res.status(400).json({ message: "imageUrl is required." });

    const { analysis, decision } = await analyzeAndDecide(userId, body);
    const result = await createAutonomousSave({ userId, body, analysis, decision });
    res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Failed to autonomous-save image", error);
    res.status(500).json({ message: error.message || "Unable to autonomous-save this image." });
  }
});

apiRouter.post("/ai/smart-save", async (req, res) => {
  try {
    const userId = req.user.id;
    const body = aiImagePayload(req.body);
    if (!body.imageUrl) return res.status(400).json({ message: "imageUrl is required." });

    const { analysis, decision } = await analyzeAndDecide(userId, body);
    const result = await createAutonomousSave({ userId, body, analysis, decision });
    res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Failed to smart-save image", error);
    res.status(500).json({ message: error.message || "Unable to smart-save this image." });
  }
});

apiRouter.get("/library/search", async (req, res) => {
  const query = String(req.query.q || "creative inspiration").trim() || "creative inspiration";
  const provider = String(req.query.provider || "pexels").toLowerCase();
  const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
  const perPage = Math.min(30, Math.max(20, Number.parseInt(req.query.perPage || req.query.per_page || "24", 10) || 24));

  try {
    const result = await searchImageLibrary({ query, provider, page, perPage });

    res.json({
      provider: result.provider,
      query,
      images: result.images,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Failed to search image library", error);
    res.status(500).json({ message: "Unable to search the image library." });
  }
});

apiRouter.get("/boards", async (_req, res) => {
  try {
    const boards = await getBoards(_req.user.id);
    res.json({ boards });
  } catch (error) {
    sendSupabaseReadError(res, "boards", error);
  }
});

apiRouter.get("/pins", async (_req, res) => {
  try {
    const pins = await getPins(_req.user.id);
    res.json({ pins });
  } catch (error) {
    sendSupabaseReadError(res, "pins", error);
  }
});

apiRouter.get("/pinterest/status", (_req, res) => {
  res.json({ configured: isPinterestConfigured() });
});

apiRouter.get("/me", async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    res.json({ user: req.user, profile });
  } catch (error) {
    console.error("Failed to load current profile", error);
    res.status(500).json({ message: "Unable to load your profile." });
  }
});

apiRouter.patch("/me/profile", async (req, res) => {
  try {
    const profile = await updateProfile(req.user.id, req.body);
    res.json({ profile });
  } catch (error) {
    if (/Username|Visibility|duplicate key|unique/i.test(error.message)) {
      return res.status(400).json({ message: error.message.includes("duplicate") ? "Username is already taken." : error.message });
    }
    console.error("Failed to update profile", error);
    res.status(500).json({ message: "Unable to update your profile." });
  }
});

apiRouter.get("/users", async (req, res) => {
  try {
    const result = await searchPublicUsers({
      query: req.query.q || "",
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });
    res.json(result);
  } catch (error) {
    console.error("Failed to search public users", error);
    res.status(500).json({ message: "Unable to search public users." });
  }
});

apiRouter.get("/users/:username", async (req, res) => {
  try {
    const profile = await getProfileByUsername(req.params.username);
    const isOwner = profile.id === req.user.id;
    if (!isOwner && profile.profileVisibility !== "public") {
      return res.status(403).json({ message: "This profile is private.", profile: { username: profile.username } });
    }
    res.json({ profile, isOwner });
  } catch (error) {
    if (error.message === "Profile not found" || /Username/.test(error.message)) {
      return res.status(404).json({ message: "Profile not found" });
    }
    console.error("Failed to load public profile", error);
    res.status(500).json({ message: "Unable to load this profile." });
  }
});

apiRouter.get("/users/:username/boards", async (req, res) => {
  try {
    const profile = await getProfileByUsername(req.params.username);
    const result = await getVisibleBoardsForProfile(req.user.id, profile.id);
    res.json(result);
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ message: error.message });
    if (error.message === "Profile not found" || /Username/.test(error.message)) {
      return res.status(404).json({ message: "Profile not found" });
    }
    console.error("Failed to load public boards", error);
    res.status(500).json({ message: "Unable to load public boards." });
  }
});

apiRouter.get("/users/:username/boards/:boardId", async (req, res) => {
  try {
    const profile = await getProfileByUsername(req.params.username);
    const result = await getVisibleBoardWithPins(req.user.id, profile.id, req.params.boardId);
    res.json(result);
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ message: error.message });
    if (error.status === 404 || error.message === "Profile not found" || /Username/.test(error.message)) {
      return res.status(404).json({ message: "Board or profile not found" });
    }
    console.error("Failed to load public board", error);
    res.status(500).json({ message: "Unable to load this public board." });
  }
});

apiRouter.post("/boards", async (req, res, next) => {
  try {
    const userId = req.user.id;

    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ message: "Board name is required." });
    }

    console.log(`[Supabase] Creating board for user ${userId}: ${name}`);
    const board = await createBoard(userId, { ...req.body, name });
    console.log(`[Supabase] Created board ${board.id} for user ${userId}`);

    res.status(201).json({ board });
  } catch (error) {
    sendSupabaseWriteError(res, "board", error);
  }
});

apiRouter.patch("/boards/:id", async (req, res) => {
  try {
    const board = await updateBoard(req.user.id, req.params.id, req.body);
    res.json({ board });
  } catch (error) {
    if (error.message === "Board not found") return res.status(404).json({ message: "Board not found" });
    console.error("Failed to update board", error);
    res.status(500).json({ message: "Unable to update this board." });
  }
});

apiRouter.patch("/boards/:id/visibility", async (req, res) => {
  try {
    const board = await updateBoard(req.user.id, req.params.id, { visibility: req.body.visibility });
    res.json({ board });
  } catch (error) {
    if (error.message === "Board not found") return res.status(404).json({ message: "Board not found" });
    if (/Visibility/.test(error.message)) return res.status(400).json({ message: error.message });
    console.error("Failed to update board visibility", error);
    res.status(500).json({ message: "Unable to update board visibility." });
  }
});

apiRouter.delete("/boards/:id", async (req, res) => {
  try {
    const result = await deleteBoard(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message === "Board not found") return res.status(404).json({ message: "Board not found" });
    console.error("Failed to delete board", error);
    res.status(500).json({ message: "Unable to delete this board." });
  }
});

apiRouter.patch("/boards/:boardId/pinterest", async (req, res) => {
  try {
    const pinterestBoardId = req.body.pinterestBoardId || req.body.pinterest_board_id || "";
    const board = await updateBoard(req.user.id, req.params.boardId, { pinterestBoardId });
    res.json({ board });
  } catch (error) {
    if (error.message === "Board not found") {
      return res.status(404).json({ message: "Board not found" });
    }

    console.error("Failed to update Pinterest board mapping", error);
    res.status(500).json({ message: "Unable to save Pinterest board settings." });
  }
});

apiRouter.get("/boards/:id", async (req, res) => {
  try {
    const { board, pins } = await getBoardWithPins(req.user.id, req.params.id);
    const recommendations = await getLegacyRecommendationsForBoard(board);
    res.json({ board, pins, recommendations });
  } catch (error) {
    if (error.message === "Board not found") {
      return res.status(404).json({ message: "Board not found" });
    }

    sendSupabaseReadError(res, "board details", error);
  }
});

apiRouter.post("/predict", async (req, res) => {
  try {
    const userId = req.user.id;

    const [boards, pins] = await Promise.all([getBoards(userId), getPins(userId)]);
    if (!boards.length) {
      return res.status(400).json({ message: "Create a board before running predictions." });
    }

    const prediction = predictBoard(buildAiContext(boards, pins), req.body);
    await savePrediction(null, {
      ...prediction,
      userId,
      inputTitle: req.body.title,
      inputCaption: req.body.caption,
      inputTags: req.body.tags,
      inputFileName: req.body.fileName,
      inputDominantColor: req.body.dominantColor,
    });
    res.json({ prediction });
  } catch (error) {
    console.error("Failed to run prediction from Supabase data", error);
    res.status(500).json({ message: "Unable to predict a board. Please try again." });
  }
});

apiRouter.post("/ai/predict-board", async (req, res) => {
  try {
    const userId = req.user.id;

    const { analysis, decision } = await analyzeAndDecide(userId, req.body);
    const prediction = legacyPredictionPayload(analysis, decision);
    console.log(`[AI] Prediction action=${decision.action} confidence=${decision.confidencePercent}`);

    await savePrediction(null, {
      ...prediction,
      userId,
      predictedBoardId: decision.predictedBoard?.id,
      selectedBoardId: null,
      inputTitle: analysis.title,
      inputCaption: analysis.description,
      inputTags: analysis.detectedTags,
      inputFileName: req.body.fileName || req.body.file_name,
    });

    res.json(prediction);
  } catch (error) {
    console.error("Failed to run AI board prediction", error);
    res.status(500).json({ message: "Unable to analyze this image. Please try again." });
  }
});

apiRouter.post("/ai/analyze-image", async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await analyzeAndDecide(userId, req.body);
    console.log(`[Vision] Analysis action=${result.decision.action} confidence=${result.decision.confidencePercent}`);
    res.json(result);
  } catch (error) {
    console.error("Failed to analyze image", error);
    res.status(500).json({ message: error.message || "Unable to analyze this image." });
  }
});

apiRouter.post("/ai/auto-save", async (req, res) => {
  try {
    const userId = req.user.id;

    const { analysis, decision } = await analyzeAndDecide(userId, req.body);
    const prediction = legacyPredictionPayload(analysis, decision);
    console.log(`[AI] Auto-save decision action=${decision.action} confidence=${decision.confidencePercent}`);

    if (decision.action === "auto_save" && decision.predictedBoard?.id) {
      const pin = await createPin(
        userId,
        pinPayloadFromAi({ body: req.body, analysis, decision, boardId: decision.predictedBoard.id }),
      );
      return res.status(201).json({ action: "auto_save", analysis, decision, prediction, pin });
    }

    if (decision.action === "confirm" && decision.predictedBoard?.id) {
      return res.json({
        action: "confirm",
        analysis,
        decision,
        prediction,
        confirmation: {
          boardId: decision.predictedBoard.id,
          boardName: decision.predictedBoard.name,
          savePayload: pinPayloadFromAi({ body: req.body, analysis, decision, boardId: decision.predictedBoard.id }),
        },
      });
    }

    res.json({
      action: "suggest_new_board",
      analysis,
      decision,
      prediction,
      suggestedBoard: {
        name: decision.suggestedBoardName,
        description: decision.suggestedBoardDescription,
        tags: decision.suggestedKeywords || analysis.detectedTags.slice(0, 8),
      },
    });
  } catch (error) {
    console.error("Failed to auto-save image with AI", error);
    res.status(500).json({ message: "Unable to auto-save this image. Please try again." });
  }
});

apiRouter.post("/ai/confirm-save", async (req, res) => {
  try {
    const userId = req.user.id;

    const selectedBoardId = req.body.selectedBoardId || req.body.selected_board_id || req.body.boardId;
    if (!selectedBoardId) return res.status(400).json({ message: "selectedBoardId is required." });

    const analysis = req.body.analysis || {};
    const decision = req.body.decision || {};
    const pin = await createPin(userId, pinPayloadFromAi({ body: req.body, analysis, decision, boardId: selectedBoardId }));
    res.status(201).json({ pin });
  } catch (error) {
    console.error("Failed to confirm AI save", error);
    res.status(500).json({ message: error.message || "Unable to save this image." });
  }
});

apiRouter.post("/ai/create-board-and-save", async (req, res) => {
  try {
    const userId = req.user.id;

    const analysis = req.body.analysis || {};
    const boardName = req.body.boardName || req.body.board_name || req.body.suggestedBoardName || analysis.suggestedBoardName;
    if (!boardName?.trim()) return res.status(400).json({ message: "boardName is required." });

    const board = await createBoard(userId, {
      name: boardName,
      description:
        req.body.boardDescription ||
        req.body.board_description ||
        `AI-created board for ${(analysis.detectedTags || []).slice(0, 5).join(", ")} inspiration.`,
      tags: req.body.boardKeywords || req.body.board_keywords || analysis.detectedTags || [],
      aesthetic: [...(analysis.style || []), ...(analysis.mood || [])].join(", ") || "AI-generated visual identity",
      coverImageUrl: req.body.imageUrl || req.body.image_url || null,
    });
    const pin = await createPin(
      userId,
      pinPayloadFromAi({ body: req.body, analysis, decision: req.body.decision || {}, boardId: board.id }),
    );

    res.status(201).json({ board, pin });
  } catch (error) {
    console.error("Failed to create board and save image", error);
    res.status(500).json({ message: error.message || "Unable to create the board and save this image." });
  }
});

apiRouter.post("/ai/undo-autonomous-save", async (req, res) => {
  try {
    const userId = req.user.id;
    const pinId = req.body.pinId || req.body.pin_id;
    const boardId = req.body.boardId || req.body.board_id;
    const createdNewBoard = Boolean(req.body.createdNewBoard ?? req.body.created_new_board);
    if (!pinId) return res.status(400).json({ message: "pinId is required." });

    const deletedPin = await deletePin(userId, pinId);
    let deletedBoard = null;
    if (createdNewBoard && boardId) {
      const { pins } = await getBoardWithPins(userId, boardId);
      if (!pins.length) deletedBoard = await deleteBoard(userId, boardId);
    }
    res.json({ undone: true, deletedPin, deletedBoard });
  } catch (error) {
    if (error.message === "Pin not found" || error.message === "Board not found") {
      return res.status(404).json({ message: error.message });
    }
    console.error("Failed to undo autonomous save", error);
    res.status(500).json({ message: error.message || "Unable to undo this save." });
  }
});

apiRouter.post("/pins", async (req, res, next) => {
  try {
    const userId = req.user.id;

    const boardId = req.body.boardId || req.body.board_id;
    const title = req.body.title?.trim();
    const imageUrl = req.body.imageUrl || req.body.image_url;
    if (!boardId) {
      return res.status(400).json({ message: "A valid boardId is required" });
    }
    if (!title) {
      return res.status(400).json({ message: "Pin title is required." });
    }
    if (!imageUrl) {
      return res.status(400).json({ message: "Pin imageUrl is required." });
    }

    console.log(`[Supabase] Creating pin for user ${userId} on board ${boardId}: ${title}`);
    const pin = await createPin(userId, { ...req.body, title, imageUrl });
    console.log(`[Supabase] Created pin ${pin.id} for user ${userId}`);

    res.status(201).json({ pin });
  } catch (error) {
    if (error.message === "Board not found") {
      return res.status(400).json({ message: "A valid boardId is required" });
    }

    sendSupabaseWriteError(res, "pin", error);
  }
});

apiRouter.patch("/pins/:id/board", async (req, res, next) => {
  try {
    const userId = req.user.id;

    const pin = await movePin(userId, req.params.id, req.body.boardId);
    res.json({ pin, corrections: [] });
  } catch (error) {
    if (error.message === "Board not found" || error.message === "Pin not found") {
      return res.status(404).json({ message: "Pin or board not found" });
    }

    console.error("Failed to move pin in Supabase", error);
    res.status(500).json({ message: "Unable to move pin. Please try again." });
  }
});

apiRouter.patch("/pins/:id", async (req, res) => {
  try {
    const pin = await updatePin(req.user.id, req.params.id, req.body);
    res.json({ pin });
  } catch (error) {
    if (error.message === "Pin not found") return res.status(404).json({ message: "Pin not found" });
    console.error("Failed to update pin", error);
    res.status(500).json({ message: "Unable to update this pin." });
  }
});

apiRouter.delete("/pins/:id", async (req, res) => {
  try {
    const result = await deletePin(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message === "Pin not found") return res.status(404).json({ message: "Pin not found" });
    console.error("Failed to delete pin", error);
    res.status(500).json({ message: "Unable to delete this pin." });
  }
});

apiRouter.post("/pinterest/publish/:pinId", async (req, res) => {
  try {
    const userId = req.user.id;
    if (!isPinterestConfigured()) {
      return res.status(503).json({ message: "Pinterest publishing is not configured." });
    }

    const { pin, board } = await getPinWithBoard(userId, req.params.pinId);
    if (!board.pinterestBoardId) {
      return res.status(400).json({ message: "Add a Pinterest Board ID to this PinMind board before publishing." });
    }
    if (pin.pinterestPublishStatus === "published" && pin.pinterestPinId) {
      return res.json({ pinterest: { id: pin.pinterestPinId, alreadyPublished: true }, pin });
    }

    await updatePinPinterestStatus(userId, pin.id, {
      pinterestPublishStatus: "publishing",
      pinterestPublishError: null,
    });

    const pinterest = await createPinterestPin({
      boardId: board.pinterestBoardId,
      imageUrl: pin.imageUrl,
      title: pin.title,
      description: pin.caption,
      link: req.body.link || pin.imageUrl,
    });

    const updatedPin = await updatePinPinterestStatus(userId, pin.id, {
      pinterestPinId: pinterest.id,
      pinterestPublishedAt: new Date().toISOString(),
      pinterestPublishStatus: "published",
      pinterestPublishError: null,
    });

    res.status(201).json({ pinterest, pin: updatedPin });
  } catch (error) {
    console.error("Failed to publish pin to Pinterest", error.message);
    const status = error.message === "Pin not found" || error.message === "Board not found" ? 404 : 500;
    if (status !== 404) {
      try {
        await updatePinPinterestStatus(req.user.id, req.params.pinId, {
          pinterestPublishStatus: "failed",
          pinterestPublishError: error.message,
        });
      } catch {
        // If the pin lookup itself failed, return the original publishing error.
      }
    }
    res.status(status).json({ message: error.message || "Unable to publish this pin to Pinterest." });
  }
});

apiRouter.get("/recommendations/:boardId", async (req, res) => {
  try {
    const { board } = await getBoardWithPins(req.user.id, req.params.boardId);
    res.json({ recommendations: await getLegacyRecommendationsForBoard(board) });
  } catch (error) {
    if (error.message === "Board not found") {
      return res.status(404).json({ message: "Board not found" });
    }

    console.error("Failed to load recommendations", error);
    res.status(500).json({ message: "Unable to load recommendations." });
  }
});
