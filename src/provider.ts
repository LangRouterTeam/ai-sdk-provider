import type { ProviderV3 } from '@ai-sdk/provider';
import type {
  LangRouterChatModelId,
  LangRouterChatSettings,
} from './types/langrouter-chat-settings';
import type {
  LangRouterCompletionModelId,
  LangRouterCompletionSettings,
} from './types/langrouter-completion-settings';
import type {
  LangRouterEmbeddingModelId,
  LangRouterEmbeddingSettings,
} from './types/langrouter-embedding-settings';
import type {
  LangRouterImageModelId,
  LangRouterImageSettings,
} from './types/langrouter-image-settings';

import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { LangRouterChatLanguageModel } from './chat';
import { LangRouterCompletionLanguageModel } from './completion';
import { LangRouterEmbeddingModel } from './embedding';
import { LangRouterImageModel } from './image';
import { withUserAgentSuffix } from './utils/with-user-agent-suffix';
import { VERSION } from './version';

export type { LangRouterChatSettings, LangRouterCompletionSettings };

export interface LangRouterProvider extends ProviderV3 {
  (
    modelId: LangRouterChatModelId,
    settings?: LangRouterCompletionSettings,
  ): LangRouterCompletionLanguageModel;
  (
    modelId: LangRouterChatModelId,
    settings?: LangRouterChatSettings,
  ): LangRouterChatLanguageModel;

  languageModel(
    modelId: LangRouterChatModelId,
    settings?: LangRouterCompletionSettings,
  ): LangRouterCompletionLanguageModel;
  languageModel(
    modelId: LangRouterChatModelId,
    settings?: LangRouterChatSettings,
  ): LangRouterChatLanguageModel;

  /**
Creates an LangRouter chat model for text generation.
   */
  chat(
    modelId: LangRouterChatModelId,
    settings?: LangRouterChatSettings,
  ): LangRouterChatLanguageModel;

  /**
Creates an LangRouter completion model for text generation.
   */
  completion(
    modelId: LangRouterCompletionModelId,
    settings?: LangRouterCompletionSettings,
  ): LangRouterCompletionLanguageModel;

  /**
Creates an LangRouter text embedding model. (AI SDK v5)
   */
  textEmbeddingModel(
    modelId: LangRouterEmbeddingModelId,
    settings?: LangRouterEmbeddingSettings,
  ): LangRouterEmbeddingModel;

  /**
Creates an LangRouter text embedding model. (AI SDK v4 - deprecated, use textEmbeddingModel instead)
@deprecated Use textEmbeddingModel instead
   */
  embedding(
    modelId: LangRouterEmbeddingModelId,
    settings?: LangRouterEmbeddingSettings,
  ): LangRouterEmbeddingModel;

  /**
Creates an LangRouter image model for image generation.
   */
  imageModel(
    modelId: LangRouterImageModelId,
    settings?: LangRouterImageSettings,
  ): LangRouterImageModel;
}

export interface LangRouterProviderSettings {
  /**
Base URL for the LangRouter API calls.
     */
  baseURL?: string;

  /**
@deprecated Use `baseURL` instead.
     */
  baseUrl?: string;

  /**
API key for authenticating requests.
     */
  apiKey?: string;

  /**
Custom headers to include in the requests.
     */
  headers?: Record<string, string>;

  /**
LangRouter compatibility mode. Should be set to `strict` when using the LangRouter API,
and `compatible` when using 3rd party providers. In `compatible` mode, newer
information such as streamOptions are not being sent. Defaults to 'compatible'.
   */
  compatibility?: 'strict' | 'compatible';

  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
    */
  fetch?: typeof fetch;

  /**
A JSON object to send as the request body to access LangRouter features & upstream provider features.
  */
  extraBody?: Record<string, unknown>;

  /**
   * Record of provider slugs to API keys for injecting into provider routing.
   * Maps provider slugs (e.g. "anthropic", "openai") to their respective API keys.
   */
  api_keys?: Record<string, string>;
}

/**
Create an LangRouter provider instance.
 */
export function createLangRouter(
  options: LangRouterProviderSettings = {},
): LangRouterProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
    'https://api.langrouter.ai/v1';

  // we default to compatible, because strict breaks providers like Groq:
  const compatibility = options.compatibility ?? 'compatible';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'LANGROUTER_API_KEY',
          description: 'LangRouter',
        })}`,
        ...options.headers,
        ...(options.api_keys &&
          Object.keys(options.api_keys).length > 0 && {
            'X-Provider-API-Keys': JSON.stringify(options.api_keys),
          }),
      },
      `ai-sdk/langrouter/${VERSION}`,
    );

  const createChatModel = (
    modelId: LangRouterChatModelId,
    settings: LangRouterChatSettings = {},
  ) =>
    new LangRouterChatLanguageModel(modelId, settings, {
      provider: 'langrouter.chat',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createCompletionModel = (
    modelId: LangRouterCompletionModelId,
    settings: LangRouterCompletionSettings = {},
  ) =>
    new LangRouterCompletionLanguageModel(modelId, settings, {
      provider: 'langrouter.completion',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createEmbeddingModel = (
    modelId: LangRouterEmbeddingModelId,
    settings: LangRouterEmbeddingSettings = {},
  ) =>
    new LangRouterEmbeddingModel(modelId, settings, {
      provider: 'langrouter.embedding',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createImageModel = (
    modelId: LangRouterImageModelId,
    settings: LangRouterImageSettings = {},
  ) =>
    new LangRouterImageModel(modelId, settings, {
      provider: 'langrouter.image',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createLanguageModel = (
    modelId: LangRouterChatModelId | LangRouterCompletionModelId,
    settings?: LangRouterChatSettings | LangRouterCompletionSettings,
  ) => {
    if (new.target) {
      throw new Error(
        'The LangRouter model function cannot be called with the new keyword.',
      );
    }

    if (modelId === 'openai/gpt-3.5-turbo-instruct') {
      return createCompletionModel(
        modelId,
        settings as LangRouterCompletionSettings,
      );
    }

    return createChatModel(modelId, settings as LangRouterChatSettings);
  };

  const provider = (
    modelId: LangRouterChatModelId | LangRouterCompletionModelId,
    settings?: LangRouterChatSettings | LangRouterCompletionSettings,
  ) => createLanguageModel(modelId, settings);

  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.embedding = createEmbeddingModel; // deprecated alias for v4 compatibility
  provider.imageModel = createImageModel;

  return provider as LangRouterProvider;
}

/**
Default LangRouter provider instance. It uses 'strict' compatibility mode.
 */
export const langrouter = createLangRouter({
  compatibility: 'strict', // strict for LangRouter API
});
