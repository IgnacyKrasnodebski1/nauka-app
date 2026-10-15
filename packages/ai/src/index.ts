export {
  generateTopic,
  generateSubject,
  prepareGeneration,
  runPreparedGeneration,
  releasePreparedGeneration,
  GenerationError,
  AI_TIMEOUT_MESSAGE,
  GENERATION_LEVELS,
  MAX_INPUT_TOKENS,
  WARM_UP_CAP_MS,
  type GenerateInput,
  type GenerateResult,
  type GenerationErrorCode,
  type GenerationQuality,
  type PreparedGeneration,
} from "./generate.js";
export { MODEL_PRICES, UsageMeter, costColumns, costOf, priceFor, tokensFromUsage, type AiRole, type CallTokens, type GenerationCostColumns, type ModelPrice, type UsageLike, type UsageSummary } from "./cost.js";
export { CHARGE_BY_MS, Deadline, GENERATION_DEADLINE_MS, MIN_AI_TIME_MS, RESPOND_BY_MS, RETRY_IF_LEFT_MS } from "./deadline.js";
export {
  handleGenerationRequest,
  normalizeOptions,
  reserveRejection,
  DAILY_CAP_SENTINEL,
  GLOBAL_CAP_SENTINEL,
  type FailInput,
  type FinishInput,
  type GenerationRequest,
  type GenerationResponse,
  type ReserveOutcome,
  type ReserveRejection,
} from "./pipeline.js";
export { tutorStream, tutorContext, type TutorInput } from "./tutor.js";
export { materialsToBlocks, prepareMaterials, MaterialError, MAX_IMAGES_PER_GENERATION, type MaterialInput, type MaterialErrorCode, type PreparedMaterials, type PreparedStats } from "./materials.js";
export { extractPptx, pptxToText, PptxError, PPTX_LIMITS, type PptxErrorCode, type PptxResult } from "./pptx.js";
export { intakeMaterials, type IntakeRow, type IntakeFailure, type IntakeDeps, type IntakeResult } from "./intake.js";
export { aiConfigured, modelId } from "./client.js";
export { demoGenerated } from "./demo.js";
