<script setup lang="ts">
import { openNodeSelectDialog } from "@/components/fc";
import BetweenMenus from "@/components/BetweenMenus.vue";
import { router } from "@/config/router";
import { QUICKSTART_METHOD } from "@/hooks/widgets/quickStartFlow";
import { t } from "@/lang/i18n";
import {
  discordHostingOverview,
  type DiscordHostingFeature,
  type DiscordHostingOverview
} from "@/services/apis/discordHosting";
import type { LayoutCard } from "@/types";
import CreateInstanceForm from "@/widgets/setupApp/CreateInstanceForm.vue";
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CodeOutlined,
  FileZipOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  WarningOutlined
} from "@ant-design/icons-vue";
import { computed, onMounted, ref } from "vue";

type InstancePresetConfig = Partial<
  Omit<
    IGlobalInstanceConfig,
    "docker" | "eventTask" | "terminalOption" | "pingConfig" | "extraServiceConfig" | "java"
  >
> & {
  docker?: Partial<IGlobalInstanceDockerConfig>;
  eventTask?: Partial<IGlobalInstanceConfig["eventTask"]>;
  terminalOption?: Partial<IGlobalInstanceConfig["terminalOption"]>;
  pingConfig?: Partial<IGlobalInstanceConfig["pingConfig"]>;
  extraServiceConfig?: Partial<IGlobalInstanceConfig["extraServiceConfig"]>;
  java?: Partial<IInstanceJavaConfig>;
};

defineProps<{
  card: LayoutCard;
}>();

const overviewApi = discordHostingOverview();
const overview = ref<DiscordHostingOverview>();
const showCreateForm = ref(false);
const createForm = ref({
  createMethod: QUICKSTART_METHOD.DOCKER,
  daemonId: ""
});
const selectedPresetConfig = ref<InstancePresetConfig>();

const nodeDiscordPresetConfig: InstancePresetConfig = {
  nickname: "discord-bot",
  type: "universal",
  processType: "docker",
  cwd: ".",
  startCommand: "npm install --omit=dev && npm start",
  stopCommand: "^c",
  updateCommand: "npm install --omit=dev",
  tag: ["discord-bot"],
  eventTask: {
    autoStart: false,
    autoRestart: true,
    autoRestartMaxTimes: 5
  },
  docker: {
    image: "node:22-alpine",
    workingDir: "/workspace",
    changeWorkdir: true,
    memory: 512,
    networkMode: "bridge",
    env: ["DISCORD_TOKEN=${DISCORD_TOKEN}"],
    labels: ["mcsmanager.workload=discord-bot"]
  }
};

const pythonDiscordPresetConfig: InstancePresetConfig = {
  nickname: "discord-python-bot",
  type: "universal",
  processType: "docker",
  cwd: ".",
  startCommand: "pip install -r requirements.txt && python bot.py",
  stopCommand: "^c",
  updateCommand: "pip install -r requirements.txt",
  tag: ["discord-bot", "python"],
  eventTask: {
    autoStart: false,
    autoRestart: true,
    autoRestartMaxTimes: 5
  },
  docker: {
    image: "python:3.12-slim",
    workingDir: "/workspace",
    changeWorkdir: true,
    memory: 512,
    networkMode: "bridge",
    env: ["DISCORD_TOKEN=${DISCORD_TOKEN}"],
    labels: ["mcsmanager.workload=discord-bot", "mcsmanager.runtime=python"]
  }
};

const quickCreateActions = [
  {
    key: "nodejs-docker",
    createMethod: QUICKSTART_METHOD.DOCKER,
    presetConfig: nodeDiscordPresetConfig,
    icon: CodeOutlined,
    title: t("TXT_CODE_DISCORD_CREATE_DOCKER"),
    detail: t("TXT_CODE_DISCORD_CREATE_DOCKER_DETAIL"),
    type: "primary" as const
  },
  {
    key: "python-docker",
    createMethod: QUICKSTART_METHOD.DOCKER,
    presetConfig: pythonDiscordPresetConfig,
    icon: CodeOutlined,
    title: t("TXT_CODE_DISCORD_CREATE_PYTHON_DOCKER"),
    detail: t("TXT_CODE_DISCORD_CREATE_PYTHON_DOCKER_DETAIL"),
    type: "default" as const
  },
  {
    key: "import-project",
    createMethod: QUICKSTART_METHOD.IMPORT,
    presetConfig: nodeDiscordPresetConfig,
    icon: FileZipOutlined,
    title: t("TXT_CODE_DISCORD_IMPORT_PROJECT"),
    detail: t("TXT_CODE_DISCORD_IMPORT_PROJECT_DETAIL"),
    type: "default" as const
  }
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

const updatedAtText = computed(() => {
  if (!overview.value?.updatedAt) return "-";
  return new Date(overview.value.updatedAt).toLocaleString();
});

const loadOverview = async () => {
  const state = await overviewApi.execute({ forceRequest: true });
  overview.value = state.value;
};

const openCreateForm = async (
  createMethod: QUICKSTART_METHOD,
  presetConfig: InstancePresetConfig = nodeDiscordPresetConfig
) => {
  try {
    const selectedNode = await openNodeSelectDialog();
    if (!selectedNode) return;
    createForm.value = {
      createMethod,
      daemonId: selectedNode.uuid
    };
    selectedPresetConfig.value = presetConfig;
    showCreateForm.value = true;
  } catch (error) {
    console.error(error);
  }
};

const openInstanceList = () => {
  router.push("/instances");
};

const handleCreated = (instanceUuid: string) => {
  showCreateForm.value = false;
  router.push({
    path: "/instances/terminal",
    query: {
      daemonId: createForm.value.daemonId,
      instanceId: instanceUuid
    }
  });
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
            <a-button
              type="primary"
              @click="openCreateForm(QUICKSTART_METHOD.DOCKER, nodeDiscordPresetConfig)"
            >
              <PlusOutlined />
              {{ t("TXT_CODE_DISCORD_CREATE_SERVER") }}
            </a-button>
          </template>
        </BetweenMenus>
      </a-col>

      <a-col :span="24">
        <a-alert
          show-icon
          type="info"
          :message="t('TXT_CODE_DISCORD_ADMIN_CREATE_ALERT_TITLE')"
          :description="t('TXT_CODE_DISCORD_ADMIN_CREATE_ALERT_DESC')"
        />
      </a-col>

      <a-col :span="24" :xl="8">
        <section class="section-panel quick-create-panel">
          <div class="section-title">
            <PlusOutlined />
            {{ t("TXT_CODE_DISCORD_QUICK_CREATE_TITLE") }}
          </div>
          <p class="section-copy">
            {{ t("TXT_CODE_DISCORD_QUICK_CREATE_DESC") }}
          </p>

          <div class="quick-actions">
            <a-button
              v-for="action in quickCreateActions"
              :key="action.key"
              :type="action.type"
              block
              class="quick-action"
              @click="openCreateForm(action.createMethod, action.presetConfig)"
            >
              <component :is="action.icon" />
              <span class="quick-action-copy">
                <strong>{{ action.title }}</strong>
                <small>{{ action.detail }}</small>
              </span>
            </a-button>
          </div>

          <a-button block @click="openInstanceList">
            <CloudServerOutlined />
            {{ t("TXT_CODE_DISCORD_OPEN_INSTANCE_LIST") }}
          </a-button>
        </section>
      </a-col>

      <a-col :span="24" :xl="16">
        <a-row :gutter="[20, 20]">
          <a-col v-for="metric in overview?.metrics || []" :key="metric.label" :span="24" :md="12">
            <section class="metric-panel">
              <a-statistic :title="displayText(metric.label)" :value="displayText(metric.value)" />
              <a-tag class="mt-8" :color="statusColor(metric.status)">
                {{ statusText(metric.status) }}
              </a-tag>
              <p>{{ displayText(metric.detail) }}</p>
            </section>
          </a-col>
        </a-row>
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
            {{ t("TXT_CODE_DISCORD_RUNTIME_MONITORING") }}
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

    <a-modal
      v-model:open="showCreateForm"
      :title="t('TXT_CODE_DISCORD_CREATE_MODAL_TITLE')"
      :width="1000"
      :footer="null"
      :destroy-on-close="true"
    >
      <CreateInstanceForm
        :create-method="createForm.createMethod"
        :daemon-id="createForm.daemonId"
        :preset-config="selectedPresetConfig"
        @next-step="handleCreated"
      />
    </a-modal>
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

.quick-create-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-copy {
  margin: 0;
  color: var(--color-gray-10);
  line-height: 1.6;
}

.quick-actions {
  display: grid;
  gap: 10px;
}

.quick-action {
  height: auto;
  min-height: 62px;
  justify-content: flex-start;
  padding: 10px 14px;
  text-align: left;
}

.quick-action-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong,
  small {
    white-space: normal;
    line-height: 1.35;
  }

  small {
    opacity: 0.72;
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

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 992px) {
  .section-title {
    align-items: flex-start;
    flex-wrap: wrap;

    .ant-typography {
      width: 100%;
      margin-left: 0;
    }
  }
}
</style>
