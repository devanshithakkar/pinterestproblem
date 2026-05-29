// Simulated AI vision service.
// This is intentionally API-free: it uses image URL/file names plus optional
// text clues to mimic a future vision + embedding pipeline.

const AUTO_SAVE_THRESHOLD = 0.8;
const CONFIRM_THRESHOLD = 0.5;

const stopWords = new Set([
  "the",
  "and",
  "with",
  "for",
  "this",
  "that",
  "from",
  "into",
  "image",
  "photo",
  "save",
  "idea",
  "auto",
  "format",
  "crop",
  "width",
  "height",
  "quick",
  "local",
  "upload",
  "uploaded",
  "fresh",
  "curated",
  "visual",
  "inspiration",
  "organized",
  "board",
  "boards",
  "created",
  "generated",
  "appears",
  "distinct",
  "reference",
]);

const visualTaxonomy = {
  fashion: ["fashion", "outfit", "style", "streetwear", "linen", "jewelry", "wardrobe", "dress", "shoe", "editorial"],
  coding: ["coding", "developer", "laptop", "terminal", "dashboard", "interface", "workspace", "desk", "code", "ui", "analytics"],
  recipes: ["recipe", "food", "kitchen", "breakfast", "dessert", "pasta", "spice", "tomato", "basil", "plate", "baking"],
  decor: ["room", "decor", "interior", "plant", "lamp", "sofa", "minimal", "shelf", "bedroom", "rug", "lighting"],
  travel: ["travel", "hotel", "beach", "map", "city", "cafe", "coast", "trip", "landscape", "passport"],
  fitness: ["fitness", "workout", "gym", "yoga", "running", "training", "wellness", "active"],
  art: ["art", "illustration", "poster", "painting", "color", "typography", "graphic", "palette"],
};

const categoryNames = Object.keys(visualTaxonomy);

function normalizeTagList(tags = []) {
  if (Array.isArray(tags)) return tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tokenize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/^data:image\/[a-z0-9+.-]+;base64,.*/i, " local upload image ")
    .replace(/https?:\/\//g, " ")
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function uniqueKeywords(values) {
  return [...new Set(values.flatMap((value) => tokenize(value)))];
}

function emptyVector() {
  return Object.fromEntries(categoryNames.map((name) => [name, 0]));
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(Object.values(vector).reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;
  return Object.fromEntries(Object.entries(vector).map(([key, value]) => [key, value / magnitude]));
}

function vectorFromKeywords(keywords) {
  const vector = emptyVector();

  keywords.forEach((keyword) => {
    categoryNames.forEach((category) => {
      const lexicon = visualTaxonomy[category];
      if (lexicon.includes(keyword)) vector[category] += 1;
      if (lexicon.some((term) => term.length >= 4 && keyword.length >= 4 && (keyword.includes(term) || term.includes(keyword)))) {
        vector[category] += 0.45;
      }
    });
  });

  return normalizeVector(vector);
}

function cosineSimilarity(a, b) {
  return categoryNames.reduce((sum, key) => sum + (a[key] || 0) * (b[key] || 0), 0);
}

function getImageKeywords(payload = {}) {
  const imageTags = normalizeTagList(payload.tags || payload.detectedTags);
  const urlText = String(payload.imageUrl || payload.image_url || "")
    .split(/[/?#&=._-]/)
    .join(" ");

  return uniqueKeywords([
    payload.title,
    payload.caption,
    payload.description,
    payload.fileName,
    payload.file_name,
    payload.dominantColor,
    payload.category,
    payload.suggestedBoardName,
    compactText(payload.objects),
    compactText(payload.style),
    compactText(payload.colors),
    compactText(payload.mood),
    payload.source,
    urlText,
    imageTags.join(" "),
  ]);
}

function compactText(value = []) {
  return Array.isArray(value) ? value.join(" ") : String(value || "");
}

function getBoardKeywords(board, boardPins = []) {
  return uniqueKeywords([
    board.name,
    board.description,
    board.aesthetic,
    ...(board.tags || []),
    ...boardPins.map(
      (pin) =>
        `${pin.title} ${pin.caption || ""} ${normalizeTagList(pin.tags).join(" ")} ${normalizeTagList(pin.aiSignals).join(" ")} ${pin.source || ""}`,
    ),
  ]);
}

function buildBoardProfile(board, boardPins = []) {
  const keywords = getBoardKeywords(board, boardPins);
  const vector = vectorFromKeywords(keywords);
  const topTags = keywords
    .map((keyword) => ({
      keyword,
      weight:
        (board.tags || []).map((tag) => tag.toLowerCase()).includes(keyword) ? 3 : 1 + boardPins.filter((pin) => {
          const pinText = `${pin.title} ${pin.caption || ""} ${normalizeTagList(pin.tags).join(" ")} ${normalizeTagList(pin.aiSignals).join(" ")}`.toLowerCase();
          return pinText.includes(keyword);
        }).length,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map((item) => item.keyword);

  return {
    board,
    keywords,
    vector,
    topTags,
    visualIdentity: topTags.slice(0, 6).join(", ") || board.name,
  };
}

function getDetectedTags(keywords, vector) {
  const taxonomyTags = categoryNames
    .filter((category) => vector[category] > 0)
    .sort((a, b) => vector[b] - vector[a])
    .flatMap((category) => visualTaxonomy[category].filter((tag) => keywords.includes(tag)).slice(0, 4));

  return [...new Set([...taxonomyTags, ...keywords])].slice(0, 8);
}

function scoreBoard(profile, imageKeywords, imageVector) {
  const boardKeywordSet = new Set(profile.keywords);
  const boardTagSet = new Set((profile.board.tags || []).map((tag) => tag.toLowerCase()));
  const matchedSignals = imageKeywords.filter((keyword) => boardKeywordSet.has(keyword));
  const tagMatches = imageKeywords.filter((keyword) => boardTagSet.has(keyword));
  const vectorSimilarity = cosineSimilarity(imageVector, profile.vector);
  const textScore = Math.min(1, matchedSignals.length / Math.max(4, imageKeywords.length));
  const tagScore = Math.min(1, tagMatches.length / 3);
  const hasBoardContent = Boolean((profile.board.pinCount || 0) > 0 || (profile.board.tags || []).length > 1);
  const contentDepth = hasBoardContent ? Math.min(0.08, (profile.board.pinCount || 0) * 0.015) : 0;
  const rawScore = vectorSimilarity * 0.5 + textScore * 0.3 + tagScore * 0.18 + contentDepth;
  const score = matchedSignals.length || vectorSimilarity >= 0.35 ? Math.min(1, rawScore) : Math.min(0.18, rawScore);

  return {
    board: profile.board,
    score,
    vectorSimilarity,
    matchedSignals: [...new Set(matchedSignals)].slice(0, 7),
    visualIdentity: profile.visualIdentity,
  };
}

function actionForConfidence(confidence) {
  if (confidence >= AUTO_SAVE_THRESHOLD) return "auto_save";
  if (confidence >= CONFIRM_THRESHOLD) return "confirm";
  return "suggest_new_board";
}

function suggestBoardName(detectedTags) {
  const primary = detectedTags[0] || "Inspiration";
  const pretty = primary
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
  return `${pretty || "Fresh"} Ideas`;
}

function suggestBoardDescription(detectedTags) {
  const signals = detectedTags.slice(0, 5);
  if (!signals.length) return "AI-created board for a new visual direction that does not match existing boards yet.";
  return `AI-created board for ${signals.join(", ")} inspiration.`;
}

function makeTitle(payload, detectedTags) {
  const explicit = payload.title || payload.fileName || payload.file_name;
  if (explicit) return String(explicit).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  return `${(detectedTags[0] || "Smart").replace(/^\w/, (letter) => letter.toUpperCase())} save`;
}

function makeCaption(payload, detectedTags, action, boardName) {
  if (payload.caption || payload.description) return payload.caption || payload.description;
  if (action === "suggest_new_board") return `AI detected ${detectedTags.slice(0, 4).join(", ")} and suggested a new board.`;
  return `AI matched this image with ${boardName} using ${detectedTags.slice(0, 4).join(", ")}.`;
}

export function analyzeImageForBoards({ boards = [], pins = [], image = {} }) {
  if (!boards.length) {
    const fallbackTags = getDetectedTags(getImageKeywords(image), vectorFromKeywords(getImageKeywords(image)));
    return {
      action: "suggest_new_board",
      predictedBoard: null,
      confidence: 0,
      confidencePercent: 0,
      detectedTags: fallbackTags,
      reasoning: "No boards exist yet, so PinMind suggests creating a first board for this image.",
      suggestedBoardName: suggestBoardName(fallbackTags),
      suggestedBoardDescription: suggestBoardDescription(fallbackTags),
      suggestedTitle: makeTitle(image, fallbackTags),
      suggestedCaption: makeCaption(image, fallbackTags, "suggest_new_board"),
      scores: [],
    };
  }

  const imageKeywords = getImageKeywords(image);
  const imageVector = vectorFromKeywords(imageKeywords);
  const detectedTags = getDetectedTags(imageKeywords, imageVector);
  const profiles = boards.map((board) => buildBoardProfile(board, pins.filter((pin) => pin.boardId === board.id)));
  const scores = profiles.map((profile) => scoreBoard(profile, imageKeywords, imageVector)).sort((a, b) => b.score - a.score);
  const winner = scores[0];
  const second = scores[1];
  const margin = winner.score - (second?.score || 0);
  const weakSignal = winner.score < CONFIRM_THRESHOLD || (!winner.matchedSignals.length && winner.vectorSimilarity < 0.45);
  const confidence = weakSignal
    ? Math.max(0, Math.min(0.49, winner.score))
    : Math.max(0, Math.min(0.98, winner.score + Math.min(0.18, Math.max(0, margin) * 0.5)));
  const action = actionForConfidence(confidence);
  const reasoning =
    action === "auto_save"
      ? `Strong match with ${winner.board.name}: ${winner.matchedSignals.slice(0, 4).join(", ") || winner.visualIdentity}.`
      : action === "confirm"
        ? `Likely match with ${winner.board.name}, but the signal is mixed. Confirm before saving.`
        : `This image does not strongly match existing boards. The closest match was ${winner.board.name}.`;

  return {
    action,
    predictedBoard:
      action === "suggest_new_board"
        ? null
        : {
            id: winner.board.id,
            name: winner.board.name,
            description: winner.board.description,
            tags: winner.board.tags || [],
            visualIdentity: winner.visualIdentity,
          },
    predictedBoardId: action === "suggest_new_board" ? null : winner.board.id,
    predictedBoardName: action === "suggest_new_board" ? null : winner.board.name,
    confidence,
    confidencePercent: Math.round(confidence * 100),
    detectedTags,
    reasoning,
    suggestedBoardName: action === "suggest_new_board" ? suggestBoardName(detectedTags) : null,
    suggestedBoardDescription: action === "suggest_new_board" ? suggestBoardDescription(detectedTags) : null,
    suggestedTitle: makeTitle(image, detectedTags),
    suggestedCaption: makeCaption(image, detectedTags, action, winner.board.name),
    scores: scores.map((item) => ({
      boardId: item.board.id,
      boardName: item.board.name,
      score: Math.round(item.score * 100),
      confidence: Math.round(Math.max(0, Math.min(0.98, item.score)) * 100),
      matchedSignals: item.matchedSignals,
      visualIdentity: item.visualIdentity,
    })),
  };
}

export function predictBoard(db, payload) {
  const result = analyzeImageForBoards({ boards: db.boards, pins: db.pins, image: payload });

  return {
    predictedBoardId: result.predictedBoard?.id || null,
    predictedBoardName: result.predictedBoard?.name || null,
    confidence: result.confidencePercent,
    signals: result.detectedTags,
    alternatives: result.scores.slice(1, 4).map((item) => ({
      boardId: item.boardId,
      boardName: item.boardName,
      confidence: item.confidence,
      score: item.score,
    })),
    scores: result.scores,
    explanation: result.reasoning,
    action: result.action,
    suggestedBoardName: result.suggestedBoardName,
  };
}

export function getRecommendations(db, boardId) {
  const board = db.boards.find((item) => item.id === boardId);
  if (!board) return [];

  const boardPins = db.pins.filter((pin) => pin.boardId === boardId);
  const boardKeywords = getBoardKeywords(board, boardPins);
  const base = (db.recommendations || []).filter((item) => item.boardId === boardId);

  return base.map((item) => {
    const recommendationKeywords = uniqueKeywords([item.title, item.caption]);
    const sharedKeywords = recommendationKeywords.filter((keyword) => boardKeywords.includes(keyword));
    const similarityScore = Math.max(70, Math.min(96, 72 + sharedKeywords.length * 6));

    return {
      ...item,
      confidence: similarityScore,
      learnedFrom: sharedKeywords.length
        ? `Matched board keywords: ${sharedKeywords.join(", ")}`
        : `Based on ${board.name} tags and saved pins`,
    };
  });
}
