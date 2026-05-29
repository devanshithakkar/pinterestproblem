import { supabaseAdmin } from "../lib/supabaseClient.js";
import { uploadImageIfNeeded } from "./storageService.js";

function normalizeTags(tags = []) {
  if (Array.isArray(tags)) return tags.map(String).map((tag) => tag.trim()).filter(Boolean);

  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

function assertSupabaseResult({ data, error }, action) {
  if (error) {
    throw new Error(`Supabase ${action} failed: ${error.message}`);
  }

  return data;
}

function mapBoard(row, pins = [], previewPins = pins) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    tags: row.tags || [],
    aesthetic: row.aesthetic,
    coverImageUrl: row.cover_image_url,
    pinterestBoardId: row.pinterest_board_id,
    pinCount: pins.length,
    previews: previewPins.slice(0, 4).map((pin) => pin.image_url),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPin(row) {
  return {
    id: row.id,
    userId: row.user_id,
    boardId: row.board_id,
    title: row.title,
    caption: row.caption,
    tags: row.tags || [],
    imageUrl: row.image_url,
    source: row.source,
    height: row.height,
    correctedAt: row.corrected_at,
    pinterestPinId: row.pinterest_pin_id,
    pinterestPublishedAt: row.pinterest_published_at,
    pinterestPublishStatus: row.pinterest_publish_status || "not_published",
    pinterestPublishError: row.pinterest_publish_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPrediction(row) {
  return {
    id: row.id,
    userId: row.user_id,
    pinId: row.pin_id,
    predictedBoardId: row.predicted_board_id,
    selectedBoardId: row.selected_board_id,
    confidence: row.confidence,
    signals: row.signals || [],
    alternatives: row.alternatives || [],
    scores: row.scores || [],
    explanation: row.explanation,
    inputTitle: row.input_title,
    inputCaption: row.input_caption,
    inputTags: row.input_tags || [],
    inputFileName: row.input_file_name,
    inputDominantColor: row.input_dominant_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeConfidence(confidence = 0) {
  const numeric = Number(confidence) || 0;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
}

async function getOwnedBoard(userId, boardId) {
  requireValue(userId, "userId");
  requireValue(boardId, "boardId");

  const board = await supabaseAdmin
    .from("boards")
    .select("id")
    .eq("user_id", userId)
    .eq("id", boardId)
    .maybeSingle();

  return assertSupabaseResult(board, "board lookup");
}

export async function getBoards(userId) {
  requireValue(userId, "userId");

  const boards = assertSupabaseResult(
    await supabaseAdmin.from("boards").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    "get boards",
  );

  const pins = assertSupabaseResult(
    await supabaseAdmin
      .from("pins")
      .select("id, board_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    "get board pin counts",
  );

  const previewPins = assertSupabaseResult(
    await supabaseAdmin
      .from("pins")
      .select("id, board_id, image_url, created_at")
      .eq("user_id", userId)
      .not("image_url", "like", "data:%")
      .order("created_at", { ascending: false }),
    "get board previews",
  );

  const pinsByBoardId = pins.reduce((groups, pin) => {
    groups[pin.board_id] ||= [];
    groups[pin.board_id].push(pin);
    return groups;
  }, {});

  const previewPinsByBoardId = previewPins.reduce((groups, pin) => {
    groups[pin.board_id] ||= [];
    groups[pin.board_id].push(pin);
    return groups;
  }, {});

  return boards.map((board) => mapBoard(board, pinsByBoardId[board.id] || [], previewPinsByBoardId[board.id] || []));
}

export async function upsertProfile(user) {
  requireValue(user?.id, "user.id");

  const metadata = user.user_metadata || {};
  const displayName = metadata.full_name || metadata.name || user.email?.split("@")[0] || "PinMind user";
  const avatarUrl = metadata.avatar_url || metadata.picture || null;

  return assertSupabaseResult(
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
      })
      .select("*")
      .single(),
    "upsert profile",
  );
}

export async function getBoardWithPins(userId, boardId) {
  requireValue(userId, "userId");
  requireValue(boardId, "boardId");

  const board = assertSupabaseResult(
    await supabaseAdmin.from("boards").select("*").eq("user_id", userId).eq("id", boardId).maybeSingle(),
    "get board",
  );

  if (!board) {
    throw new Error("Board not found");
  }

  const pins = assertSupabaseResult(
    await supabaseAdmin
      .from("pins")
      .select("*")
      .eq("user_id", userId)
      .eq("board_id", boardId)
      .order("created_at", { ascending: false }),
    "get board pins",
  );

  return {
    board: mapBoard(board, pins),
    pins: pins.map(mapPin),
  };
}

export async function createBoard(userId, boardData = {}) {
  requireValue(userId, "userId");
  requireValue(boardData.name?.trim(), "name");

  const row = {
    user_id: userId,
    name: boardData.name.trim(),
    description: boardData.description?.trim() || "A fresh AI-organized board.",
    tags: normalizeTags(boardData.tags?.length ? boardData.tags : boardData.name?.toLowerCase().split(/\s+/) || []),
    aesthetic: boardData.aesthetic || "curated visual inspiration",
    cover_image_url: boardData.coverImageUrl || boardData.cover_image_url || null,
    pinterest_board_id: boardData.pinterestBoardId || boardData.pinterest_board_id || null,
  };

  const board = assertSupabaseResult(
    await supabaseAdmin.from("boards").insert(row).select("*").single(),
    "create board",
  );

  return mapBoard(board);
}

export async function updateBoard(userId, boardId, boardData = {}) {
  requireValue(userId, "userId");
  requireValue(boardId, "boardId");

  const updates = {};
  if (boardData.name !== undefined) updates.name = boardData.name?.trim() || "Untitled Board";
  if (boardData.description !== undefined) updates.description = boardData.description?.trim() || "";
  if (boardData.tags !== undefined) updates.tags = normalizeTags(boardData.tags);
  if (boardData.aesthetic !== undefined) updates.aesthetic = boardData.aesthetic || "curated visual inspiration";
  if (boardData.coverImageUrl !== undefined) updates.cover_image_url = boardData.coverImageUrl || null;
  if (boardData.pinterestBoardId !== undefined || boardData.pinterest_board_id !== undefined) {
    updates.pinterest_board_id = (boardData.pinterestBoardId || boardData.pinterest_board_id || "").trim() || null;
  }
  if (boardData.cover_image_url !== undefined) updates.cover_image_url = boardData.cover_image_url || null;

  const board = assertSupabaseResult(
    await supabaseAdmin.from("boards").update(updates).eq("user_id", userId).eq("id", boardId).select("*").maybeSingle(),
    "update board",
  );

  if (!board) {
    throw new Error("Board not found");
  }

  return mapBoard(board);
}

export async function deleteBoard(userId, boardId) {
  requireValue(userId, "userId");
  requireValue(boardId, "boardId");

  await assertSupabaseResult(
    await supabaseAdmin.from("pins").delete().eq("user_id", userId).eq("board_id", boardId),
    "delete board pins",
  );

  const board = assertSupabaseResult(
    await supabaseAdmin.from("boards").delete().eq("user_id", userId).eq("id", boardId).select("id").maybeSingle(),
    "delete board",
  );

  if (!board) {
    throw new Error("Board not found");
  }

  return { id: board.id, deleted: true };
}

export async function getPins(userId) {
  requireValue(userId, "userId");

  const pins = assertSupabaseResult(
    await supabaseAdmin.from("pins").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    "get pins",
  );

  return pins.map(mapPin);
}

export async function getPinWithBoard(userId, pinId) {
  requireValue(userId, "userId");
  requireValue(pinId, "pinId");

  const pin = assertSupabaseResult(
    await supabaseAdmin.from("pins").select("*").eq("user_id", userId).eq("id", pinId).maybeSingle(),
    "get pin",
  );
  if (!pin) throw new Error("Pin not found");

  const board = assertSupabaseResult(
    await supabaseAdmin.from("boards").select("*").eq("user_id", userId).eq("id", pin.board_id).maybeSingle(),
    "get pin board",
  );
  if (!board) throw new Error("Board not found");

  return { pin: mapPin(pin), board: mapBoard(board, [pin]) };
}

export async function updatePinPinterestStatus(userId, pinId, updates = {}) {
  requireValue(userId, "userId");
  requireValue(pinId, "pinId");

  const row = {};
  if (updates.pinterestPinId !== undefined) row.pinterest_pin_id = updates.pinterestPinId || null;
  if (updates.pinterestPublishedAt !== undefined) row.pinterest_published_at = updates.pinterestPublishedAt || null;
  if (updates.pinterestPublishStatus !== undefined) row.pinterest_publish_status = updates.pinterestPublishStatus;
  if (updates.pinterestPublishError !== undefined) row.pinterest_publish_error = updates.pinterestPublishError || null;

  const pin = assertSupabaseResult(
    await supabaseAdmin.from("pins").update(row).eq("user_id", userId).eq("id", pinId).select("*").maybeSingle(),
    "update pin Pinterest status",
  );
  if (!pin) throw new Error("Pin not found");
  return mapPin(pin);
}

export async function getAiTrainingData(userId) {
  requireValue(userId, "userId");

  const [boards, pins, predictions] = await Promise.all([
    getBoards(userId),
    supabaseAdmin
      .from("pins")
      .select("id, board_id, title, caption, tags, source, height, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("ai_predictions")
      .select(
        "pin_id, predicted_board_id, selected_board_id, confidence, signals, input_title, input_caption, input_tags, input_file_name, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const pinRows = assertSupabaseResult(pins, "get AI pin signals");
  const predictionRows = assertSupabaseResult(predictions, "get AI prediction signals");
  const predictionsByPinId = predictionRows.reduce((groups, prediction) => {
    if (!prediction.pin_id) return groups;
    groups[prediction.pin_id] ||= [];
    groups[prediction.pin_id].push(prediction);
    return groups;
  }, {});

  return {
    boards,
    pins: pinRows.map((pin) => ({
      id: pin.id,
      boardId: pin.board_id,
      title: pin.title,
      caption: pin.caption,
      tags: pin.tags || [],
      source: pin.source,
      height: pin.height,
      createdAt: pin.created_at,
      aiSignals: (predictionsByPinId[pin.id] || []).flatMap((prediction) => prediction.signals || []),
    })),
    predictions: predictionRows.map((prediction) => ({
      pinId: prediction.pin_id,
      predictedBoardId: prediction.predicted_board_id,
      selectedBoardId: prediction.selected_board_id,
      confidence: prediction.confidence,
      signals: prediction.signals || [],
      inputTitle: prediction.input_title,
      inputCaption: prediction.input_caption,
      inputTags: prediction.input_tags || [],
      inputFileName: prediction.input_file_name,
      createdAt: prediction.created_at,
    })),
  };
}

export async function createPin(userId, pinData = {}) {
  requireValue(userId, "userId");
  requireValue(pinData.boardId || pinData.board_id, "boardId");
  requireValue(pinData.title?.trim(), "title");
  requireValue(pinData.imageUrl || pinData.image_url, "imageUrl");

  const boardId = pinData.boardId || pinData.board_id;
  const imageUrl = await uploadImageIfNeeded({
    imageUrl: pinData.imageUrl || pinData.image_url,
    userId,
    fileName: pinData.fileName || pinData.file_name || pinData.title,
  });
  const board = await getOwnedBoard(userId, boardId);
  if (!board) {
    throw new Error("Board not found");
  }

  const row = {
    user_id: userId,
    board_id: boardId,
    title: pinData.title.trim(),
    caption: pinData.caption?.trim() || "",
    tags: normalizeTags(pinData.tags),
    image_url: imageUrl,
    source: pinData.source || "Upload",
    height: pinData.height || 560,
  };

  const pin = assertSupabaseResult(await supabaseAdmin.from("pins").insert(row).select("*").single(), "create pin");

  if (pinData.ai) {
    try {
      await savePrediction(pin.id, {
        ...pinData.ai,
        userId,
        selectedBoardId: pinData.ai.selectedBoardId || pinData.ai.selected_board_id || boardId,
        inputTitle: pinData.title,
        inputCaption: pinData.caption,
        inputTags: pinData.tags,
      });
    } catch (error) {
      console.warn("Pin was saved, but AI prediction metadata was not saved.", error.message);
    }
  }

  return mapPin(pin);
}

export async function movePin(userId, pinId, boardId) {
  requireValue(userId, "userId");
  requireValue(pinId, "pinId");
  requireValue(boardId, "boardId");

  const board = await getOwnedBoard(userId, boardId);
  if (!board) {
    throw new Error("Board not found");
  }

  const pin = assertSupabaseResult(
    await supabaseAdmin
      .from("pins")
      .update({ board_id: boardId, corrected_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("id", pinId)
      .select("*")
      .maybeSingle(),
    "move pin",
  );

  if (!pin) {
    throw new Error("Pin not found");
  }

  return mapPin(pin);
}

export async function updatePin(userId, pinId, pinData = {}) {
  requireValue(userId, "userId");
  requireValue(pinId, "pinId");

  const updates = {};
  if (pinData.title !== undefined) updates.title = pinData.title?.trim() || "Untitled pin";
  if (pinData.caption !== undefined || pinData.description !== undefined) {
    updates.caption = (pinData.caption ?? pinData.description ?? "").trim();
  }
  if (pinData.tags !== undefined) updates.tags = normalizeTags(pinData.tags);
  if (pinData.height !== undefined) updates.height = Number(pinData.height) || 560;

  const pin = assertSupabaseResult(
    await supabaseAdmin.from("pins").update(updates).eq("user_id", userId).eq("id", pinId).select("*").maybeSingle(),
    "update pin",
  );

  if (!pin) throw new Error("Pin not found");
  return mapPin(pin);
}

export async function deletePin(userId, pinId) {
  requireValue(userId, "userId");
  requireValue(pinId, "pinId");

  const pin = assertSupabaseResult(
    await supabaseAdmin.from("pins").delete().eq("user_id", userId).eq("id", pinId).select("*").maybeSingle(),
    "delete pin",
  );

  if (!pin) throw new Error("Pin not found");
  return { id: pin.id, boardId: pin.board_id, deleted: true };
}

export async function savePrediction(pinId, predictionData = {}) {
  let userId = predictionData.userId || predictionData.user_id;

  if (pinId && !userId) {
    const pin = assertSupabaseResult(
      await supabaseAdmin.from("pins").select("user_id").eq("id", pinId).maybeSingle(),
      "prediction pin lookup",
    );
    userId = pin?.user_id;
  }

  requireValue(userId, "userId");

  const row = {
    user_id: userId,
    pin_id: pinId || null,
    predicted_board_id: predictionData.predictedBoardId || predictionData.predicted_board_id || null,
    selected_board_id: predictionData.selectedBoardId || predictionData.selected_board_id || null,
    confidence: normalizeConfidence(predictionData.confidence || predictionData.confidencePercent || 0),
    signals: normalizeTags(predictionData.signals),
    alternatives: predictionData.alternatives || [],
    scores: predictionData.scores || [],
    explanation: predictionData.explanation || "",
    input_title: predictionData.inputTitle || predictionData.input_title || predictionData.title || "",
    input_caption: predictionData.inputCaption || predictionData.input_caption || predictionData.caption || "",
    input_tags: normalizeTags(predictionData.inputTags || predictionData.input_tags || predictionData.tags),
    input_file_name: predictionData.inputFileName || predictionData.input_file_name || predictionData.fileName || "",
    input_dominant_color:
      predictionData.inputDominantColor || predictionData.input_dominant_color || predictionData.dominantColor || "",
  };

  const prediction = assertSupabaseResult(
    await supabaseAdmin.from("ai_predictions").insert(row).select("*").single(),
    "save prediction",
  );

  return mapPrediction(prediction);
}
