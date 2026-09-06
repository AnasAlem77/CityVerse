export type AiGenerationInput = { system: string; user: string; context: unknown };
export type AiProvider = { generateStructured(input: AiGenerationInput): Promise<unknown>; capabilities(): { provider: string; structured: boolean } };
