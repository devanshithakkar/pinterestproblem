import { randomUUID } from "node:crypto";
import { createBoard, createPin, getBoards } from "./databaseService.js";
import { analyzeImageWithVision } from "./visionService.js";
import { buildUserBoardProfiles } from "./boardProfileService.js";
import { matchImageToBoards } from "./boardMatcherService.js";
import { findReusableBoard, getSuggestedBoardFromAnalysis, sanitizeBoardName } from "./boardNameService.js";
import { normalizeSmartSaveInput } from "./imageInputService.js";

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
    tags: [
      ...(visionAnalysis.detectedTags || []),
      ...(Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",")),
      ...(Array.isArray(body.providerTags) ? body.providerTags : String(body.providerTags || "").split(",")),
    ].filter(Boolean),
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
    preferredBoardId: body.preferredBoardId || body.preferred_board_id,
    source: body.source,
    height: body.height,
  };
}

function normalizeDecision(boardDecision, visionAnalysis) {
  const suggestedBoardName =
    boardDecision.action === "suggest_new_board"
      ? boardDecision.suggestedBoardName || visionAnalysis.suggestedBoardName
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
      (suggestedBoardName ? `AI-created board for ${(visionAnalysis.detectedTags || []).slice(0, 5).join(", ")} inspiration.` : null),
    suggestedKeywords: boardDecision.suggestedKeywords || visionAnalysis.detectedTags?.slice(0, 8) || [],
    suggestedTitle: visionAnalysis.title,
    suggestedCaption: visionAnalysis.description,
    scores: boardDecision.scores || [],
  };
}

function pinPayloadFromAi({ body, analysis, decision, boardId }) {
  return {
    title: analysis.title || body.title?.trim() || decision.suggestedTitle || "Smart AI save",
    caption: analysis.description || body.caption?.trim() || body.description?.trim() || decision.suggestedCaption || "",
    tags: analysis.detectedTags || decision.detectedTags || [],
    imageUrl: body.imageUrl || body.image_url,
    fileName: body.fileName || body.file_name,
    source: body.source || body.provider || "AI vision save",
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

function debugPayload({ requestId, analysis, decision, boardName, reusedExistingBoard, createdNewBoard, suggestion }) {
  if (process.env.NODE_ENV === "production") return undefined;
  return {
    requestId,
    analysisSummary: `${analysis.primarySubject || ""} / ${analysis.primaryCategory || ""}`.trim(),
    chosenBoardName: boardName,
    reusedExistingBoard,
    createdNewBoard,
    topBoardScores: decision.scores || [],
    rejectedBoardNames: (decision.scores || []).map((score) => score.boardName),
    rejectedReasons: (decision.scores || []).map((score) => score.rejectedReason).filter(Boolean),
    categoryDecision: suggestion?.name || boardName,
    sanitizedBoardName: boardName,
    rejectedGenericName: suggestion?.rejectedGenericName || null,
  };
}

function logSmartSaveDebug({ requestId, analysis, decision, boardName, reusedExistingBoard, createdNewBoard, suggestion }) {
  if (process.env.NODE_ENV === "production") return;
  console.log("[SmartSave:debug]", {
    requestId,
    primaryCategory: analysis.primaryCategory,
    primarySubject: analysis.primarySubject,
    topBoardScores: (decision.scores || []).slice(0, 3).map((score) => ({
      boardName: score.boardName,
      score: score.score,
      categoryCompatible: score.categoryCompatible,
      penalty: score.penalty,
      penaltyReasons: score.penaltyReasons,
      feedbackAdjustment: score.feedbackAdjustment,
      recommendationAdjustment: score.recommendationAdjustment,
      feedbackReasons: score.feedbackReasons,
    })),
    finalBoard: boardName,
    reusedExistingBoard,
    createdNewBoard,
    sanitizedBoardName: boardName,
    rejectedGenericName: suggestion?.rejectedGenericName || null,
  });
}

export async function analyzeSmartSaveInput(userId, input = {}) {
  const body = normalizeSmartSaveInput(input);
  const imageUrl = body.imageUrl;
  if (!imageUrl && !body.imageBase64) throw new Error("imageUrl or imageBase64 is required.");

  const analysis = await analyzeImageWithVision({
    imageUrl,
    imageBase64: body.imageBase64,
    mimeType: body.mimeType,
    fileName: [body.fileName, body.title, body.description, Array.isArray(body.tags) ? body.tags.join(" ") : body.tags]
      .filter(Boolean)
      .join(" "),
  });
  const { boards, pins, predictions, feedback } = await buildUserBoardProfiles(userId);
  const boardDecision = matchImageToBoards({
    boards,
    pins,
    predictions,
    feedback,
    image: visionPayloadForBoardMatching(analysis, body),
  });
  return { body, analysis, decision: normalizeDecision(boardDecision, analysis) };
}

export function legacyPredictionPayload(analysis, decision) {
  return {
    ...decision,
    detectedTags: analysis.detectedTags,
    suggestedTitle: analysis.title,
    suggestedCaption: analysis.description,
    reasoning: decision.reasoning,
  };
}

export function createPinPayloadFromAi(args) {
  return pinPayloadFromAi(args);
}

export async function runSmartSave({ userId, input, uploadResult = null }) {
  const requestId = randomUUID();
  const { body, analysis, decision } = await analyzeSmartSaveInput(userId, input);
  const predictedScore = (decision.scores || []).find((score) => score.boardId === decision.predictedBoard?.id);
  const predictedBoardIsSafe =
    predictedScore &&
    predictedScore.categoryCompatible !== false &&
    Number(predictedScore.penalty || 0) < 32 &&
    Number(predictedScore.categoryScore || 0) >= 45;
  const saveToExisting =
    decision.predictedBoard?.id && decision.confidence >= 0.78 && decision.action !== "suggest_new_board" && predictedBoardIsSafe;

  if (saveToExisting) {
    const createdPin = await createPin(userId, pinPayloadFromAi({ body, analysis, decision, boardId: decision.predictedBoard.id }));
    logSmartSaveDebug({
      requestId,
      analysis,
      decision,
      boardName: decision.predictedBoard.name,
      reusedExistingBoard: true,
      createdNewBoard: false,
    });
    return {
      status: 201,
      payload: {
        action: "saved_to_existing_board",
        confidence: decision.confidence,
        analysis,
        decision,
        matchedBoard: decision.predictedBoard,
        createdBoard: null,
        createdPin,
        pin: createdPin,
        board: decision.predictedBoard,
        boardName: decision.predictedBoard.name,
        image: uploadResult,
        reasoning: decision.reasoning,
        rejectedBoards: decision.scores || [],
        undoTokenOrIds: { pinId: createdPin.id, boardId: createdPin.boardId, createdNewBoard: false },
        debugInfo: debugPayload({
          requestId,
          analysis,
          decision,
          boardName: decision.predictedBoard.name,
          reusedExistingBoard: true,
          createdNewBoard: false,
        }),
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
    logSmartSaveDebug({
      requestId,
      analysis,
      decision,
      boardName: reusableBoard.name,
      reusedExistingBoard: true,
      createdNewBoard: false,
      suggestion,
    });
    return {
      status: 201,
      payload: {
        action: "saved_to_existing_board",
        confidence: decision.confidence,
        analysis,
        decision,
        matchedBoard: reusableBoard,
        createdBoard: null,
        createdPin,
        pin: createdPin,
        board: reusableBoard,
        boardName: reusableBoard.name,
        image: uploadResult,
        reasoning: `Reused existing board "${reusableBoard.name}" because it matched the safe category "${suggestion.name}".${
          suggestion.rejectedGenericName ? ` Rejected unsafe board name "${suggestion.rejectedGenericName}".` : ""
        }`,
        rejectedBoards: decision.scores || [],
        undoTokenOrIds: { pinId: createdPin.id, boardId: createdPin.boardId, createdNewBoard: false },
        debugInfo: debugPayload({
          requestId,
          analysis,
          decision,
          boardName: reusableBoard.name,
          reusedExistingBoard: true,
          createdNewBoard: false,
          suggestion,
        }),
      },
    };
  }

  const board = await createBoard(userId, {
    name: suggestion.name,
    description: suggestion.description || decision.suggestedBoardDescription,
    tags: suggestion.keywords || decision.suggestedKeywords || analysis.detectedTags || [],
    aesthetic: [...(analysis.style || []), ...(analysis.mood || [])].join(", ") || "AI-generated visual identity",
    coverImageUrl: body.imageUrl || body.image_url || null,
    visibility: "private",
  });
  const createdPin = await createPin(userId, pinPayloadFromAi({ body, analysis, decision, boardId: board.id }));
  logSmartSaveDebug({
    requestId,
    analysis,
    decision,
    boardName: board.name,
    reusedExistingBoard: false,
    createdNewBoard: true,
    suggestion,
  });

  return {
    status: 201,
    payload: {
      action: "created_new_board_and_saved",
      confidence: decision.confidence,
      analysis,
      decision,
      matchedBoard: null,
      createdBoard: board,
      createdPin,
      pin: createdPin,
      board,
      boardName: board.name,
      image: uploadResult,
      reasoning: `Created category board "${board.name}" for this image.${
        suggestion.rejectedGenericName ? ` Rejected unsafe board name "${suggestion.rejectedGenericName}".` : ""
      } ${decision.reasoning || ""}`.trim(),
      rejectedBoards: decision.scores || [],
      undoTokenOrIds: { pinId: createdPin.id, boardId: board.id, createdNewBoard: true },
      debugInfo: debugPayload({
        requestId,
        analysis,
        decision,
        boardName: board.name,
        reusedExistingBoard: false,
        createdNewBoard: true,
        suggestion,
      }),
    },
  };
}
