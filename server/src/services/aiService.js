// A tiny beginner-friendly "AI" recommendation engine.
// It does not call a real AI model. Instead, it uses readable keyword matching:
// 1. Turn the uploaded image caption/tags into keywords.
// 2. Turn every board's name/description/tags/saved pins into keywords.
// 3. Compare image keywords with board keywords.
// 4. Give each board a similarity score.
// 5. Auto-select the board with the highest score.

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
]);

function normalizeTagList(tags = []) {
  if (Array.isArray(tags)) return tags;
  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tokenize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function uniqueKeywords(values) {
  return [...new Set(values.flatMap((value) => tokenize(value)))];
}

function getImageKeywords(payload) {
  const imageTags = normalizeTagList(payload.tags);

  return uniqueKeywords([
    payload.title,
    payload.caption,
    payload.fileName,
    payload.dominantColor,
    imageTags.join(" "),
  ]);
}

function getBoardKeywords(board, boardPins) {
  return uniqueKeywords([
    board.name,
    board.description,
    board.aesthetic,
    ...(board.tags || []),
    ...boardPins.map((pin) => `${pin.title} ${pin.caption} ${pin.tags || ""}`),
  ]);
}

function scoreBoard({ board, boardPins, imageKeywords, corrections }) {
  const boardKeywords = getBoardKeywords(board, boardPins);
  const boardTagSet = new Set((board.tags || []).map((tag) => tag.toLowerCase()));
  const matchedSignals = [];
  let score = 0;

  imageKeywords.forEach((keyword) => {
    if (!boardKeywords.includes(keyword)) return;

    matchedSignals.push(keyword);

    // Board tags are the strongest signal because users create them intentionally.
    if (boardTagSet.has(keyword)) {
      score += 10;
      return;
    }

    // Keywords found anywhere in the board still matter.
    score += 6;
  });

  // Existing pins make the board feel like it has a learned theme.
  score += Math.min(boardPins.length * 2, 8);

  // Manual corrections simulate learning from user feedback.
  corrections
    .filter((correction) => correction.correctBoardId === board.id)
    .forEach((correction) => {
      const correctionKeywords = uniqueKeywords([correction.title, correction.caption, correction.tags || ""]);
      const correctionMatches = imageKeywords.filter((keyword) => correctionKeywords.includes(keyword));
      if (correctionMatches.length) {
        score += correctionMatches.length * 4;
        matchedSignals.push(...correctionMatches);
      }
    });

  return {
    board,
    score,
    matchedSignals: [...new Set(matchedSignals)].slice(0, 7),
    keywordCount: boardKeywords.length,
  };
}

function scoreToConfidence(score, imageKeywordCount, bestScore) {
  if (!score) return 42;

  const possibleScore = Math.max(imageKeywordCount * 10, 1);
  const rawSimilarity = Math.round((score / possibleScore) * 100);
  const winnerBonus = score === bestScore ? 10 : 0;

  return Math.max(45, Math.min(97, rawSimilarity + winnerBonus));
}

export function predictBoard(db, payload) {
  const imageKeywords = getImageKeywords(payload);

  const scoredBoards = db.boards
    .map((board) =>
      scoreBoard({
        board,
        boardPins: db.pins.filter((pin) => pin.boardId === board.id),
        imageKeywords,
        corrections: db.corrections || [],
      }),
    )
    .sort((a, b) => b.score - a.score);

  const winner = scoredBoards[0];
  const bestScore = winner?.score || 0;

  return {
    predictedBoardId: winner.board.id,
    predictedBoardName: winner.board.name,
    confidence: scoreToConfidence(winner.score, imageKeywords.length, bestScore),
    signals: winner.matchedSignals.length ? winner.matchedSignals : imageKeywords.slice(0, 4),
    alternatives: scoredBoards.slice(1, 4).map((item) => ({
      boardId: item.board.id,
      boardName: item.board.name,
      confidence: scoreToConfidence(item.score, imageKeywords.length, bestScore),
      score: item.score,
    })),
    scores: scoredBoards.map((item) => ({
      boardId: item.board.id,
      boardName: item.board.name,
      score: item.score,
      matchedSignals: item.matchedSignals,
    })),
    explanation:
      "Step 1: read caption and tags. Step 2: compare them with each board's keywords. Step 3: score every board. Step 4: choose the highest score.",
  };
}

export function getRecommendations(db, boardId) {
  const board = db.boards.find((item) => item.id === boardId);
  if (!board) return [];

  const boardPins = db.pins.filter((pin) => pin.boardId === boardId);
  const boardKeywords = getBoardKeywords(board, boardPins);
  const base = db.recommendations.filter((item) => item.boardId === boardId);

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
