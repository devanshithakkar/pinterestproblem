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
]);

const weakWords = new Set([
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

const categoryBoardMap = [
  {
    name: "Animals",
    description: "Animal, pet, and wildlife inspiration saved by PinMind.",
    keywords: ["animal", "animals", "pet", "pets", "wildlife", "dog", "cat", "bird", "puppy", "kitten", "horse", "rabbit"],
    flags: ["isAnimal"],
  },
  {
    name: "Concerts / Music Events",
    description: "Concerts, live music, festivals, stages, performers, and music event memories.",
    keywords: ["concert", "concerts", "music", "stage", "singer", "band", "festival", "performance", "crowd", "event"],
    flags: ["isMusicOrConcert"],
  },
  {
    name: "Fashion",
    description: "Outfits, streetwear, accessories, and fashion styling inspiration.",
    keywords: ["fashion", "outfit", "outfits", "streetwear", "accessories", "style", "dress", "shoe", "wardrobe", "clothing"],
    flags: ["isFashion"],
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
    flags: ["isAnimeOrIllustration"],
  },
  {
    name: "Coding / Tech",
    description: "Coding, dashboards, UI screenshots, laptops, and technical workspace ideas.",
    keywords: ["code", "coding", "tech", "technology", "ui", "dashboard", "laptop", "developer", "screen", "interface", "software"],
    flags: ["isTech"],
  },
  {
    name: "Room Decor",
    description: "Interior rooms, furniture, decor, lighting, and home styling ideas.",
    keywords: ["interior", "room", "decor", "furniture", "home", "sofa", "lamp", "bedroom", "living", "shelf"],
    flags: ["isInterior"],
  },
  {
    name: "Food",
    description: "Food, drinks, desserts, recipes, and meal inspiration.",
    keywords: ["food", "drink", "drinks", "dessert", "recipe", "meal", "plate", "pasta", "breakfast", "kitchen", "restaurant"],
    flags: ["isFood"],
  },
  {
    name: "Vehicles",
    description: "Cars, bikes, motorcycles, and vehicle design inspiration.",
    keywords: ["vehicle", "vehicles", "car", "cars", "bike", "bicycle", "motorcycle", "truck", "bus", "automotive"],
    flags: ["isVehicle"],
  },
  {
    name: "Nature",
    description: "Flowers, forests, mountains, beaches, plants, and landscape inspiration.",
    keywords: ["nature", "flower", "flowers", "forest", "mountain", "beach", "landscape", "garden", "plant", "plants", "wildlife"],
  },
  {
    name: "Movies / Cinema",
    description: "Movie posters, cinematic stills, film scenes, and cinema references.",
    keywords: ["movie", "movies", "cinema", "film", "poster", "cinematic", "scene", "actor", "actress"],
  },
  {
    name: "Architecture / Travel",
    description: "Architecture, cities, buildings, travel, and destination inspiration.",
    keywords: ["architecture", "building", "buildings", "city", "travel", "street", "hotel", "landmark", "urban"],
  },
  {
    name: "Fitness / Sports",
    description: "Fitness, gym, workout, sports, and active lifestyle inspiration.",
    keywords: ["sport", "sports", "fitness", "gym", "workout", "training", "yoga", "running", "athlete"],
  },
];

export function normalizeBoardName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s/]+/g, " ")
    .replace(/\bideas?\b/g, "")
    .replace(/\binspiration\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/^data:image\/[a-z0-9+.-]+;base64,.*/i, " local upload image ")
    .replace(/https?:\/\//g, " ")
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !weakWords.has(word));
}

function looksRandomToken(value = "") {
  const text = String(value || "");
  if (/https?:\/\//i.test(text) || /supabase\.co/i.test(text) || /storage\/v1/i.test(text)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(text)) return true;
  const compact = text.replace(/\s+ideas?$/i, "").replace(/[^a-z0-9]/gi, "");
  if (/^[0-9a-f]{8,}$/i.test(compact)) return true;
  if (compact.length >= 16 && /^[a-z0-9]+$/i.test(compact)) {
    const vowelRatio = (compact.match(/[aeiou]/gi) || []).length / compact.length;
    return vowelRatio < 0.32 || /\d/.test(compact);
  }
  return false;
}

function metadataWords(analysis = {}, imageMetadata = {}) {
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
    imageMetadata.source,
    ...(Array.isArray(imageMetadata.tags) ? imageMetadata.tags : String(imageMetadata.tags || "").split(",")),
    ...(Array.isArray(imageMetadata.providerTags) ? imageMetadata.providerTags : String(imageMetadata.providerTags || "").split(",")),
  ].flatMap(tokenize);
}

function includesAny(values, terms) {
  return values.some((value) => terms.some((term) => value.includes(term)));
}

export function getCategoryBoardName(analysis = {}, metadata = {}) {
  const primary = String(analysis.primaryCategory || analysis.category || "").toLowerCase();
  const subject = String(analysis.primarySubject || "").toLowerCase();
  const objects = (analysis.detectedObjects || analysis.objects || []).map((item) => String(item).toLowerCase());
  const tags = (analysis.detectedTags || []).map((item) => String(item).toLowerCase());
  const values = [primary, subject, ...objects, ...tags];
  const subjectObjectTokens = new Set([subject, ...objects].flatMap(tokenize));

  if (analysis.isMusicOrConcert || includesAny(values, ["concert", "music", "festival", "stage", "singer", "band"])) {
    return "Concerts / Music Events";
  }
  if (analysis.isFashion || includesAny(values, ["fashion", "outfit", "dress", "streetwear", "clothing", "accessory"])) return "Fashion";
  if (analysis.isCampusOrFriends || includesAny(values, ["campus", "college", "university", "student", "friends", "group photo"])) {
    return "Campus Life / Friends";
  }
  if (analysis.isAnimal || includesAny(values, ["animal", "pet", "dog", "cat", "wildlife", "bird", "horse"])) return "Animals";
  if (analysis.isTech || includesAny(values, ["coding", "code", "dashboard", "laptop", "interface", "software", "tech"])) return "Coding / Tech";
  if (analysis.isFood || includesAny(values, ["food", "dessert", "drink", "meal", "recipe", "restaurant"])) return "Food";
  if (analysis.isAnimeOrIllustration || includesAny(values, ["anime", "manga", "illustration", "digital art", "character art"])) {
    return "Anime / Digital Art";
  }
  if (
    analysis.isVehicle ||
    /^(vehicle|transportation|car|motorcycle|bike|bicycle|truck|bus)$/i.test(primary) ||
    ["car", "cars", "vehicle", "vehicles", "motorcycle", "bicycle", "bike", "truck", "bus"].some((term) => subjectObjectTokens.has(term))
  ) {
    return "Vehicles";
  }
  if (analysis.isInterior || includesAny(values, ["interior", "room", "furniture", "decor", "home"])) return "Room Decor";
  if (includesAny(values, ["movie", "cinema", "film", "poster"])) return "Movies / Cinema";
  if (includesAny(values, ["flower", "forest", "mountain", "beach", "landscape", "plant", "garden", "nature"])) return "Nature";
  if (includesAny(values, ["sport", "fitness", "gym", "workout"])) return "Fitness / Sports";
  if (includesAny(values, ["architecture", "building", "city", "travel", "landmark"])) return "Architecture / Travel";

  const metadataSet = new Set(metadataWords({}, metadata));
  const metadataCategory = categoryBoardMap.find((category) => category.keywords.some((keyword) => metadataSet.has(keyword)));
  return metadataCategory?.name || "Visual Inspiration";
}

export function getSuggestedBoardFromAnalysis(analysis = {}, metadata = {}) {
  const name = getCategoryBoardName(analysis, metadata);
  const category = categoryBoardMap.find((item) => item.name === name);
  const rejectedGenericName = isUnsafeBoardName(analysis.suggestedBoardName || metadata.suggestedBoardName)
    ? analysis.suggestedBoardName || metadata.suggestedBoardName
    : null;
  return {
    name,
    description: category?.description || "General visual inspiration that does not fit a more specific category yet.",
    keywords: category?.keywords?.slice(0, 10) || ["visual", "inspiration"],
    rejectedGenericName,
  };
}

export function isUnsafeBoardName(candidateName = "") {
  const raw = String(candidateName || "").trim().toLowerCase();
  const normalized = normalizeBoardName(candidateName);
  if (genericBoardNames.has(raw)) return true;
  if (!normalized || genericBoardNames.has(normalized) || looksRandomToken(candidateName)) return true;
  if (/\b[a-z0-9]{16,}\s+ideas?\b/i.test(String(candidateName))) return true;
  return false;
}

export function sanitizeBoardName(candidateName, analysis = {}, metadata = {}) {
  if (isUnsafeBoardName(candidateName)) {
    return getSuggestedBoardFromAnalysis(analysis, { ...metadata, suggestedBoardName: candidateName }).name;
  }
  return String(candidateName).trim();
}

export function findReusableBoard(boards = [], suggestion) {
  const suggestedName = normalizeBoardName(suggestion.name);
  const suggestedTokens = new Set(metadataWords({}, { tags: [suggestion.name, ...(suggestion.keywords || [])] }));
  const aliasGroups = [
    ["animals", "animal photography", "pets wildlife", "pets and wildlife"],
    ["concerts music events", "music", "concerts", "music events"],
    ["fashion", "outfits", "style"],
    ["campus life friends", "friends", "college memories", "campus life"],
    ["nature", "flowers", "flower", "landscape"],
    ["anime digital art", "anime", "digital art"],
    ["coding tech", "coding", "tech", "ui design", "developer setup"],
    ["visual", "visual inspiration"],
  ];

  return boards.find((board) => {
    const boardName = normalizeBoardName(board.name);
    if (!boardName) return false;
    if (boardName === suggestedName || boardName.replace(/s$/, "") === suggestedName.replace(/s$/, "")) return true;
    if (aliasGroups.some((group) => group.includes(boardName) && group.includes(suggestedName))) return true;
    const boardTokens = new Set(metadataWords({}, { tags: [board.name, board.description, ...(board.tags || [])] }));
    const overlap = [...suggestedTokens].filter((token) => boardTokens.has(token));
    return overlap.length >= 2 || (overlap.length >= 1 && (boardName.includes(suggestedName) || suggestedName.includes(boardName)));
  });
}
