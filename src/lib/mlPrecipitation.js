import { executeMLHazardInference } from './mlHazardEngine.js';

export async function predictNextHourPrecipitation({ current, hourly, timestamp }) {
  return executeMLHazardInference({ current, hourly, timestamp });
}
