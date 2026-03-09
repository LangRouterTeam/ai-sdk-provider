import type {
  JSONObject,
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import type { ParseResult } from '@ai-sdk/provider-utils';
import type { z } from 'zod/v4';
import type { LangRouterUsageAccounting } from '../types';
import type {
  LangRouterCompletionModelId,
  LangRouterCompletionSettings,
} from '../types/langrouter-completion-settings';

import {
  APICallError,
  NoContentGeneratedError,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { langrouterFailedResponseHandler } from '../schemas/error-response';
import { LangRouterProviderMetadataSchema } from '../schemas/provider-metadata';
import { computeTokenUsage, emptyUsage } from '../utils/compute-token-usage';
import {
  createFinishReason,
  mapLangRouterFinishReason,
} from '../utils/map-finish-reason';
import { convertToLangRouterCompletionPrompt } from './convert-to-langrouter-completion-prompt';
import { LangRouterCompletionChunkSchema } from './schemas';

type LangRouterCompletionConfig = {
  provider: string;
  compatibility: 'strict' | 'compatible';
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class LangRouterCompletionLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'langrouter';
  readonly modelId: LangRouterCompletionModelId;
  readonly supportsImageUrls = true;
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [
      /^data:image\/[a-zA-Z]+;base64,/,
      /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i,
    ],
    'text/*': [/^data:text\//, /^https?:\/\/.+$/],
    'application/*': [/^data:application\//, /^https?:\/\/.+$/],
  };
  readonly defaultObjectGenerationMode = undefined;
  readonly settings: LangRouterCompletionSettings;

  private readonly config: LangRouterCompletionConfig;

  constructor(
    modelId: LangRouterCompletionModelId,
    settings: LangRouterCompletionSettings,
    config: LangRouterCompletionConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  private getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed,
    responseFormat,
    topK,
    stopSequences,
    tools,
    toolChoice,
  }: LanguageModelV3CallOptions) {
    const { prompt: completionPrompt } = convertToLangRouterCompletionPrompt({
      prompt,
      inputFormat: 'prompt',
    });

    if (tools?.length) {
      throw new UnsupportedFunctionalityError({
        functionality: 'tools',
      });
    }

    if (toolChoice) {
      throw new UnsupportedFunctionalityError({
        functionality: 'toolChoice',
      });
    }

    return {
      // model id:
      model: this.modelId,
      models: this.settings.models,

      // model specific settings:
      logit_bias: this.settings.logitBias,
      logprobs:
        typeof this.settings.logprobs === 'number'
          ? this.settings.logprobs
          : typeof this.settings.logprobs === 'boolean'
            ? this.settings.logprobs
              ? 0
              : undefined
            : undefined,
      suffix: this.settings.suffix,
      user: this.settings.user,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,

      stop: stopSequences,
      response_format: responseFormat,
      top_k: topK,

      // prompt:
      prompt: completionPrompt,

      // LangRouter specific settings:
      include_reasoning: this.settings.includeReasoning,
      reasoning: this.settings.reasoning,

      // extra body:
      ...this.config.extraBody,
      ...this.settings.extraBody,
    };
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3['doGenerate']>>> {
    const providerOptions = options.providerOptions || {};
    const langrouterOptions = providerOptions.langrouter || {};

    const args = {
      ...this.getArgs(options),
      ...langrouterOptions,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: langrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        LangRouterCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    if ('error' in response) {
      const errorData = response.error as { message: string; code?: string };
      throw new APICallError({
        message: errorData.message,
        url: this.config.url({
          path: '/completions',
          modelId: this.modelId,
        }),
        requestBodyValues: args,
        statusCode: 200,
        responseHeaders,
        data: errorData,
      });
    }

    const choice = response.choices[0];

    if (!choice) {
      throw new NoContentGeneratedError({
        message: 'No choice in LangRouter completion response',
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: choice.text ?? '',
        },
      ],
      finishReason: mapLangRouterFinishReason(choice.finish_reason),
      usage: response.usage ? computeTokenUsage(response.usage) : emptyUsage(),
      warnings: [],
      providerMetadata: {
        langrouter: LangRouterProviderMetadataSchema.parse({
          provider: response.provider ?? '',
          usage: {
            promptTokens: response.usage?.prompt_tokens ?? 0,
            completionTokens: response.usage?.completion_tokens ?? 0,
            totalTokens:
              (response.usage?.prompt_tokens ?? 0) +
              (response.usage?.completion_tokens ?? 0),
            ...(response.usage?.cost != null
              ? { cost: response.usage.cost }
              : {}),
            ...(response.usage?.prompt_tokens_details?.cached_tokens != null
              ? {
                  promptTokensDetails: {
                    cachedTokens:
                      response.usage.prompt_tokens_details.cached_tokens,
                  },
                }
              : {}),
            ...(response.usage?.completion_tokens_details?.reasoning_tokens !=
            null
              ? {
                  completionTokensDetails: {
                    reasoningTokens:
                      response.usage.completion_tokens_details.reasoning_tokens,
                  },
                }
              : {}),
            ...(response.usage?.cost_details?.upstream_inference_cost != null
              ? {
                  costDetails: {
                    upstreamInferenceCost:
                      response.usage.cost_details.upstream_inference_cost,
                  },
                }
              : {}),
          },
        }),
      },
      response: {
        headers: responseHeaders,
      },
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3['doStream']>>> {
    const providerOptions = options.providerOptions || {};
    const langrouterOptions = providerOptions.langrouter || {};

    const args = {
      ...this.getArgs(options),
      ...langrouterOptions,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: {
        ...args,
        stream: true,

        // only include stream_options when in strict compatibility mode:
        stream_options:
          this.config.compatibility === 'strict'
            ? { include_usage: true }
            : undefined,
      },
      failedResponseHandler: langrouterFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        LangRouterCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV3FinishReason = createFinishReason('other');
    const usage: LanguageModelV3Usage = {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
      raw: undefined,
    };

    const langrouterUsage: Partial<LangRouterUsageAccounting> = {};
    let provider: string | undefined;

    // Track raw usage from the API response for usage.raw
    let rawUsage: JSONObject | undefined;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof LangRouterCompletionChunkSchema>>,
          LanguageModelV3StreamPart
        >({
          transform(chunk, controller) {
            // Emit raw chunk if requested (before anything else)
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = createFinishReason('error');
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // handle error chunks:
            if ('error' in value) {
              finishReason = createFinishReason('error');
              controller.enqueue({ type: 'error', error: value.error });
              return;
            }

            if (value.provider) {
              provider = value.provider;
            }

            if (value.usage != null) {
              const computed = computeTokenUsage(value.usage);
              Object.assign(usage.inputTokens, computed.inputTokens);
              Object.assign(usage.outputTokens, computed.outputTokens);

              rawUsage = value.usage as JSONObject;

              const promptTokens = value.usage.prompt_tokens ?? 0;
              const completionTokens = value.usage.completion_tokens ?? 0;
              langrouterUsage.promptTokens = promptTokens;

              if (value.usage.prompt_tokens_details) {
                langrouterUsage.promptTokensDetails = {
                  cachedTokens:
                    value.usage.prompt_tokens_details.cached_tokens ?? 0,
                };
              }

              langrouterUsage.completionTokens = completionTokens;
              if (value.usage.completion_tokens_details) {
                langrouterUsage.completionTokensDetails = {
                  reasoningTokens:
                    value.usage.completion_tokens_details.reasoning_tokens ?? 0,
                };
              }

              if (value.usage.cost != null) {
                langrouterUsage.cost = value.usage.cost;
              }
              langrouterUsage.totalTokens = value.usage.total_tokens;
              const upstreamInferenceCost =
                value.usage.cost_details?.upstream_inference_cost;
              if (upstreamInferenceCost != null) {
                langrouterUsage.costDetails = {
                  upstreamInferenceCost,
                };
              }
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = mapLangRouterFinishReason(choice.finish_reason);
            }

            if (choice?.text != null) {
              controller.enqueue({
                type: 'text-delta',
                delta: choice.text,
                id: generateId(),
              });
            }
          },

          flush(controller) {
            // Set raw usage before emitting finish event
            usage.raw = rawUsage;

            const langrouterMetadata: {
              usage: Partial<LangRouterUsageAccounting>;
              provider?: string;
            } = {
              usage: langrouterUsage,
            };

            // Only include provider if it's actually set
            if (provider !== undefined) {
              langrouterMetadata.provider = provider;
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
              providerMetadata: {
                langrouter: langrouterMetadata,
              },
            });
          },
        }),
      ),
      response: {
        headers: responseHeaders,
      },
    };
  }
}
