export interface GreetingAIProvider {
  generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
  reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
}

export interface GreetingGenerationInput {
  scenario: "birthday" | "holiday";
  holidayType?: "public_holiday" | "professional_holiday" | "religious_holiday" | null;
  recipient?: {
    name?: string;
    role?: string;
    gender?: string;
  };
  event?: {
    title?: string;
    date?: string;
    holidayType?: "public_holiday" | "professional_holiday" | "religious_holiday" | null;
    tradition?: string;
    description?: string;
  };
  context?: {
    birthday?: {
      name?: string;
      dateOfBirth?: string;
      age?: number | null;
      note?: string;
    } | null;
    holiday?: {
      title?: string;
      description?: string;
      source?: string;
    } | null;
    personalNote?: string;
    existingText?: string;
    allowedFacts?: string[];
  };
  bans?: {
    mentionAge?: boolean;
    personalTopics?: string[];
  };
  sender?: string;
  addressMode?: "ty" | "vy";
  tone?: "warm" | "official" | "personal" | "light_humor" | "respectful";
  length?: "short" | "medium" | "long";
  format?: "plain_text" | "message" | "toast";
  variantCount?: 1 | 2 | 3;
  promptVersion?: string;
}

export interface GreetingRevisionInput {
  sourceText: string;
  instruction: string;
  baseInput: GreetingGenerationInput;
  promptVersion?: string;
}

export interface GreetingVariant {
  id: string;
  title: string;
  text: string;
  tone: string;
  format: string;
}

export interface GreetingGenerationResult {
  status: "generated" | "provider_not_configured" | "invalid_request" | "failed";
  provider: string | null;
  promptVersion: string;
  variants: GreetingVariant[];
  safety?: {
    validated: boolean;
    validationVersion: string;
  };
  warnings?: string[];
  errors?: string[];
  reason?: string;
  message?: string;
  checkedAt: string;
}

export class MockGreetingAIProvider implements GreetingAIProvider {
  generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
  reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
}

export class DisabledGreetingAIProvider implements GreetingAIProvider {
  generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
  reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
}

export class PolzaGreetingAIProvider implements GreetingAIProvider {
  generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
  reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
  isConfigured(): boolean;
}

export class GigaChatGreetingAIProvider implements GreetingAIProvider {
  generateGreeting(input: GreetingGenerationInput): Promise<GreetingGenerationResult>;
  reviseGreeting(input: GreetingRevisionInput): Promise<GreetingGenerationResult>;
  isConfigured(): boolean;
}

export function createGreetingAIProviderFromEnv(
  env?: Record<string, string | undefined>,
  options?: {
    fetchImpl?: typeof fetch;
    now?: () => Date;
    createId?: () => string;
  },
): GreetingAIProvider;

export function isPolzaProductionActivationApproved(env?: Record<string, string | undefined>): boolean;

export function isPolzaModelComparisonEvaluationEnabled(env?: Record<string, string | undefined>): boolean;
