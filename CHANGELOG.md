# @langrouter/ai-sdk-provider

## 2.2.5

### Patch Changes

- [#428](https://github.com/LangRouterTeam/ai-sdk-provider/pull/428) [`6e2ff61`](https://github.com/LangRouterTeam/ai-sdk-provider/commit/6e2ff61c4d2441ff9bfe1a96350417dfe4f225a0) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Surface detailed error information from provider metadata in error messages

  When LangRouter returns an error, the top-level `error.message` is often generic (e.g. "Provider returned error"). The actual error details from the upstream provider are in `error.metadata.raw` but were not being surfaced to users.

  Now `extractErrorMessage` recursively extracts meaningful error messages from `metadata.raw` (which can be a string, JSON string, or nested object) and includes the provider name when available. For example, instead of just "Provider returned error", users will now see "[Anthropic] Your credit balance is too low".
