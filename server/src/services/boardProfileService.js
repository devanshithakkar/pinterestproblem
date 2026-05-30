import { getAiTrainingData } from "./databaseService.js";

export async function buildUserBoardProfiles(userId) {
  return getAiTrainingData(userId);
}
