<script setup lang="ts">
import BetweenMenus from "@/components/BetweenMenus.vue";
import type { LayoutCard } from "@/types";
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
  { label: "Guilds", value: "GUILDS" },
  { label: "Guild members", value: "GUILD_MEMBERS" },
  { label: "Guild presences", value: "GUILD_PRESENCES" },
  { label: "Message content", value: "MESSAGE_CONTENT" }
];

const behaviorOptions = [
  { label: "Mass DM", value: "mass-dm" },
  { label: "Unsolicited ads", value: "unsolicited-ads" },
  { label: "Webhook spam", value: "webhook-spam" },
  { label: "Guild scraping", value: "guild-scraping" },
  { label: "Raid tools", value: "raid-tools" },
  { label: "Invite join automation", value: "invite-join-automation" },
  { label: "Captcha bypass", value: "captcha-bypass" },
  { label: "Malware", value: "malware" }
];

const featureColumns = [
  { title: "Capability", dataIndex: "title", key: "title" },
  { title: "Status", dataIndex: "status", key: "status", width: 120 },
  { title: "Owner", dataIndex: "owner", key: "owner", width: 120 },
  { title: "Detail", dataIndex: "detail", key: "detail" }
];

const guardrailColumns = [
  { title: "Layer", dataIndex: "layer", key: "layer", width: 120 },
  { title: "Control", dataIndex: "control", key: "control", width: 210 },
  { title: "Enforcement", dataIndex: "enforcement", key: "enforcement" },
  { title: "Failure action", dataIndex: "failureAction", key: "failureAction" }
];

const checkColumns = [
  { title: "Result", dataIndex: "status", key: "status", width: 110 },
  { title: "Check", dataIndex: "title", key: "title", width: 220 },
  { title: "Detail", dataIndex: "detail", key: "detail" },
  { title: "Remediation", dataIndex: "remediation", key: "remediation" }
];

const riskMeta = computed(() => {
  const risk = preflight.value?.risk;
  if (risk === "block") {
    return {
      color: "red",
      status: "exception" as const,
      icon: WarningOutlined,
      title: "Blocked"
    };
  }
  if (risk === "review") {
    return {
      color: "orange",
      status: "active" as const,
      icon: ThunderboltOutlined,
      title: "Review"
    };
  }
  return {
    color: "green",
    status: "success" as const,
    icon: CheckCircleOutlined,
    title: "Allowed"
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
    message.success("Preflight passed.");
  }
};

const statusColor = (status: string) => {
  if (status === "ready" || status === "pass" || status === "success") return "green";
  if (status === "planned" || status === "review" || status === "processing") return "orange";
  if (status === "required" || status === "block" || status === "error") return "red";
  return "default";
};

const featureRowKey = (record: DiscordHostingFeature) => record.key;
const checkRowKey = (record: DiscordPreflightCheck) => `${record.status}-${record.title}`;
const checkTagText = (status: DiscordPreflightStatus) => status.toUpperCase();

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
              {{ card.title }}
            </a-typography-title>
          </template>
          <template #right>
            <a-button :loading="overviewApi.isLoading.value" @click="loadOverview">
              <ReloadOutlined />
              Refresh
            </a-button>
            <a-button type="primary" :loading="preflightApi.isLoading.value" @click="runPreflight">
              <SafetyCertificateOutlined />
              Run preflight
            </a-button>
          </template>
        </BetweenMenus>
      </a-col>

      <a-col :span="24">
        <a-alert
          show-icon
          type="warning"
          message="Discord hosting must be a controlled platform path, not a generic Node.js template."
          description="The safe architecture blocks high-risk manifests before deploy, forces Discord traffic through a metered egress gateway, and suspends bots before invalid requests can burn a shared IP."
        />
      </a-col>

      <a-col v-for="metric in overview?.metrics || []" :key="metric.label" :span="24" :md="6">
        <section class="metric-panel">
          <a-statistic :title="metric.label" :value="metric.value" />
          <a-tag class="mt-8" :color="statusColor(metric.status)">
            {{ metric.status }}
          </a-tag>
          <p>{{ metric.detail }}</p>
        </section>
      </a-col>

      <a-col :span="24" :xl="10">
        <section class="section-panel">
          <div class="section-title">
            <CloudServerOutlined />
            Architecture path
          </div>
          <a-steps direction="vertical" size="small" :current="overview?.architecture.length || 0">
            <a-step
              v-for="item in overview?.architecture || []"
              :key="item"
              status="finish"
              :title="item"
            />
          </a-steps>
        </section>
      </a-col>

      <a-col :span="24" :xl="14">
        <section class="section-panel">
          <div class="section-title">
            <LockOutlined />
            Deployment gates
            <a-typography-text type="secondary">Updated {{ updatedAtText }}</a-typography-text>
          </div>
          <a-list size="small" :data-source="overview?.deploymentGates || []">
            <template #renderItem="{ item }">
              <a-list-item>
                <CheckCircleOutlined class="gate-icon" />
                {{ item }}
              </a-list-item>
            </template>
          </a-list>
        </section>
      </a-col>

      <a-col :span="24">
        <section class="section-panel">
          <div class="section-title">
            <SafetyCertificateOutlined />
            Capability map
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
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'owner'">
                <a-tag>{{ record.owner }}</a-tag>
              </template>
            </template>
          </a-table>
        </section>
      </a-col>

      <a-col :span="24">
        <section class="section-panel">
          <div class="section-title">
            <WarningOutlined />
            Runtime guardrails
          </div>
          <a-table
            :columns="guardrailColumns"
            :data-source="overview?.guardrails || []"
            :pagination="false"
            row-key="control"
            size="small"
          />
        </section>
      </a-col>

      <a-col :span="24" :xl="10">
        <section class="section-panel">
          <div class="section-title">
            <ThunderboltOutlined />
            Bot manifest preflight
          </div>
          <a-form layout="vertical" class="preflight-form">
            <a-row :gutter="[12, 0]">
              <a-col :span="24" :md="12">
                <a-form-item label="Bot name">
                  <a-input v-model:value="manifest.name" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Application ID">
                  <a-input v-model:value="manifest.applicationId" placeholder="Discord application ID" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Runtime">
                  <a-select v-model:value="manifest.runtime">
                    <a-select-option value="nodejs">Node.js</a-select-option>
                    <a-select-option value="python">Python</a-select-option>
                    <a-select-option value="java">Java</a-select-option>
                    <a-select-option value="other">Other</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Library">
                  <a-input v-model:value="manifest.library" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Expected guilds">
                  <a-input-number v-model:value="manifest.expectedGuilds" :min="0" class="fill" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Shard count">
                  <a-input-number v-model:value="manifest.shardCount" :min="1" class="fill" />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="REST requests per minute">
                  <a-input-number
                    v-model:value="manifest.expectedRestRequestsPerMinute"
                    :min="0"
                    class="fill"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Messages per minute">
                  <a-input-number
                    v-model:value="manifest.expectedMessagesPerMinute"
                    :min="0"
                    class="fill"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Token storage">
                  <a-select v-model:value="manifest.tokenStorage">
                    <a-select-option value="vault">Secret vault</a-select-option>
                    <a-select-option value="env">Environment secret</a-select-option>
                    <a-select-option value="file">File</a-select-option>
                    <a-select-option value="code">Source code</a-select-option>
                    <a-select-option value="unknown">Unknown</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="24" :md="12">
                <a-form-item label="Outbound mode">
                  <a-select v-model:value="manifest.outboundMode">
                    <a-select-option value="platform-egress">Platform egress</a-select-option>
                    <a-select-option value="dedicated-egress">Dedicated egress</a-select-option>
                    <a-select-option value="direct">Direct internet</a-select-option>
                    <a-select-option value="unknown">Unknown</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Gateway intents">
                  <a-checkbox-group
                    v-model:value="manifest.gatewayIntents"
                    :options="gatewayIntentOptions"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Risk behavior flags">
                  <a-select
                    v-model:value="manifest.behaviorFlags"
                    mode="multiple"
                    :options="behaviorOptions"
                    placeholder="Select declared high-risk behaviors"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <div class="toggle-grid">
                  <a-checkbox v-model:checked="manifest.hasPrivacyPolicy">
                    Privacy policy ready
                  </a-checkbox>
                  <a-checkbox v-model:checked="manifest.usesUserToken">
                    Uses user account token
                  </a-checkbox>
                  <a-checkbox v-model:checked="manifest.slashCommandFirst">
                    Slash-command-first
                  </a-checkbox>
                  <a-checkbox v-model:checked="manifest.reconnectBackoff">
                    Reconnect backoff
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
            Preflight result
          </div>

          <a-empty v-if="!preflight" description="Run preflight to evaluate a bot manifest." />

          <template v-else>
            <div class="risk-summary">
              <component :is="riskMeta.icon" class="risk-icon" />
              <div class="risk-copy">
                <a-tag :color="riskMeta.color">{{ riskMeta.title }}</a-tag>
                <strong>Score {{ preflight.score }}/100</strong>
                <span>{{ preflight.summary }}</span>
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
              </template>
            </a-table>
          </template>
        </section>
      </a-col>

      <a-col :span="24" :xl="12">
        <section class="section-panel">
          <div class="section-title">
            <WarningOutlined />
            Always blocked behavior
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
            Official references
          </div>
          <a-list size="small" :data-source="overview?.sources || []">
            <template #renderItem="{ item }">
              <a-list-item>
                <a :href="item.url" target="_blank" rel="noreferrer">{{ item.title }}</a>
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
