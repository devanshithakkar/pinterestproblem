import { supabaseAdmin } from "../lib/supabaseClient.js";

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

function mapBoard(row, pins = []) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    tags: row.tags || [],
    aesthetic: row.aesthetic,
    coverImageUrl: row.cover_image_url,
    pinCount: pins.length,
    previews: pins.slice(0, 4).map((pin) => pin.image_url),
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
      .select("id, board_id, image_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    "get board previews",
  );

  const pinsByBoardId = pins.reduce((groups, pin) => {
    groups[pin.board_id] ||= [];
    groups[pin.board_id].push(pin);
    return groups;
  }, {});

  return boards.map((board) => mapBoard(board, pinsByBoardId[board.id] || []));
}

export async function createBoard(userId, boardData = {}) {
  requireValue(userId, "userId");

  const row = {
    user_id: userId,
    name: boardData.name?.trim() || "Untitled Board",
    description: boardData.description?.trim() || "A fresh AI-organized board.",
    tags: normalizeTags(boardData.tags?.length ? boardData.tags : boardData.name?.toLowerCase().split(/\s+/) || []),
    aesthetic: boardData.aesthetic || "curated visual inspiration",
    cover_image_url: boardData.coverImageUrl || boardData.cover_image_url || null,
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

export async function createPin(userId, pinData = {}) {
  requireValue(userId, "userId");
  requireValue(pinData.boardId || pinData.board_id, "boardId");
  requireValue(pinData.imageUrl || pinData.image_url, "imageUrl");

  const boardId = pinData.boardId || pinData.board_id;
  const board = await getOwnedBoard(userId, boardId);
  if (!board) {
    throw new Error("Board not found");
  }

  const row = {
    user_id: userId,
    board_id: boardId,
    title: pinData.title?.trim() || "Untitled inspiration",
    caption: pinData.caption?.trim() || "",
    tags: normalizeTags(pinData.tags),
    image_url: pinData.imageUrl || pinData.image_url,
    source: pinData.source || "Upload",
    height: pinData.height || 560,
  };

  const pin = assertSupabaseResult(await supabaseAdmin.from("pins").insert(row).select("*").single(), "create pin");

  if (pinData.ai) {
    await savePrediction(pin.id, {
      ...pinData.ai,
      userId,
      inputTitle: pinData.title,
      inputCaption: pinData.caption,
      inputTags: pinData.tags,
    });
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
    confidence: predictionData.confidence || 0,
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
