import { supabaseAdmin } from "../lib/supabaseClient.js";
import { searchImageLibrary } from "./imageLibraryService.js";
import { getBoardWithPins, getBoards, mergeBoards as mergeOwnedBoards } from "./databaseService.js";
import { findReusableBoard, normalizeBoardName } from "./boardNameService.js";

const PROFILE_CACHE_TTL_MS = 45_000;
const boardProfileCache = new Map();
const cleanupAliasGroups = [
  ["animals", "animal", "animal photography", "pets", "wildlife", "pets wildlife"],
  ["fashion", "outfits", "style", "streetwear"],
  ["concerts music events", "concerts", "music", "music events", "festival"],
  ["nature", "flowers", "flower", "landscape", "landscapes", "plants"],
  ["campus life friends", "campus", "friends", "college memories", "student life"],
  ["anime digital art", "anime", "manga", "digital art", "illustration"],
  ["coding tech", "coding", "tech", "developer setup", "ui inspiration"],
  ["room decor", "interior", "home decor", "furniture"],
];

const weakWords = new Set([
  "and",
  "the",
  "with",
  "image",
  "photo",
  "visual",
  "inspiration",
  "idea",
  "ideas",
  "board",
  "saved",
  "this",
  "that",
  "from",
  "into",
]);

function tokenize(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[-_/]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !weakWords.has(word));
}

function normalizeTags(tags = []) {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function topCounts(values = [], limit = 10) {
  const counts = values.reduce((acc, value) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key || weakWords.has(key)) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function scoreText(queryTokens, values = []) {
  const textTokens = new Set(values.flatMap(tokenize));
  const matches = queryTokens.filter((token) => textTokens.has(token));
  return { score: matches.length, matches };
}

function readCachedProfile(cacheKey) {
  const cached = boardProfileCache.get(cacheKey);
  if (!cached || cached.expiresAt < Date.now()) {
    boardProfileCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function writeCachedProfile(cacheKey, value) {
  boardProfileCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  });
  if (boardProfileCache.size > 200) {
    const oldestKey = boardProfileCache.keys().next().value;
    boardProfileCache.delete(oldestKey);
  }
  return value;
}

function aliasGroupFor(value = "") {
  const normalized = normalizeBoardName(value);
  return cleanupAliasGroups.find((group) => group.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized)));
}

function aliasMatch(a = "", b = "") {
  const left = aliasGroupFor(a);
  const right = aliasGroupFor(b);
  return Boolean(left && right && left === right);
}

function profileSignals(profile = {}) {
  return [
    ...(profile.topTags || []),
    ...(profile.dominantCategories || []),
    ...(profile.subjects || []),
    ...(profile.moods || []),
    ...(profile.styles || []),
    ...(profile.colors || []),
    ...(profile.recommendationQueries || []),
  ];
}

function cleanupReason({ a, b, aliasHit, nameScore, tagScore, profileScore }) {
  const parts = [];
  if (aliasHit) parts.push("known alias group");
  if (nameScore > 0.25) parts.push("similar names");
  if (tagScore > 0.08) parts.push("shared tags/descriptions");
  if (profileScore > 0.12) parts.push("similar saved-pin profiles");
  const signal = parts.length ? parts.join(", ") : "overlapping board signals";
  return `"${a.name}" and "${b.name}" look related through ${signal}. Review before merging.`;
}

async function getPredictionRows(userId, pinIds = []) {
  if (!pinIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from("ai_predictions")
    .select("pin_id, signals, scores, explanation, input_title, input_caption, input_tags, created_at")
    .eq("user_id", userId)
    .in("pin_id", pinIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Supabase get AI prediction rows failed: ${error.message}`);
  return data || [];
}

export async function searchUserPins(userId, { query = "", page = 1, limit = 24 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(40, Math.max(1, Number(limit) || 24));
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return { pins: [], pagination: { page: safePage, limit: safeLimit, total: 0, hasMore: false } };

  const { data: pins, error } = await supabaseAdmin
    .from("pins")
    .select("*, boards!inner(id, name, description, tags)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Supabase search pins failed: ${error.message}`);

  const predictions = await getPredictionRows(userId, (pins || []).map((pin) => pin.id));
  const predictionsByPinId = predictions.reduce((groups, prediction) => {
    groups[prediction.pin_id] ||= [];
    groups[prediction.pin_id].push(prediction);
    return groups;
  }, {});

  const ranked = (pins || [])
    .map((pin) => {
      const board = pin.boards || {};
      const pinPredictions = predictionsByPinId[pin.id] || [];
      const signals = pinPredictions.flatMap((prediction) => [
        prediction.explanation,
        prediction.input_title,
        prediction.input_caption,
        ...(prediction.input_tags || []),
        ...(prediction.signals || []),
        JSON.stringify(prediction.scores || []),
      ]);
      const scored = scoreText(queryTokens, [
        pin.title,
        pin.caption,
        ...(pin.tags || []),
        board.name,
        board.description,
        ...(board.tags || []),
        ...signals,
      ]);
      return {
        score: scored.score,
        matches: scored.matches,
        pin: {
          id: pin.id,
          userId: pin.user_id,
          boardId: pin.board_id,
          title: pin.title,
          caption: pin.caption,
          tags: pin.tags || [],
          imageUrl: pin.image_url,
          source: pin.source,
          height: pin.height,
          correctedAt: pin.corrected_at,
          createdAt: pin.created_at,
          updatedAt: pin.updated_at,
          board: {
            id: board.id,
            name: board.name,
            description: board.description,
            tags: board.tags || [],
          },
          searchMatches: [...new Set(scored.matches)].slice(0, 8),
        },
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.pin.createdAt) - new Date(a.pin.createdAt));

  const start = (safePage - 1) * safeLimit;
  const pageRows = ranked.slice(start, start + safeLimit);
  return {
    pins: pageRows.map((item) => item.pin),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: ranked.length,
      hasMore: start + safeLimit < ranked.length,
    },
  };
}

async function getVisibleBoardProfileInput(viewerId, boardId) {
  const { data: board, error: boardError } = await supabaseAdmin
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) throw new Error(`Supabase get board for profile failed: ${boardError.message}`);
  if (!board) {
    const error = new Error("Board not found");
    error.status = 404;
    throw error;
  }

  const isOwner = board.user_id === viewerId;
  if (!isOwner) {
    const { data: ownerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, profile_visibility")
      .eq("id", board.user_id)
      .maybeSingle();

    if (profileError) throw new Error(`Supabase get board owner profile failed: ${profileError.message}`);
    if (!ownerProfile || ownerProfile.profile_visibility !== "public" || board.visibility !== "public") {
      const error = new Error("Board profile is private.");
      error.status = 403;
      throw error;
    }
  }

  const { data: pinRows, error: pinsError } = await supabaseAdmin
    .from("pins")
    .select("*")
    .eq("user_id", board.user_id)
    .eq("board_id", board.id)
    .order("created_at", { ascending: false });

  if (pinsError) throw new Error(`Supabase get board profile pins failed: ${pinsError.message}`);

  const pins = (pinRows || []).map((pin) => ({
    id: pin.id,
    title: pin.title,
    caption: pin.caption,
    tags: pin.tags || [],
    imageUrl: pin.image_url,
    createdAt: pin.created_at,
  }));

  return {
    ownerId: board.user_id,
    isOwner,
    board: {
      id: board.id,
      userId: board.user_id,
      name: board.name,
      description: board.description,
      tags: board.tags || [],
      visibility: board.visibility || "private",
      createdAt: board.created_at,
      updatedAt: board.updated_at,
    },
    pins,
  };
}

function summarizeBoardProfile({ board, pins, predictions }) {
  const predictionSignals = predictions.flatMap((prediction) => [
    prediction.explanation,
    prediction.input_title,
    prediction.input_caption,
    ...(prediction.input_tags || []),
    ...(prediction.signals || []),
    JSON.stringify(prediction.scores || []),
  ]);
  const allText = [
    board.name,
    board.description,
    ...(board.tags || []),
    ...pins.flatMap((pin) => [pin.title, pin.caption, ...(pin.tags || []), JSON.stringify(pin.aiAnalysis || {})]),
    ...predictionSignals,
  ];
  const tokens = allText.flatMap(tokenize);
  const topTags = topCounts([...tokens, ...(board.tags || []), ...pins.flatMap((pin) => pin.tags || [])], 14);
  const moods = topTags.filter((tag) => ["cozy", "calm", "dark", "bright", "energetic", "soft", "moody", "playful", "focused"].includes(tag));
  const styles = topTags.filter((tag) => ["minimal", "cinematic", "anime", "editorial", "modern", "vintage", "streetwear", "natural"].includes(tag));
  const colors = topTags.filter((tag) => ["black", "white", "red", "blue", "green", "pink", "neutral", "warm", "dark", "gold"].includes(tag));
  const dominantCategories = topTags.filter((tag) =>
    [
      "animal",
      "animals",
      "nature",
      "fashion",
      "concert",
      "music",
      "campus",
      "friends",
      "coding",
      "tech",
      "room",
      "decor",
      "food",
      "anime",
      "vehicle",
    ].includes(tag),
  );
  const subjects = topTags.filter((tag) => ![...moods, ...styles, ...colors, ...dominantCategories].includes(tag)).slice(0, 8);
  const recommendationQueries = [
    [board.name, ...dominantCategories.slice(0, 2), ...styles.slice(0, 2)].filter(Boolean).join(" "),
    [...subjects.slice(0, 3), ...moods.slice(0, 1)].filter(Boolean).join(" "),
    [...topTags.slice(0, 4)].filter(Boolean).join(" "),
  ].filter((query, index, list) => query && list.indexOf(query) === index);

  const confidence = Math.min(0.96, 0.25 + Math.min(0.58, pins.length * 0.08) + Math.min(0.13, topTags.length * 0.01));
  const lowConfidenceReason = pins.length < 3 ? " Save a few more pins to make this profile sharper." : "";

  return {
    summary: pins.length
      ? `${board.name} is shaped by ${topTags.slice(0, 5).join(", ")} with ${pins.length} saved pin${pins.length === 1 ? "" : "s"}.${lowConfidenceReason}`
      : `${board.name} is ready to learn from the first saved pins.`,
    topTags,
    dominantCategories: dominantCategories.slice(0, 6),
    subjects,
    moods,
    styles,
    colors,
    recommendationQueries: recommendationQueries.length ? recommendationQueries : [board.name],
    confidence,
  };
}

export async function buildBoardIntelligenceProfile(userId, boardId) {
  const cacheKey = `owner:${userId}:${boardId}`;
  const cached = readCachedProfile(cacheKey);
  if (cached) return cached;

  const { board, pins } = await getBoardWithPins(userId, boardId);
  const predictions = await getPredictionRows(userId, pins.map((pin) => pin.id));
  return writeCachedProfile(cacheKey, summarizeBoardProfile({ board, pins, predictions }));
}

export async function buildVisibleBoardIntelligenceProfile(viewerId, boardId) {
  const { ownerId, board, pins, isOwner } = await getVisibleBoardProfileInput(viewerId, boardId);
  const cacheKey = isOwner ? `owner:${ownerId}:${boardId}` : null;
  const cached = cacheKey ? readCachedProfile(cacheKey) : null;
  if (cached) {
    return {
      ...cached,
      board: {
        id: board.id,
        name: board.name,
        visibility: board.visibility,
      },
      isOwner,
    };
  }

  const predictions = await getPredictionRows(ownerId, pins.map((pin) => pin.id));
  const profile = {
    ...summarizeBoardProfile({ board, pins, predictions }),
    board: {
      id: board.id,
      name: board.name,
      visibility: board.visibility,
    },
    isOwner,
  };
  if (cacheKey) writeCachedProfile(cacheKey, profile);
  return profile;
}

function overlap(a = [], b = []) {
  const left = new Set(a.flatMap(tokenize));
  const right = new Set(b.flatMap(tokenize));
  const matches = [...left].filter((item) => right.has(item));
  return matches.length / Math.max(1, Math.min(left.size || 1, right.size || 1));
}

export async function getBoardCleanupSuggestions(userId) {
  const boards = await getBoards(userId);
  const suggestions = [];
  const profilesByBoardId = {};

  await Promise.all(
    boards.map(async (board) => {
      try {
        profilesByBoardId[board.id] = await buildBoardIntelligenceProfile(userId, board.id);
      } catch {
        profilesByBoardId[board.id] = null;
      }
    }),
  );

  for (let i = 0; i < boards.length; i += 1) {
    for (let j = i + 1; j < boards.length; j += 1) {
      const a = boards[i];
      const b = boards[j];
      const profileA = profilesByBoardId[a.id] || {};
      const profileB = profilesByBoardId[b.id] || {};
      const reusable = findReusableBoard([b], { name: a.name, keywords: [...(a.tags || []), a.description || ""] });
      const nameA = normalizeBoardName(a.name);
      const nameB = normalizeBoardName(b.name);
      const aliasHit = aliasMatch(a.name, b.name);
      const nameScore =
        nameA === nameB || nameA.replace(/s$/, "") === nameB.replace(/s$/, "")
          ? 0.62
          : aliasHit
            ? 0.44
            : overlap([a.name], [b.name]) * 0.32;
      const tagScore = overlap([a.name, a.description, ...(a.tags || [])], [b.name, b.description, ...(b.tags || [])]) * 0.34;
      const profileScore = overlap(profileSignals(profileA), profileSignals(profileB)) * 0.28;
      const pinSignalScore = Math.min(0.04, (a.pinCount || 0) && (b.pinCount || 0) ? 0.03 : 0);
      const confidence = Math.min(0.96, nameScore + tagScore + profileScore + pinSignalScore + (reusable ? 0.12 : 0));

      if (confidence >= 0.52) {
        const sourceBoard = (a.pinCount || 0) <= (b.pinCount || 0) ? a : b;
        const targetBoard = sourceBoard.id === a.id ? b : a;
        suggestions.push({
          sourceBoard,
          targetBoard,
          confidence,
          reason: cleanupReason({ a, b, aliasHit, nameScore, tagScore, profileScore }),
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 12);
}

export async function mergeUserBoards(userId, { sourceBoardId, targetBoardId }) {
  const result = await mergeOwnedBoards(userId, sourceBoardId, targetBoardId);
  boardProfileCache.delete(`owner:${userId}:${sourceBoardId}`);
  boardProfileCache.delete(`owner:${userId}:${targetBoardId}`);
  return result;
}

export async function getBoardBasedRecommendations(userId, boardId, { page = 1, provider = "all" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const profile = await buildVisibleBoardIntelligenceProfile(userId, boardId);
  const queries = (profile.recommendationQueries || []).filter(Boolean).slice(0, 3);
  const searchQueries = queries.length ? queries : [profile.board?.name || "visual inspiration"];
  const imagesByKey = new Map();
  const providerResults = [];

  for (const query of searchQueries) {
    if (imagesByKey.size >= 20) break;
    const result = await searchImageLibrary({
      query,
      provider,
      page: safePage,
      perPage: Math.max(6, Math.ceil(20 / searchQueries.length)),
    });
    providerResults.push(result.provider);
    for (const image of result.images || []) {
      const key = `${image.provider}:${image.id}:${image.imageUrl}`;
      if (!imagesByKey.has(key)) {
        imagesByKey.set(key, {
          ...image,
          recommendationQuery: query,
          recommendedBoardId: boardId,
        });
      }
      if (imagesByKey.size >= 20) break;
    }
  }

  return {
    provider: [...new Set(providerResults)].join(",") || "mock",
    images: [...imagesByKey.values()].slice(0, 20),
    pagination: {
      page: safePage,
      perPage: 20,
      hasMore: true,
      nextPage: safePage + 1,
    },
    query: searchQueries[0],
    queries: searchQueries,
    profile,
  };
}
