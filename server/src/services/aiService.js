const AUTO_SAVE_THRESHOLD = 0.82;
const CONFIRM_THRESHOLD = 0.6;

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
  "ideas",
  "auto",
  "format",
  "crop",
  "width",
  "height",
  "quick",
  "local",
  "life",
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

const categoryGroups = {
  animal: ["animal", "animals", "pet", "pets", "dog", "cat", "puppy", "kitten", "bird", "wildlife", "horse", "rabbit"],
  interior: ["interior", "decor", "room", "home", "living", "bedroom", "sofa", "lamp", "furniture", "shelf", "rug"],
  food: ["food", "recipe", "recipes", "meal", "dish", "plate", "pasta", "dessert", "breakfast", "baking", "kitchen"],
  fashion: ["fashion", "outfit", "style", "streetwear", "dress", "shoe", "jewelry", "wardrobe", "clothing", "accessory"],
  tech: ["tech", "coding", "code", "developer", "dashboard", "terminal", "laptop", "screen", "ui", "interface", "software"],
  anime: ["anime", "manga", "character", "illustration", "cartoon", "drawing", "fanart", "wallpaper"],
  art: ["art", "painting", "poster", "graphic", "typography", "palette", "illustration", "design"],
  travel: ["travel", "beach", "city", "hotel", "map", "coast", "landscape", "trip", "passport"],
  fitness: ["fitness", "workout", "gym", "yoga", "running", "training", "wellness"],
  nature: ["nature", "forest", "flower", "flowers", "garden", "mountain", "beach", "landscape", "wildlife", "plant", "plants"],
  music: ["concert", "concerts", "music", "stage", "singer", "band", "festival", "performance", "crowd"],
  campus: ["campus", "college", "student", "students", "friends", "friend", "group", "university", "classmate"],
  vehicle: ["vehicle", "vehicles", "car", "cars", "bike", "bicycle", "motorcycle", "truck", "bus", "automotive"],
};

const categoryAliases = {
  pet: "animal",
  pets: "animal",
  wildlife: "animal",
  "room decor": "interior",
  decor: "interior",
  room: "interior",
  home: "interior",
  recipe: "food",
  recipes: "food",
  meal: "food",
  coding: "tech",
  developer: "tech",
  "ui design": "tech",
  ui: "tech",
  manga: "anime",
  cartoon: "anime",
  illustration: "anime",
  illustrated: "anime",
  concert: "music",
  concerts: "music",
  music: "music",
  "music event": "music",
  "music events": "music",
  festival: "music",
  band: "music",
  campus: "campus",
  "campus life": "campus",
  college: "campus",
  friends: "campus",
  "group photo": "campus",
  "college memories": "campus",
  student: "campus",
  students: "campus",
  transportation: "vehicle",
  vehicle: "vehicle",
  vehicles: "vehicle",
  car: "vehicle",
  cars: "vehicle",
  bike: "vehicle",
  bicycle: "vehicle",
  motorcycle: "vehicle",
  flower: "nature",
  flowers: "nature",
  forest: "nature",
  plant: "nature",
  plants: "nature",
  landscape: "nature",
};

const categoryNames = Object.keys(categoryGroups);
const directCategoryNames = new Set(categoryNames);
const compatibleCategoryMap = {
  animal: new Set(["animal", "nature"]),
  nature: new Set(["nature", "animal", "travel"]),
  music: new Set(["music"]),
  campus: new Set(["campus"]),
  fashion: new Set(["fashion"]),
  tech: new Set(["tech"]),
  food: new Set(["food"]),
  vehicle: new Set(["vehicle"]),
  interior: new Set(["interior"]),
  anime: new Set(["anime", "art"]),
  art: new Set(["art", "anime"]),
  travel: new Set(["travel", "nature"]),
  fitness: new Set(["fitness"]),
};

const categoryBoardNames = {
  animal: "Animals",
  nature: "Nature",
  music: "Concerts / Music Events",
  campus: "Campus Life / Friends",
  fashion: "Fashion",
  tech: "Coding / Tech",
  food: "Food",
  vehicle: "Vehicles",
  interior: "Room Decor",
  anime: "Anime / Digital Art",
  art: "Anime / Digital Art",
  travel: "Architecture / Travel",
  fitness: "Fitness / Sports",
};

function normalizeTagList(tags = []) {
  if (Array.isArray(tags)) return tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function compactText(value = []) {
  return Array.isArray(value) ? value.join(" ") : String(value || "");
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
    .filter((word) => word.length > 2 && !stopWords.has(word) && !weakContextWords.has(word));
}

function uniqueKeywords(values) {
  return [...new Set(values.flatMap((value) => tokenize(value)))];
}

function canonicalCategory(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "other";
  if (categoryGroups[raw]) return raw;
  if (categoryAliases[raw]) return categoryAliases[raw];
  const tokens = tokenize(raw);
  const match = categoryNames.find((category) => tokens.some((token) => categoryGroups[category].includes(token)));
  return match || raw;
}

function primaryCategoryFromFlags(image = {}, fallback = "other") {
  if (image.isMusicOrConcert) return "music";
  if (image.isCampusOrFriends) return "campus";
  if (image.isVehicle) return "vehicle";
  if (image.isAnimal) return "animal";
  if (image.isFashion) return "fashion";
  if (image.isTech) return "tech";
  if (image.isFood) return "food";
  if (image.isAnimeOrIllustration) return "anime";
  if (image.isInterior) return "interior";
  return fallback;
}

function categoriesFromKeywords(keywords = []) {
  const scores = Object.fromEntries(categoryNames.map((name) => [name, 0]));
  keywords.forEach((keyword) => {
    categoryNames.forEach((category) => {
      const lexicon = categoryGroups[category];
      if (lexicon.includes(keyword)) scores[category] += 2;
      if (lexicon.some((term) => term.length >= 5 && keyword.length >= term.length + 2 && keyword.includes(term))) {
        scores[category] += 0.7;
      }
    });
  });
  return Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
}

function overlapScore(a = [], b = []) {
  const left = new Set(a.map((item) => String(item).toLowerCase()));
  const right = new Set(b.map((item) => String(item).toLowerCase()));
  const matches = [...left].filter((item) => right.has(item));
  return {
    matches,
    score: matches.length / Math.max(1, Math.min(left.size || 1, right.size || 1)),
  };
}

function getImageKeywords(payload = {}) {
  const imageTags = normalizeTagList(payload.tags || payload.detectedTags);

  return uniqueKeywords([
    payload.title,
    payload.caption,
    payload.description,
    payload.fileName,
    payload.file_name,
    payload.dominantColor,
    payload.primarySubject,
    payload.primaryCategory,
    compactText(payload.secondaryCategories),
    compactText(payload.detectedObjects || payload.objects),
    compactText(payload.style),
    compactText(payload.colors),
    compactText(payload.mood),
    payload.suggestedBoardName,
    payload.source,
    imageTags.join(" "),
  ]);
}

function getImageProfile(image = {}) {
  const keywords = getImageKeywords(image);
  const inferredCategories = categoriesFromKeywords(keywords);
  const rawPrimaryCategory = canonicalCategory(image.primaryCategory || image.category || inferredCategories[0] || "other");
  const primaryCategory = primaryCategoryFromFlags(image, rawPrimaryCategory);
  const environmentKeywords = uniqueKeywords([image.environment]);
  const secondaryCategories = [
    ...new Set([
      ...normalizeTagList(image.secondaryCategories).map(canonicalCategory),
      ...inferredCategories,
    ]),
  ].filter((category) => category !== "other");

  return {
    keywords,
    primarySubject: String(image.primarySubject || normalizeTagList(image.detectedObjects || image.objects)[0] || keywords[0] || "").toLowerCase(),
    primaryCategory,
    secondaryCategories,
    detectedTags: normalizeTagList(image.detectedTags || image.tags).map((tag) => tag.toLowerCase()),
    detectedObjects: normalizeTagList(image.detectedObjects || image.objects).map((item) => item.toLowerCase()),
    style: normalizeTagList(image.style).map((item) => item.toLowerCase()),
    colors: normalizeTagList(image.colors).map((item) => item.toLowerCase()),
    mood: normalizeTagList(image.mood).map((item) => item.toLowerCase()),
    flags: {
      isAnimal: Boolean(image.isAnimal) || primaryCategory === "animal",
      isInterior: Boolean(image.isInterior) || primaryCategory === "interior",
      isFood: Boolean(image.isFood) || primaryCategory === "food",
      isFashion: Boolean(image.isFashion) || primaryCategory === "fashion",
      isTech: Boolean(image.isTech) || primaryCategory === "tech",
      isAnimeOrIllustration: Boolean(image.isAnimeOrIllustration) || primaryCategory === "anime",
      isMusicOrConcert: Boolean(image.isMusicOrConcert) || primaryCategory === "music",
      isVehicle: Boolean(image.isVehicle) || primaryCategory === "vehicle",
      isCampusOrFriends: Boolean(image.isCampusOrFriends) || primaryCategory === "campus",
    },
    environmentKeywords,
  };
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

function buildBoardProfile(board, boardPins = [], predictions = []) {
  const predictionSignals = predictions
    .filter((prediction) => prediction.selectedBoardId === board.id || prediction.predictedBoardId === board.id)
    .flatMap((prediction) => [prediction.inputTitle, prediction.inputCaption, ...(prediction.inputTags || []), ...(prediction.signals || [])]);
  const keywords = getBoardKeywords(board, boardPins).concat(uniqueKeywords(predictionSignals));
  const profileTags = [...new Set([...(board.tags || []).map((tag) => String(tag).toLowerCase()), ...keywords])].slice(0, 32);
  const dominantCategories = categoriesFromKeywords(profileTags);
  const boardText = [board.name, board.description, ...(board.tags || [])].join(" ").toLowerCase();

  return {
    board,
    boardId: board.id,
    boardName: board.name,
    keywords,
    profileTags,
    dominantCategories,
    subjects: [...new Set([...keywords, ...boardPins.flatMap((pin) => tokenize(pin.title))])].slice(0, 20),
    styles: profileTags.filter((tag) => ["minimal", "cozy", "editorial", "technical", "illustrated", "modern", "natural"].includes(tag)),
    colors: profileTags.filter((tag) => ["black", "white", "neutral", "warm", "green", "blue", "red", "pink", "brown", "cream", "dark"].includes(tag)),
    moods: profileTags.filter((tag) => ["calm", "focused", "playful", "cozy", "confident", "appetizing", "expressive"].includes(tag)),
    negativeHints: {
      animalVsInterior: dominantCategories.includes("interior") && !/(animal|pet|dog|cat|wildlife|nature)/.test(boardText),
      foodVsTech: dominantCategories.includes("tech") && !/(food|recipe|kitchen|meal)/.test(boardText),
      animeVsInterior: dominantCategories.includes("interior") && !/(anime|manga|art|illustration|wallpaper|poster)/.test(boardText),
      techVsFashion: dominantCategories.includes("fashion") && !/(tech|coding|ui|dashboard|developer)/.test(boardText),
      natureBlackHole:
        dominantCategories.includes("nature") &&
        !/(nature|flower|forest|mountain|beach|landscape|plant|garden|wildlife|animal|pet|travel)/.test(boardText),
    },
  };
}

function isCategoryCompatible(imageProfile, boardProfile) {
  const boardCategories = boardProfile.dominantCategories;
  if (!boardCategories.length) return true;
  const imageCategory = imageProfile.primaryCategory;
  if (!directCategoryNames.has(imageCategory)) return false;
  const compatible = compatibleCategoryMap[imageCategory] || new Set([imageCategory]);
  return boardCategories.some((category) => compatible.has(category));
}

function categoryScore(imageProfile, boardProfile) {
  if (!isCategoryCompatible(imageProfile, boardProfile)) return 0;
  if (boardProfile.dominantCategories.includes(imageProfile.primaryCategory)) return 1;
  if (imageProfile.secondaryCategories.some((category) => boardProfile.dominantCategories.includes(category))) return 0.45;
  if (!boardProfile.dominantCategories.length) return 0.08;
  return 0;
}

function negativePenalty(imageProfile, boardProfile) {
  const reasons = [];
  let penalty = 0;
  const categoryCompatible = isCategoryCompatible(imageProfile, boardProfile);
  if (!categoryCompatible) {
    penalty += 0.46;
    reasons.push(`${imageProfile.primaryCategory} primary subject is not compatible with ${boardProfile.boardName}`);
  }
  if (
    boardProfile.dominantCategories.includes("nature") &&
    !["nature", "animal", "travel"].includes(imageProfile.primaryCategory)
  ) {
    penalty += 0.34;
    reasons.push("background nature signals are not enough when the primary subject is not nature");
  }
  if (imageProfile.flags.isMusicOrConcert && boardProfile.dominantCategories.includes("nature")) {
    penalty += 0.3;
    reasons.push("concert/music subject should not be filed by outdoor nature context");
  }
  if (imageProfile.flags.isFashion && boardProfile.dominantCategories.includes("nature")) {
    penalty += 0.3;
    reasons.push("fashion subject should not be filed by outdoor nature context");
  }
  if (imageProfile.flags.isCampusOrFriends && boardProfile.dominantCategories.includes("nature")) {
    penalty += 0.3;
    reasons.push("campus/friends subject should not be filed by trees or outdoor context");
  }
  if (imageProfile.flags.isAnimal && boardProfile.negativeHints.animalVsInterior) {
    penalty += 0.35;
    reasons.push("animal image conflicts with an interior/decor board");
  }
  if (imageProfile.flags.isFood && boardProfile.negativeHints.foodVsTech) {
    penalty += 0.32;
    reasons.push("food image conflicts with a tech/coding board");
  }
  if (imageProfile.flags.isAnimeOrIllustration && boardProfile.negativeHints.animeVsInterior) {
    penalty += 0.32;
    reasons.push("anime/illustration conflicts with a room decor board");
  }
  if (imageProfile.flags.isTech && boardProfile.negativeHints.techVsFashion) {
    penalty += 0.32;
    reasons.push("tech/UI image conflicts with a fashion board");
  }
  return { penalty: Math.min(0.72, penalty), reasons };
}

function scoreBoard(profile, imageProfile) {
  const boardNameTokens = tokenize(profile.boardName);
  const subjectTokens = tokenize(imageProfile.primarySubject);
  const categoryCompatible = isCategoryCompatible(imageProfile, profile);
  const category = categoryScore(imageProfile, profile);
  const subject = overlapScore(subjectTokens, profile.subjects);
  const tags = overlapScore(imageProfile.detectedTags, profile.profileTags);
  const objects = overlapScore(imageProfile.detectedObjects, profile.profileTags);
  const style = overlapScore(imageProfile.style, profile.profileTags);
  const mood = overlapScore(imageProfile.mood, profile.profileTags);
  const color = overlapScore(imageProfile.colors, profile.profileTags);
  const environment = overlapScore(imageProfile.environmentKeywords, profile.profileTags);
  const nameExact =
    boardNameTokens.includes(imageProfile.primaryCategory) ||
    subjectTokens.some((token) => boardNameTokens.includes(token)) ||
    imageProfile.detectedTags.some((tag) => boardNameTokens.includes(tag))
      ? 1
      : 0;
  const keyword = overlapScore(imageProfile.keywords, profile.keywords);
  const negative = negativePenalty(imageProfile, profile);
  const weakKeywordScore = categoryCompatible ? Math.min(0.04, keyword.score * 0.04) : 0;
  const supportingEnvironmentScore = categoryCompatible ? Math.min(0.015, environment.score * 0.015) : 0;

  const rawScore =
    category * 0.42 +
    subject.score * 0.22 +
    objects.score * 0.15 +
    tags.score * 0.08 +
    style.score * 0.035 +
    mood.score * 0.025 +
    color.score * 0.01 +
    nameExact * 0.12 +
    weakKeywordScore +
    supportingEnvironmentScore;
  const score = Math.max(0, Math.min(0.98, rawScore - negative.penalty));
  const matchedSignals = [
    ...new Set([
      ...subject.matches,
      ...objects.matches,
      ...tags.matches,
      ...style.matches,
      ...mood.matches,
      ...color.matches,
      ...(nameExact ? [imageProfile.primaryCategory] : []),
    ]),
  ].slice(0, 10);

  return {
    board: profile.board,
    score,
    rawScore,
    categoryScore: category,
    categoryCompatible,
    subjectScore: subject.score,
    penalty: negative.penalty,
    penaltyReasons: negative.reasons,
    matchedSignals,
    rejectedReason:
      negative.reasons[0] ||
      (!categoryCompatible
        ? `${profile.boardName} is not category-compatible with ${imageProfile.primaryCategory}`
        : category === 0
          ? `no strong ${imageProfile.primaryCategory} category overlap`
          : null),
    visualIdentity: profile.profileTags.slice(0, 8).join(", ") || profile.boardName,
  };
}

function actionForConfidence(confidence, winner) {
  if (!winner || !winner.categoryCompatible || winner.categoryScore < 0.45 || winner.penalty >= 0.32) return "suggest_new_board";
  if (confidence >= AUTO_SAVE_THRESHOLD) return "auto_save";
  if (confidence >= CONFIRM_THRESHOLD) return "confirm";
  return "suggest_new_board";
}

function prettyWords(value = "") {
  return String(value || "Fresh")
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function suggestBoardName(imageProfile, detectedTags) {
  if (categoryBoardNames[imageProfile.primaryCategory]) return categoryBoardNames[imageProfile.primaryCategory];
  if (imageProfile.flags.isAnimal) return imageProfile.detectedTags.includes("pet") ? "Cute Pets" : "Animal Photography";
  if (imageProfile.flags.isMusicOrConcert) return "Concerts / Music Events";
  if (imageProfile.flags.isCampusOrFriends) return "Campus Life / Friends";
  if (imageProfile.flags.isVehicle) return "Vehicles";
  if (imageProfile.flags.isAnimeOrIllustration) return "Anime Aesthetic";
  if (imageProfile.flags.isTech) return "Coding & UI Ideas";
  if (imageProfile.flags.isFood) return "Recipe Ideas";
  if (imageProfile.flags.isFashion) return "Outfit Ideas";
  if (imageProfile.flags.isInterior) return "Room Decor Ideas";
  return `${prettyWords(imageProfile.primarySubject || detectedTags[0] || imageProfile.primaryCategory)} Ideas`;
}

function suggestBoardDescription(imageProfile, detectedTags) {
  const signals = detectedTags.slice(0, 6);
  if (!signals.length) return "AI-created board for a new visual direction that does not match existing boards yet.";
  return `AI-created board for ${signals.join(", ")} inspiration.`;
}

function makeTitle(payload, detectedTags) {
  const explicit = payload.title || payload.primarySubject || payload.fileName || payload.file_name;
  if (explicit) return String(explicit).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  return `${prettyWords(detectedTags[0] || "Smart")} save`;
}

function makeCaption(payload, detectedTags, action, boardName) {
  if (payload.caption || payload.description) return payload.caption || payload.description;
  if (action === "suggest_new_board") return `AI detected ${detectedTags.slice(0, 4).join(", ")} and suggested a new board.`;
  return `AI matched this image with ${boardName} using ${detectedTags.slice(0, 4).join(", ")}.`;
}

function debugReasoning(action, winner, scores, imageProfile) {
  if (!winner) return "No boards exist yet, so PinMind suggests creating a first board for this image.";
  const matched = winner.matchedSignals.slice(0, 5).join(", ") || imageProfile.primaryCategory;
  const rejected = scores
    .slice(1, 4)
    .filter((score) => score.rejectedReason)
    .map((score) => `${score.board.name}: ${score.rejectedReason}`)
    .join("; ");
  const base =
    action === "auto_save"
      ? `Strong ${imageProfile.primaryCategory} match with ${winner.board.name}: ${matched}.`
      : action === "confirm"
        ? `Likely ${imageProfile.primaryCategory} match with ${winner.board.name}, but confidence is not high enough to auto-save.`
        : `This image does not strongly match existing boards. Closest board was ${winner.board.name}, but ${winner.rejectedReason || "the overlap was weak"}.`;
  return rejected ? `${base} Rejected alternatives: ${rejected}.` : base;
}

export function analyzeImageForBoards({ boards = [], pins = [], predictions = [], image = {} }) {
  const imageProfile = getImageProfile(image);
  const detectedTags = [
    ...new Set([
      imageProfile.primaryCategory,
      ...imageProfile.detectedTags,
      ...imageProfile.detectedObjects,
      ...imageProfile.style,
      ...imageProfile.mood,
      ...imageProfile.keywords,
    ]),
  ].filter(Boolean).slice(0, 12);

  if (!boards.length) {
    return {
      action: "suggest_new_board",
      predictedBoard: null,
      confidence: 0,
      confidencePercent: 0,
      detectedTags,
      reasoning: "No boards exist yet, so PinMind suggests creating a first board for this image.",
      suggestedBoardName: suggestBoardName(imageProfile, detectedTags),
      suggestedBoardDescription: suggestBoardDescription(imageProfile, detectedTags),
      suggestedKeywords: detectedTags.slice(0, 8),
      suggestedTitle: makeTitle(image, detectedTags),
      suggestedCaption: makeCaption(image, detectedTags, "suggest_new_board"),
      scores: [],
    };
  }

  const profiles = boards.map((board) => buildBoardProfile(board, pins.filter((pin) => pin.boardId === board.id), predictions));
  const scores = profiles.map((profile) => scoreBoard(profile, imageProfile)).sort((a, b) => b.score - a.score);
  const winner = scores[0];
  const second = scores[1];
  const margin = winner.score - (second?.score || 0);
  const confidenceBoost = winner.categoryCompatible && winner.categoryScore >= 1 && winner.matchedSignals.length >= 1 ? 0.08 : 0;
  const confidence = Math.max(0, Math.min(0.98, winner.score + confidenceBoost + Math.min(0.08, Math.max(0, margin) * 0.35)));
  const hasStrongSubjectOverlap =
    winner.categoryCompatible &&
    winner.categoryScore >= 0.45 &&
    (winner.matchedSignals.length >= 1 || winner.subjectScore > 0 || winner.score >= 0.5);
  const action = hasStrongSubjectOverlap ? actionForConfidence(confidence, winner) : "suggest_new_board";
  const reasoning = debugReasoning(action, winner, scores, imageProfile);

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
    confidence: action === "suggest_new_board" ? Math.min(confidence, 0.59) : confidence,
    confidencePercent: Math.round((action === "suggest_new_board" ? Math.min(confidence, 0.59) : confidence) * 100),
    detectedTags,
    reasoning,
    suggestedBoardName: action === "suggest_new_board" ? suggestBoardName(imageProfile, detectedTags) : null,
    suggestedBoardDescription: action === "suggest_new_board" ? suggestBoardDescription(imageProfile, detectedTags) : null,
    suggestedKeywords: detectedTags.slice(0, 8),
    suggestedTitle: makeTitle(image, detectedTags),
    suggestedCaption: makeCaption(image, detectedTags, action, winner.board.name),
    scores: scores.slice(0, 3).map((item) => ({
      boardId: item.board.id,
      boardName: item.board.name,
      score: Math.round(item.score * 100),
      confidence: Math.round(Math.max(0, Math.min(0.98, item.score)) * 100),
      categoryScore: Math.round(item.categoryScore * 100),
      categoryCompatible: item.categoryCompatible,
      penalty: Math.round(item.penalty * 100),
      penaltyReasons: item.penaltyReasons,
      matchedSignals: item.matchedSignals,
      rejectedReason: item.rejectedReason,
      visualIdentity: item.visualIdentity,
    })),
  };
}

export function predictBoard(db, payload) {
  const result = analyzeImageForBoards({ boards: db.boards, pins: db.pins, predictions: db.predictions || [], image: payload });

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
