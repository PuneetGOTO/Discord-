import { useDefineApi } from "@/stores/useDefineApi";

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

export const discordHostingOverview = useDefineApi<any, DiscordHostingOverview>({
  url: "/api/discord_hosting/overview",
  method: "GET"
});

export const discordHostingPreflight = useDefineApi<
  {
    data: DiscordBotManifest;
  },
  DiscordPreflightResult
>({
  url: "/api/discord_hosting/preflight",
  method: "POST"
});
