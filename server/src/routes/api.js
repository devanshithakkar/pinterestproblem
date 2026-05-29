import express from "express";
import multer from "multer";
import { readDb } from "../db/jsonStore.js";
import { analyzeImageForBoards, predictBoard, getRecommendations } from "../services/aiService.js";
import { uploadImageBuffer } from "../services/storageService.js";
import { analyzeImageWithVision } from "../services/visionService.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createBoard,
  createPin,
  getAiTrainingData,
  getBoardWithPins,
  getBoards,
  getPins,
  movePin,
  savePrediction,
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
    tags: visionAnalysis.detectedTags || body.tags,
    objects: visionAnalysis.objects,
    style: visionAnalysis.style,
    colors: visionAnalysis.colors,
    mood: visionAnalysis.mood,
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
  const { boards, pins } = await getAiContextForUser(userId);
  const boardDecision = analyzeImageForBoards({
    boards,
    pins,
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

async function getLegacyRecommendationsForBoard(board) {
  const db = await readDb();
  const legacyBoard = db.boards.find((item) => item.name.toLowerCase() === board.name.toLowerCase());
  return legacyBoard ? getRecommendations(db, legacyBoard.id) : [];
}

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "smart-board-organizer-api" });
});

apiRouter.use(requireAuth);

apiRouter.post("/uploads/image", upload.single("image"), async (req, res) => {
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
        tags: analysis.detectedTags.slice(0, 8),
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
      tags: analysis.detectedTags || [],
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
