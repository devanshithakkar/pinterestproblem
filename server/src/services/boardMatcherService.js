import { analyzeImageForBoards } from "./aiService.js";

export function matchImageToBoards({ boards = [], pins = [], predictions = [], feedback = [], image = {} }) {
  return analyzeImageForBoards({ boards, pins, predictions, feedback, image });
}
