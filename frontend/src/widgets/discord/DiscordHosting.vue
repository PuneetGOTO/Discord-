<script setup lang="ts">
import BetweenMenus from "@/components/BetweenMenus.vue";
import type { LayoutCard } from "@/types";
import { t } from "@/lang/i18n";
import {
  discordHostingOverview,
  discordHostingPreflight,
  type DiscordBotManifest,
  type DiscordHostingFeature,
  type DiscordHostingOverview,
  type DiscordPreflightCheck,
  type DiscordPreflightResult,
  type DiscordPreflightStatus
} from "@/services/apis/discordHosting";
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WarningOutlined
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { computed, onMounted, reactive, ref } from "vue";

defineProps<{
  card: LayoutCard;
}>();

const overviewApi = discordHostingOverview();
const preflightApi = discordHostingPreflight();

const overview = ref<DiscordHostingOverview>();
const preflight = ref<DiscordPreflightResult>();

const manifest = reactive<DiscordBotManifest>({
  name: "community-helper",
  applicationId: "",
  runtime: "nodejs",
  library: "discord.js",
  gatewayIntents: [],
  behaviorFlags: [],
  expectedGuilds: 5,
  expectedRestRequestsPerMinute: 120,
  expectedMessagesPerMinute: 10,
  tokenStorage: "vault",
  outboundMode: "platform-egress",
  hasPrivacyPolicy: false,
  usesUserToken: false,
  slashCommandFirst: true,
  reconnectBackoff: true,
  shardCount: 1
});

const gatewayIntentOptions = [
  { label: t("TXT_CODE_DISCORD_INTENT_GUILDS"), value: "GUILDS" },
  { label: t("TXT_CODE_DISCORD_INTENT_GUILD_MEMBERS"), value: "GUILD_MEMBERS" },
  { label: t("TXT_CODE_DISCORD_INTENT_GUILD_PRESENCES"), value: "GUILD_PRESENCES" },
  { label: t("TXT_CODE_DISCORD_INTENT_MESSAGE_CONTENT"), value: "MESSAGE_CONTENT" }
];

const behaviorOptions = [
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_MASS_DM"), value: "mass-dm" },
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_UNSOLICITED_ADS"), value: "unsolicited-ads" },
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_WEBHOOK_SPAM"), value: "webhook-spam" },
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_GUILD_SCRAPING"), value: "guild-scraping" },
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_RAID_TOOLS"), value: "raid-tools" },
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_INVITE_JOIN"), value: "invite-join-automation" },
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_CAPTCHA_BYPASS"), value: "captcha-bypass" },
  { label: t("TXT_CODE_DISCORD_BEHAVIOR_MALWARE"), value: "malware" }
];

const featureColumns = [
  { title: t("TXT_CODE_DISCORD_COLUMN_CAPABILITY"), dataIndex: "title", key: "title" },
  { title: t("TXT_CODE_DISCORD_COLUMN_STATUS"), dataIndex: "status", key: "status", width: 120 },
  { title: t("TXT_CODE_DISCORD_COLUMN_OWNER"), dataIndex: "owner", key: "owner", width: 120 },
  { title: t("TXT_CODE_DISCORD_COLUMN_DETAIL"), dataIndex: "detail", key: "detail" }
];

const guardrailColumns = [
  { title: t("TXT_CODE_DISCORD_COLUMN_LAYER"), dataIndex: "layer", key: "layer", width: 120 },
  { title: t("TXT_CODE_DISCORD_COLUMN_CONTROL"), dataIndex: "control", key: "control", width: 210 },
  { title: t("TXT_CODE_DISCORD_COLUMN_ENFORCEMENT"), dataIndex: "enforcement", key: "enforcement" },
  { title: t("TXT_CODE_DISCORD_COLUMN_FAILURE_ACTION"), dataIndex: "failureAction", key: "failureAction" }
];

const checkColumns = [
  { title: t("TXT_CODE_DISCORD_COLUMN_RESULT"), dataIndex: "status", key: "status", width: 110 },
  { title: t("TXT_CODE_DISCORD_COLUMN_CHECK"), dataIndex: "title", key: "title", width: 220 },
  { title: t("TXT_CODE_DISCORD_COLUMN_DETAIL"), dataIndex: "detail", key: "detail" },
  { title: t("TXT_CODE_DISCORD_COLUMN_REMEDIATION"), dataIndex: "remediation", key: "remediation" }
];

const riskMeta = computed(() => {
  const risk = preflight.value?.risk;
  if (risk === "block") {
    return {
      color: "red",
      status: "exception" as const,
      icon: WarningOutlined,
      title: t("TXT_CODE_DISCORD_RISK_BLOCKED")
    };
  }
  if (risk === "review") {
    return {
      color: "orange",
      status: "active" as const,
      icon: ThunderboltOutlined,
      title: t("TXT_CODE_DISCORD_RISK_REVIEW")
    };
  }
  return {
    color: "green",
    status: "success" as const,
    icon: CheckCircleOutlined,
    title: t("TXT_CODE_DISCORD_RISK_ALLOWED")
  };
});

const updatedAtText = computed(() => {
  if (!overview.value?.updatedAt) return "-";
  return new Date(overview.value.updatedAt).toLocaleString();
});

const loadOverview = async () => {
  const state = await overviewApi.execute({ forceRequest: true });
  overview.value = state.value;
};

const runPreflight = async () => {
  const payload: DiscordBotManifest = {
    ...manifest,
    gatewayIntents: [...(manifest.gatewayIntents || [])],
    behaviorFlags: [...(manifest.behaviorFlags || [])],
    expectedGuilds: Number(manifest.expectedGuilds || 0),
    expectedRestRequestsPerMinute: Number(manifest.expectedRestRequestsPerMinute || 0),
    expectedMessagesPerMinute: Number(manifest.expectedMessagesPerMinute || 0),
    shardCount: Number(manifest.shardCount || 1)
  };
  const state = await preflightApi.execute({
    data: payload,
    forceRequest: true,
    errorAlert: true
  });
  preflight.value = state.value;
  if (preflight.value?.risk === "allow") {
    message.success(t("TXT_CODE_DISCORD_PREFLIGHT_PASSED"));
  }
};

const statusColor = (status: string) => {
  if (status === "ready" || status === "pass" || status === "success") return "green";
  if (status === "planned" || status === "review" || status === "processing") return "orange";
  if (status === "required" || status === "block" || status === "error") return "red";
  return "default";
};

const displayText = (value?: string | number) => {
  if (typeof value !== "string") return value ?? "";
  if (value.startsWith("TXT_CODE_")) return t(value);
  return value;
};

const featureRowKey = (record: DiscordHostingFeature) => record.key;
const checkRowKey = (record: DiscordPreflightCheck) => `${record.status}-${record.title}`;

const statusText = (status: string) => {
  const statusMap: Record<string, string> = {
    ready: t("TXT_CODE_DISCORD_STATUS_READY"),
    planned: t("TXT_CODE_DISCORD_STATUS_PLANNED"),
    required: t("TXT_CODE_DISCORD_STATUS_REQUIRED"),
    pass: t("TXT_CODE_DISCORD_STATUS_PASS"),
    review: t("TXT_CODE_DISCORD_STATUS_REVIEW"),
    block: t("TXT_CODE_DISCORD_STATUS_BLOCK"),
    success: t("TXT_CODE_DISCORD_STATUS_SUCCESS"),
    warning: t("TXT_CODE_DISCORD_STATUS_WARNING"),
    error: t("TXT_CODE_DISCORD_STATUS_ERROR"),
    processing: t("TXT_CODE_DISCORD_STATUS_PROCESSING")
  };
  return statusMap[status] || status;
};

const ownerText = (owner: string) => {
  const ownerMap: Record<string, string> = {
    panel: t("TXT_CODE_DISCORD_OWNER_PANEL"),
    daemon: t("TXT_CODE_DISCORD_OWNER_DAEMON"),
    network: t("TXT_CODE_DISCORD_OWNER_NETWORK"),
    operator: t("TXT_CODE_DISCORD_OWNER_OPERATOR")
  };
  return ownerMap[owner] || owner;
};

const checkTagText = (status: DiscordPreflightStatus) => statusText(status);

onMounted(() => {
  loadOverview();
});
</script>

<template>
  <div class="discord-hosting">
    <a-row :gutter="[20, 20]">
      <a-col :span="24">
        <BetweenMenus>
          <template #left>
            <a-typography-title class="mb-0" :level="4">
              <ApiOutlined />
              {{ displayText(card.title) }}
            </a-typography-title>
          </template>
          <template #right>
            <a-button :loading="overviewApi.isLoading.value" @click="loadOverview">
              <ReloadOutlined />
              {{ t("TXT_CODE_DISCORD_REFRESH") }}
            </a-button>
            <a-button type="primary" :loading="preflightApi.isLoading.value" @click="runPreflight">
              <SafetyCertificateOutlined />
              {{ t("TXT_CODE_DISCORD_RUN_PREFLIGHT") }}
            </a-button>
          </template>
        </BetweenMenus>
      </a-col>

      <a-col :span="24">
        <a-alert
          show-icon
          type="warning"
          :message="t('TXT_CODE_DISCORD_ALERT_TITLE')"
          :description="t('TXT_CODE_DISCORD_ALERT_DESC')"
        />
      </a-col>

      <a-col v-for="metric in overview?.metrics || []" :key="metric.label" :span="24" :md="6">
        <section class="metric-panel">
          <a-statistic :title="displayText(metric.label)" :value="displayText(metric.value)" />
          <a-tag class="mt-8" :color="statusColor(metric.status)">
            {{ statusText(metric.status) }}
          </a-tag>
          <p>{{ displayText(metric.detail) }}</p>
        </section>
      </a-col>

      <a-col :span="24" :xl="10">
        <section class="section-panel">
          <div class="section-title">
            <CloudServerOutlined />
            {{ t("TXT_CODE_DISCORD_ARCHITECTURE_PATH") }}
          </div>
          <a-steps direction="vertical" size="small" :current="overview?.architecture.length || 0">
            <a-step
              v-for="item in overview?.architecture || []"
              :key="item"
              status="finish"
              :title="displayText(item)"
            />
          </a-steps>
        </section>
      </a-col>

      <a-col :span="24" :xl="14">
        <section class="section-panel">
          <div class="section-title">
            <LockOutlined />
            {{ t("TXT_CODE_DISCORD_DEPLOYMENT_GATES") }}
            <a-typography-text type="secondary">
              {{ t("TXT_CODE_DISCORD_UPDATED", { time: updatedAtText }) }}
            </a-typography-text>
          </div>
          <a-list size="small" :data-source="overview?.deploymentGates || []">
            <template #renderItem="{ item }">
              <a-list-item>
                <CheckCircleOutlined class="gate-icon" />
                {{ displayText(item) }}
              </a-list-item>
            </template>
          </a-list>
        </section>
      </a-col>

      <a-col :span="24">
        <section class="section-panel">
          <div class="section-title">
            <SafetyCertificateOutlined />
            {{ t("TXT_CODE_DISCORD_CAPABILITY_MAP") }}
          </div>
          <a-table
            :columns="featureColumns"
            :data-source="overview?.features || []"
            :pagination="false"
            :row-key="featureRowKey"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColor(record.status)">
                  {{ statusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'owner'">
                <a-tag>{{ ownerText(record.owner) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'title'">
                {{ displayText(record.title) }}
              </template>
              <template v-else-if="column.key === 'detail'">
                {{ displayText(record.detail) }}
              </template>
            </template>
          </a-table>
        </section>
      </a-col>

      <a-col :span="24">
        <section class="section-panel">
          <div class="section-title">
            <WarningOutlined />
            {{ t("TXT_CODE_DISCORD_RUNTIME_GUARDRAILS") }}
          </div>
          <a-table
            :columns="guardrailColumns"
            :data-source="overview?.guardrails || []"
            :pagination="false"
            row-key="control"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'layer'">
                {{ displayText(record.layer) }}
              </template>
              <template v-else-if="column.key === 'control'">
                {{ displayText(record.control) }}
              </template>
              <template v-else-if="column.key === 'enforcement'">
                {{ displayText(record.enforcement) }}
              </template>
              <template v-else-if="column.key === 'failureAction'">
                {{ displayText(record.failureAction) }}
              </template>
            </template>
          </a-table>
        </section>
      </a-col>

      <a-col :span="24" :xl="10">
        <section class="section-panel">
          <div class="section-title">
            <ThunderboltOutlined />
            {{ t("TXT_CODE_DISCORD_BOT_MANIFEST_PREFLIGHT") }}
          </div>
          <a-form layout="vertical" class="preflight-form">
            <a-row :gutter="[12, 0]">
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_BOT_NAME')">
                  <a-input v-model:value="manifest.name" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_APPLICATION_ID')">
                  <a-input
                    v-model:value="manifest.applicationId"
                    :placeholder="t('TXT_CODE_DISCORD_APPLICATION_ID_PLACEHOLDER')"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_RUNTIME')">
                  <a-select v-model:value="manifest.runtime">
                    <a-select-option value="nodejs">Node.js</a-select-option>
                    <a-select-option value="python">Python</a-select-option>
                    <a-select-option value="java">Java</a-select-option>
                    <a-select-option value="other">
                      {{ t("TXT_CODE_DISCORD_OTHER") }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_LIBRARY')">
                  <a-input v-model:value="manifest.library" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_EXPECTED_GUILDS')">
                  <a-input-number v-model:value="manifest.expectedGuilds" :min="0" class="fill" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_SHARD_COUNT')">
                  <a-input-number v-model:value="manifest.shardCount" :min="1" class="fill" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_REST_REQUESTS_PER_MINUTE')">
                  <a-input-number
                    v-model:value="manifest.expectedRestRequestsPerMinute"
                    :min="0"
                    class="fill"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_MESSAGES_PER_MINUTE')">
                  <a-input-number
                    v-model:value="manifest.expectedMessagesPerMinute"
                    :min="0"
                    class="fill"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_TOKEN_STORAGE')">
                  <a-select v-model:value="manifest.tokenStorage">
                    <a-select-option value="vault">
                      {{ t("TXT_CODE_DISCORD_SECRET_VAULT") }}
                    </a-select-option>
                    <a-select-option value="env">
                      {{ t("TXT_CODE_DISCORD_ENV_SECRET") }}
                    </a-select-option>
                    <a-select-option value="file">
                      {{ t("TXT_CODE_DISCORD_FILE") }}
                    </a-select-option>
                    <a-select-option value="code">
                      {{ t("TXT_CODE_DISCORD_SOURCE_CODE") }}
                    </a-select-option>
                    <a-select-option value="unknown">
                      {{ t("TXT_CODE_DISCORD_UNKNOWN") }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item :label="t('TXT_CODE_DISCORD_OUTBOUND_MODE')">
                  <a-select v-model:value="manifest.outboundMode">
                    <a-select-option value="platform-egress">
                      {{ t("TXT_CODE_DISCORD_PLATFORM_EGRESS") }}
                    </a-select-option>
                    <a-select-option value="dedicated-egress">
                      {{ t("TXT_CODE_DISCORD_DEDICATED_EGRESS") }}
                    </a-select-option>
                    <a-select-option value="direct">
                      {{ t("TXT_CODE_DISCORD_DIRECT_INTERNET") }}
                    </a-select-option>
                    <a-select-option value="unknown">
                      {{ t("TXT_CODE_DISCORD_UNKNOWN") }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item :label="t('TXT_CODE_DISCORD_GATEWAY_INTENTS')">
                  <a-checkbox-group
                    v-model:value="manifest.gatewayIntents"
                    :options="gatewayIntentOptions"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item :label="t('TXT_CODE_DISCORD_RISK_BEHAVIOR_FLAGS')">
                  <a-select
                    v-model:value="manifest.behaviorFlags"
                    mode="multiple"
                    :options="behaviorOptions"
                    :placeholder="t('TXT_CODE_DISCORD_RISK_BEHAVIOR_PLACEHOLDER')"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <div class="toggle-grid">
                  <a-checkbox v-model:checked="manifest.hasPrivacyPolicy">
                    {{ t("TXT_CODE_DISCORD_PRIVACY_POLICY_READY") }}
                  </a-checkbox>
                  <a-checkbox v-model:checked="manifest.usesUserToken">
                    {{ t("TXT_CODE_DISCORD_USES_USER_TOKEN") }}
                  </a-checkbox>
                  <a-checkbox v-model:checked="manifest.slashCommandFirst">
                    {{ t("TXT_CODE_DISCORD_SLASH_COMMAND_FIRST") }}
                  </a-checkbox>
                  <a-checkbox v-model:checked="manifest.reconnectBackoff">
                    {{ t("TXT_CODE_DISCORD_RECONNECT_BACKOFF") }}
                  </a-checkbox>
                </div>
              </a-col>
            </a-row>
          </a-form>
        </section>
      </a-col>

      <a-col :span="24" :xl="14">
        <section class="section-panel result-panel">
          <div class="section-title">
            <SafetyCertificateOutlined />
            {{ t("TXT_CODE_DISCORD_PREFLIGHT_RESULT") }}
          </div>

          <a-empty v-if="!preflight" :description="t('TXT_CODE_DISCORD_EMPTY_PREFLIGHT')" />

          <template v-else>
            <div class="risk-summary">
              <component :is="riskMeta.icon" class="risk-icon" />
              <div class="risk-copy">
                <a-tag :color="riskMeta.color">{{ riskMeta.title }}</a-tag>
                <strong>{{ t("TXT_CODE_DISCORD_SCORE", { score: preflight.score }) }}</strong>
                <span>{{ displayText(preflight.summary) }}</span>
              </div>
              <a-progress
                type="circle"
                :percent="preflight.score"
                :status="riskMeta.status"
                :width="82"
              />
            </div>

            <a-table
              :columns="checkColumns"
              :data-source="preflight.checks"
              :pagination="{ pageSize: 6 }"
              :row-key="checkRowKey"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'status'">
                  <a-tag :color="statusColor(record.status)">
                    {{ checkTagText(record.status) }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'title'">
                  {{ displayText(record.title) }}
                </template>
                <template v-else-if="column.key === 'detail'">
                  {{ displayText(record.detail) }}
                </template>
                <template v-else-if="column.key === 'remediation'">
                  {{ displayText(record.remediation) }}
                </template>
              </template>
            </a-table>
          </template>
        </section>
      </a-col>

      <a-col :span="24" :xl="12">
        <section class="section-panel">
          <div class="section-title">
            <WarningOutlined />
            {{ t("TXT_CODE_DISCORD_ALWAYS_BLOCKED_BEHAVIOR") }}
          </div>
          <div class="tag-list">
            <a-tag v-for="flag in overview?.bannedBehaviors || []" :key="flag" color="red">
              {{ flag }}
            </a-tag>
          </div>
        </section>
      </a-col>

      <a-col :span="24" :xl="12">
        <section class="section-panel">
          <div class="section-title">
            <ApiOutlined />
            {{ t("TXT_CODE_DISCORD_OFFICIAL_REFERENCES") }}
          </div>
          <a-list size="small" :data-source="overview?.sources || []">
            <template #renderItem="{ item }">
              <a-list-item>
                <a :href="item.url" target="_blank" rel="noreferrer">
                  {{ displayText(item.title) }}
                </a>
              </a-list-item>
            </template>
          </a-list>
        </section>
      </a-col>
    </a-row>
  </div>
</template>

<style lang="scss" scoped>
.discord-hosting {
  height: 100%;
  overflow: auto;
}

.metric-panel,
.section-panel {
  height: 100%;
  border: 1px solid var(--gray-border-color);
  border-radius: 6px;
  padding: 16px;
  background: var(--background-color-white);
}

.metric-panel {
  min-height: 170px;

  p {
    margin: 12px 0 0;
    color: var(--color-gray-10);
    line-height: 1.55;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 16px;
  font-weight: 600;

  .ant-typography {
    margin-left: auto;
    font-size: 12px;
    font-weight: 400;
  }
}

.gate-icon {
  margin-right: 8px;
  color: var(--color-green-6);
}

.preflight-form {
  :deep(.ant-form-item) {
    margin-bottom: 12px;
  }
}

.fill {
  width: 100%;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.result-panel {
  min-height: 620px;
}

.risk-summary {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid var(--gray-border-color);
  border-radius: 6px;
}

.risk-icon {
  font-size: 28px;
}

.risk-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 992px) {
  .toggle-grid,
  .risk-summary {
    grid-template-columns: 1fr;
  }
}
</style>
