import express from "express";
import multer from "multer";
import { readDb } from "../db/jsonStore.js";
import { predictBoard, getRecommendations } from "../services/aiService.js";
import { uploadImageBuffer } from "../services/storageService.js";
import { searchImageLibrary } from "../services/imageLibraryService.js";
import { normalizeSmartSaveInput, normalizeUrlSmartSaveInput } from "../services/imageInputService.js";
import {
  analyzeSmartSaveInput,
  createPinPayloadFromAi as servicePinPayloadFromAi,
  legacyPredictionPayload as serviceLegacyPredictionPayload,
  runSmartSave as runSmartSaveService,
} from "../services/smartSaveService.js";
import {
  buildVisibleBoardIntelligenceProfile,
  getBoardBasedRecommendations,
  getBoardCleanupSuggestions,
  mergeUserBoards,
  searchUserPins,
} from "../services/visualMemoryService.js";
import { getSuggestedBoardFromAnalysis, sanitizeBoardName } from "../services/boardNameService.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createBoard,
  createPin,
  deleteBoard,
  deletePin,
  getBoardWithPins,
  getBoards,
  getProfile,
  getProfileByUsername,
  getPins,
  getVisibleBoardsForProfile,
  getVisibleBoardWithPins,
  movePin,
  savePrediction,
  searchPublicUsers,
  updateBoard,
  updateProfile,
  updatePin,
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
    const result = await runSmartSaveService({ userId, input: body, uploadResult });
    console.log(`[AI] Smart-save upload ${result.payload.action} confidence=${Math.round((result.payload.confidence || 0) * 100)}`);
    return res.status(result.status).json(result.payload);
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
    const result = await runSmartSaveService({ userId, input: body, uploadResult });
    console.log(`[AI] Autonomous save ${result.payload.action} confidence=${Math.round((result.payload.confidence || 0) * 100)}`);
    res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Failed to autonomous-save uploaded image", error);
    res.status(500).json({ message: error.message || "Unable to autonomous-save this image." });
  }
});

apiRouter.post("/ai/autonomous-save-url", async (req, res) => {
  try {
    const userId = req.user.id;
    const imageUrl = String(req.body.imageUrl || req.body.image_url || "").trim();
    if (!imageUrl) return res.status(400).json({ message: "imageUrl is required." });

    console.log(`[AI] Autonomous save URL started for user ${userId}`);
    const body = await normalizeUrlSmartSaveInput(imageUrl, req.body);
    const result = await runSmartSaveService({ userId, input: body });
    console.log(`[AI] Autonomous URL save ${result.payload.action} confidence=${Math.round((result.payload.confidence || 0) * 100)}`);
    res.status(result.status).json(result.payload);
  } catch (error) {
    const status = error.status || 500;
    console.error("Failed to autonomous-save image URL", error.message);
    res.status(status).json({ message: error.message || "Unable to smart-save this image URL." });
  }
});

apiRouter.post("/ai/autonomous-save", async (req, res) => {
  try {
    const userId = req.user.id;
    const body = normalizeSmartSaveInput(req.body);
    if (!body.imageUrl) return res.status(400).json({ message: "imageUrl is required." });

    const result = await runSmartSaveService({ userId, input: body });
    res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Failed to autonomous-save image", error);
    res.status(500).json({ message: error.message || "Unable to autonomous-save this image." });
  }
});

apiRouter.post("/ai/smart-save", async (req, res) => {
  try {
    const userId = req.user.id;
    const body = normalizeSmartSaveInput(req.body);
    if (!body.imageUrl) return res.status(400).json({ message: "imageUrl is required." });

    const result = await runSmartSaveService({ userId, input: body });
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

apiRouter.get("/search/pins", async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await searchUserPins(userId, {
      query: req.query.q || "",
      page: req.query.page || 1,
      limit: req.query.limit || 24,
    });
    res.json(result);
  } catch (error) {
    console.error("Failed to search pins", error);
    res.status(500).json({ message: error.message || "Unable to search saved pins." });
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

apiRouter.get("/boards/cleanup-suggestions", async (req, res) => {
  try {
    const suggestions = await getBoardCleanupSuggestions(req.user.id);
    res.json({ suggestions });
  } catch (error) {
    console.error("Failed to get board cleanup suggestions", error);
    res.status(500).json({ message: error.message || "Unable to load cleanup suggestions." });
  }
});

apiRouter.post("/boards/merge", async (req, res) => {
  try {
    const result = await mergeUserBoards(req.user.id, {
      sourceBoardId: req.body.sourceBoardId || req.body.source_board_id,
      targetBoardId: req.body.targetBoardId || req.body.target_board_id,
    });
    res.json(result);
  } catch (error) {
    console.error("Failed to merge boards", error);
    res.status(400).json({ message: error.message || "Unable to merge these boards." });
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

apiRouter.get("/boards/:id/profile", async (req, res) => {
  try {
    const profile = await buildVisibleBoardIntelligenceProfile(req.user.id, req.params.id);
    res.json({ profile });
  } catch (error) {
    console.error("Failed to get board intelligence profile", error);
    res.status(error.status || (error.message === "Board not found" ? 404 : 500)).json({ message: error.message || "Unable to load board profile." });
  }
});

apiRouter.get("/boards/:id/recommendations", async (req, res) => {
  try {
    const result = await getBoardBasedRecommendations(req.user.id, req.params.id, {
      page: req.query.page || 1,
      provider: req.query.provider || "all",
    });
    res.json(result);
  } catch (error) {
    console.error("Failed to get board-based recommendations", error);
    res.status(error.status || (error.message === "Board not found" ? 404 : 500)).json({ message: error.message || "Unable to load board recommendations." });
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

    const { analysis, decision } = await analyzeSmartSaveInput(userId, req.body);
    const prediction = serviceLegacyPredictionPayload(analysis, decision);
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

    const result = await analyzeSmartSaveInput(userId, req.body);
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

    const { analysis, decision } = await analyzeSmartSaveInput(userId, req.body);
    const prediction = serviceLegacyPredictionPayload(analysis, decision);
    console.log(`[AI] Auto-save decision action=${decision.action} confidence=${decision.confidencePercent}`);

    if (decision.action === "auto_save" && decision.predictedBoard?.id) {
      const pin = await createPin(
        userId,
        servicePinPayloadFromAi({ body: req.body, analysis, decision, boardId: decision.predictedBoard.id }),
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
          savePayload: servicePinPayloadFromAi({ body: req.body, analysis, decision, boardId: decision.predictedBoard.id }),
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
    const pin = await createPin(userId, servicePinPayloadFromAi({ body: req.body, analysis, decision, boardId: selectedBoardId }));
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
    const rawBoardName = req.body.boardName || req.body.board_name || req.body.suggestedBoardName || analysis.suggestedBoardName;
    const safeSuggestion = getSuggestedBoardFromAnalysis(analysis, { ...req.body, suggestedBoardName: rawBoardName });
    const boardName = sanitizeBoardName(rawBoardName || safeSuggestion.name, analysis, req.body);
    if (!boardName?.trim()) return res.status(400).json({ message: "boardName is required." });

    const board = await createBoard(userId, {
      name: boardName,
      description:
        req.body.boardDescription ||
        req.body.board_description ||
        safeSuggestion.description ||
        `AI-created board for ${(analysis.detectedTags || []).slice(0, 5).join(", ")} inspiration.`,
      tags: req.body.boardKeywords || req.body.board_keywords || safeSuggestion.keywords || analysis.detectedTags || [],
      aesthetic: [...(analysis.style || []), ...(analysis.mood || [])].join(", ") || "AI-generated visual identity",
      coverImageUrl: req.body.imageUrl || req.body.image_url || null,
    });
    const pin = await createPin(
      userId,
      servicePinPayloadFromAi({ body: req.body, analysis, decision: req.body.decision || {}, boardId: board.id }),
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
    res.json({ pin, corrections: [{ type: "ai_feedback", message: "Learning from your correction." }] });
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
