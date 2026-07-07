import storage from "../common/system_storage";

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

const STORE_NAME = "discord-hosting.json";

const OFFICIAL_SOURCES: DiscordHostingSource[] = [
  {
    title: "Discord API rate limits",
    url: "https://discord.com/developers/docs/topics/rate-limits"
  },
  {
    title: "Discord Gateway intents",
    url: "https://discord.com/developers/docs/events/gateway#gateway-intents"
  },
  {
    title: "Discord Developer Policy",
    url: "https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy"
  },
  {
    title: "Discord bot verification",
    url: "https://support-dev.discord.com/hc/en-us/articles/6209188462871-Bot-Verification-FAQ-for-Parents-Legal-Guardians-and-Other-Users"
  }
];

const DEFAULT_SETTINGS: DiscordHostingSettings = {
  enabled: true,
  requireManualReview: true,
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
      label: "Policy gate",
      value: settings.requireManualReview ? "manual review" : "auto allow",
      status: settings.requireManualReview ? "processing" : "warning",
      detail: "Every bot manifest should be reviewed before first start and before major scope changes."
    },
    {
      label: "Invalid request fuse",
      value: `${settings.platformFuseInvalidRequestsPer10m}/10m`,
      status:
        settings.platformFuseInvalidRequestsPer10m < settings.discordInvalidRequestsPer10m
          ? "success"
          : "error",
      detail: "Suspend bot traffic before Discord/Cloudflare invalid-request enforcement is reached."
    },
    {
      label: "REST ceiling",
      value: `${settings.maxGlobalRestRpsPerBot} rps`,
      status: "success",
      detail: "Use route buckets from Discord response headers plus a conservative per-bot global budget."
    },
    {
      label: "Egress mode",
      value: settings.requireEgressGateway ? "gateway required" : "direct allowed",
      status: settings.requireEgressGateway ? "success" : "error",
      detail: "Containers should not reach discord.com directly; all Discord traffic should pass through metering."
    }
  ];
}

function getFeatures(): DiscordHostingFeature[] {
  return [
    {
      key: "onboarding",
      title: "Bot onboarding and review queue",
      status: "ready",
      owner: "panel",
      detail:
        "Collect application ID, owner contact, runtime, intents, traffic estimate, privacy policy and abuse-risk flags."
    },
    {
      key: "secret-vault",
      title: "Token secret vault",
      status: "required",
      owner: "panel",
      detail:
        "Store bot tokens only as protected environment secrets; reject manifests that keep tokens in files or source code."
    },
    {
      key: "sandbox-runtime",
      title: "Sandboxed worker runtime",
      status: "planned",
      owner: "daemon",
      detail:
        "Run each bot in a non-privileged container with cgroup CPU/RAM quotas, read-only base image and isolated writable volume."
    },
    {
      key: "egress-gateway",
      title: "Discord egress gateway",
      status: "required",
      owner: "network",
      detail:
        "Deny direct outbound internet from bot containers and force Discord REST/Gateway traffic through per-tenant metering."
    },
    {
      key: "rate-limit-engine",
      title: "Header-aware rate limiter",
      status: "planned",
      owner: "network",
      detail:
        "Track per-route buckets, global limits, 429 backoff, invalid 401/403/429 responses and websocket reconnect storms."
    },
    {
      key: "circuit-breaker",
      title: "Abuse circuit breaker",
      status: "ready",
      owner: "panel",
      detail:
        "Preflight blocks high-risk manifests now; runtime metrics should later quarantine live bots automatically."
    },
    {
      key: "observability",
      title: "Logs, metrics and audit trail",
      status: "planned",
      owner: "panel",
      detail:
        "Show bot logs, deploy history, rate-limit incidents, invalid-request budget burn and operator approvals."
    },
    {
      key: "risk-ip-pool",
      title: "Risk-tier egress pools",
      status: "planned",
      owner: "operator",
      detail:
        "Keep approved production bots, untrusted trials and quarantined workloads on separate outbound IP pools."
    }
  ];
}

function getGuardrails(): DiscordHostingGuardrail[] {
  return [
    {
      layer: "Pre-deploy",
      control: "Manifest policy scan",
      enforcement: "Block selfbots, user tokens, raids, scraping, spam and code-stored tokens.",
      failureAction: "Reject deployment before files are scheduled."
    },
    {
      layer: "Identity",
      control: "Application ownership check",
      enforcement: "Require application ID, owner contact and privileged-intent justification.",
      failureAction: "Hold for manual review."
    },
    {
      layer: "Secrets",
      control: "Token vault",
      enforcement: "Inject token at runtime only; mask logs and deny token-like strings in repository scans.",
      failureAction: "Block deploy or rotate secret."
    },
    {
      layer: "Runtime",
      control: "Container sandbox",
      enforcement: "No privileged mode, no host networking, CPU/RAM/pid limits and restart backoff.",
      failureAction: "Stop instance and mark it unhealthy."
    },
    {
      layer: "Network",
      control: "Discord egress gateway",
      enforcement: "All REST and Gateway traffic is attributed to bot, tenant, route and token bucket.",
      failureAction: "Throttle, quarantine or isolate egress IP."
    },
    {
      layer: "Abuse",
      control: "Invalid request fuse",
      enforcement: "Count 401/403/429 responses per bot and per egress IP within the 10 minute window.",
      failureAction: "Suspend bot before the shared IP reaches Discord's invalid-request threshold."
    }
  ];
}

export function getDiscordHostingOverview(): DiscordHostingOverview {
  const state = loadState();
  return {
    settings: clone(state.settings),
    metrics: getMetrics(state.settings),
    architecture: [
      "Panel API: review queue, policy engine, operator approvals and audit history.",
      "Scheduler: maps approved bots to daemon workers and risk-tier egress pools.",
      "Daemon worker: isolated container runtime with resource quotas and controlled environment secrets.",
      "Egress gateway: the only path to Discord REST and Gateway endpoints; owns buckets and invalid-request fuse.",
      "Telemetry: aggregates logs, 429s, invalid responses, reconnects, message volume and quarantine events."
    ],
    features: getFeatures(),
    guardrails: getGuardrails(),
    deploymentGates: [
      "Application ID and owner contact are present.",
      "No user account token, selfbot, raid, scraping or unsolicited messaging behavior is declared.",
      "Bot token is stored in the platform secret vault, not in source code or uploaded files.",
      "Privileged intents have business justification, privacy policy and manual approval.",
      "Direct outbound network access is denied; Discord traffic uses the metered egress gateway.",
      "REST request estimate fits per-bot budget and reconnect backoff is enabled.",
      "Runtime container has CPU, memory, process and restart limits."
    ],
    bannedBehaviors: [...BANNED_BEHAVIORS],
    sources: clone(OFFICIAL_SOURCES),
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
      "Missing bot name",
      "The manifest does not include a human-readable bot name.",
      "Collect a bot name for audit records and incident response."
    );
  } else {
    addCheck(
      checks,
      "pass",
      "Bot identity present",
      `Manifest name: ${manifest.name}`,
      "No action required."
    );
  }

  if (!manifest.applicationId) {
    addCheck(
      checks,
      "review",
      "Missing application ID",
      "Discord application ID is required to tie deployments to a developer application.",
      "Require the owner to submit the Discord application ID before approval."
    );
  }

  if (manifest.usesUserToken || flags.has("user-token") || flags.has("selfbot")) {
    addCheck(
      checks,
      "block",
      "User token or selfbot detected",
      "Discord bot hosting must not automate normal user accounts or use user tokens.",
      "Reject deployment. Require a proper bot application token.",
      OFFICIAL_SOURCES[2].url
    );
  }

  const blockedFlags = [...flags].filter((flag) => HARD_BLOCK_FLAGS.has(flag));
  if (blockedFlags.length > 0) {
    addCheck(
      checks,
      "block",
      "Prohibited behavior flags",
      `Manifest declares high-risk behavior: ${blockedFlags.join(", ")}.`,
      "Reject deployment and keep this workload off shared egress infrastructure.",
      OFFICIAL_SOURCES[2].url
    );
  }

  if (settings.requireSecretVault && (manifest.tokenStorage === "code" || manifest.tokenStorage === "file")) {
    addCheck(
      checks,
      "block",
      "Unsafe token storage",
      `Token storage mode is ${manifest.tokenStorage}.`,
      "Move tokens into the platform secret vault or environment secret injection before deploy."
    );
  } else if (manifest.tokenStorage === "unknown") {
    addCheck(
      checks,
      "review",
      "Token storage unknown",
      "The manifest does not prove token handling is isolated from source files and logs.",
      "Require token vault confirmation before approval."
    );
  } else {
    addCheck(
      checks,
      "pass",
      "Token storage accepted",
      `Token storage mode is ${manifest.tokenStorage}.`,
      "No action required."
    );
  }

  if (settings.requireEgressGateway && manifest.outboundMode === "direct") {
    addCheck(
      checks,
      "block",
      "Direct Discord egress",
      "Direct outbound network access prevents the platform from counting 429/401/403 responses and protecting shared IPs.",
      "Force the bot through the Discord egress gateway before start.",
      OFFICIAL_SOURCES[0].url
    );
  } else if (manifest.outboundMode === "unknown") {
    addCheck(
      checks,
      "review",
      "Outbound path unknown",
      "The manifest does not state whether Discord traffic uses the platform egress gateway.",
      "Confirm egress gateway enforcement before deployment."
    );
  } else {
    addCheck(
      checks,
      "pass",
      "Egress path accepted",
      `Outbound mode is ${manifest.outboundMode}.`,
      "Keep direct container internet disabled."
    );
  }

  if (privilegedIntents.length > 0 && !manifest.hasPrivacyPolicy) {
    addCheck(
      checks,
      "review",
      "Privileged intents need review",
      `Requested privileged intents: ${privilegedIntents.join(", ")}.`,
      "Require owner justification, privacy policy, Discord intent approval evidence and manual review.",
      OFFICIAL_SOURCES[1].url
    );
  } else if (privilegedIntents.length > 0) {
    addCheck(
      checks,
      "review",
      "Privileged intents declared",
      `Requested privileged intents: ${privilegedIntents.join(", ")}.`,
      "Verify Discord approval and confirm the data retention policy before start.",
      OFFICIAL_SOURCES[1].url
    );
  } else {
    addCheck(
      checks,
      "pass",
      "Intent surface is limited",
      "No privileged intents were declared.",
      "Prefer slash commands and interaction events."
    );
  }

  if (
    expectedRestRequestsPerMinute > settings.maxRestRequestsPerMinutePerBot
  ) {
    addCheck(
      checks,
      "review",
      "REST volume exceeds platform budget",
      `Expected ${expectedRestRequestsPerMinute} REST requests/minute; platform budget is ${settings.maxRestRequestsPerMinutePerBot}/minute.`,
      "Require sharding, caching, queueing and a lower per-route send budget before approval.",
      OFFICIAL_SOURCES[0].url
    );
  } else {
    addCheck(
      checks,
      "pass",
      "REST volume fits budget",
      `Expected ${expectedRestRequestsPerMinute} REST requests/minute.`,
      "Egress gateway should still honor Discord rate-limit response headers."
    );
  }

  if (expectedMessagesPerMinute > settings.maxMessagesPerMinutePerBot) {
    addCheck(
      checks,
      "review",
      "Message send volume is high",
      `Expected ${expectedMessagesPerMinute} messages/minute; platform budget is ${settings.maxMessagesPerMinutePerBot}/minute.`,
      "Require queueing, per-channel cooldowns and anti-spam review."
    );
  }

  if (settings.requireSlashCommandFirst && !manifest.slashCommandFirst) {
    addCheck(
      checks,
      "review",
      "Slash-command-first design missing",
      "Bots that depend on broad message reads increase compliance and intent risk.",
      "Prefer slash commands, components and interaction webhooks over broad message listeners.",
      OFFICIAL_SOURCES[1].url
    );
  }

  if (settings.requireReconnectBackoff && !manifest.reconnectBackoff) {
    addCheck(
      checks,
      "review",
      "Reconnect backoff missing",
      "A reconnect loop can flood the Gateway after network incidents.",
      "Add exponential backoff, jitter and max restart policy in daemon runtime."
    );
  }

  if (expectedGuilds >= 75) {
    addCheck(
      checks,
      "review",
      "Scale review required",
      `Expected guild count is ${expectedGuilds}.`,
      "Review sharding, verification readiness, data handling and incident response before onboarding more servers.",
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
        ? "Deployment blocked. The manifest includes behavior or architecture that can put shared Discord egress IPs at risk."
        : risk === "review"
          ? "Manual review required before deployment. Fix or approve the listed controls first."
          : "Manifest can be deployed through the guarded Discord hosting path.",
    checks,
    recommendedControls: [
      "Run the bot only through the Discord egress gateway.",
      "Store tokens in the platform secret vault and mask token-like log output.",
      "Enable per-route REST buckets, global token bucket and 10 minute invalid-request fuse.",
      "Use slash commands/interactions before broad message-content reads.",
      "Keep restart backoff, jitter and max crash-loop limits enabled."
    ],
    manifest
  };
}
