import storage from "../common/system_storage";
import { $t } from "../i18n";

export type DiscordHostingRiskLevel = "allow" | "review" | "block";
export type DiscordPreflightStatus = "pass" | "review" | "block";

export interface DiscordHostingSettings {
  enabled: boolean;
  requireManualReview: boolean;
  requireEgressGateway: boolean;
  platformFuseInvalidRequestsPer10m: number;
  discordInvalidRequestsPer10m: number;
  maxGlobalRestRpsPerBot: number;
  maxRestRequestsPerMinutePerBot: number;
  maxMessagesPerMinutePerBot: number;
  requireSecretVault: boolean;
  requireReconnectBackoff: boolean;
  requireSlashCommandFirst: boolean;
  isolateRiskyBots: boolean;
}

export interface DiscordHostingMetric {
  label: string;
  value: number | string;
  status: "success" | "warning" | "error" | "processing" | "default";
  detail: string;
}

export interface DiscordHostingFeature {
  key: string;
  title: string;
  status: "ready" | "planned" | "required";
  owner: "panel" | "daemon" | "network" | "operator";
  detail: string;
}

export interface DiscordHostingGuardrail {
  layer: string;
  control: string;
  enforcement: string;
  failureAction: string;
}

export interface DiscordHostingSource {
  title: string;
  url: string;
}

export interface DiscordHostingOverview {
  settings: DiscordHostingSettings;
  metrics: DiscordHostingMetric[];
  architecture: string[];
  features: DiscordHostingFeature[];
  guardrails: DiscordHostingGuardrail[];
  deploymentGates: string[];
  bannedBehaviors: string[];
  sources: DiscordHostingSource[];
  updatedAt: number;
}

export interface DiscordBotManifest {
  name?: string;
  applicationId?: string;
  runtime?: string;
  library?: string;
  gatewayIntents?: string[];
  behaviorFlags?: string[];
  expectedGuilds?: number;
  expectedRestRequestsPerMinute?: number;
  expectedMessagesPerMinute?: number;
  tokenStorage?: "env" | "vault" | "file" | "code" | "unknown";
  outboundMode?: "platform-egress" | "dedicated-egress" | "direct" | "unknown";
  hasPrivacyPolicy?: boolean;
  usesUserToken?: boolean;
  slashCommandFirst?: boolean;
  reconnectBackoff?: boolean;
  shardCount?: number;
}

export interface DiscordPreflightCheck {
  status: DiscordPreflightStatus;
  title: string;
  detail: string;
  remediation: string;
  source?: string;
}

export interface DiscordPreflightResult {
  risk: DiscordHostingRiskLevel;
  score: number;
  summary: string;
  checks: DiscordPreflightCheck[];
  recommendedControls: string[];
  manifest: DiscordBotManifest;
}

interface DiscordHostingState {
  settings: DiscordHostingSettings;
  updatedAt: number;
}

interface DiscordHostingSourceTemplate {
  titleKey: string;
  url: string;
}

const STORE_NAME = "discord-hosting.json";

const OFFICIAL_SOURCES: DiscordHostingSourceTemplate[] = [
  {
    titleKey: "SOURCE_RATE_LIMITS",
    url: "https://discord.com/developers/docs/topics/rate-limits"
  },
  {
    titleKey: "SOURCE_GATEWAY_INTENTS",
    url: "https://discord.com/developers/docs/events/gateway#gateway-intents"
  },
  {
    titleKey: "SOURCE_DEVELOPER_POLICY",
    url: "https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy"
  },
  {
    titleKey: "SOURCE_BOT_VERIFICATION",
    url: "https://support-dev.discord.com/hc/en-us/articles/6209188462871-Bot-Verification-FAQ-for-Parents-Legal-Guardians-and-Other-Users"
  }
];

const DEFAULT_SETTINGS: DiscordHostingSettings = {
  enabled: true,
  requireManualReview: false,
  requireEgressGateway: true,
  platformFuseInvalidRequestsPer10m: 7000,
  discordInvalidRequestsPer10m: 10000,
  maxGlobalRestRpsPerBot: 45,
  maxRestRequestsPerMinutePerBot: 1800,
  maxMessagesPerMinutePerBot: 120,
  requireSecretVault: true,
  requireReconnectBackoff: true,
  requireSlashCommandFirst: true,
  isolateRiskyBots: true
};

const BANNED_BEHAVIORS = [
  "selfbot",
  "user-token",
  "account-automation",
  "token-harvesting",
  "raid-tools",
  "mass-dm",
  "unsolicited-ads",
  "webhook-spam",
  "guild-scraping",
  "invite-join-automation",
  "captcha-bypass",
  "malware"
];

const PRIVILEGED_INTENTS = new Set(["GUILD_MEMBERS", "GUILD_PRESENCES", "MESSAGE_CONTENT"]);
const HARD_BLOCK_FLAGS = new Set(BANNED_BEHAVIORS);
let cachedState: DiscordHostingState | null = null;

function t(key: string, params?: Record<string, unknown>) {
  return $t(`TXT_CODE_DISCORD_${key}`, params);
}

function getOfficialSources(): DiscordHostingSource[] {
  return OFFICIAL_SOURCES.map((source) => ({
    title: t(source.titleKey),
    url: source.url
  }));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeNumber(value: unknown, fallback: number, min = 0): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(min, Math.floor(numericValue));
}

function getDefaultState(): DiscordHostingState {
  return {
    settings: clone(DEFAULT_SETTINGS),
    updatedAt: Date.now()
  };
}

function normalizeSettings(settings?: Partial<DiscordHostingSettings>): DiscordHostingSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings || {})
  };

  return {
    enabled: Boolean(merged.enabled),
    requireManualReview: Boolean(merged.requireManualReview),
    requireEgressGateway: Boolean(merged.requireEgressGateway),
    platformFuseInvalidRequestsPer10m: normalizeNumber(
      merged.platformFuseInvalidRequestsPer10m,
      DEFAULT_SETTINGS.platformFuseInvalidRequestsPer10m,
      1
    ),
    discordInvalidRequestsPer10m: normalizeNumber(
      merged.discordInvalidRequestsPer10m,
      DEFAULT_SETTINGS.discordInvalidRequestsPer10m,
      1
    ),
    maxGlobalRestRpsPerBot: normalizeNumber(
      merged.maxGlobalRestRpsPerBot,
      DEFAULT_SETTINGS.maxGlobalRestRpsPerBot,
      1
    ),
    maxRestRequestsPerMinutePerBot: normalizeNumber(
      merged.maxRestRequestsPerMinutePerBot,
      DEFAULT_SETTINGS.maxRestRequestsPerMinutePerBot,
      1
    ),
    maxMessagesPerMinutePerBot: normalizeNumber(
      merged.maxMessagesPerMinutePerBot,
      DEFAULT_SETTINGS.maxMessagesPerMinutePerBot,
      1
    ),
    requireSecretVault: Boolean(merged.requireSecretVault),
    requireReconnectBackoff: Boolean(merged.requireReconnectBackoff),
    requireSlashCommandFirst: Boolean(merged.requireSlashCommandFirst),
    isolateRiskyBots: Boolean(merged.isolateRiskyBots)
  };
}

function loadState(): DiscordHostingState {
  if (cachedState) return cachedState;

  if (!storage.fileExists(STORE_NAME)) {
    cachedState = getDefaultState();
    return cachedState;
  }

  try {
    const saved = JSON.parse(storage.readFile(STORE_NAME)) as Partial<DiscordHostingState>;
    cachedState = {
      settings: normalizeSettings(saved.settings),
      updatedAt: normalizeNumber(saved.updatedAt, Date.now(), 1)
    };
    return cachedState;
  } catch {
    cachedState = getDefaultState();
    return cachedState;
  }
}

function saveState(state: DiscordHostingState): DiscordHostingState {
  cachedState = {
    settings: normalizeSettings(state.settings),
    updatedAt: Date.now()
  };
  storage.writeFile(STORE_NAME, JSON.stringify(cachedState, null, 2));
  return clone(cachedState);
}

function getMetrics(settings: DiscordHostingSettings): DiscordHostingMetric[] {
  return [
    {
      label: t("METRIC_CREATE_MODE"),
      value: t("VALUE_ADMIN_DIRECT_CREATE"),
      status: "success",
      detail: t("METRIC_CREATE_MODE_DETAIL")
    },
    {
      label: t("METRIC_INVALID_REQUEST_FUSE"),
      value: `${settings.platformFuseInvalidRequestsPer10m}/10m`,
      status:
        settings.platformFuseInvalidRequestsPer10m < settings.discordInvalidRequestsPer10m
          ? "success"
          : "error",
      detail: t("METRIC_INVALID_REQUEST_FUSE_DETAIL")
    },
    {
      label: t("METRIC_REST_CEILING"),
      value: `${settings.maxGlobalRestRpsPerBot} rps`,
      status: "success",
      detail: t("METRIC_REST_CEILING_DETAIL")
    },
    {
      label: t("METRIC_RUNTIME_ACTION"),
      value: settings.isolateRiskyBots ? t("VALUE_AUTO_QUARANTINE") : t("VALUE_OPERATOR_ALERT"),
      status: settings.requireEgressGateway ? "success" : "error",
      detail: t("METRIC_RUNTIME_ACTION_DETAIL")
    }
  ];
}

function getFeatures(): DiscordHostingFeature[] {
  return [
    {
      key: "onboarding",
      title: t("FEATURE_ONBOARDING"),
      status: "ready",
      owner: "panel",
      detail: t("FEATURE_ONBOARDING_DETAIL")
    },
    {
      key: "secret-vault",
      title: t("FEATURE_SECRET_VAULT"),
      status: "required",
      owner: "panel",
      detail: t("FEATURE_SECRET_VAULT_DETAIL")
    },
    {
      key: "sandbox-runtime",
      title: t("FEATURE_SANDBOX_RUNTIME"),
      status: "planned",
      owner: "daemon",
      detail: t("FEATURE_SANDBOX_RUNTIME_DETAIL")
    },
    {
      key: "egress-gateway",
      title: t("FEATURE_EGRESS_GATEWAY"),
      status: "required",
      owner: "network",
      detail: t("FEATURE_EGRESS_GATEWAY_DETAIL")
    },
    {
      key: "rate-limit-engine",
      title: t("FEATURE_RATE_LIMIT_ENGINE"),
      status: "planned",
      owner: "network",
      detail: t("FEATURE_RATE_LIMIT_ENGINE_DETAIL")
    },
    {
      key: "circuit-breaker",
      title: t("FEATURE_CIRCUIT_BREAKER"),
      status: "ready",
      owner: "panel",
      detail: t("FEATURE_CIRCUIT_BREAKER_DETAIL")
    },
    {
      key: "observability",
      title: t("FEATURE_OBSERVABILITY"),
      status: "planned",
      owner: "panel",
      detail: t("FEATURE_OBSERVABILITY_DETAIL")
    },
    {
      key: "risk-ip-pool",
      title: t("FEATURE_RISK_IP_POOL"),
      status: "planned",
      owner: "operator",
      detail: t("FEATURE_RISK_IP_POOL_DETAIL")
    }
  ];
}

function getGuardrails(): DiscordHostingGuardrail[] {
  return [
    {
      layer: t("GUARDRAIL_LAYER_PRE_DEPLOY"),
      control: t("GUARDRAIL_POLICY_SCAN"),
      enforcement: t("GUARDRAIL_POLICY_SCAN_ENFORCEMENT"),
      failureAction: t("GUARDRAIL_POLICY_SCAN_FAILURE")
    },
    {
      layer: t("GUARDRAIL_LAYER_IDENTITY"),
      control: t("GUARDRAIL_OWNERSHIP"),
      enforcement: t("GUARDRAIL_OWNERSHIP_ENFORCEMENT"),
      failureAction: t("GUARDRAIL_OWNERSHIP_FAILURE")
    },
    {
      layer: t("GUARDRAIL_LAYER_SECRETS"),
      control: t("GUARDRAIL_TOKEN_VAULT"),
      enforcement: t("GUARDRAIL_TOKEN_VAULT_ENFORCEMENT"),
      failureAction: t("GUARDRAIL_TOKEN_VAULT_FAILURE")
    },
    {
      layer: t("GUARDRAIL_LAYER_RUNTIME"),
      control: t("GUARDRAIL_CONTAINER_SANDBOX"),
      enforcement: t("GUARDRAIL_CONTAINER_SANDBOX_ENFORCEMENT"),
      failureAction: t("GUARDRAIL_CONTAINER_SANDBOX_FAILURE")
    },
    {
      layer: t("GUARDRAIL_LAYER_NETWORK"),
      control: t("GUARDRAIL_EGRESS_GATEWAY"),
      enforcement: t("GUARDRAIL_EGRESS_GATEWAY_ENFORCEMENT"),
      failureAction: t("GUARDRAIL_EGRESS_GATEWAY_FAILURE")
    },
    {
      layer: t("GUARDRAIL_LAYER_ABUSE"),
      control: t("GUARDRAIL_INVALID_REQUEST_FUSE"),
      enforcement: t("GUARDRAIL_INVALID_REQUEST_FUSE_ENFORCEMENT"),
      failureAction: t("GUARDRAIL_INVALID_REQUEST_FUSE_FAILURE")
    }
  ];
}

export function getDiscordHostingOverview(): DiscordHostingOverview {
  const state = loadState();
  return {
    settings: clone(state.settings),
    metrics: getMetrics(state.settings),
    architecture: [
      t("ARCH_PANEL_API"),
      t("ARCH_SCHEDULER"),
      t("ARCH_DAEMON_WORKER"),
      t("ARCH_EGRESS_GATEWAY"),
      t("ARCH_TELEMETRY")
    ],
    features: getFeatures(),
    guardrails: getGuardrails(),
    deploymentGates: [
      t("MONITOR_REST_BURST"),
      t("MONITOR_MESSAGE_BURST"),
      t("MONITOR_INVALID_REQUESTS"),
      t("MONITOR_GATEWAY_RECONNECT"),
      t("MONITOR_TOKEN_LEAK"),
      t("MONITOR_AUTO_SUSPEND")
    ],
    bannedBehaviors: [...BANNED_BEHAVIORS],
    sources: getOfficialSources(),
    updatedAt: state.updatedAt
  };
}

export function updateDiscordHostingSettings(
  settings: Partial<DiscordHostingSettings>
): DiscordHostingSettings {
  const state = loadState();
  const nextState = saveState({
    settings: normalizeSettings({
      ...state.settings,
      ...settings
    }),
    updatedAt: Date.now()
  });
  return nextState.settings;
}

function normalizeManifest(input: Partial<DiscordBotManifest>): DiscordBotManifest {
  return {
    name: typeof input.name === "string" ? input.name.trim() : "",
    applicationId:
      typeof input.applicationId === "string" ? input.applicationId.trim() : undefined,
    runtime: typeof input.runtime === "string" ? input.runtime.trim() : "nodejs",
    library: typeof input.library === "string" ? input.library.trim() : "discord.js",
    gatewayIntents: Array.isArray(input.gatewayIntents) ? input.gatewayIntents.map(String) : [],
    behaviorFlags: Array.isArray(input.behaviorFlags) ? input.behaviorFlags.map(String) : [],
    expectedGuilds: normalizeNumber(input.expectedGuilds, 1, 0),
    expectedRestRequestsPerMinute: normalizeNumber(input.expectedRestRequestsPerMinute, 60, 0),
    expectedMessagesPerMinute: normalizeNumber(input.expectedMessagesPerMinute, 0, 0),
    tokenStorage: input.tokenStorage || "unknown",
    outboundMode: input.outboundMode || "unknown",
    hasPrivacyPolicy: Boolean(input.hasPrivacyPolicy),
    usesUserToken: Boolean(input.usesUserToken),
    slashCommandFirst: input.slashCommandFirst !== false,
    reconnectBackoff: input.reconnectBackoff !== false,
    shardCount: normalizeNumber(input.shardCount, 1, 1)
  };
}

function addCheck(
  checks: DiscordPreflightCheck[],
  status: DiscordPreflightStatus,
  title: string,
  detail: string,
  remediation: string,
  source?: string
) {
  checks.push({ status, title, detail, remediation, source });
}

export function evaluateDiscordBotManifest(
  input: Partial<DiscordBotManifest>
): DiscordPreflightResult {
  const manifest = normalizeManifest(input);
  const settings = loadState().settings;
  const checks: DiscordPreflightCheck[] = [];
  const flags = new Set((manifest.behaviorFlags || []).map((flag) => flag.toLowerCase()));
  const intents = new Set((manifest.gatewayIntents || []).map((intent) => intent.toUpperCase()));
  const privilegedIntents = [...intents].filter((intent) => PRIVILEGED_INTENTS.has(intent));
  const expectedGuilds = manifest.expectedGuilds || 0;
  const expectedRestRequestsPerMinute = manifest.expectedRestRequestsPerMinute || 0;
  const expectedMessagesPerMinute = manifest.expectedMessagesPerMinute || 0;

  if (!manifest.name) {
    addCheck(
      checks,
      "review",
      t("CHECK_MISSING_BOT_NAME"),
      t("CHECK_MISSING_BOT_NAME_DETAIL"),
      t("CHECK_MISSING_BOT_NAME_REMEDIATION")
    );
  } else {
    addCheck(
      checks,
      "pass",
      t("CHECK_BOT_IDENTITY_PRESENT"),
      t("CHECK_BOT_IDENTITY_PRESENT_DETAIL", { name: manifest.name }),
      t("CHECK_NO_ACTION")
    );
  }

  if (!manifest.applicationId) {
    addCheck(
      checks,
      "review",
      t("CHECK_MISSING_APPLICATION_ID"),
      t("CHECK_MISSING_APPLICATION_ID_DETAIL"),
      t("CHECK_MISSING_APPLICATION_ID_REMEDIATION")
    );
  }

  if (manifest.usesUserToken || flags.has("user-token") || flags.has("selfbot")) {
    addCheck(
      checks,
      "block",
      t("CHECK_USER_TOKEN"),
      t("CHECK_USER_TOKEN_DETAIL"),
      t("CHECK_USER_TOKEN_REMEDIATION"),
      OFFICIAL_SOURCES[2].url
    );
  }

  const blockedFlags = [...flags].filter((flag) => HARD_BLOCK_FLAGS.has(flag));
  if (blockedFlags.length > 0) {
    addCheck(
      checks,
      "block",
      t("CHECK_PROHIBITED_FLAGS"),
      t("CHECK_PROHIBITED_FLAGS_DETAIL", { flags: blockedFlags.join(", ") }),
      t("CHECK_PROHIBITED_FLAGS_REMEDIATION"),
      OFFICIAL_SOURCES[2].url
    );
  }

  if (settings.requireSecretVault && (manifest.tokenStorage === "code" || manifest.tokenStorage === "file")) {
    addCheck(
      checks,
      "block",
      t("CHECK_UNSAFE_TOKEN_STORAGE"),
      t("CHECK_TOKEN_STORAGE_MODE", { mode: manifest.tokenStorage }),
      t("CHECK_UNSAFE_TOKEN_STORAGE_REMEDIATION")
    );
  } else if (manifest.tokenStorage === "unknown") {
    addCheck(
      checks,
      "review",
      t("CHECK_TOKEN_STORAGE_UNKNOWN"),
      t("CHECK_TOKEN_STORAGE_UNKNOWN_DETAIL"),
      t("CHECK_TOKEN_STORAGE_UNKNOWN_REMEDIATION")
    );
  } else {
    addCheck(
      checks,
      "pass",
      t("CHECK_TOKEN_STORAGE_ACCEPTED"),
      t("CHECK_TOKEN_STORAGE_MODE", { mode: manifest.tokenStorage }),
      t("CHECK_NO_ACTION")
    );
  }

  if (settings.requireEgressGateway && manifest.outboundMode === "direct") {
    addCheck(
      checks,
      "block",
      t("CHECK_DIRECT_EGRESS"),
      t("CHECK_DIRECT_EGRESS_DETAIL"),
      t("CHECK_DIRECT_EGRESS_REMEDIATION"),
      OFFICIAL_SOURCES[0].url
    );
  } else if (manifest.outboundMode === "unknown") {
    addCheck(
      checks,
      "review",
      t("CHECK_OUTBOUND_UNKNOWN"),
      t("CHECK_OUTBOUND_UNKNOWN_DETAIL"),
      t("CHECK_OUTBOUND_UNKNOWN_REMEDIATION")
    );
  } else {
    addCheck(
      checks,
      "pass",
      t("CHECK_EGRESS_ACCEPTED"),
      t("CHECK_EGRESS_ACCEPTED_DETAIL", { mode: manifest.outboundMode }),
      t("CHECK_EGRESS_ACCEPTED_REMEDIATION")
    );
  }

  if (privilegedIntents.length > 0 && !manifest.hasPrivacyPolicy) {
    addCheck(
      checks,
      "review",
      t("CHECK_PRIVILEGED_INTENTS_NEED_REVIEW"),
      t("CHECK_PRIVILEGED_INTENTS_DETAIL", { intents: privilegedIntents.join(", ") }),
      t("CHECK_PRIVILEGED_INTENTS_NEED_REVIEW_REMEDIATION"),
      OFFICIAL_SOURCES[1].url
    );
  } else if (privilegedIntents.length > 0) {
    addCheck(
      checks,
      "review",
      t("CHECK_PRIVILEGED_INTENTS_DECLARED"),
      t("CHECK_PRIVILEGED_INTENTS_DETAIL", { intents: privilegedIntents.join(", ") }),
      t("CHECK_PRIVILEGED_INTENTS_DECLARED_REMEDIATION"),
      OFFICIAL_SOURCES[1].url
    );
  } else {
    addCheck(
      checks,
      "pass",
      t("CHECK_INTENT_LIMITED"),
      t("CHECK_INTENT_LIMITED_DETAIL"),
      t("CHECK_INTENT_LIMITED_REMEDIATION")
    );
  }

  if (
    expectedRestRequestsPerMinute > settings.maxRestRequestsPerMinutePerBot
  ) {
    addCheck(
      checks,
      "review",
      t("CHECK_REST_VOLUME_HIGH"),
      t("CHECK_REST_VOLUME_HIGH_DETAIL", {
        expected: expectedRestRequestsPerMinute,
        budget: settings.maxRestRequestsPerMinutePerBot
      }),
      t("CHECK_REST_VOLUME_HIGH_REMEDIATION"),
      OFFICIAL_SOURCES[0].url
    );
  } else {
    addCheck(
      checks,
      "pass",
      t("CHECK_REST_VOLUME_OK"),
      t("CHECK_REST_VOLUME_OK_DETAIL", { expected: expectedRestRequestsPerMinute }),
      t("CHECK_REST_VOLUME_OK_REMEDIATION")
    );
  }

  if (expectedMessagesPerMinute > settings.maxMessagesPerMinutePerBot) {
    addCheck(
      checks,
      "review",
      t("CHECK_MESSAGE_VOLUME_HIGH"),
      t("CHECK_MESSAGE_VOLUME_HIGH_DETAIL", {
        expected: expectedMessagesPerMinute,
        budget: settings.maxMessagesPerMinutePerBot
      }),
      t("CHECK_MESSAGE_VOLUME_HIGH_REMEDIATION")
    );
  }

  if (settings.requireSlashCommandFirst && !manifest.slashCommandFirst) {
    addCheck(
      checks,
      "review",
      t("CHECK_SLASH_COMMAND_MISSING"),
      t("CHECK_SLASH_COMMAND_MISSING_DETAIL"),
      t("CHECK_SLASH_COMMAND_MISSING_REMEDIATION"),
      OFFICIAL_SOURCES[1].url
    );
  }

  if (settings.requireReconnectBackoff && !manifest.reconnectBackoff) {
    addCheck(
      checks,
      "review",
      t("CHECK_RECONNECT_BACKOFF_MISSING"),
      t("CHECK_RECONNECT_BACKOFF_MISSING_DETAIL"),
      t("CHECK_RECONNECT_BACKOFF_MISSING_REMEDIATION")
    );
  }

  if (expectedGuilds >= 75) {
    addCheck(
      checks,
      "review",
      t("CHECK_SCALE_REVIEW"),
      t("CHECK_SCALE_REVIEW_DETAIL", { guilds: expectedGuilds }),
      t("CHECK_SCALE_REVIEW_REMEDIATION"),
      OFFICIAL_SOURCES[3].url
    );
  }

  const hasBlock = checks.some((check) => check.status === "block");
  const hasReview = checks.some((check) => check.status === "review");
  const risk: DiscordHostingRiskLevel = hasBlock ? "block" : hasReview ? "review" : "allow";
  const score = Math.max(
    0,
    100 -
      checks.filter((check) => check.status === "block").length * 35 -
      checks.filter((check) => check.status === "review").length * 12
  );

  return {
    risk,
    score,
    summary:
      risk === "block"
        ? t("SUMMARY_BLOCK")
        : risk === "review"
          ? t("SUMMARY_REVIEW")
          : t("SUMMARY_ALLOW"),
    checks,
    recommendedControls: [
      t("CONTROL_EGRESS_GATEWAY"),
      t("CONTROL_SECRET_VAULT"),
      t("CONTROL_RATE_LIMITS"),
      t("CONTROL_SLASH_COMMANDS"),
      t("CONTROL_RESTART_BACKOFF")
    ],
    manifest
  };
}
