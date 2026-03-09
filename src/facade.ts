import type { LangRouterProviderSettings } from './provider';
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

import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { LangRouterChatLanguageModel } from './chat';
import { LangRouterCompletionLanguageModel } from './completion';
import { LangRouterEmbeddingModel } from './embedding';

/**
@deprecated Use `createLangRouter` instead.
 */
export class LangRouter {
  /**
Use a different URL prefix for API calls, e.g. to use proxy servers.
The default prefix is `https://api.langrouter.ai/v1`.
   */
  readonly baseURL: string;

  /**
API key that is being sent using the `Authorization` header.
It defaults to the `LANGROUTER_API_KEY` environment variable.
 */
  readonly apiKey?: string;

  /**
Custom headers to include in the requests.
   */
  readonly headers?: Record<string, string>;

  /**
   * Record of provider slugs to API keys for injecting into provider routing.
   */
  readonly api_keys?: Record<string, string>;

  /**
   * Creates a new LangRouter provider instance.
   */
  constructor(options: LangRouterProviderSettings = {}) {
    this.baseURL =
      withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
      'https://api.langrouter.ai/v1';
    this.apiKey = options.apiKey;
    this.headers = options.headers;
    this.api_keys = options.api_keys;
  }

  private get baseConfig() {
    return {
      baseURL: this.baseURL,
      headers: () => ({
        Authorization: `Bearer ${loadApiKey({
          apiKey: this.apiKey,
          environmentVariableName: 'LANGROUTER_API_KEY',
          description: 'LangRouter',
        })}`,
        ...this.headers,
        ...(this.api_keys &&
          Object.keys(this.api_keys).length > 0 && {
            'X-Provider-API-Keys': JSON.stringify(this.api_keys),
          }),
      }),
    };
  }

  chat(modelId: LangRouterChatModelId, settings: LangRouterChatSettings = {}) {
    return new LangRouterChatLanguageModel(modelId, settings, {
      provider: 'langrouter.chat',
      ...this.baseConfig,
      compatibility: 'strict',
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  completion(
    modelId: LangRouterCompletionModelId,
    settings: LangRouterCompletionSettings = {},
  ) {
    return new LangRouterCompletionLanguageModel(modelId, settings, {
      provider: 'langrouter.completion',
      ...this.baseConfig,
      compatibility: 'strict',
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  textEmbeddingModel(
    modelId: LangRouterEmbeddingModelId,
    settings: LangRouterEmbeddingSettings = {},
  ) {
    return new LangRouterEmbeddingModel(modelId, settings, {
      provider: 'langrouter.embedding',
      ...this.baseConfig,
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  /**
   * @deprecated Use textEmbeddingModel instead
   */
  embedding(
    modelId: LangRouterEmbeddingModelId,
    settings: LangRouterEmbeddingSettings = {},
  ) {
    return this.textEmbeddingModel(modelId, settings);
  }
}
