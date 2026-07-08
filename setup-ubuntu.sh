#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/PuneetGOTO/Discord-.git}"
REPO_BRANCH="${REPO_BRANCH:-codex/discord-hosting-platform}"
INSTALL_DIR="${INSTALL_DIR:-/opt/discord-mcsm}"
SERVICE_PREFIX="${SERVICE_PREFIX:-discord-mcsm}"
NODE_MAJOR="${NODE_MAJOR:-20}"
DOMAIN="${DOMAIN:-}"
DOMAIN_EMAIL="${DOMAIN_EMAIL:-}"
DOMAIN_SSL=1
DOMAIN_SSL_ISSUED=0
ASSUME_YES=0
MODE=""
BUILD_ROOT=""
SOURCE_DIR=""

log() {
  printf '\033[1;32m[OK]\033[0m %s\n' "$*"
}

info() {
  printf '\033[1;34m[INFO]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2
}

die() {
  printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n "${BUILD_ROOT}" && -d "${BUILD_ROOT}" ]]; then
    rm -rf "${BUILD_ROOT}"
  fi
}

trap cleanup EXIT

usage() {
  cat <<EOF
Discord MCSManager Ubuntu installer

Usage:
  sudo bash setup-ubuntu.sh
  sudo bash setup-ubuntu.sh --main
  sudo bash setup-ubuntu.sh --node

Options:
  --main              Install main platform: Web panel + local Daemon
  --node              Install remote node: Daemon only
  -y, --yes           Non-interactive defaults where possible
  --install-dir PATH  Install directory, default: ${INSTALL_DIR}
  --branch NAME       Git branch, default: ${REPO_BRANCH}
  --repo URL          Git repository, default: ${REPO_URL}
  --domain DOMAIN     Configure Nginx reverse proxy for the main platform
  --email EMAIL       Email for Let's Encrypt certificate notices
  --no-ssl            Configure domain over HTTP only, skip Let's Encrypt
  -h, --help          Show this help

Environment overrides:
  INSTALL_DIR=/opt/discord-mcsm
  REPO_URL=https://github.com/PuneetGOTO/Discord-.git
  REPO_BRANCH=codex/discord-hosting-platform
  SERVICE_PREFIX=discord-mcsm
  NODE_MAJOR=20
  DOMAIN=panel.example.com
  DOMAIN_EMAIL=admin@example.com
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --main)
        MODE="main"
        shift
        ;;
      --node)
        MODE="node"
        shift
        ;;
      -y|--yes)
        ASSUME_YES=1
        shift
        ;;
      --install-dir)
        INSTALL_DIR="${2:-}"
        [[ -n "${INSTALL_DIR}" ]] || die "--install-dir requires a path"
        shift 2
        ;;
      --branch)
        REPO_BRANCH="${2:-}"
        [[ -n "${REPO_BRANCH}" ]] || die "--branch requires a value"
        shift 2
        ;;
      --repo)
        REPO_URL="${2:-}"
        [[ -n "${REPO_URL}" ]] || die "--repo requires a URL"
        shift 2
        ;;
      --domain)
        DOMAIN="${2:-}"
        [[ -n "${DOMAIN}" ]] || die "--domain requires a value"
        shift 2
        ;;
      --email)
        DOMAIN_EMAIL="${2:-}"
        [[ -n "${DOMAIN_EMAIL}" ]] || die "--email requires a value"
        shift 2
        ;;
      --no-ssl)
        DOMAIN_SSL=0
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
  done
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Please run as root, for example: sudo bash setup-ubuntu.sh"
  fi
}

require_ubuntu() {
  [[ -r /etc/os-release ]] || die "Cannot detect Linux distribution"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || die "This one-click script is designed for Ubuntu. Current OS: ${PRETTY_NAME:-unknown}"
  log "Detected ${PRETTY_NAME}"
}

choose_mode() {
  [[ -n "${MODE}" ]] && return 0

  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    MODE="main"
    return 0
  fi

  cat <<'EOF'

请选择安装类型 / Select install type:
  1. 主平台 Main platform (Web panel + local Daemon)
  2. 节点 Node only (Daemon only)

EOF

  local choice
  read -r -p "输入 1 或 2: " choice
  case "${choice}" in
    1) MODE="main" ;;
    2) MODE="node" ;;
    *) die "Invalid selection: ${choice}" ;;
  esac
}

normalize_domain() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  value="${value%%:*}"
  value="$(printf '%s' "${value}" | tr '[:upper:]' '[:lower:]')"
  printf '%s' "${value}"
}

validate_domain() {
  local value="$1"
  [[ -n "${value}" ]] || return 1
  [[ "${value}" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]]
}

choose_domain() {
  [[ "${MODE}" == "main" ]] || return 0

  if [[ -n "${DOMAIN}" ]]; then
    DOMAIN="$(normalize_domain "${DOMAIN}")"
    validate_domain "${DOMAIN}" || die "Invalid domain: ${DOMAIN}"
    return 0
  fi

  local existing_domain=""
  if [[ -f "/etc/nginx/sites-available/${SERVICE_PREFIX}.conf" ]]; then
    existing_domain="$(awk '/server_name/ {print $2; exit}' "/etc/nginx/sites-available/${SERVICE_PREFIX}.conf" | tr -d ';' || true)"
    existing_domain="$(normalize_domain "${existing_domain}")"
    if validate_domain "${existing_domain}"; then
      DOMAIN="${existing_domain}"
      info "Detected existing domain: ${DOMAIN}"
      return 0
    fi
  fi

  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    return 0
  fi

  local answer
  read -r -p "是否配置域名和 Nginx 反向代理？Configure domain? [y/N]: " answer
  case "${answer}" in
    y|Y|yes|YES)
      read -r -p "请输入域名，例如 panel.example.com: " DOMAIN
      DOMAIN="$(normalize_domain "${DOMAIN}")"
      validate_domain "${DOMAIN}" || die "Invalid domain: ${DOMAIN}"
      read -r -p "Let's Encrypt 邮箱，可留空: " DOMAIN_EMAIL
      read -r -p "是否自动申请 HTTPS 证书？Enable HTTPS? [Y/n]: " answer
      case "${answer}" in
        n|N|no|NO) DOMAIN_SSL=0 ;;
        *) DOMAIN_SSL=1 ;;
      esac
      ;;
    *)
      DOMAIN=""
      ;;
  esac
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

apt_install_base() {
  export DEBIAN_FRONTEND=noninteractive
  info "Installing base packages..."
  apt-get update
  apt-get install -y ca-certificates curl git wget tar xz-utils build-essential gnupg lsb-release rsync
  log "Base packages are ready"
}

current_node_major() {
  if command_exists node; then
    node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0'
  else
    printf '0'
  fi
}

install_nodejs() {
  local major
  major="$(current_node_major)"
  if [[ "${major}" =~ ^[0-9]+$ ]] && (( major >= NODE_MAJOR )); then
    log "Node.js $(node -v) is already installed"
    return 0
  fi

  info "Installing Node.js ${NODE_MAJOR}.x from NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  log "Installed Node.js $(node -v) and npm $(npm -v)"
}

install_docker() {
  export DEBIAN_FRONTEND=noninteractive

  if dpkg -s docker-ce >/dev/null 2>&1 && command_exists docker; then
    info "Docker CE package is already installed"
  else
    info "Installing Docker Engine from Docker's official apt repository..."
    apt-get remove -y docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc || true

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    local codename arch
    # shellcheck disable=SC1091
    . /etc/os-release
    codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
    arch="$(dpkg --print-architecture)"
    [[ -n "${codename}" ]] || die "Cannot detect Ubuntu codename for Docker repository"

    cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${codename}
Components: stable
Architectures: ${arch}
Signed-By: /etc/apt/keyrings/docker.asc
EOF

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  systemctl enable --now docker
  docker info >/dev/null 2>&1 || die "Docker is installed but not responding"
  log "Docker Engine is ready"
}

fetch_source() {
  info "Fetching clean source from ${REPO_URL} (${REPO_BRANCH})..."
  if [[ -e "${INSTALL_DIR}" && ! -d "${INSTALL_DIR}" ]]; then
    die "${INSTALL_DIR} exists but is not a directory."
  fi

  BUILD_ROOT="$(mktemp -d /tmp/discord-mcsm-build.XXXXXX)"
  SOURCE_DIR="${BUILD_ROOT}/source"
  git clone --depth 1 -b "${REPO_BRANCH}" "${REPO_URL}" "${SOURCE_DIR}"
  log "Source is ready in ${SOURCE_DIR}"
}

stop_existing_services() {
  systemctl stop "${SERVICE_PREFIX}-web.service" >/dev/null 2>&1 || true
  systemctl stop "${SERVICE_PREFIX}-daemon.service" >/dev/null 2>&1 || true
}

build_project() {
  info "Building production files. This can take several minutes..."
  cd "${SOURCE_DIR}"
  chmod +x install-dependents.sh build.sh
  ./install-dependents.sh
  ./build.sh
  log "Production build completed"
}

deploy_production() {
  local target="${INSTALL_DIR}/production-code"
  info "Deploying production files to ${target}..."
  mkdir -p "${target}"

  rsync -a --delete \
    --exclude '/daemon/data/' \
    --exclude '/daemon/logs/' \
    --exclude '/web/data/' \
    --exclude '/web/logs/' \
    --exclude '/web/public/upload_files/' \
    "${SOURCE_DIR}/production-code/" \
    "${target}/"

  log "Production files deployed"
}

linux_helper_arch() {
  case "$(uname -m)" in
    x86_64|amd64)
      printf 'x64'
      ;;
    aarch64|arm64)
      printf 'arm64'
      ;;
    *)
      die "Unsupported CPU architecture for helper binaries: $(uname -m). Supported: x86_64, arm64"
      ;;
  esac
}

install_daemon_helpers() {
  local arch lib_dir
  arch="$(linux_helper_arch)"
  lib_dir="${INSTALL_DIR}/production-code/daemon/lib"

  info "Installing Daemon helper binaries for linux_${arch}..."
  mkdir -p "${lib_dir}"
  wget -qO "${lib_dir}/pty_linux_${arch}" "https://github.com/MCSManager/PTY/releases/download/latest/pty_linux_${arch}"
  wget -qO "${lib_dir}/file_zip_linux_${arch}" "https://github.com/MCSManager/Zip-Tools/releases/download/latest/file_zip_linux_${arch}"
  wget -qO "${lib_dir}/7z_linux_${arch}" "https://github.com/MCSManager/Zip-Tools/releases/download/latest/7z_linux_${arch}"
  chmod +x "${lib_dir}/pty_linux_${arch}" "${lib_dir}/file_zip_linux_${arch}" "${lib_dir}/7z_linux_${arch}"
  log "Daemon helper binaries are ready"
}

prepare_runtime_dirs() {
  mkdir -p \
    "${INSTALL_DIR}/production-code/daemon/data/InstanceData" \
    "${INSTALL_DIR}/production-code/daemon/logs" \
    "${INSTALL_DIR}/production-code/web/data" \
    "${INSTALL_DIR}/production-code/web/logs" \
    "${INSTALL_DIR}/production-code/web/public/upload_files"
}

write_daemon_service() {
  cat > "/etc/systemd/system/${SERVICE_PREFIX}-daemon.service" <<EOF
[Unit]
Description=Discord MCSManager Daemon
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/production-code/daemon
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=MCSM_DOCKER_WORKSPACE_PATH=${INSTALL_DIR}/production-code/daemon/data/InstanceData
ExecStart=/usr/bin/node --max-old-space-size=8192 --enable-source-maps app.js
Restart=always
RestartSec=5
TimeoutStopSec=60
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
  log "Wrote ${SERVICE_PREFIX}-daemon.service"
}

write_web_service() {
  cat > "/etc/systemd/system/${SERVICE_PREFIX}-web.service" <<EOF
[Unit]
Description=Discord MCSManager Web Panel
After=network-online.target ${SERVICE_PREFIX}-daemon.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/production-code/web
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/node --max-old-space-size=8192 --enable-source-maps app.js
Restart=always
RestartSec=5
TimeoutStopSec=60
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
  log "Wrote ${SERVICE_PREFIX}-web.service"
}

configure_panel_reverse_proxy() {
  [[ "${MODE}" == "main" && -n "${DOMAIN}" ]] || return 0

  local config_file="${INSTALL_DIR}/production-code/web/data/SystemConfig/config.json"
  mkdir -p "$(dirname "${config_file}")"
  PANEL_CONFIG_FILE="${config_file}" node <<'NODE'
const fs = require("fs");
const file = process.env.PANEL_CONFIG_FILE;
let config = {};
if (fs.existsSync(file)) {
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${file}: ${error.message}`);
  }
}
config.httpIp = "127.0.0.1";
config.httpPort = Number(config.httpPort || 23333);
config.reverseProxyMode = true;
config.reverseProxyHeader = "X-Real-IP";
fs.writeFileSync(file, JSON.stringify(config, null, 4));
NODE
  log "Panel reverse proxy mode is enabled"
}

configure_daemon_browser_proxy() {
  [[ "${MODE}" == "main" && -n "${DOMAIN}" ]] || return 0

  local config_dir="${INSTALL_DIR}/production-code/web/data/RemoteServiceConfig"
  local nginx_snippet="/etc/nginx/snippets/${SERVICE_PREFIX}-daemon-proxies.conf"
  mkdir -p "${config_dir}"
  mkdir -p "$(dirname "${nginx_snippet}")"

  local i
  for i in $(seq 1 30); do
    if find "${config_dir}" -maxdepth 1 -name '*.json' -print -quit 2>/dev/null | grep -q .; then
      break
    fi
    sleep 1
  done

  PANEL_REMOTE_CONFIG_DIR="${config_dir}" DOMAIN_NAME="${DOMAIN}" NGINX_DAEMON_SNIPPET="${nginx_snippet}" node <<'NODE'
const fs = require("fs");
const path = require("path");

const dir = process.env.PANEL_REMOTE_CONFIG_DIR;
const domain = process.env.DOMAIN_NAME;
const snippetFile = process.env.NGINX_DAEMON_SNIPPET;
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".json")) : [];
let changed = 0;
const locations = [
  "# Generated by setup-ubuntu.sh. Do not edit manually.",
  "# Re-run the installer after adding or removing Daemon nodes."
];

function normalizePrefix(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return "/" + raw.replace(/^\/+/, "").replace(/\/+$/, "");
}

function upstreamFor(config) {
  let protocol = "http";
  let host = String(config.ip || "localhost").trim();
  if (/^wss:\/\//i.test(host) || /^https:\/\//i.test(host)) protocol = "https";
  host = host.replace(/^(wss?|https?):\/\//i, "");
  host = host.split("/")[0];
  const port = Number(config.port || 24444);
  const prefix = normalizePrefix(config.prefix);
  return `${protocol}://${host}:${port}${prefix}/`;
}

function locationFor(uuid, config) {
  const safeUuid = uuid.replace(/[^a-zA-Z0-9_-]/g, "_");
  const publicPrefix = `/_daemon/${safeUuid}`;
  return {
    publicPrefix,
    text: `
    location ${publicPrefix}/ {
        proxy_pass ${upstreamFor(config)};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $discord_mcsm_connection_upgrade;
        proxy_ssl_server_name on;
        proxy_buffering off;
    }`
  };
}

for (const fileName of files) {
  const file = path.join(dir, fileName);
  const uuid = path.basename(fileName, ".json");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    continue;
  }

  const generated = locationFor(uuid, config);
  locations.push(generated.text);

  const nextMappings = [{
    from: { ip: domain, port: 443, prefix: "" },
    to: { ip: domain, port: 443, prefix: generated.publicPrefix }
  }, {
    from: { ip: domain, port: 80, prefix: "" },
    to: { ip: domain, port: 80, prefix: generated.publicPrefix }
  }];
  const mappings = Array.isArray(config.remoteMappings) ? config.remoteMappings : [];
  const filtered = mappings.filter(
    (entry) =>
      !(
        entry?.from?.ip === domain &&
        (Number(entry?.from?.port) === 443 || Number(entry?.from?.port) === 80) &&
        String(entry?.from?.prefix || "") === ""
      )
  );
  filtered.push(...nextMappings);
  config.remoteMappings = filtered;

  fs.writeFileSync(file, JSON.stringify(config, null, 4));
  changed += 1;
}

if (locations.length === 2) {
  locations.push("# No Daemon nodes were found yet.");
}
fs.writeFileSync(snippetFile, locations.join("\n") + "\n");
console.log(changed);
NODE
  nginx -t
  systemctl reload nginx
  systemctl restart "${SERVICE_PREFIX}-web.service"
  systemctl --no-pager --full status "${SERVICE_PREFIX}-web.service" >/dev/null
  log "Daemon browser proxy mappings are configured under https://${DOMAIN}/_daemon/<node-id>/"
}

configure_domain_proxy() {
  [[ "${MODE}" == "main" && -n "${DOMAIN}" ]] || return 0

  info "Configuring domain ${DOMAIN} with Nginx..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y nginx certbot python3-certbot-nginx

  mkdir -p /etc/nginx/snippets
  if [[ ! -f "/etc/nginx/snippets/${SERVICE_PREFIX}-daemon-proxies.conf" ]]; then
    cat > "/etc/nginx/snippets/${SERVICE_PREFIX}-daemon-proxies.conf" <<'EOF'
# Generated by setup-ubuntu.sh after the Panel creates Daemon node records.
EOF
  fi

  cat > "/etc/nginx/conf.d/${SERVICE_PREFIX}-websocket.conf" <<'EOF'
map $http_upgrade $discord_mcsm_connection_upgrade {
    default upgrade;
    '' close;
}
EOF

  cat > "/etc/nginx/sites-available/${SERVICE_PREFIX}.conf" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 1024m;
    proxy_connect_timeout 60s;
    proxy_send_timeout 3600s;
    proxy_read_timeout 3600s;

    location / {
        proxy_pass http://127.0.0.1:23333;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$discord_mcsm_connection_upgrade;
        proxy_buffering off;
    }

    location /_daemon/ {
        proxy_pass http://127.0.0.1:24444/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$discord_mcsm_connection_upgrade;
        proxy_buffering off;
    }

    include /etc/nginx/snippets/${SERVICE_PREFIX}-daemon-proxies.conf;
}
EOF

  ln -sf "/etc/nginx/sites-available/${SERVICE_PREFIX}.conf" "/etc/nginx/sites-enabled/${SERVICE_PREFIX}.conf"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
  log "Nginx reverse proxy is ready for http://${DOMAIN}/"

  if [[ "${DOMAIN_SSL}" -eq 1 ]]; then
    info "Requesting Let's Encrypt certificate for ${DOMAIN}..."
    local certbot_args=(--nginx -d "${DOMAIN}" --redirect --non-interactive --agree-tos)
    if [[ -n "${DOMAIN_EMAIL}" ]]; then
      certbot_args+=(--email "${DOMAIN_EMAIL}")
    else
      certbot_args+=(--register-unsafely-without-email)
    fi

    if certbot "${certbot_args[@]}"; then
      DOMAIN_SSL_ISSUED=1
      systemctl reload nginx
      log "HTTPS is ready for https://${DOMAIN}/"
    else
      warn "Let's Encrypt certificate request failed. Check DNS A/AAAA records and ports 80/443, then rerun with --domain ${DOMAIN}."
      warn "HTTP reverse proxy remains available at http://${DOMAIN}/"
    fi
  fi
}

start_services() {
  systemctl daemon-reload
  systemctl enable --now "${SERVICE_PREFIX}-daemon.service"

  if [[ "${MODE}" == "main" ]]; then
    sleep 2
    systemctl enable --now "${SERVICE_PREFIX}-web.service"
  else
    systemctl disable --now "${SERVICE_PREFIX}-web.service" >/dev/null 2>&1 || true
  fi

  systemctl --no-pager --full status "${SERVICE_PREFIX}-daemon.service" >/dev/null
  if [[ "${MODE}" == "main" ]]; then
    systemctl --no-pager --full status "${SERVICE_PREFIX}-web.service" >/dev/null
  fi
  log "systemd services are running"
}

pull_bot_images() {
  info "Pulling Discord bot runtime images..."
  docker pull node:22-alpine
  docker pull python:3.12-slim
  log "Bot runtime images are ready"
}

configure_ufw_if_active() {
  if ! command_exists ufw; then
    return 0
  fi

  if ufw status 2>/dev/null | grep -qi "Status: active"; then
    if [[ "${MODE}" == "main" ]]; then
      if [[ -n "${DOMAIN}" ]]; then
        ufw allow 80/tcp
        ufw allow 443/tcp
        log "UFW rules added for domain ports 80/tcp and 443/tcp"
        warn "Direct Web panel port 23333/tcp and Daemon port 24444/tcp were not opened."
      else
        ufw allow 23333/tcp
        log "UFW rule added for Web panel port 23333/tcp"
        warn "Daemon port 24444/tcp was not opened. Keep it private unless you run remote nodes."
      fi
    else
      ufw allow 24444/tcp
      log "UFW rule added for node Daemon port 24444/tcp"
    fi
  else
    warn "UFW is not active. Open port 23333/tcp for main platform or 24444/tcp for remote nodes if your provider firewall blocks them."
  fi
}

server_ip() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

daemon_key() {
  local config_file="${INSTALL_DIR}/production-code/daemon/data/Config/global.json"
  local i
  for i in $(seq 1 30); do
    [[ -f "${config_file}" ]] && break
    sleep 1
  done
  DAEMON_CONFIG_FILE="${config_file}" node -e 'const fs=require("fs"); const f=process.env.DAEMON_CONFIG_FILE; if (fs.existsSync(f)) console.log(JSON.parse(fs.readFileSync(f, "utf8")).key || "");' 2>/dev/null || true
}

print_summary() {
  local ip key open_url
  ip="$(server_ip)"
  key="$(daemon_key)"
  if [[ -z "${key}" ]]; then
    key="check with: journalctl -u ${SERVICE_PREFIX}-daemon -n 80 --no-pager"
  fi

  if [[ -n "${DOMAIN}" ]]; then
    if [[ "${DOMAIN_SSL_ISSUED}" -eq 1 ]]; then
      open_url="https://${DOMAIN}/"
    else
      open_url="http://${DOMAIN}/"
    fi
  else
    open_url="http://${ip:-your-server-ip}:23333/"
  fi

  cat <<EOF

============================================================
Installation complete
============================================================
Install directory: ${INSTALL_DIR}
Branch: ${REPO_BRANCH}

Services:
  systemctl status ${SERVICE_PREFIX}-daemon
EOF

  if [[ "${MODE}" == "main" ]]; then
    cat <<EOF
  systemctl status ${SERVICE_PREFIX}-web

Open:
  ${open_url}

Discord bot hosting:
  Admin panel -> Discord Hosting -> select node -> Create Node.js container or Create Python container

EOF
    if [[ -n "${DOMAIN}" ]]; then
      cat <<EOF
Domain proxy:
  nginx config: /etc/nginx/sites-available/${SERVICE_PREFIX}.conf
  daemon path:  ${open_url%/}/_daemon/
  nginx logs:   /var/log/nginx/access.log /var/log/nginx/error.log

EOF
    fi
  else
    cat <<EOF

Add this node in the main panel:
  URL: ws://${ip:-your-node-ip}:24444
  Key: ${key}

EOF
  fi

  cat <<EOF
Useful commands:
  journalctl -u ${SERVICE_PREFIX}-daemon -f
EOF

  if [[ "${MODE}" == "main" ]]; then
    cat <<EOF
  journalctl -u ${SERVICE_PREFIX}-web -f
EOF
  fi

  cat <<'EOF'

Security note:
  Do not store Discord bot tokens inside source files. Use the DISCORD_TOKEN environment variable.
============================================================

EOF
}

main() {
  parse_args "$@"
  require_root
  require_ubuntu
  choose_mode
  choose_domain

  info "Mode: ${MODE}"
  [[ -n "${DOMAIN}" ]] && info "Domain: ${DOMAIN}"
  apt_install_base
  install_nodejs
  install_docker
  fetch_source
  build_project
  stop_existing_services
  deploy_production
  install_daemon_helpers
  prepare_runtime_dirs
  write_daemon_service
  [[ "${MODE}" == "main" ]] && write_web_service
  configure_panel_reverse_proxy
  start_services
  configure_ufw_if_active
  configure_domain_proxy
  configure_daemon_browser_proxy
  pull_bot_images
  print_summary
}

main "$@"
