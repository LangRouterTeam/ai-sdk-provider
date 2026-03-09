# LangRouter Provider for Vercel AI SDK

The [LangRouter](https://langrouter.ai/) provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) gives access to over 300 large language models on the LangRouter chat and completion APIs.

## Setup for AI SDK v6

```bash
# For pnpm
pnpm add @langrouter/ai-sdk-provider

# For npm
npm install @langrouter/ai-sdk-provider

# For yarn
yarn add @langrouter/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `langrouter` from `@langrouter/ai-sdk-provider`:

```ts
import { langrouter } from '@langrouter/ai-sdk-provider';
```

## Example

```ts
import { langrouter } from '@langrouter/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: langrouter('openai/gpt-4o'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Supported models

This list is not a definitive list of models supported by LangRouter, as it constantly changes as we add new models (and deprecate old ones) to our system. You can find the latest list of models supported by LangRouter [here](https://langrouter.ai/models).

You can find the latest list of tool-supported models supported by LangRouter [here](https://langrouter.ai/models?order=newest&supported_parameters=tools). (Note: This list may contain models that are not compatible with the AI SDK.)

## Embeddings

LangRouter supports embedding models for semantic search, RAG pipelines, and vector-native features.

### Basic Usage

```ts
import { embed } from 'ai';
import { langrouter } from '@langrouter/ai-sdk-provider';

const { embedding } = await embed({
  model: langrouter.textEmbeddingModel('openai/text-embedding-3-small'),
  value: 'sunny day at the beach',
});

console.log(embedding); // Array of numbers representing the embedding
```

### Batch Embeddings

```ts
import { embedMany } from 'ai';
import { langrouter } from '@langrouter/ai-sdk-provider';

const { embeddings } = await embedMany({
  model: langrouter.textEmbeddingModel('openai/text-embedding-3-small'),
  values: [
    'sunny day at the beach',
    'rainy day in the city',
    'snowy mountain peak',
  ],
});

console.log(embeddings); // Array of embedding arrays
```

### Supported Embedding Models

LangRouter supports various embedding models including:
- `openai/text-embedding-3-small`
- `openai/text-embedding-3-large`
- `openai/text-embedding-ada-002`
- And more available on [LangRouter](https://langrouter.ai/models?output_modalities=embeddings)

## Passing Extra Body to LangRouter

There are 3 ways to pass extra body to LangRouter:

1. Via the `providerOptions.langrouter` property:

   ```typescript
   import { createLangRouter } from '@langrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const langrouter = createLangRouter({ apiKey: 'your-api-key' });
   const model = langrouter('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
     providerOptions: {
       langrouter: {
         reasoning: {
           max_tokens: 10,
         },
       },
     },
   });
   ```

2. Via the `extraBody` property in the model settings:

   ```typescript
   import { createLangRouter } from '@langrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const langrouter = createLangRouter({ apiKey: 'your-api-key' });
   const model = langrouter('anthropic/claude-3.7-sonnet:thinking', {
     extraBody: {
       reasoning: {
         max_tokens: 10,
       },
     },
   });
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
   });
   ```

3. Via the `extraBody` property in the model factory.

   ```typescript
   import { createLangRouter } from '@langrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const langrouter = createLangRouter({
     apiKey: 'your-api-key',
     extraBody: {
       reasoning: {
         max_tokens: 10,
       },
     },
   });
   const model = langrouter('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
   });
   ```

## Anthropic Prompt Caching

You can include Anthropic-specific options directly in your messages when using functions like `streamText`. The LangRouter provider will automatically convert these messages to the correct format internally.

### Basic Usage

```typescript
import { createLangRouter } from '@langrouter/ai-sdk-provider';
import { streamText } from 'ai';

const langrouter = createLangRouter({ apiKey: 'your-api-key' });
const model = langrouter('anthropic/<supported-caching-model>');

await streamText({
  model,
  messages: [
    {
      role: 'system',
      content:
        'You are a podcast summary assistant. You are detail-oriented and critical about the content.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Given the text body below:',
        },
        {
          type: 'text',
          text: `<LARGE BODY OF TEXT>`,
          providerOptions: {
            langrouter: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
        {
          type: 'text',
          text: 'List the speakers?',
        },
      ],
    },
  ],
});
```

## Anthropic Beta Features

You can enable Anthropic beta features by passing custom headers through the LangRouter SDK.

### Fine-grained Tool Streaming

[Fine-grained tool streaming](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/fine-grained-tool-streaming) allows streaming tool parameters without buffering, reducing latency for large schemas. This is particularly useful when working with large nested JSON structures.

**Important:** This is a beta feature from Anthropic. Make sure to evaluate responses before using in production.

#### Basic Usage

```typescript
import { createLangRouter } from '@langrouter/ai-sdk-provider';
import { streamObject } from 'ai';

const provider = createLangRouter({
  apiKey: process.env.LANGROUTER_API_KEY,
  headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
  },
});

const model = provider.chat('anthropic/claude-sonnet-4');

const result = await streamObject({
  model,
  schema: yourLargeSchema,
  prompt: 'Generate a complex object...',
});

for await (const partialObject of result.partialObjectStream) {
  console.log(partialObject);
}
```

You can also pass the header at the request level:

```typescript
import { createLangRouter } from '@langrouter/ai-sdk-provider';
import { generateText } from 'ai';

const provider = createLangRouter({
  apiKey: process.env.LANGROUTER_API_KEY,
});

const model = provider.chat('anthropic/claude-sonnet-4');

await generateText({
  model,
  prompt: 'Hello',
  headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
  },
});
```

**Note:** Fine-grained tool streaming is specific to Anthropic models. When using models from other providers, the header will be ignored.

#### Use Case: Large Component Generation

This feature is particularly beneficial when streaming large, nested JSON structures like UI component trees:

```typescript
import { createLangRouter } from '@langrouter/ai-sdk-provider';
import { streamObject } from 'ai';
import { z } from 'zod';

const componentSchema = z.object({
  type: z.string(),
  props: z.record(z.any()),
  children: z.array(z.lazy(() => componentSchema)).optional(),
});

const provider = createLangRouter({
  apiKey: process.env.LANGROUTER_API_KEY,
  headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
  },
});

const model = provider.chat('anthropic/claude-sonnet-4');

const result = await streamObject({
  model,
  schema: componentSchema,
  prompt: 'Create a responsive dashboard layout',
});

for await (const partialComponent of result.partialObjectStream) {
  console.log('Partial component:', partialComponent);
}
```

## Use Cases

### Response Healing for Structured Outputs

The provider supports the [Response Healing plugin](https://langrouter.ai/docs/guides/features/plugins/response-healing), which automatically validates and repairs malformed JSON responses from AI models. This is particularly useful when using `generateObject` or structured outputs, as it can fix common issues like missing brackets, trailing commas, markdown wrappers, and mixed text.

```typescript
import { createLangRouter } from '@langrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';

const langrouter = createLangRouter({ apiKey: 'your-api-key' });
const model = langrouter('openai/gpt-4o', {
  plugins: [{ id: 'response-healing' }],
});

const { object } = await generateObject({
  model,
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  prompt: 'Generate a person with name and age.',
});

console.log(object); // { name: "John", age: 30 }
```

Note that Response Healing only works with non-streaming requests. When the model returns imperfect JSON formatting, the plugin attempts to repair the response so you receive valid, parseable JSON.

### Debugging API Requests

The provider supports a debug mode that echoes back the request body sent to the upstream provider. This is useful for troubleshooting and understanding how your requests are being processed. Note that debug mode only works with streaming requests.

```typescript
import { createLangRouter } from '@langrouter/ai-sdk-provider';
import { streamText } from 'ai';

const langrouter = createLangRouter({ apiKey: 'your-api-key' });
const model = langrouter('anthropic/claude-3.5-sonnet', {
  debug: {
    echo_upstream_body: true,
  },
});

const result = await streamText({
  model,
  prompt: 'Hello, how are you?',
});

// The debug data is available in the stream's first chunk
// and in the final response's providerMetadata
for await (const chunk of result.fullStream) {
  // Debug chunks have empty choices and contain debug.echo_upstream_body
  console.log(chunk);
}
```

The debug response will include the request body that was sent to the upstream provider, with sensitive data redacted (user IDs, base64 content, etc.). This helps you understand how LangRouter transforms your request before sending it to the model provider.

### Usage Accounting

The provider supports [LangRouter usage accounting](https://langrouter.ai/docs/use-cases/usage-accounting), which allows you to track token usage details directly in your API responses, without making additional API calls.

```typescript
// Enable usage accounting
const model = langrouter('openai/gpt-3.5-turbo', {
  usage: {
    include: true,
  },
});

// Access usage accounting data
const result = await generateText({
  model,
  prompt: 'Hello, how are you today?',
});

// Provider-specific usage details (available in providerMetadata)
if (result.providerMetadata?.langrouter?.usage) {
  console.log('Cost:', result.providerMetadata.langrouter.usage.cost);
  console.log(
    'Total Tokens:',
    result.providerMetadata.langrouter.usage.totalTokens,
  );
}
```

It also supports BYOK (Bring Your Own Key) [usage accounting](https://langrouter.ai/docs/docs/guides/usage-accounting#cost-breakdown), which allows you to track passthrough costs when you are using a provider's own API key in your LangRouter account.

```typescript
// Assuming you have set an OpenAI API key in https://langrouter.ai/settings/integrations

// Enable usage accounting
const model = langrouter('openai/gpt-3.5-turbo', {
  usage: {
    include: true,
  },
});

// Access usage accounting data
const result = await generateText({
  model,
  prompt: 'Hello, how are you today?',
});

// Provider-specific BYOK usage details (available in providerMetadata)
if (result.providerMetadata?.langrouter?.usage) {
  const costDetails = result.providerMetadata.langrouter.usage.costDetails;
  if (costDetails) {
    console.log('BYOK cost:', costDetails.upstreamInferenceCost);
  }
  console.log('LangRouter credits cost:', result.providerMetadata.langrouter.usage.cost);
  console.log(
    'Total Tokens:',
    result.providerMetadata.langrouter.usage.totalTokens,
  );
}
```
