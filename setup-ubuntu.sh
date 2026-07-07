#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/PuneetGOTO/Discord-.git}"
REPO_BRANCH="${REPO_BRANCH:-codex/discord-hosting-platform}"
INSTALL_DIR="${INSTALL_DIR:-/opt/discord-mcsm}"
SERVICE_PREFIX="${SERVICE_PREFIX:-discord-mcsm}"
NODE_MAJOR="${NODE_MAJOR:-20}"
ASSUME_YES=0
MODE=""

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
  -h, --help          Show this help

Environment overrides:
  INSTALL_DIR=/opt/discord-mcsm
  REPO_URL=https://github.com/PuneetGOTO/Discord-.git
  REPO_BRANCH=codex/discord-hosting-platform
  SERVICE_PREFIX=discord-mcsm
  NODE_MAJOR=20
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

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

apt_install_base() {
  export DEBIAN_FRONTEND=noninteractive
  info "Installing base packages..."
  apt-get update
  apt-get install -y ca-certificates curl git wget tar xz-utils build-essential gnupg lsb-release
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

clone_or_update_source() {
  info "Preparing source at ${INSTALL_DIR}..."
  mkdir -p "$(dirname "${INSTALL_DIR}")"

  if [[ -e "${INSTALL_DIR}" ]] && [[ ! -d "${INSTALL_DIR}" ]]; then
    die "${INSTALL_DIR} exists but is not a directory."
  fi

  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    git config --global --add safe.directory "${INSTALL_DIR}" >/dev/null 2>&1 || true
    if [[ -n "$(git -C "${INSTALL_DIR}" status --porcelain)" ]]; then
      die "${INSTALL_DIR} has uncommitted changes. Commit/stash them or use another INSTALL_DIR."
    fi
    git -C "${INSTALL_DIR}" fetch origin "${REPO_BRANCH}"
    git -C "${INSTALL_DIR}" checkout -B "${REPO_BRANCH}" FETCH_HEAD
  else
    if [[ -e "${INSTALL_DIR}" ]] && [[ -n "$(find "${INSTALL_DIR}" -mindepth 1 -maxdepth 1 2>/dev/null)" ]]; then
      die "${INSTALL_DIR} exists and is not empty. Use another INSTALL_DIR or clean it first."
    fi
    git clone -b "${REPO_BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
  fi

  log "Source is ready: ${REPO_URL} (${REPO_BRANCH})"
}

stop_existing_services() {
  systemctl stop "${SERVICE_PREFIX}-web.service" >/dev/null 2>&1 || true
  systemctl stop "${SERVICE_PREFIX}-daemon.service" >/dev/null 2>&1 || true
}

build_project() {
  info "Building production files. This can take several minutes..."
  cd "${INSTALL_DIR}"
  chmod +x install-dependents.sh build.sh
  ./install-dependents.sh
  ./build.sh
  log "Production build completed"
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
      ufw allow 23333/tcp
      log "UFW rule added for Web panel port 23333/tcp"
      warn "Daemon port 24444/tcp was not opened. Keep it private unless you run remote nodes."
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
  local ip key
  ip="$(server_ip)"
  key="$(daemon_key)"
  if [[ -z "${key}" ]]; then
    key="check with: journalctl -u ${SERVICE_PREFIX}-daemon -n 80 --no-pager"
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
  http://${ip:-your-server-ip}:23333/

Discord bot hosting:
  Admin panel -> Discord Hosting -> select node -> Create Node.js container or Create Python container

EOF
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

  info "Mode: ${MODE}"
  apt_install_base
  install_nodejs
  install_docker
  clone_or_update_source
  stop_existing_services
  build_project
  install_daemon_helpers
  prepare_runtime_dirs
  write_daemon_service
  [[ "${MODE}" == "main" ]] && write_web_service
  start_services
  pull_bot_images
  configure_ufw_if_active
  print_summary
}

main "$@"
