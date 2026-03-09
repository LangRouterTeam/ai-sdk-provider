import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  ImageModelV3File,
  ImageModelV3ProviderMetadata,
  ImageModelV3Usage,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type {
  LangRouterImageModelId,
  LangRouterImageSettings,
} from '../types/langrouter-image-settings';

import {
  NoContentGeneratedError,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { buildFileDataUrl, getBase64FromDataUrl } from '../chat/file-url-utils';
import { langrouterFailedResponseHandler } from '../schemas/error-response';
import { LangRouterImageResponseSchema } from './schemas';

type LangRouterImageConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class LangRouterImageModel implements ImageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'langrouter';
  readonly modelId: LangRouterImageModelId;
  readonly settings: LangRouterImageSettings;
  readonly maxImagesPerCall = 1;

  private readonly config: LangRouterImageConfig;

  constructor(
    modelId: LangRouterImageModelId,
    settings: LangRouterImageSettings,
    config: LangRouterImageConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doGenerate(options: ImageModelV3CallOptions): Promise<{
    images: Array<string>;
    warnings: Array<SharedV3Warning>;
    providerMetadata?: ImageModelV3ProviderMetadata;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
    usage?: ImageModelV3Usage;
  }> {
    const {
      prompt,
      n,
      size,
      aspectRatio,
      seed,
      files,
      mask,
      abortSignal,
      headers,
      providerOptions,
    } = options;

    const langrouterOptions =
      (providerOptions?.langrouter as Record<string, unknown>) || {};

    const warnings: SharedV3Warning[] = [];

    if (mask !== undefined) {
      throw new UnsupportedFunctionalityError({
        functionality: 'image inpainting (mask parameter)',
      });
    }

    if (n > 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'n > 1',
        details: `LangRouter image generation returns 1 image per call. Requested ${n} images.`,
      });
    }

    if (size !== undefined) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details:
          'Use aspectRatio instead. Size parameter is not supported by LangRouter image generation.',
      });
    }

    const imageConfig: Record<string, string> | undefined =
      aspectRatio !== undefined ? { aspect_ratio: aspectRatio } : undefined;

    const hasFiles = files !== undefined && files.length > 0;

    const userContent: string | Array<Record<string, unknown>> = hasFiles
      ? [
          ...files.map((file: ImageModelV3File) =>
            convertImageFileToContentPart(file),
          ),
          { type: 'text', text: prompt ?? '' },
        ]
      : (prompt ?? '');

    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
      modalities: ['image', 'text'],
      ...(imageConfig !== undefined && { image_config: imageConfig }),
      ...(seed !== undefined && { seed }),
      ...(this.settings.user !== undefined && { user: this.settings.user }),
      ...(this.settings.provider !== undefined && {
        provider: this.settings.provider,
      }),
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...langrouterOptions,
    };

    const { value: responseValue, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body,
      failedResponseHandler: langrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        LangRouterImageResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const choice = responseValue.choices[0];

    if (!choice) {
      throw new NoContentGeneratedError({
        message: 'No choice in response',
      });
    }

    const images: string[] = [];

    if (choice.message?.images) {
      for (const image of choice.message.images) {
        const dataUrl = image.image_url.url;
        images.push(getBase64FromDataUrl(dataUrl));
      }
    }

    const usage: ImageModelV3Usage | undefined = responseValue.usage
      ? {
          inputTokens: responseValue.usage.prompt_tokens,
          outputTokens: responseValue.usage.completion_tokens,
          totalTokens: responseValue.usage.total_tokens,
        }
      : undefined;

    return {
      images,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: responseValue.model,
        headers: responseHeaders as Record<string, string> | undefined,
      },
      usage,
    };
  }
}

const DEFAULT_IMAGE_MEDIA_TYPE = 'image/png';

function convertImageFileToContentPart(
  file: ImageModelV3File,
): Record<string, unknown> {
  if (file.type === 'url') {
    return {
      type: 'image_url',
      image_url: { url: file.url },
    };
  }

  const url = buildFileDataUrl({
    data: file.data,
    mediaType: file.mediaType,
    defaultMediaType: DEFAULT_IMAGE_MEDIA_TYPE,
  });

  return {
    type: 'image_url',
    image_url: { url },
  };
}
