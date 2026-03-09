import { z } from 'zod/v4';

const langrouterEmbeddingUsageSchema = z.object({
  prompt_tokens: z.number(),
  total_tokens: z.number(),
  cost: z.number().optional(),
});

const langrouterEmbeddingDataSchema = z.object({
  object: z.literal('embedding'),
  embedding: z.array(z.number()),
  index: z.number().optional(),
});

export const LangRouterEmbeddingResponseSchema = z.object({
  id: z.string().optional(),
  object: z.literal('list'),
  data: z.array(langrouterEmbeddingDataSchema),
  model: z.string(),
  provider: z.string().optional(),
  usage: langrouterEmbeddingUsageSchema.optional(),
});

export type LangRouterEmbeddingResponse = z.infer<
  typeof LangRouterEmbeddingResponseSchema
>;
