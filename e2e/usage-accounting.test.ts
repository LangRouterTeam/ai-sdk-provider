import { streamText } from 'ai';
import { it, vi } from 'vitest';
import { createLangRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

it('receive usage accounting', async () => {
  const langrouter = createLangRouter({
    apiKey: process.env.LANGROUTER_API_KEY,
    baseUrl: `${process.env.LANGROUTER_API_BASE}/api/v1`,
  });
  const model = langrouter('anthropic/claude-3.7-sonnet:thinking', {
    usage: {
      include: true,
    },
  });
  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
    onFinish(e) {
      expect(e.providerMetadata?.langrouter).toMatchObject({
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          promptTokensDetails: expect.any(Object),
          completionTokensDetails: expect.any(Object),
          totalTokens: expect.any(Number),
          cost: expect.any(Number),
        }),
      });
    },
  });

  await response.consumeStream();
  const providerMetadata = await response.providerMetadata;
  // You can use expect.any(Type) or expect.objectContaining for schema-like matching
  expect(providerMetadata?.langrouter).toMatchObject({
    provider: expect.any(String),
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      promptTokensDetails: expect.any(Object),
      completionTokensDetails: expect.any(Object),
      totalTokens: expect.any(Number),
      cost: expect.any(Number),
    }),
  });
});
