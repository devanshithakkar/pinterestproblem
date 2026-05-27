import express from "express";
import { readDb, writeDb } from "../db/jsonStore.js";
import { predictBoard, getRecommendations } from "../services/aiService.js";
import { createId } from "../utils/id.js";

export const apiRouter = express.Router();

function enrichBoards(db) {
  return db.boards.map((board) => {
    const pins = db.pins.filter((pin) => pin.boardId === board.id);
    return {
      ...board,
      pinCount: pins.length,
      previews: pins.slice(0, 4).map((pin) => pin.imageUrl),
    };
  });
}

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "smart-board-organizer-api" });
});

apiRouter.get("/boards", async (_req, res, next) => {
  try {
    const db = await readDb();
    res.json({ boards: enrichBoards(db) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/boards", async (req, res, next) => {
  try {
    const db = await readDb();
    const board = {
      id: createId("board"),
      name: req.body.name?.trim() || "Untitled Board",
      description: req.body.description?.trim() || "A fresh AI-organized board.",
      tags: req.body.tags?.length ? req.body.tags : req.body.name?.toLowerCase().split(/\s+/) || [],
      aesthetic: req.body.aesthetic || "curated visual inspiration",
      createdAt: new Date().toISOString(),
    };
    db.boards.unshift(board);
    await writeDb(db);
    res.status(201).json({ board: { ...board, pinCount: 0, previews: [] } });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/boards/:id", async (req, res, next) => {
  try {
    const db = await readDb();
    const board = db.boards.find((item) => item.id === req.params.id);
    if (!board) return res.status(404).json({ message: "Board not found" });

    const pins = db.pins
      .filter((pin) => pin.boardId === board.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ board, pins, recommendations: getRecommendations(db, board.id) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/predict", async (req, res, next) => {
  try {
    const db = await readDb();
    const prediction = predictBoard(db, req.body);
    db.predictionHistory.unshift({
      id: createId("prediction"),
      ...prediction,
      caption: req.body.caption || "",
      tags: req.body.tags || "",
      title: req.body.title || "",
      fileName: req.body.fileName || "",
      createdAt: new Date().toISOString(),
    });
    db.predictionHistory = db.predictionHistory.slice(0, 60);
    await writeDb(db);
    res.json({ prediction });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/pins", async (req, res, next) => {
  try {
    const db = await readDb();
    const board = db.boards.find((item) => item.id === req.body.boardId);
    if (!board) return res.status(400).json({ message: "A valid boardId is required" });

    const pin = {
      id: createId("pin"),
      boardId: board.id,
      title: req.body.title?.trim() || "Untitled inspiration",
      caption: req.body.caption?.trim() || "",
      tags: req.body.tags || "",
      imageUrl: req.body.imageUrl,
      source: req.body.source || "Upload",
      height: req.body.height || 560,
      ai: req.body.ai || null,
      createdAt: new Date().toISOString(),
    };
    db.pins.unshift(pin);
    await writeDb(db);
    res.status(201).json({ pin });
  } catch (error) {
    next(error);
  }
});

apiRouter.patch("/pins/:id/board", async (req, res, next) => {
  try {
    const db = await readDb();
    const pin = db.pins.find((item) => item.id === req.params.id);
    const target = db.boards.find((item) => item.id === req.body.boardId);
    if (!pin || !target) return res.status(404).json({ message: "Pin or board not found" });

    const previousBoardId = pin.boardId;
    pin.boardId = target.id;
    pin.correctedAt = new Date().toISOString();
    db.corrections.unshift({
      id: createId("correction"),
      pinId: pin.id,
      previousBoardId,
      correctBoardId: target.id,
      caption: pin.caption,
      tags: pin.tags || "",
      title: pin.title,
      createdAt: new Date().toISOString(),
    });
    await writeDb(db);
    res.json({ pin, corrections: db.corrections });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/recommendations/:boardId", async (req, res, next) => {
  try {
    const db = await readDb();
    res.json({ recommendations: getRecommendations(db, req.params.boardId) });
  } catch (error) {
    next(error);
  }
});
