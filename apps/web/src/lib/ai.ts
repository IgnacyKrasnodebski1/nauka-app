/** AI entry point for route handlers — `@nauka/ai` handles demo mode itself when ANTHROPIC_API_KEY is missing. */
export {
  generateTopic,
  tutorStream,
  GenerationError,
  intakeMaterials,
  handleGenerationRequest,
  reserveRejection,
  type IntakeFailure,
  type IntakeRow,
  type FailInput,
  type FinishInput,
  type ReserveOutcome,
} from "@nauka/ai";
