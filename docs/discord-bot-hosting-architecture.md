# Discord Bot Hosting Architecture

This feature should be treated as a controlled hosting platform, not as a generic
Node.js/Python process template. The primary risk is shared outbound IP damage:
one abusive or badly written bot can create enough 401, 403, 429, spam, or
reconnect traffic to affect every tenant behind the same egress address.

## Target Architecture

1. Panel control plane
   - Bot onboarding form and review queue.
   - Manifest policy engine: runtime, library, intents, scale estimate, behavior
     flags, token storage, outbound path, privacy policy and owner contact.
   - Operator approvals and immutable audit trail for scope changes.
   - Secret references only; never store bot tokens in instance files.

2. Daemon worker runtime
   - One bot per isolated container or process jail.
   - No privileged mode, no host networking, no Docker socket mount.
   - CPU, RAM, pid, disk and restart-loop quotas.
   - Read-only base image plus small writable data volume.
   - Runtime env injection from the panel secret vault.

3. Discord egress gateway
   - Bot containers cannot reach the public internet directly.
   - Discord REST and Gateway traffic must pass through the gateway.
   - The gateway tracks bot ID, tenant ID, route bucket, token bucket, status
     code, invalid-request budget and websocket reconnect rate.
   - Use separate egress IP pools for production, trial, review and quarantine
     workloads.

4. Rate-limit and abuse fuse
   - Respect Discord rate-limit response headers per route.
   - Apply a conservative global per-bot request budget.
   - Count 401, 403 and 429 responses per bot and per egress IP in a 10 minute
     window.
   - Suspend bot traffic before the shared IP approaches Discord's invalid
     request threshold.
   - Quarantine bots that create mass messages, direct-message bursts, gateway
     reconnect storms or webhook spikes.

5. Observability
   - Per-bot deploy log, console log, rate-limit incidents and restart history.
   - Egress dashboard for REST requests, Gateway sessions, invalid requests,
     429s, message-send volume and quarantine events.
   - Operator notifications when any tenant consumes too much invalid-request
     budget.

## Deployment Gates

- Application ID and owner contact are present.
- The bot uses a bot token, never a user account token.
- No selfbot, raid, spam, scraping, token-harvesting, captcha-bypass or malware
  behavior is declared or detected.
- Tokens are injected from a secret vault and are masked from logs.
- Privileged intents have justification, privacy policy and manual approval.
- Direct outbound network access is disabled.
- REST and Gateway traffic is metered by the Discord egress gateway.
- Restart backoff and jitter are enabled.
- Runtime resource limits are enforced.

## Rollout Phases

1. Phase 1: policy surface
   - Add panel route, overview UI and manifest preflight API.
   - Block high-risk manifests before deployment.
   - Document required network and daemon enforcement.

2. Phase 2: managed runtime
   - Add bot-specific instance type and secret references.
   - Add code upload or Git deploy flow with dependency install sandboxing.
   - Add per-bot logs, restarts, env vars and resource templates.

3. Phase 3: egress enforcement
   - Disable direct outbound internet for bot containers.
   - Introduce Discord egress gateway and route-aware rate limiter.
   - Add invalid-request fuse and automatic quarantine.

4. Phase 4: production operations
   - Add review queue, approval workflow and abuse reports.
   - Add risk-tier egress pools and tenant reputation.
   - Add billing/resource quota integration if business mode is enabled.

## Official References

- Discord API rate limits:
  https://discord.com/developers/docs/topics/rate-limits
- Discord Gateway intents:
  https://discord.com/developers/docs/events/gateway#gateway-intents
- Discord Developer Policy:
  https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy
