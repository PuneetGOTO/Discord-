<div align="center">
  <a href="https://mcsmanager.com/" target="_blank">
    <img src="https://public-link.oss-cn-shenzhen.aliyuncs.com/mcsm_picture/logo.png" alt="MCSManagerLogo.png" width="510px" />    
  </a>

  <br />
  <br />

[![--](https://img.shields.io/badge/Support%20Platform-Windows/Linux/Mac-green.svg)](https://github.com/MCSManager)
[![Status](https://img.shields.io/badge/NPM-v8.9.14-blue.svg)](https://www.npmjs.com/)
[![Status](https://img.shields.io/badge/Node-v16.20.2-blue.svg)](https://nodejs.org/en/download/)
[![Status](https://img.shields.io/badge/License-Apache%202.0-red.svg)](https://github.com/MCSManager)

<p align="center">
  <a href="http://mcsmanager.com/"><img alt="Official Website" src="https://img.shields.io/badge/Site-Official Website-yellow"></a>
  <a href="https://docs.mcsmanager.com/"><img alt="EnglishDocs" src="https://img.shields.io/badge/Docs-English Document-blue"></a>
  <a href="https://discord.gg/BNpYMVX7Cd"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join Us-5866f4"></a>
  
</p>

<br />

[English](README.md) - [简体中文](README_ZH.md) - [繁體中文](README_TW.md) - [日本語](README_JP.md) - [Deutsch](README_DE.md) - [Русский](README_RU.md) - [Spanish](README_ES.md) - [Thai](README_TH.md) - [Français](README_FR.md) - [Português BR](README_PTBR.md)

</div>

<br />

## What is this?

**MCSManager Panel** (or simply **MCSM Panel**) is a fast-deploying, distributed, multi-user, and modern web-based management panel for **`Minecraft`**, **`Steam`**, and other game servers.

MCSManager has gained popularity within the **`Minecraft`** and **`Steam`** gaming communities. It enables you to manage multiple physical or virtual servers from a single platform, and offers a **secure**, **reliable**, and **granular multi-user permission system**. The MCSM Panel continues to support server administrators, operators, and independent developers, managing servers like **`Minecraft`**, **`Terraria`**, and other **`Steam`**-based games for them.

MCSM also has **commercial applications** in mind, such as private server hosting and sales by **IDC service providers**. Several small and medium-sized enterprises already use the panel as a combined **server management** and **sales platform**. In addition, it supports **multi-language environments**, making it accessible to users across different countries and regions.

<img width="1871" height="1342" alt="terminal" src="https://github.com/user-attachments/assets/7f6ed988-e402-4347-94ee-a0469f6658da" />

<img width="1915" height="1386" alt="market" src="https://github.com/user-attachments/assets/fc276180-a826-476a-803e-a038f97115fc" />

<img width="3164" height="2060" alt="1" src="https://github.com/user-attachments/assets/570d2447-66dc-4c0b-b2d2-4c3176b51d67" />

<img width="3164" height="2060" alt="3" src="https://github.com/user-attachments/assets/2722cf9f-de9b-4630-b0ea-c00283791d8d" />

<br />

## Features

1. One-click deployment of **`Minecraft`** or **`Steam`** game servers via the built-in application marketplace.
2. Compatible with most **`Steam`**-based game servers, including **`Palworld`**, **`Squad`**, **`Project Zomboid`**, **`Terraria`**, and more.
3. Customizable web interface with drag-and-drop card layout to build your ideal dashboard.
4. Full **Docker Hub** image support, with built-in multi-user access and support for commercial instance hosting services.
5. Distributed architecture, managing multiple machines from a single web panel.
6. Lightweight technology stack. The entire project can be developed and maintained with TypeScript alone.
7. ...and much more.

<br />

## Runtime Environment

The control panel runs on both **`Windows`** and **`Linux`** platforms. No database installation is required. Simply install the **`Node.js`** runtime and a few basic **decompression utilities**.

> Requires **[Node.js 16.20.2](https://nodejs.org/en)** or higher.
> It is recommended to use the **latest LTS version** for best compatibility and stability.

<br />

## Official Documentation

English: https://docs.mcsmanager.com/

Chinese: https://docs.mcsmanager.com/zh_cn/

<br />

## Installation

### Ubuntu 22.04/24.04 (recommended for this Discord hosting fork)

This is the primary deployment path for this fork. It builds the current
`PuneetGOTO/Discord-` source branch instead of downloading the upstream
MCSManager release, so the Discord Bot Hosting page and the Node.js/Python bot
presets are included.

#### One-click installer

The one-click script can install either the main platform or a remote node. It
installs Node.js, Docker Engine, project dependencies, Daemon helper binaries,
production files, systemd services and basic firewall rules when UFW is already
active.

The script builds from a clean temporary clone on every run, then deploys the
compiled files into `/opt/discord-mcsm/production-code`. Existing runtime data,
logs and uploaded files are preserved, so it can be rerun after an interrupted
installation or during upgrades.

Interactive mode:

```bash
curl -fsSL https://github.com/PuneetGOTO/Discord-/raw/refs/heads/codex/discord-hosting-platform/setup-ubuntu.sh | sudo bash
```

Install the main platform directly:

```bash
curl -fsSL https://github.com/PuneetGOTO/Discord-/raw/refs/heads/codex/discord-hosting-platform/setup-ubuntu.sh | sudo bash -s -- --main
```

Install the main platform and configure a domain with Nginx + Let's Encrypt:

```bash
curl -fsSL https://github.com/PuneetGOTO/Discord-/raw/refs/heads/codex/discord-hosting-platform/setup-ubuntu.sh | sudo bash -s -- --main --domain panel.example.com --email admin@example.com
```

Before using `--domain`, point the domain's DNS A/AAAA record to this server
and make sure ports `80/tcp` and `443/tcp` are reachable from the internet. If
you only want HTTP reverse proxy without HTTPS, add `--no-ssl`.

When a domain is configured, the installer also proxies Daemon browser traffic
under `/_daemon/<node-id>/` and writes the matching node remote mapping. This
prevents the node list from showing `Browser direct connection` errors when the
panel is opened through HTTPS or when port `24444` is not exposed publicly.

Install a remote node directly:

```bash
curl -fsSL https://github.com/PuneetGOTO/Discord-/raw/refs/heads/codex/discord-hosting-platform/setup-ubuntu.sh | sudo bash -s -- --node
```

You can also clone the repository and run the script locally:

```bash
git clone -b codex/discord-hosting-platform https://github.com/PuneetGOTO/Discord-.git
cd Discord-
sudo bash setup-ubuntu.sh
```

The default installation path is `/opt/discord-mcsm`. Override it when needed:

```bash
curl -fsSL https://github.com/PuneetGOTO/Discord-/raw/refs/heads/codex/discord-hosting-platform/setup-ubuntu.sh | sudo INSTALL_DIR=/data/discord-mcsm bash -s -- --main
```

The manual deployment steps below are kept for operators who want to audit or
customize every command.

#### 1. Install base packages and Node.js

Use Node.js 20 LTS for the most predictable build/runtime behavior with this
project.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git wget tar xz-utils build-essential

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
```

#### 2. Install Docker Engine

Discord bot instances are created as Docker containers, so Docker must be
available to the Daemon host.

```bash
# Optional cleanup if unofficial Docker packages were installed before.
sudo apt remove -y docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc || true

# Add Docker's official apt repository.
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
```

If you plan to run MCSManager as a non-root service user, add that user to the
`docker` group and log in again. For a simple single-server deployment, running
the Daemon service as root is the least surprising option because it can access
`/var/run/docker.sock` directly.

#### 3. Download this fork and build production files

```bash
sudo mkdir -p /opt/discord-mcsm
sudo chown -R "$USER":"$USER" /opt/discord-mcsm
cd /opt/discord-mcsm

git clone -b codex/discord-hosting-platform https://github.com/PuneetGOTO/Discord-.git .

chmod +x install-dependents.sh build.sh
./install-dependents.sh
./build.sh
```

The build output will be written to:

```text
/opt/discord-mcsm/production-code/
```

#### 4. Add Linux Daemon binary dependencies

The Daemon needs the PTY and Zip helper binaries for terminal and file
management features. The commands below are for Ubuntu x64. On ARM servers,
replace `x64` with `arm64`.

```bash
mkdir -p /opt/discord-mcsm/production-code/daemon/lib
cd /opt/discord-mcsm/production-code/daemon/lib

wget -O pty_linux_x64 https://github.com/MCSManager/PTY/releases/download/latest/pty_linux_x64
wget -O file_zip_linux_x64 https://github.com/MCSManager/Zip-Tools/releases/download/latest/file_zip_linux_x64
wget -O 7z_linux_x64 https://github.com/MCSManager/Zip-Tools/releases/download/latest/7z_linux_x64

chmod +x pty_linux_x64 file_zip_linux_x64 7z_linux_x64
```

#### 5. Create systemd services

Create the Daemon service:

```bash
sudo tee /etc/systemd/system/discord-mcsm-daemon.service > /dev/null <<'EOF'
[Unit]
Description=Discord MCSManager Daemon
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/discord-mcsm/production-code/daemon
Environment=NODE_ENV=production
Environment=MCSM_DOCKER_WORKSPACE_PATH=/opt/discord-mcsm/production-code/daemon/data/InstanceData
ExecStart=/usr/bin/node --max-old-space-size=8192 app.js
Restart=always
RestartSec=5
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
```

Create the Web panel service:

```bash
sudo tee /etc/systemd/system/discord-mcsm-web.service > /dev/null <<'EOF'
[Unit]
Description=Discord MCSManager Web Panel
After=network-online.target discord-mcsm-daemon.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/discord-mcsm/production-code/web
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --max-old-space-size=8192 app.js
Restart=always
RestartSec=5
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start both services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now discord-mcsm-daemon discord-mcsm-web

sudo systemctl status discord-mcsm-daemon --no-pager
sudo systemctl status discord-mcsm-web --no-pager
```

#### 6. Open the panel

Open the Web panel in your browser:

```text
http://<your-server-ip>:23333/
```

For a single-machine deployment, keep the Daemon bound to the same server and
avoid exposing port `24444` to the public internet. If you use `ufw`, a minimal
single-server setup is:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 23333/tcp
sudo ufw enable
```

Only open `24444/tcp` to trusted panel IPs when you intentionally run remote
Daemon nodes.

#### 7. Create Discord bot servers

After logging in as an administrator:

1. Open `Discord Hosting`.
2. Select a node.
3. Choose `Create Node.js container` or `Create Python container`.
4. Upload or create the bot project.
5. Store the bot token as the `DISCORD_TOKEN` environment variable. Do not put
   the token in source files or uploaded archives.

The Node.js preset expects a project with `package.json` and `npm start`. It
loads `.env`, installs dependencies only when `node_modules` is missing, and
uses `npm ci --omit=dev` when `package-lock.json` exists:

```bash
sh -lc "set -a; [ -f .env ] && . ./.env; set +a; if [ ! -d node_modules ]; then if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi; fi; npm start"
```

The Python preset expects `requirements.txt` and `bot.py`, and starts with:

```bash
sh -lc "set -a; [ -f .env ] && . ./.env; set +a; [ -d .venv ] || python -m venv .venv; . .venv/bin/activate; if [ -f requirements.txt ]; then python -m pip install --disable-pip-version-check --root-user-action=ignore -r requirements.txt; fi; python ${PYTHON_BOT_ENTRY:-bot.py}"
```

The presets automatically load a project-level `.env` file before starting the
bot. Use normal dotenv lines such as `DISCORD_TOKEN=your_token_here`. Do not set
placeholder container variables like `DISCORD_TOKEN=${DISCORD_TOKEN}`; that
literal value can override `.env` loading in many bot frameworks.

#### 8. Update this deployment later

```bash
cd /opt/discord-mcsm
sudo systemctl stop discord-mcsm-web discord-mcsm-daemon

git pull
./install-dependents.sh
./build.sh

mkdir -p production-code/daemon/lib
cd production-code/daemon/lib
wget -O pty_linux_x64 https://github.com/MCSManager/PTY/releases/download/latest/pty_linux_x64
wget -O file_zip_linux_x64 https://github.com/MCSManager/Zip-Tools/releases/download/latest/file_zip_linux_x64
wget -O 7z_linux_x64 https://github.com/MCSManager/Zip-Tools/releases/download/latest/7z_linux_x64
chmod +x pty_linux_x64 file_zip_linux_x64 7z_linux_x64

sudo systemctl start discord-mcsm-daemon discord-mcsm-web
```

#### Development or local testing on Ubuntu

For local development, use:

```bash
git clone -b codex/discord-hosting-platform https://github.com/PuneetGOTO/Discord-.git
cd Discord-
./install-dependents.sh

mkdir -p daemon/lib
wget -O daemon/lib/pty_linux_x64 https://github.com/MCSManager/PTY/releases/download/latest/pty_linux_x64
wget -O daemon/lib/file_zip_linux_x64 https://github.com/MCSManager/Zip-Tools/releases/download/latest/file_zip_linux_x64
wget -O daemon/lib/7z_linux_x64 https://github.com/MCSManager/Zip-Tools/releases/download/latest/7z_linux_x64
chmod +x daemon/lib/*

npm run dev
```

Development ports:

- Frontend: `http://localhost:5173/`
- Web panel API: `http://localhost:23333/`
- Daemon: `http://localhost:24444/`

<br />

### Windows

**For Windows systems, it comes as a ready-to-run integrated version - download and run it immediately.**

Archive: https://download.mcsmanager.com/mcsmanager_windows_release.zip

Double-click `start.bat` to launch both the web panel and daemon process.

<br />

### Linux

**One-line command quick installation**

```bash
sudo su -c "wget -qO- https://script.mcsmanager.com/setup.sh | bash"
```

**Usage after installation**

```bash
systemctl start mcsm-{web,daemon} # Start panel
systemctl stop mcsm-{web,daemon}  # Stop panel
```

- Script only applies to Ubuntu/Centos/Debian/Archlinux
- Panel code and runtime environment are automatically installed in the `/opt/mcsmanager/` directory.

<br />

**Linux Manual Installation**

- If the one-click installation method doesn't work, you can install MCSManager manually by following the steps below:

```bash
# Step 1: Navigate to the installation directory (create it if it doesn't exist)
cd /opt/

# Step 2: (Optional) Download and install Node.js if it's not already installed
wget https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz
tar -xvf node-v20.11.0-linux-x64.tar.xz

# Add Node.js and npm to the system path
ln -s /opt/node-v20.11.0-linux-x64/bin/node /usr/bin/node
ln -s /opt/node-v20.11.0-linux-x64/bin/npm /usr/bin/npm

# Step 3: Prepare the MCSManager installation directory
mkdir /opt/mcsmanager/
cd /opt/mcsmanager/

# Step 4: Download the latest MCSManager release
wget https://github.com/MCSManager/MCSManager/releases/latest/download/mcsmanager_linux_release.tar.gz
tar -zxf mcsmanager_linux_release.tar.gz

# Step 5: Install dependencies
chmod 775 install.sh
./install.sh

# Step 6: Open two terminal windows or use screen/tmux

# In the first terminal: start the daemon
./start-daemon.sh

# In the second terminal: start the web service
./start-web.sh

# Step 7: Access the panel in your browser
# Replace <public IP> with your server's actual IP address
http://<public IP>:23333/

# The web interface will automatically detect and connect to the local daemon in most cases.
```

> The above steps do **not** register the panel as a system service.  
> To keep it running in the background, you’ll need to use tools like **`screen`** or **`tmux`**.

If you prefer to run MCSManager as a system service, please refer to the official documentation for setup instructions.

<br />

### Mac OS

```bash

# Step 1: Install Node.js (skip if already installed)
# It's recommended to use the latest LTS version
brew install node
node -v
npm -v

# Step 2: Download the latest release using curl
curl -L https://github.com/MCSManager/MCSManager/releases/latest/download/mcsmanager_linux_release.tar.gz -o mcsmanager_linux_release.tar.gz

# Step 3: Extract the downloaded archive
tar -zxf mcsmanager_linux_release.tar.gz

# Step 4: Enter the extracted directory
cd mcsmanager

# Step 5: Make the installer executable and run it
chmod 775 install.sh
./install.sh

# Step 6: Open two terminal windows or use screen/tmux to run services in parallel

# In the first terminal: start the daemon
./start-daemon.sh

# In the second terminal: start the web service
./start-web.sh

# Access the panel at: http://localhost:23333/
# The web interface will typically auto-detect and connect to the local daemon.
```

<br />

### Docker Installation

Install the panel using docker-compose.yml, note that you need to modify all `<CHANGE_ME_TO_INSTALL_PATH>` in it to your actual installation directory.

```yml
services:
  web:
    image: githubyumao/mcsmanager-web:latest
    ports:
      - "23333:23333"
    volumes:
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
      - <CHANGE_ME_TO_INSTALL_PATH>/web/data:/opt/mcsmanager/web/data
      - <CHANGE_ME_TO_INSTALL_PATH>/web/logs:/opt/mcsmanager/web/logs
      - <CHANGE_ME_TO_INSTALL_PATH>/web/public/upload_files:/opt/mcsmanager/web/public/upload_files

  daemon:
    image: githubyumao/mcsmanager-daemon:latest
    restart: unless-stopped
    ports:
      - "24444:24444"
    environment:
      - MCSM_DOCKER_WORKSPACE_PATH=<CHANGE_ME_TO_INSTALL_PATH>/daemon/data/InstanceData
    volumes:
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
      - <CHANGE_ME_TO_INSTALL_PATH>/daemon/data:/opt/mcsmanager/daemon/data
      - <CHANGE_ME_TO_INSTALL_PATH>/daemon/logs:/opt/mcsmanager/daemon/logs
      - /var/run/docker.sock:/var/run/docker.sock
```

Note (Rootless Docker on Linux): the daemon supports `DOCKER_HOST`. If your Docker daemon runs in rootless mode, the socket is usually at `/run/user/<uid>/docker.sock` instead of `/var/run/docker.sock`. In that case, replace the default socket mount with the rootless socket and set `DOCKER_HOST`, for example:

```yml
  daemon:
    environment:
      - DOCKER_HOST=unix:///run/user/1000/docker.sock
    volumes:
      - /run/user/1000/docker.sock:/run/user/1000/docker.sock
```

Replace `1000` with your actual UID (`id -u`).

Enable using docker-compose.

```bash
mkdir -p <CHANGE_ME_TO_INSTALL_PATH>
cd <CHANGE_ME_TO_INSTALL_PATH>
vim docker-compose.yml # Write the above docker-compose.yml content here
docker compose pull && docker compose up -d
```

Note: After Docker installation, the Web side may no longer be able to automatically connect to the Daemon.

At this point, if you enter the panel, you should see some errors because the Web side has not successfully connected to the daemon side, you need to create a new node to connect them together.

<br />

## Contributing Code

Before contributing code to this project, please make sure to review the following:

- **Must read:** [Issue #599 – Contribution Guidelines](https://github.com/MCSManager/MCSManager/issues/599)
- Please maintain the existing code structure and formatting, **do not apply unnecessary or excessive formatting changes.**
- All submitted code **must follow internationalization (i18n) standards**.

### Bug Reports

We welcome all bug reports and feedback. Your contributions help us improve the project.

If you encounter any issues, please report them via the [GitHub Issues](https://github.com/MCSManager/MCSManager/issues) page, and we’ll address them as soon as possible.

For serious **security vulnerabilities** that should not be disclosed publicly, please contact us directly at: **support@mcsmanager.com**

Once resolved, we will credit the discoverer in the relevant code or release notes.

### Acknowledgements

Thanks to the following developers for making important contributions to the security testing of MCSManager!

> [@Cuo256](https://github.com/Cuo256), [@xiaosu](https://github.com/xiaosuawa), [@tianjiefeifei](https://github.com/tianjiefeifei)

<br />

## Development

### Project Structure

The project comprises three core modules:

- Daemon backend (`daemon` directory)
- Web backend (`panel` directory)
- Web frontend (`frontend` directory)

**Web Backend Responsibilities:**

- User management
- Node connectivity
- Authentication and authorization
- API services

**Daemon Backend Responsibilities:**

- Process management for server instances
- Docker container operations
- File system management
- Real-time terminal access

**Web Frontend Responsibilities:**

- User interface implementation
- Web backend integration
- Direct node communication for optimized performance

### Setting Up Development Environment

See: [DEVELOPMENT.md](./DEVELOPMENT.md)

<br />

## Browser Compatibility

MCSManager supports all major modern browsers, including:

- `Chrome`
- `Firefox`
- `Safari`
- `Opera`

**Internet Explorer (IE)** is no longer supported.

<br />


## Contributors

<a href="https://openomy.com/MCSManager/MCSManager" target="_blank" style="display: block; width: 100%;" align="center">
  <img src="https://openomy.com/svg?repo=MCSManager/MCSManager&chart=bubble&latestMonth=12" target="_blank" alt="Contribution Leaderboard" style="display: block; width: 100%;" />
</a>

## License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

&copy; 2025 MCSManager. All rights reserved.
