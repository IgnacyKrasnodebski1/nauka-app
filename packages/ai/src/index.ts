export { generateTopic, generateSubject, GenerationError, type GenerateInput, type GenerateResult, type GenerationQuality } from "./generate.js";
export { tutorStream, tutorContext, type TutorInput } from "./tutor.js";
export { materialsToBlocks, prepareMaterials, MaterialError, MAX_IMAGES_PER_GENERATION, type MaterialInput, type MaterialErrorCode, type PreparedMaterials, type PreparedStats } from "./materials.js";
export { extractPptx, pptxToText, PptxError, PPTX_LIMITS, type PptxErrorCode, type PptxResult } from "./pptx.js";
export { intakeMaterials, type IntakeRow, type IntakeFailure, type IntakeDeps, type IntakeResult } from "./intake.js";
export { aiConfigured, modelId } from "./client.js";
export { demoGenerated } from "./demo.js";
