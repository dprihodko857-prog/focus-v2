import { randomUUID } from "node:crypto";

export const GREETING_PROMPT_VERSION = "greeting-assistant@2026-08-06.v1";
export const GREETING_DISABLED_MESSAGE = "Генерация поздравлений пока недоступна. Анкету можно сохранить и продолжить позднее.";

const DEFAULT_GIGACHAT_BASE_URL = "https://api.giga.chat";
const DEFAULT_GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const DEFAULT_GIGACHAT_SCOPE = "GIGACHAT_API_PERS";
const DEFAULT_GIGACHAT_TIMEOUT_MS = 30000;
const DEFAULT_GIGACHAT_RETRY_ATTEMPTS = 2;
const DEFAULT_GIGACHAT_RATE_LIMIT_PER_MINUTE = 30;
const GIGACHAT_TOKEN_REFRESH_SKEW_MS = 60 * 1000;
const DEFAULT_POLZA_BASE_URL = "https://polza.ai/api/v1";
const DEFAULT_POLZA_TIMEOUT_MS = 30000;
const DEFAULT_POLZA_RETRY_ATTEMPTS = 2;
const DEFAULT_POLZA_RATE_LIMIT_PER_MINUTE = 30;
const MAX_GREETING_TEXT_LENGTH = 1800;
const MAX_GREETING_REQUEST_LENGTH = 32 * 1024;

const GREETING_SCENARIOS = new Set(["birthday", "holiday"]);
const HOLIDAY_GREETING_TYPES = new Set(["public_holiday", "professional_holiday", "religious_holiday"]);
const ADDRESS_MODES = new Set(["ty", "vy"]);
const GREETING_TONES = new Set(["warm", "official", "personal", "light_humor", "respectful"]);
const GREETING_LENGTHS = new Set(["short", "medium", "long"]);
const GREETING_FORMATS = new Set(["plain_text", "message", "toast"]);

const RU_PROFANITY_MARKERS = [
  [0x0445, 0x0443, 0x0439],
  [0x0445, 0x0443, 0x044f],
  [0x043f, 0x0438, 0x0437, 0x0434],
  [0x0431, 0x043b, 0x044f],
  [0x0435, 0x0431, 0x0430],
].map(points => String.fromCodePoint(...points));

/**
 * TypeScript contract used by Focus backend adapters:
 *
 * interface GreetingAIProvider {
 *   generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
 *   reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
 * }
 */

export class DisabledGreetingAIProvider {
  constructor({ message = GREETING_DISABLED_MESSAGE } = {}) {
    this.provider = "disabled";
    this.available = false;
    this.message = sanitizeText(message, 240) || GREETING_DISABLED_MESSAGE;
  }

  async generateGreeting(input = {}) {
    return createDisabledGreetingResult({ provider: this.provider, input, message: this.message });
  }

  async reviseGreeting(input = {}) {
    return createDisabledGreetingResult({ provider: this.provider, input, message: this.message });
  }
}

export class MockGreetingAIProvider {
  constructor({ now = () => new Date(), createId = randomUUID } = {}) {
    this.provider = "mock";
    this.available = true;
    this.now = now;
    this.createId = createId;
  }

  async generateGreeting(input = {}) {
    const normalized = normalizeGreetingGenerationInput(input);
    const variants = createMockGreetingVariants({
      input: normalized.input,
      createId: this.createId,
      revision: false,
    });

    return createGeneratedGreetingResult({
      provider: this.provider,
      variants,
      input: normalized.input,
      checkedAt: this.now().toISOString(),
    });
  }

  async reviseGreeting(input = {}) {
    const normalized = normalizeGreetingRevisionInput(input);
    const baseInput = normalized.input.baseInput || normalizeGreetingGenerationInput(input.baseInput || {}).input;
    const sourceText = normalized.input.sourceText || baseInput.context?.existingText || "";
    const instruction = normalized.input.instruction || "Сделай текст естественнее.";
    const variants = createMockGreetingVariants({
      input: {
        ...baseInput,
        revisionInstruction: instruction,
        context: {
          ...(baseInput.context || {}),
          existingText: sourceText,
        },
      },
      createId: this.createId,
      revision: true,
    });

    return createGeneratedGreetingResult({
      provider: this.provider,
      variants,
      input: baseInput,
      checkedAt: this.now().toISOString(),
    });
  }
}

export class GigaChatGreetingAIProvider {
  constructor({
    authorizationKey,
    scope = DEFAULT_GIGACHAT_SCOPE,
    model,
    baseUrl = DEFAULT_GIGACHAT_BASE_URL,
    oauthUrl = DEFAULT_GIGACHAT_OAUTH_URL,
    timeoutMs = DEFAULT_GIGACHAT_TIMEOUT_MS,
    retryAttempts = DEFAULT_GIGACHAT_RETRY_ATTEMPTS,
    rateLimitPerMinute = DEFAULT_GIGACHAT_RATE_LIMIT_PER_MINUTE,
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
    createId = randomUUID,
  } = {}) {
    this.provider = "gigachat";
    this.available = true;
    this.authorizationKey = normalizeAuthorizationKey(authorizationKey);
    this.scope = normalizeGigaChatScope(scope);
    this.model = normalizeProviderName(model);
    this.baseUrl = normalizeUrl(baseUrl) || DEFAULT_GIGACHAT_BASE_URL;
    this.oauthUrl = normalizeUrl(oauthUrl) || DEFAULT_GIGACHAT_OAUTH_URL;
    this.timeoutMs = normalizeTimeoutMs(timeoutMs);
    this.retryAttempts = normalizeRetryAttempts(retryAttempts);
    this.rateLimitPerMinute = normalizeRateLimit(rateLimitPerMinute);
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.createId = createId;
    this.cachedToken = null;
    this.pendingToken = null;
    this.rateWindowStartedAt = 0;
    this.rateWindowCount = 0;
  }

  async generateGreeting(input = {}) {
    const normalized = normalizeGreetingGenerationInput(input);
    if (!normalized.ok) {
      return createInvalidGreetingResult({
        provider: this.provider,
        errors: normalized.errors,
        input: normalized.input,
        checkedAt: this.now().toISOString(),
      });
    }

    return this.generateStructuredGreeting({
      operation: "generate",
      input: normalized.input,
      checkedAt: this.now().toISOString(),
    });
  }

  async reviseGreeting(input = {}) {
    const normalized = normalizeGreetingRevisionInput(input);
    if (!normalized.ok) {
      return createInvalidGreetingResult({
        provider: this.provider,
        errors: normalized.errors,
        input: normalized.input.baseInput,
        checkedAt: this.now().toISOString(),
      });
    }

    return this.generateStructuredGreeting({
      operation: "revise",
      input: normalized.input,
      checkedAt: this.now().toISOString(),
    });
  }

  async generateStructuredGreeting({ operation, input, checkedAt }) {
    if (!this.isConfigured()) {
      return createDisabledGreetingResult({
        provider: this.provider,
        input,
        checkedAt,
        reason: "provider_not_configured",
      });
    }

    try {
      const token = await this.getAccessToken();
      const payload = operation === "revise"
        ? createGigaChatRevisionPayload({ model: this.model, input })
        : createGigaChatGenerationPayload({ model: this.model, input });
      const result = await this.fetchChatCompletion({ token, payload });
      const providerResult = parseGigaChatGreetingResult({
        body: result.body,
        provider: this.provider,
        input: operation === "revise" ? input.baseInput : input,
        checkedAt,
      });
      const validation = validateGreetingGenerationResult(
        providerResult,
        operation === "revise" ? input.baseInput : input,
      );

      if (!validation.ok) {
        return createProviderFailedGreetingResult({
          provider: this.provider,
          reason: "provider_validation_failed",
          errors: validation.errors,
          input: operation === "revise" ? input.baseInput : input,
          checkedAt,
        });
      }

      return {
        ...validation.result,
        usage: normalizeGigaChatUsage(result.body?.usage),
      };
    } catch (error) {
      return createProviderFailedGreetingResult({
        provider: this.provider,
        reason: getProviderFailureReason(error),
        input: operation === "revise" ? input.baseInput : input,
        checkedAt,
      });
    }
  }

  isConfigured() {
    return Boolean(this.authorizationKey && this.scope && this.model && this.baseUrl && this.oauthUrl && this.fetchImpl);
  }

  async getAccessToken() {
    const nowMs = this.now().getTime();
    if (this.cachedToken?.accessToken && this.cachedToken.expiresAtMs - GIGACHAT_TOKEN_REFRESH_SKEW_MS > nowMs) {
      return this.cachedToken.accessToken;
    }

    if (this.pendingToken) {
      return this.pendingToken;
    }

    this.pendingToken = this.requestAccessToken()
      .finally(() => {
        this.pendingToken = null;
      });

    return this.pendingToken;
  }

  async requestAccessToken() {
    const body = new URLSearchParams();
    body.set("scope", this.scope);

    const result = await this.fetchJsonWithRetry({
      url: this.oauthUrl,
      options: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
          RqUID: this.createId(),
          Authorization: formatGigaChatAuthorizationHeader(this.authorizationKey),
        },
        body,
      },
      tokenRequest: true,
    });

    if (!result.response.ok) {
      throw createProviderError(getGigaChatFailureReason(result.response.status, result.body), result.response.status);
    }

    const accessToken = sanitizeSecretToken(result.body?.access_token);
    if (!accessToken) {
      throw createProviderError("provider_auth_failed");
    }

    this.cachedToken = {
      accessToken,
      expiresAtMs: normalizeGigaChatTokenExpiresAt(result.body?.expires_at, this.now().getTime()),
    };
    return accessToken;
  }

  async fetchChatCompletion({ token, payload }) {
    const chatUrl = `${this.baseUrl.replace(/\/+$/u, "")}/v1/chat/completions`;
    const result = await this.fetchJsonWithRetry({
      url: chatUrl,
      options: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    });

    if (result.response.status === 401 || result.response.status === 403) {
      this.cachedToken = null;
      const refreshedToken = await this.getAccessToken();
      const retried = await this.fetchJsonWithRetry({
        url: chatUrl,
        options: {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            Authorization: `Bearer ${refreshedToken}`,
          },
          body: JSON.stringify(payload),
        },
      });
      if (!retried.response.ok) {
        throw createProviderError(getGigaChatFailureReason(retried.response.status, retried.body), retried.response.status);
      }
      return retried;
    }

    if (!result.response.ok) {
      throw createProviderError(getGigaChatFailureReason(result.response.status, result.body), result.response.status);
    }

    return result;
  }

  async fetchJsonWithRetry({ url, options, tokenRequest = false }) {
    let lastError = null;
    const attempts = Math.max(1, this.retryAttempts + 1);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!tokenRequest) {
        await this.waitForRateLimit();
      }

      try {
        const result = await fetchJsonWithTimeout({
          fetchImpl: this.fetchImpl,
          url,
          options,
          timeoutMs: this.timeoutMs,
        });

        if (!shouldRetryProviderResponse(result.response.status) || attempt === attempts - 1) {
          return result;
        }
      } catch (error) {
        lastError = error;
        if (isAbortError(error) || attempt === attempts - 1) {
          throw error;
        }
      }

      await sleep(getRetryDelayMs(attempt));
    }

    throw lastError || createProviderError("provider_error");
  }

  async waitForRateLimit() {
    if (!this.rateLimitPerMinute) return;

    const nowMs = this.now().getTime();
    if (!this.rateWindowStartedAt || nowMs - this.rateWindowStartedAt >= 60 * 1000) {
      this.rateWindowStartedAt = nowMs;
      this.rateWindowCount = 0;
    }

    if (this.rateWindowCount >= this.rateLimitPerMinute) {
      const waitMs = Math.max(0, 60 * 1000 - (nowMs - this.rateWindowStartedAt));
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      this.rateWindowStartedAt = this.now().getTime();
      this.rateWindowCount = 0;
    }

    this.rateWindowCount += 1;
  }
}

export class PolzaGreetingAIProvider {
  constructor({
    apiKey,
    model,
    baseUrl = DEFAULT_POLZA_BASE_URL,
    timeoutMs = DEFAULT_POLZA_TIMEOUT_MS,
    retryAttempts = DEFAULT_POLZA_RETRY_ATTEMPTS,
    rateLimitPerMinute = DEFAULT_POLZA_RATE_LIMIT_PER_MINUTE,
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
  } = {}) {
    this.provider = "polza";
    this.available = true;
    this.apiKey = sanitizeSecretToken(apiKey);
    this.model = normalizeProviderName(model);
    this.baseUrl = normalizeUrl(baseUrl) || DEFAULT_POLZA_BASE_URL;
    this.timeoutMs = normalizeTimeoutMs(timeoutMs, DEFAULT_POLZA_TIMEOUT_MS);
    this.retryAttempts = normalizeRetryAttempts(retryAttempts, DEFAULT_POLZA_RETRY_ATTEMPTS);
    this.rateLimitPerMinute = normalizeRateLimit(rateLimitPerMinute, DEFAULT_POLZA_RATE_LIMIT_PER_MINUTE);
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.rateWindowStartedAt = 0;
    this.rateWindowCount = 0;
  }

  async generateGreeting(input = {}) {
    const normalized = normalizeGreetingGenerationInput(input);
    if (!normalized.ok) {
      return createInvalidGreetingResult({
        provider: this.provider,
        errors: normalized.errors,
        input: normalized.input,
        checkedAt: this.now().toISOString(),
      });
    }

    return this.generateStructuredGreeting({
      operation: "generate",
      input: normalized.input,
      checkedAt: this.now().toISOString(),
    });
  }

  async reviseGreeting(input = {}) {
    const normalized = normalizeGreetingRevisionInput(input);
    if (!normalized.ok) {
      return createInvalidGreetingResult({
        provider: this.provider,
        errors: normalized.errors,
        input: normalized.input.baseInput,
        checkedAt: this.now().toISOString(),
      });
    }

    return this.generateStructuredGreeting({
      operation: "revise",
      input: normalized.input,
      checkedAt: this.now().toISOString(),
    });
  }

  async generateStructuredGreeting({ operation, input, checkedAt }) {
    const baseInput = operation === "revise" ? input.baseInput : input;
    if (!this.isConfigured()) {
      return createDisabledGreetingResult({
        provider: this.provider,
        input: baseInput,
        checkedAt,
        reason: "provider_not_configured",
      });
    }

    try {
      const payload = operation === "revise"
        ? createOpenAICompatibleRevisionPayload({ model: this.model, input })
        : createOpenAICompatibleGenerationPayload({ model: this.model, input });
      const result = await this.fetchChatCompletion({ payload });
      const providerResult = parseOpenAICompatibleGreetingResult({
        body: result.body,
        provider: this.provider,
        input: baseInput,
        checkedAt,
      });
      const validation = validateGreetingGenerationResult(providerResult, baseInput);

      if (!validation.ok) {
        return createProviderFailedGreetingResult({
          provider: this.provider,
          reason: "provider_validation_failed",
          errors: validation.errors,
          input: baseInput,
          checkedAt,
        });
      }

      return {
        ...validation.result,
        usage: normalizeOpenAICompatibleUsage(result.body?.usage),
      };
    } catch (error) {
      return createProviderFailedGreetingResult({
        provider: this.provider,
        reason: getProviderFailureReason(error),
        input: baseInput,
        checkedAt,
      });
    }
  }

  isConfigured() {
    return Boolean(this.apiKey && this.model && this.baseUrl && this.fetchImpl);
  }

  async fetchChatCompletion({ payload }) {
    const chatUrl = `${this.baseUrl.replace(/\/+$/u, "")}/chat/completions`;
    const result = await this.fetchJsonWithRetry({
      url: chatUrl,
      options: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      },
    });

    if (!result.response.ok) {
      throw createProviderError(getOpenAICompatibleFailureReason(result.response.status, result.body), result.response.status);
    }

    return result;
  }

  async fetchJsonWithRetry({ url, options }) {
    let lastError = null;
    const attempts = Math.max(1, this.retryAttempts + 1);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await this.waitForRateLimit();

      try {
        const result = await fetchJsonWithTimeout({
          fetchImpl: this.fetchImpl,
          url,
          options,
          timeoutMs: this.timeoutMs,
        });

        if (!shouldRetryProviderResponse(result.response.status) || attempt === attempts - 1) {
          return result;
        }
      } catch (error) {
        lastError = error;
        if (isAbortError(error) || attempt === attempts - 1) {
          throw error;
        }
      }

      await sleep(getRetryDelayMs(attempt));
    }

    throw lastError || createProviderError("provider_error");
  }

  async waitForRateLimit() {
    if (!this.rateLimitPerMinute) return;

    const nowMs = this.now().getTime();
    if (!this.rateWindowStartedAt || nowMs - this.rateWindowStartedAt >= 60 * 1000) {
      this.rateWindowStartedAt = nowMs;
      this.rateWindowCount = 0;
    }

    if (this.rateWindowCount >= this.rateLimitPerMinute) {
      const waitMs = Math.max(0, 60 * 1000 - (nowMs - this.rateWindowStartedAt));
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      this.rateWindowStartedAt = this.now().getTime();
      this.rateWindowCount = 0;
    }

    this.rateWindowCount += 1;
  }
}

export function createGreetingAIProviderFromEnv(env = process.env, { fetchImpl = globalThis.fetch, now = () => new Date(), createId = randomUUID } = {}) {
  const provider = normalizeGreetingProviderName(
    env.FOCUS_GREETING_AI_PROVIDER ||
    env.FOCUS_GREETING_PROVIDER ||
    "",
  );

  if (!provider) {
    return new MockGreetingAIProvider({ now, createId });
  }

  if (provider === "disabled") {
    return new DisabledGreetingAIProvider();
  }

  if (provider === "mock") {
    return new MockGreetingAIProvider({ now, createId });
  }

  if (provider === "gigachat") {
    return new GigaChatGreetingAIProvider({
      authorizationKey: env.FOCUS_GIGACHAT_AUTHORIZATION_KEY || env.GIGACHAT_AUTHORIZATION_KEY || env.GIGACHAT_CREDENTIALS || "",
      scope: env.FOCUS_GIGACHAT_SCOPE || env.GIGACHAT_SCOPE || DEFAULT_GIGACHAT_SCOPE,
      model: env.FOCUS_GIGACHAT_MODEL || env.GIGACHAT_MODEL || "",
      baseUrl: env.FOCUS_GIGACHAT_BASE_URL || env.GIGACHAT_BASE_URL || DEFAULT_GIGACHAT_BASE_URL,
      oauthUrl: env.FOCUS_GIGACHAT_OAUTH_URL || env.GIGACHAT_OAUTH_URL || DEFAULT_GIGACHAT_OAUTH_URL,
      timeoutMs: env.FOCUS_GIGACHAT_TIMEOUT_MS || env.GIGACHAT_TIMEOUT_MS || parseTimeoutSecondsEnv(env.FOCUS_GIGACHAT_TIMEOUT || env.GIGACHAT_TIMEOUT),
      retryAttempts: env.FOCUS_GIGACHAT_RETRY_ATTEMPTS,
      rateLimitPerMinute: env.FOCUS_GIGACHAT_RATE_LIMIT_PER_MINUTE,
      fetchImpl,
      now,
      createId,
    });
  }

  if (provider === "polza") {
    return new PolzaGreetingAIProvider({
      apiKey: env.FOCUS_POLZA_API_KEY || env.POLZA_API_KEY || env.POLZA_AI_API_KEY || "",
      model: env.FOCUS_POLZA_MODEL || env.POLZA_MODEL || "",
      baseUrl: env.FOCUS_POLZA_BASE_URL || env.POLZA_BASE_URL || DEFAULT_POLZA_BASE_URL,
      timeoutMs: env.FOCUS_POLZA_TIMEOUT_MS || env.POLZA_TIMEOUT_MS || parseTimeoutSecondsEnv(env.FOCUS_POLZA_TIMEOUT || env.POLZA_TIMEOUT),
      retryAttempts: env.FOCUS_POLZA_RETRY_ATTEMPTS || env.POLZA_RETRY_ATTEMPTS,
      rateLimitPerMinute: env.FOCUS_POLZA_RATE_LIMIT_PER_MINUTE || env.POLZA_RATE_LIMIT_PER_MINUTE,
      fetchImpl,
      now,
    });
  }

  return new DisabledGreetingAIProvider();
}

export function normalizeGreetingAIProvider(provider, options = {}) {
  if (!provider) {
    return new DisabledGreetingAIProvider();
  }

  if (provider instanceof MockGreetingAIProvider || provider instanceof DisabledGreetingAIProvider || provider instanceof GigaChatGreetingAIProvider || provider instanceof PolzaGreetingAIProvider) {
    return provider;
  }

  if (typeof provider.generateGreeting === "function" && typeof provider.reviseGreeting === "function") {
    return {
      provider: normalizeGreetingProviderName(provider.provider) || "custom",
      available: provider.available !== false,
      generateGreeting: provider.generateGreeting.bind(provider),
      reviseGreeting: provider.reviseGreeting.bind(provider),
    };
  }

  if (typeof provider === "string") {
    return createGreetingAIProviderFromEnv({ FOCUS_GREETING_AI_PROVIDER: provider }, options);
  }

  if (isPlainObject(provider)) {
    const name = normalizeGreetingProviderName(provider.provider);
    if (name === "mock") return new MockGreetingAIProvider(options);
    if (name === "disabled") return new DisabledGreetingAIProvider(provider);
    if (name === "polza") {
      return new PolzaGreetingAIProvider({
        ...provider,
        fetchImpl: provider.fetchImpl || options.fetchImpl,
        now: provider.now || options.now,
      });
    }
    if (name === "gigachat") {
      return new GigaChatGreetingAIProvider({
        ...provider,
        fetchImpl: provider.fetchImpl || options.fetchImpl,
        now: provider.now || options.now,
        createId: provider.createId || options.createId,
      });
    }
  }

  return new DisabledGreetingAIProvider();
}

export function validateGreetingGenerationInput(input = {}) {
  const normalized = normalizeGreetingGenerationInput(input);
  return normalized.ok ? { ok: true, input: normalized.input, errors: [] } : normalized;
}

export function validateGreetingRevisionInput(input = {}) {
  const normalized = normalizeGreetingRevisionInput(input);
  return normalized.ok ? { ok: true, input: normalized.input, errors: [] } : normalized;
}

export function validateGreetingGenerationResult(result = {}, input = {}) {
  const errors = [];
  const source = isPlainObject(result) ? result : {};
  const normalizedInput = normalizeGreetingGenerationInput(input).input;
  const variants = Array.isArray(source.variants)
    ? source.variants
      .map((variant, index) => normalizeGreetingVariant(variant, index))
      .filter(Boolean)
      .slice(0, 3)
    : [];

  if (source.status !== "generated") {
    errors.push("status");
  }
  if (!variants.length) {
    errors.push("variants_required");
  }
  if (variants.length > 3) {
    errors.push("variants_too_many");
  }

  const uniqueTexts = new Set();
  variants.forEach(variant => {
    const normalizedText = variant.text.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
    if (uniqueTexts.has(normalizedText)) {
      errors.push("variants_not_distinct");
    }
    uniqueTexts.add(normalizedText);

    const textErrors = validateGreetingText(variant.text, normalizedInput);
    errors.push(...textErrors);
  });

  const normalizedResult = {
    status: "generated",
    provider: sanitizeProviderName(source.provider) || null,
    promptVersion: source.promptVersion === GREETING_PROMPT_VERSION ? source.promptVersion : GREETING_PROMPT_VERSION,
    variants,
    safety: {
      validated: errors.length === 0,
      validationVersion: "greeting-result-validation@2026-08-06.v1",
    },
    warnings: normalizeStringList(source.warnings, 12, 160),
    checkedAt: normalizeTimestamp(source.checkedAt) || new Date().toISOString(),
  };

  return {
    ok: errors.length === 0,
    result: normalizedResult,
    errors: [...new Set(errors)],
  };
}

export function createGeneratedGreetingResult({ provider, variants, input, checkedAt, warnings = [] }) {
  const result = {
    status: "generated",
    provider: sanitizeProviderName(provider) || "unknown",
    promptVersion: GREETING_PROMPT_VERSION,
    variants: (Array.isArray(variants) ? variants : []).map((variant, index) => normalizeGreetingVariant(variant, index)).filter(Boolean),
    safety: {
      validated: true,
      validationVersion: "greeting-result-validation@2026-08-06.v1",
    },
    warnings: normalizeStringList(warnings, 12, 160),
    checkedAt: normalizeTimestamp(checkedAt) || new Date().toISOString(),
  };
  const validation = validateGreetingGenerationResult(result, input);
  return validation.ok
    ? validation.result
    : createProviderFailedGreetingResult({
      provider,
      reason: "provider_validation_failed",
      errors: validation.errors,
      input,
      checkedAt,
    });
}

function normalizeGreetingGenerationInput(input = {}) {
  const errors = [];
  const source = isPlainObject(input) ? input : {};
  const scenario = GREETING_SCENARIOS.has(source.scenario) ? source.scenario : "";
  if (!scenario) errors.push("scenario");

  const recipient = normalizeGreetingRecipient(source.recipient);
  const event = normalizeGreetingEvent(source.event || source.holiday || {});
  const context = normalizeGreetingContext(source.context || {});
  const bans = normalizeGreetingBans(source.bans || source.constraints || {});
  const normalized = {
    scenario: scenario || "birthday",
    holidayType: HOLIDAY_GREETING_TYPES.has(source.holidayType) ? source.holidayType : event.holidayType || null,
    recipient,
    event,
    context,
    bans,
    sender: sanitizeText(source.sender || source.senderLabel || "", 120),
    addressMode: ADDRESS_MODES.has(source.addressMode) ? source.addressMode : "vy",
    tone: GREETING_TONES.has(source.tone) ? source.tone : "warm",
    length: GREETING_LENGTHS.has(source.length) ? source.length : "medium",
    format: GREETING_FORMATS.has(source.format) ? source.format : "plain_text",
    variantCount: clampInteger(source.variantCount, 1, 3, 3),
    promptVersion: GREETING_PROMPT_VERSION,
  };

  if (normalized.scenario === "holiday" && !normalized.event.title) {
    errors.push("holiday_title");
  }
  if (normalized.scenario === "birthday" && !normalized.recipient.name && !normalized.context.birthday?.name) {
    errors.push("recipient_name");
  }

  const serializedLength = JSON.stringify(normalized).length;
  if (serializedLength > MAX_GREETING_REQUEST_LENGTH) {
    errors.push("request_too_large");
  }

  return {
    ok: errors.length === 0,
    input: normalized,
    errors,
  };
}

function normalizeGreetingRevisionInput(input = {}) {
  const errors = [];
  const source = isPlainObject(input) ? input : {};
  const base = normalizeGreetingGenerationInput(source.baseInput || source.input || {});
  const sourceText = sanitizeGreetingText(source.sourceText || source.text || "");
  const instruction = sanitizeText(source.instruction || source.revision || "", 500);

  if (!sourceText) errors.push("source_text");
  if (!instruction) errors.push("instruction");
  if (!base.ok) errors.push(...base.errors.map(error => `base_${error}`));

  return {
    ok: errors.length === 0,
    input: {
      sourceText,
      instruction,
      baseInput: base.input,
      promptVersion: GREETING_PROMPT_VERSION,
    },
    errors,
  };
}

function normalizeGreetingRecipient(recipient = {}) {
  const source = isPlainObject(recipient) ? recipient : {};
  return {
    name: sanitizeText(source.name || source.fullName || source.title || "", 120),
    role: sanitizeText(source.role || source.relationship || "", 120),
    gender: sanitizeText(source.gender || "", 40),
  };
}

function normalizeGreetingEvent(event = {}) {
  const source = isPlainObject(event) ? event : {};
  return {
    title: sanitizeText(source.title || source.name || "", 160),
    date: normalizeLocalDate(source.date || source.localDate || source.startLocalDate),
    holidayType: HOLIDAY_GREETING_TYPES.has(source.holidayType || source.type) ? (source.holidayType || source.type) : null,
    tradition: sanitizeText(source.tradition || source.religiousTradition || "", 120),
    description: sanitizeText(source.description || "", 1200),
  };
}

function normalizeGreetingContext(context = {}) {
  const source = isPlainObject(context) ? context : {};
  return {
    birthday: isPlainObject(source.birthday)
      ? {
        name: sanitizeText(source.birthday.name || "", 120),
        dateOfBirth: normalizeLocalDate(source.birthday.dateOfBirth),
        age: normalizeAge(source.birthday.age),
        note: sanitizeText(source.birthday.note || "", 800),
      }
      : null,
    holiday: isPlainObject(source.holiday)
      ? {
        title: sanitizeText(source.holiday.title || "", 160),
        description: sanitizeText(source.holiday.description || "", 1200),
        source: sanitizeText(source.holiday.source || "", 160),
      }
      : null,
    personalNote: sanitizeText(source.personalNote || source.note || "", 1200),
    existingText: sanitizeGreetingText(source.existingText || ""),
    allowedFacts: normalizeStringList(source.allowedFacts || source.facts, 12, 240),
  };
}

function normalizeGreetingBans(bans = {}) {
  const source = isPlainObject(bans) ? bans : {};
  return {
    mentionAge: source.mentionAge === true || source.noAge === true || source.avoidAge === true,
    personalTopics: normalizeStringList(source.personalTopics || source.forbiddenTopics || source.noTopics, 8, 120),
  };
}

function createMockGreetingVariants({ input, createId, revision }) {
  const recipientName = input.recipient.name || input.context?.birthday?.name || "";
  const recipientPrefix = recipientName ? `${recipientName}, ` : "";
  const congratulate = recipientName ? "поздравляю" : "Поздравляю";
  const holidayTitle = input.event.title || input.context?.holiday?.title || "праздник";
  const address = input.addressMode === "ty" ? "ты" : "вы";
  const sender = input.sender ? ` От ${input.sender}.` : "";
  const personalNote = input.context?.personalNote || input.context?.birthday?.note || "";
  const instructionTail = revision && input.revisionInstruction ? ` Учтено: ${input.revisionInstruction}` : "";
  const base = input.scenario === "birthday"
    ? [
      `${recipientPrefix}поздравляю с днем рождения! Желаю спокойной радости, сил для важных дел и людей рядом, с которыми легко быть собой.${sender}`,
      `${recipientPrefix}пусть этот день будет теплым, внимательным и по-настоящему вашим. Желаю здоровья, вдохновения и уверенности в каждом новом шаге.${sender}`,
      `${recipientPrefix}с днем рождения! Пусть впереди будет больше ясности, добрых встреч и поводов улыбаться без спешки.${sender}`,
    ]
    : [
      `${recipientPrefix}${congratulate} с праздником ${holidayTitle}. Пусть этот день принесет светлое настроение, уважение к традиции и добрые слова рядом.${sender}`,
      `${recipientPrefix}${recipientName ? "с" : "С"} праздником ${holidayTitle}! Желаю мира, тепла и уверенности в том, что важное обязательно получится.${sender}`,
      `${recipientPrefix}${recipientName ? "пусть" : "Пусть"} ${holidayTitle} станет поводом сказать главное: ценю ваше участие, внимание и доброту.${sender}`,
    ];

  return base.slice(0, input.variantCount).map((text, index) => {
    const adjusted = applyMockStyle({
      text,
      input,
      address,
      personalNote,
      instructionTail,
      index,
    });
    return {
      id: `greeting-${String(createId()).replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120) || index + 1}`,
      title: index === 0 ? "Теплый вариант" : index === 1 ? "Спокойный вариант" : "Короткий вариант",
      text: adjusted,
      tone: input.tone,
      format: input.format,
    };
  });
}

function applyMockStyle({ text, input, address, personalNote, instructionTail, index }) {
  let nextText = text;
  if (input.tone === "official") {
    nextText = nextText.replace("поздравляю", "поздравляем").replace("Желаю", "Желаем");
  }
  if (input.tone === "light_humor" && index === 2) {
    nextText += " И пусть список дел сегодня уступит место хорошему настроению.";
  }
  if (input.length === "short") {
    nextText = nextText.split(".").slice(0, 2).join(".").trim();
    if (nextText && !nextText.endsWith(".")) nextText += ".";
  }
  if (personalNote && index === 1) {
    nextText += ` Отдельно хочется отметить: ${personalNote}.`;
  }
  if (address === "ты") {
    nextText = nextText
      .replaceAll("вашим", "твоим")
      .replaceAll("ваше", "твое")
      .replaceAll("вас", "тебя")
      .replaceAll("вы", "ты");
  }
  nextText += instructionTail ? `.${instructionTail}` : "";
  return sanitizeGreetingText(removeBannedMockDetails(nextText, input));
}

function removeBannedMockDetails(text, input) {
  let result = text;
  if (input.bans?.mentionAge) {
    result = result.replace(/\b\d{1,3}\s*(?:лет|года|год)\b/giu, "").replace(/\s{2,}/g, " ");
  }
  for (const topic of input.bans?.personalTopics || []) {
    if (!topic) continue;
    const escaped = escapeRegExp(topic);
    result = result.replace(new RegExp(escaped, "giu"), "важная тема");
  }
  return result;
}

function createGigaChatGenerationPayload({ model, input }) {
  return createGigaChatPayload({
    model,
    instruction: "Сформируй три разных русскоязычных поздравления по анкете Focus. Не выдумывай факты, используй только явно переданные данные. Верни только JSON по схеме.",
    input,
  });
}

function createGigaChatRevisionPayload({ model, input }) {
  return createGigaChatPayload({
    model,
    instruction: "Отредактируй поздравление по команде пользователя. Не выполняй никаких действий кроме переписывания текста. Верни только JSON по схеме.",
    input,
  });
}

function createOpenAICompatibleGenerationPayload({ model, input }) {
  return createGigaChatGenerationPayload({ model, input });
}

function createOpenAICompatibleRevisionPayload({ model, input }) {
  return createGigaChatRevisionPayload({ model, input });
}

function createGigaChatPayload({ model, instruction, input }) {
  return {
    model,
    messages: [
      {
        role: "system",
        content: [
          "Ты серверный помощник Focus Greeting Assistant.",
          `Версия промпта: ${GREETING_PROMPT_VERSION}.`,
          "Пиши естественно по-русски. Не добавляй факты, которых нет во входных данных.",
          "Провайдер не сохраняет черновики, не копирует текст, не меняет события и не отправляет сообщения.",
          "Если есть запреты, соблюдай их строго.",
          instruction,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    temperature: 0.7,
    max_tokens: 1600,
    response_format: {
      type: "json_schema",
      schema: createGreetingResultJsonSchema(),
      strict: true,
    },
  };
}

function createGreetingResultJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ["generated"] },
      variants: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            text: { type: "string" },
            tone: { type: "string" },
            format: { type: "string" },
          },
          required: ["id", "title", "text", "tone", "format"],
        },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["status", "variants", "warnings"],
  };
}

function parseGigaChatGreetingResult({ body, provider, input, checkedAt }) {
  const content = extractGigaChatContent(body);
  const parsed = parseJsonObject(content);
  if (!parsed) {
    return createProviderFailedGreetingResult({
      provider,
      reason: "invalid_structured_output",
      input,
      checkedAt,
    });
  }

  return {
    status: parsed.status === "generated" ? "generated" : "",
    provider,
    promptVersion: GREETING_PROMPT_VERSION,
    variants: Array.isArray(parsed.variants) ? parsed.variants : [],
    warnings: normalizeStringList(parsed.warnings, 12, 160),
    checkedAt,
  };
}

function extractGigaChatContent(body = {}) {
  const choiceContent = body?.choices?.[0]?.message?.content;
  if (typeof choiceContent === "string") return choiceContent;

  const messageContent = body?.messages?.[0]?.content;
  if (typeof messageContent === "string") return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent.map(part => typeof part?.text === "string" ? part.text : "").join("");
  }

  return "";
}

function parseJsonObject(content) {
  const text = String(content || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/u);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function parseOpenAICompatibleGreetingResult({ body, provider, input, checkedAt }) {
  return parseGigaChatGreetingResult({ body, provider, input, checkedAt });
}

function createDisabledGreetingResult({ provider, input, checkedAt, message = GREETING_DISABLED_MESSAGE, reason = "provider_not_configured" }) {
  return {
    status: "provider_not_configured",
    provider: sanitizeProviderName(provider) || null,
    promptVersion: GREETING_PROMPT_VERSION,
    variants: [],
    message: sanitizeText(message, 240) || GREETING_DISABLED_MESSAGE,
    reason,
    checkedAt: normalizeTimestamp(checkedAt) || new Date().toISOString(),
    inputScenario: normalizeGreetingGenerationInput(input).input.scenario,
  };
}

function createInvalidGreetingResult({ provider, errors, input, checkedAt }) {
  return {
    status: "invalid_request",
    provider: sanitizeProviderName(provider) || null,
    promptVersion: GREETING_PROMPT_VERSION,
    variants: [],
    errors: normalizeStringList(errors, 20, 120),
    checkedAt: normalizeTimestamp(checkedAt) || new Date().toISOString(),
    inputScenario: normalizeGreetingGenerationInput(input).input.scenario,
  };
}

function createProviderFailedGreetingResult({ provider, reason, errors = [], input, checkedAt }) {
  return {
    status: "failed",
    provider: sanitizeProviderName(provider) || null,
    promptVersion: GREETING_PROMPT_VERSION,
    variants: [],
    reason: sanitizeText(reason, 120) || "provider_error",
    errors: normalizeStringList(errors, 20, 120),
    checkedAt: normalizeTimestamp(checkedAt) || new Date().toISOString(),
    inputScenario: normalizeGreetingGenerationInput(input).input.scenario,
  };
}

function normalizeGreetingVariant(variant = {}, index = 0) {
  const source = isPlainObject(variant) ? variant : {};
  const text = sanitizeGreetingText(source.text);
  if (!text) return null;
  return {
    id: sanitizeText(source.id, 120) || `variant-${index + 1}`,
    title: sanitizeText(source.title, 120) || `Вариант ${index + 1}`,
    text,
    tone: GREETING_TONES.has(source.tone) ? source.tone : "warm",
    format: GREETING_FORMATS.has(source.format) ? source.format : "plain_text",
  };
}

function validateGreetingText(text, input) {
  const errors = [];
  const normalizedText = String(text || "").toLocaleLowerCase("ru-RU");
  if (text.length > MAX_GREETING_TEXT_LENGTH) errors.push("text_too_long");
  if (RU_PROFANITY_MARKERS.some(marker => normalizedText.includes(marker))) {
    errors.push("profanity_detected");
  }
  if (/(?:\b(?:authorization|access_token|bearer|gigachat_auth|polza[_-]?api|api[_-]?key)\b|sk-polza-)/iu.test(text)) {
    errors.push("secret_leak_marker");
  }
  if (input?.bans?.mentionAge && /\b\d{1,3}\s*(?:лет|года|год|годик|годиков)\b/giu.test(text)) {
    errors.push("age_mentioned");
  }
  for (const topic of input?.bans?.personalTopics || []) {
    if (topic && normalizedText.includes(topic.toLocaleLowerCase("ru-RU"))) {
      errors.push("forbidden_topic");
    }
  }
  return errors;
}

async function fetchJsonWithTimeout({ fetchImpl, url, options, timeoutMs }) {
  if (typeof fetchImpl !== "function") {
    throw createProviderError("provider_unavailable");
  }

  const abortController = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = abortController
    ? setTimeout(() => abortController.abort(), timeoutMs)
    : null;
  timeoutId?.unref?.();

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: abortController?.signal,
    });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function shouldRetryProviderResponse(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function getRetryDelayMs(attempt) {
  return Math.min(1500, 250 * (attempt + 1));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ABORT_ERR";
}

function createProviderError(reason, statusCode = 0) {
  const error = new Error(reason);
  error.reason = reason;
  error.statusCode = statusCode;
  return error;
}

function getProviderFailureReason(error) {
  if (isAbortError(error)) return "provider_timeout";
  return sanitizeText(error?.reason || error?.message, 120) || "provider_error";
}

function getGigaChatFailureReason(statusCode, body) {
  const providerCode = sanitizeText(body?.error?.code || body?.error || body?.message || "", 120);
  if (statusCode === 401 || statusCode === 403) return "provider_auth_failed";
  if (statusCode === 408) return "provider_timeout";
  if (statusCode === 429) return "provider_rate_limited";
  if (statusCode >= 500) return "provider_unavailable";
  if (providerCode) return "provider_error";
  return "provider_error";
}

function getOpenAICompatibleFailureReason(statusCode, body) {
  const error = body?.error;
  const providerCode = sanitizeText(
    (isPlainObject(error) ? error.code || error.message || error.type : error) || body?.message || "",
    120,
  );
  if (statusCode === 401 || statusCode === 403) return "provider_auth_failed";
  if (statusCode === 402) return "provider_payment_required";
  if (statusCode === 408) return "provider_timeout";
  if (statusCode === 429) return "provider_rate_limited";
  if (statusCode >= 500) return "provider_unavailable";
  if (providerCode) return "provider_error";
  return "provider_error";
}

function normalizeGigaChatUsage(usage = {}) {
  return normalizeOpenAICompatibleUsage(usage);
}

function normalizeOpenAICompatibleUsage(usage = {}) {
  if (!isPlainObject(usage)) return null;
  const promptTokens = normalizeNonNegativeInteger(usage.prompt_tokens ?? usage.input_tokens);
  const completionTokens = normalizeNonNegativeInteger(usage.completion_tokens ?? usage.output_tokens);
  const totalTokens = normalizeNonNegativeInteger(usage.total_tokens);
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function normalizeAuthorizationKey(value) {
  const key = String(value || "").trim();
  return key.length >= 20 && !/[\r\n]/.test(key) ? key : "";
}

function formatGigaChatAuthorizationHeader(key) {
  return /^Basic\s+/iu.test(key) ? key : `Basic ${key}`;
}

function sanitizeSecretToken(value) {
  const token = String(value || "").trim();
  return token.length >= 20 && !/[\r\n]/.test(token) ? token : "";
}

function normalizeGigaChatScope(value) {
  const scope = String(value || DEFAULT_GIGACHAT_SCOPE).trim();
  return ["GIGACHAT_API_PERS", "GIGACHAT_API_B2B", "GIGACHAT_API_CORP"].includes(scope)
    ? scope
    : DEFAULT_GIGACHAT_SCOPE;
}

function normalizeGigaChatTokenExpiresAt(value, nowMs) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return nowMs + 30 * 60 * 1000;
  }
  const asMs = parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
  return asMs > nowMs ? asMs : nowMs + 30 * 60 * 1000;
}

function parseTimeoutSecondsEnv(value) {
  if (value === undefined || value === null || value === "") return "";
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1000 : "";
}

function normalizeTimeoutMs(value, fallback = DEFAULT_GIGACHAT_TIMEOUT_MS) {
  const timeoutMs = Math.floor(Number(value));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return fallback;
  return Math.min(timeoutMs, 120000);
}

function normalizeRetryAttempts(value, fallback = DEFAULT_GIGACHAT_RETRY_ATTEMPTS) {
  const attempts = Math.floor(Number(value));
  if (!Number.isFinite(attempts) || attempts < 0) return fallback;
  return Math.min(attempts, 3);
}

function normalizeRateLimit(value, fallback = DEFAULT_GIGACHAT_RATE_LIMIT_PER_MINUTE) {
  const limit = Math.floor(Number(value));
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(limit, 120);
}

function normalizeGreetingProviderName(value) {
  const provider = String(value || "").trim().toLocaleLowerCase("en-US");
  if (!provider) return "";
  if (["mock", "local", "test"].includes(provider)) return "mock";
  if (["disabled", "none", "off"].includes(provider)) return "disabled";
  if (["gigachat", "giga-chat"].includes(provider)) return "gigachat";
  if (["polza", "polza.ai", "polza-ai", "chatgpt-polza", "polza-chatgpt"].includes(provider)) return "polza";
  return sanitizeProviderName(provider);
}

function normalizeProviderName(value) {
  const name = String(value || "").trim();
  return /^[a-zA-Z0-9_.:/-]{1,160}$/u.test(name) ? name : "";
}

function sanitizeProviderName(value) {
  const name = String(value || "").trim();
  return /^[a-zA-Z0-9_.:-]{1,120}$/u.test(name) ? name : "";
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString().replace(/\/$/u, "") : "";
  } catch {
    return "";
  }
}

function sanitizeText(value, maxLength = 500) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function sanitizeGreetingText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_GREETING_TEXT_LENGTH);
}

function normalizeStringList(value, maxItems = 8, maxLength = 120) {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map(item => sanitizeText(item, maxLength))
    .filter(item => item && !seen.has(item) && seen.add(item))
    .slice(0, maxItems);
}

function normalizeLocalDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(date) ? date : "";
}

function normalizeAge(value) {
  if (value === null || value === undefined || value === "") return null;
  const age = Math.floor(Number(value));
  return Number.isFinite(age) && age >= 0 && age <= 130 ? age : null;
}

function normalizeTimestamp(value) {
  const timestamp = String(value || "").trim();
  if (!timestamp) return null;
  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function normalizeNonNegativeInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function clampInteger(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
