import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createGreetingAIProviderFromEnv,
  isPolzaModelComparisonEvaluationEnabled,
  isPolzaProductionActivationApproved,
} from "../server/greeting-ai-provider.mjs";

export const GREETING_PRODUCTION_PREFLIGHT_VERSION = "greeting-production-preflight@2026-08-13.v1";

const DEFAULT_CLIENT_BOUNDARY_FILES = [
  "public/index.html",
  "public/js/app.js",
  "public/js/sync.js",
];

const POLZA_API_KEY_ENV_NAMES = [
  "FOCUS_POLZA_API_KEY",
  "POLZA_API_KEY",
  "POLZA_AI_API_KEY",
];

const POLZA_MODEL_ENV_NAMES = [
  "FOCUS_POLZA_MODEL",
  "POLZA_MODEL",
];

const GIGACHAT_AUTH_ENV_NAMES = [
  "FOCUS_GIGACHAT_AUTHORIZATION_KEY",
  "GIGACHAT_AUTHORIZATION_KEY",
  "GIGACHAT_CREDENTIALS",
];

const GIGACHAT_MODEL_ENV_NAMES = [
  "FOCUS_GIGACHAT_MODEL",
  "GIGACHAT_MODEL",
];

const CLIENT_FORBIDDEN_MARKERS = [
  { id: "polza_env_prefix", value: "FOCUS_POLZA_" },
  { id: "polza_api_key_alias", value: "POLZA_API_KEY" },
  { id: "polza_model_alias", value: "POLZA_MODEL" },
  { id: "gigachat_env_prefix", value: "FOCUS_GIGACHAT_" },
  { id: "gigachat_authorization_alias", value: "GIGACHAT_AUTHORIZATION_KEY" },
  { id: "gigachat_model_alias", value: "GIGACHAT_MODEL" },
  { id: "access_token", value: "access_token" },
  { id: "bearer_header", value: "Authorization: Bearer" },
  { id: "polza_secret_prefix", value: "sk-polza-" },
  { id: "openai_secret_prefix", value: "sk-proj-" },
];

const CLIENT_FORBIDDEN_PATTERNS = [
  { id: "polza_endpoint", pattern: /polza\.ai\/api|\/v1\/chat\/completions/iu },
  { id: "gigachat_endpoint", pattern: /api\.giga\.chat|ngw\.devices\.sberbank\.ru|\/api\/v2\/oauth/iu },
  { id: "bearer_token", pattern: /Bearer\s+[A-Za-z0-9._-]{12,}/u },
];

export function parseGreetingPreflightEnv(source = "") {
  const parsed = {};

  String(source)
    .split(/\r?\n/u)
    .forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;

      const separator = line.indexOf("=");
      if (separator < 1) {
        throw new Error(`Invalid env file line ${index + 1}`);
      }

      const key = line.slice(0, separator).trim();
      const value = stripEnvValueQuotes(line.slice(separator + 1).trim());
      if (!/^[A-Z0-9_]+$/u.test(key)) {
        throw new Error(`Invalid env file key on line ${index + 1}`);
      }

      parsed[key] = value;
    });

  return parsed;
}

export function loadGreetingPreflightEnv({ env = process.env, envFilePath = "", cwd = process.cwd() } = {}) {
  if (!envFilePath) {
    return { ...env };
  }

  const resolvedPath = resolve(cwd, envFilePath);
  if (!existsSync(resolvedPath)) {
    throw new Error("Greeting preflight env file was not found");
  }

  return {
    ...env,
    ...parseGreetingPreflightEnv(readFileSync(resolvedPath, "utf8")),
  };
}

export function runGreetingProductionPreflight({
  env = process.env,
  cwd = process.cwd(),
  clientFiles = DEFAULT_CLIENT_BOUNDARY_FILES,
  clientSources,
  checkedAt = new Date().toISOString(),
} = {}) {
  let liveProviderCallPerformed = false;
  let provider;
  let providerFactoryError = false;

  try {
    provider = createGreetingAIProviderFromEnv(env, {
      fetchImpl: async () => {
        liveProviderCallPerformed = true;
        throw new Error("Greeting production preflight must not call external providers");
      },
      now: () => new Date(checkedAt),
      createId: createPreflightId,
    });
  } catch {
    providerFactoryError = true;
    provider = null;
  }

  const requestedProvider = normalizeRequestedProvider(
    env.FOCUS_GREETING_AI_PROVIDER || env.FOCUS_GREETING_PROVIDER || "",
  );
  const effectiveProvider = normalizeProviderLabel(provider?.provider || "unknown");
  const providerConfigured = provider ? computeProviderConfigured(provider) : false;
  const clientBoundary = checkGreetingClientBoundary(
    clientSources || readClientBoundaryFiles({ cwd, clientFiles }),
  );
  const polzaProductionGateApproved = isPolzaProductionActivationApproved(env);
  const polzaModelComparisonEvaluationEnabled = isPolzaModelComparisonEvaluationEnabled(env);
  const polzaApiKeyConfigured = hasAnyEnvValue(env, POLZA_API_KEY_ENV_NAMES);
  const polzaModelConfigured = hasAnyEnvValue(env, POLZA_MODEL_ENV_NAMES);
  const gigachatAuthorizationKeyConfigured = hasAnyEnvValue(env, GIGACHAT_AUTH_ENV_NAMES);
  const gigachatModelConfigured = hasAnyEnvValue(env, GIGACHAT_MODEL_ENV_NAMES);
  const activationMode = getActivationMode({
    requestedProvider,
    polzaProductionGateApproved,
    polzaModelComparisonEvaluationEnabled,
  });

  const checks = [];
  addCheck(checks, {
    id: "provider_factory",
    pass: !providerFactoryError,
    message: providerFactoryError
      ? "GreetingAIProvider factory threw before preflight completed."
      : "GreetingAIProvider factory instantiated without a provider call.",
  });
  addCheck(checks, {
    id: "selected_production_direction",
    pass: ["mock", "disabled", "polza"].includes(requestedProvider),
    message: requestedProvider === "gigachat"
      ? "GigaChat is a legacy/comparison adapter; the selected production direction is Polza.ai."
      : "Requested provider is compatible with the selected production direction.",
  });
  addCheck(checks, {
    id: "client_boundary",
    pass: clientBoundary.passed,
    message: clientBoundary.passed
      ? "Frontend assets contain no provider secret/config markers or direct provider endpoints."
      : "Frontend assets contain provider secret/config markers or direct provider endpoints.",
  });

  if (requestedProvider === "polza") {
    addCheck(checks, {
      id: "polza_activation_gate",
      pass: polzaProductionGateApproved || polzaModelComparisonEvaluationEnabled,
      message: "Polza requires explicit production approval gates or a separate model-comparison gate.",
    });
    addCheck(checks, {
      id: "polza_server_configuration",
      pass: polzaApiKeyConfigured && polzaModelConfigured && providerConfigured,
      message: "Polza server key and model must be configured server-side before adapter use.",
    });
  }

  addCheck(checks, {
    id: "no_live_provider_call",
    pass: liveProviderCallPerformed === false,
    message: "Preflight completed without invoking provider fetch.",
  });

  const requiredFailed = checks.some(check => check.required && !check.pass);
  const productionActivationReady = requestedProvider === "polza"
    && polzaProductionGateApproved
    && polzaApiKeyConfigured
    && polzaModelConfigured
    && providerConfigured
    && effectiveProvider === "polza"
    && !requiredFailed;

  const warnings = [];
  if (requestedProvider === "mock") {
    warnings.push("Mock provider is suitable for development and CI, not production traffic.");
  }
  if (requestedProvider === "disabled") {
    warnings.push("Greeting generation is intentionally disabled; users can save questionnaires and continue later.");
  }
  if (requestedProvider === "polza" && activationMode === "model_comparison") {
    warnings.push("Polza is enabled for model comparison only; production gates are not approved.");
  }
  if (requestedProvider === "polza" && !productionActivationReady) {
    warnings.push("Polza is not ready for production activation until all required checks pass.");
  }

  return {
    version: GREETING_PRODUCTION_PREFLIGHT_VERSION,
    checkedAt,
    status: requiredFailed ? "failed" : "passed",
    requestedProvider,
    effectiveProvider,
    providerConfigured,
    activationMode,
    productionActivationReady,
    liveProviderCallPerformed,
    polza: {
      requested: requestedProvider === "polza",
      productionGateApproved: polzaProductionGateApproved,
      modelComparisonEvaluationEnabled: polzaModelComparisonEvaluationEnabled,
      apiKeyConfigured: polzaApiKeyConfigured,
      modelConfigured: polzaModelConfigured,
    },
    gigachat: {
      requested: requestedProvider === "gigachat",
      legacyComparisonAdapter: true,
      authorizationKeyConfigured: gigachatAuthorizationKeyConfigured,
      modelConfigured: gigachatModelConfigured,
    },
    clientBoundary,
    checks,
    warnings,
  };
}

export function checkGreetingClientBoundary(sources = []) {
  const findings = [];

  sources.forEach(({ path = "client", source = "" }) => {
    const text = String(source);

    CLIENT_FORBIDDEN_MARKERS.forEach(({ id, value }) => {
      if (text.includes(value)) {
        findings.push({ file: path, markerId: id });
      }
    });

    CLIENT_FORBIDDEN_PATTERNS.forEach(({ id, pattern }) => {
      if (pattern.test(text)) {
        findings.push({ file: path, markerId: id });
      }
    });
  });

  return {
    passed: findings.length === 0,
    filesChecked: sources.map(({ path = "client" }) => path),
    findings,
  };
}

export function parseGreetingPreflightArgs(argv = []) {
  const options = {
    envFilePath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      index += 1;
      if (!argv[index]) throw new Error("--env-file requires a path");
      options.envFilePath = argv[index];
      continue;
    }
    if (arg.startsWith("--env-file=")) {
      options.envFilePath = arg.slice("--env-file=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readClientBoundaryFiles({ cwd, clientFiles }) {
  return clientFiles
    .map(file => {
      const resolvedPath = resolve(cwd, file);
      return {
        path: file,
        source: existsSync(resolvedPath) ? readFileSync(resolvedPath, "utf8") : "",
      };
    });
}

function addCheck(checks, { id, pass, message, required = true }) {
  checks.push({
    id,
    required,
    pass: Boolean(pass),
    message,
  });
}

function normalizeRequestedProvider(provider) {
  const normalized = normalizeProviderLabel(provider);
  return normalized || "mock";
}

function normalizeProviderLabel(provider) {
  return String(provider || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, "");
}

function computeProviderConfigured(provider) {
  if (typeof provider.isConfigured === "function") {
    return provider.isConfigured() === true;
  }
  return provider.available !== false;
}

function hasAnyEnvValue(env, names) {
  return names.some(name => String(env[name] || "").trim().length > 0);
}

function getActivationMode({
  requestedProvider,
  polzaProductionGateApproved,
  polzaModelComparisonEvaluationEnabled,
}) {
  if (requestedProvider !== "polza") return "development";
  if (polzaProductionGateApproved) return "production";
  if (polzaModelComparisonEvaluationEnabled) return "model_comparison";
  return "disabled";
}

function stripEnvValueQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function createPreflightId() {
  return "greeting-preflight";
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/greeting-production-preflight.mjs [--env-file <path>]\n`);
}

function printJson(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function printError(error) {
  process.stderr.write(`${JSON.stringify({
    version: GREETING_PRODUCTION_PREFLIGHT_VERSION,
    status: "failed",
    error: error?.message || "Greeting production preflight failed",
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseGreetingPreflightArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
    } else {
      const env = loadGreetingPreflightEnv({ env: process.env, envFilePath: options.envFilePath });
      const report = runGreetingProductionPreflight({ env });
      printJson(report);
      if (report.status !== "passed") {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
