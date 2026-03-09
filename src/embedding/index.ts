import type {
  EmbeddingModelV3,
  SharedV3Headers,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import type {
  LangRouterEmbeddingModelId,
  LangRouterEmbeddingSettings,
} from '../types/langrouter-embedding-settings';

import {
  combineHeaders,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { langrouterFailedResponseHandler } from '../schemas/error-response';
import { LangRouterProviderMetadataSchema } from '../schemas/provider-metadata';
import { LangRouterEmbeddingResponseSchema } from './schemas';

type LangRouterEmbeddingConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class LangRouterEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'langrouter';
  readonly modelId: LangRouterEmbeddingModelId;
  readonly settings: LangRouterEmbeddingSettings;
  readonly maxEmbeddingsPerCall = undefined;
  readonly supportsParallelCalls = true;

  private readonly config: LangRouterEmbeddingConfig;

  constructor(
    modelId: LangRouterEmbeddingModelId,
    settings: LangRouterEmbeddingSettings,
    config: LangRouterEmbeddingConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doEmbed(options: {
    values: Array<string>;
    abortSignal?: AbortSignal;
    headers?: Record<string, string | undefined>;
  }): Promise<{
    embeddings: Array<Array<number>>;
    usage?: { tokens: number };
    providerMetadata?: SharedV3ProviderMetadata;
    response?: {
      headers?: SharedV3Headers;
      body?: unknown;
    };
    warnings: Array<import('@ai-sdk/provider').SharedV3Warning>;
  }> {
    const { values, abortSignal, headers } = options;

    const args = {
      model: this.modelId,
      input: values,
      user: this.settings.user,
      provider: this.settings.provider,
      ...this.config.extraBody,
      ...this.settings.extraBody,
    };

    const { value: responseValue, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/embeddings',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body: args,
      failedResponseHandler: langrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        LangRouterEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      embeddings: responseValue.data.map((item) => item.embedding),
      usage: responseValue.usage
        ? { tokens: responseValue.usage.prompt_tokens }
        : undefined,
      providerMetadata: {
        langrouter: LangRouterProviderMetadataSchema.parse({
          provider: responseValue.provider ?? '',
          usage: {
            promptTokens: responseValue.usage?.prompt_tokens ?? 0,
            completionTokens: 0,
            totalTokens: responseValue.usage?.total_tokens ?? 0,
            ...(responseValue.usage?.cost != null
              ? { cost: responseValue.usage.cost }
              : {}),
          },
        }),
      },
      response: {
        headers: responseHeaders,
        body: responseValue,
      },
      warnings: [],
    };
  }
}
