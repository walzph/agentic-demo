---
description: Use when working on projects deployed to Codesphere, creating or editing ci.yml pipeline files, configuring Landscapes, managing workspaces, connecting to managed services, or interacting with the Codesphere API/MCP server.
applyTo: If the user is working on a project that uses Codesphere, or if they are asking about how to create or edit ci.yml files, manage Landscapes, workspaces, or managed services.
---

# Codesphere Platform Briefing

You are assisting a developer working with **Codesphere**, a virtual cloud platform that provides Infrastructure as Code via a single `ci.yml` file. You have access to the **Codesphere MCP server**, which lets you interact with the Codesphere Public API directly from this chat.

## Core Concepts

- **Landscape**: A deployment configuration defined by a `ci.yml` file in the repo root. It declares services, managed services, networking, and routing. It is the single source of truth for the entire microservice architecture.
- **Workspace**: A dedicated cockpit for interacting with a Landscape instance. It runs on separate compute, shares a network filesystem with the Landscape, and provides IDE, CI/Deploy, and monitoring tools.
- **Codesphere Reactives**: Managed Ubuntu containers with persistent filesystem, off-when-unused capability, and millisecond cold starts. The default and recommended runtime for web services and APIs.
- **Managed Containers**: Bring-your-own Docker/OCI images with the same orchestration features as Reactives. Use when you need a custom base image.
- **Virtual Clusters**: Full `kubectl` access to a virtual managed Kubernetes cluster for advanced workloads and Helm charts.
- **Managed Services**: Pre-configured databases (PostgreSQL, Babelfish), object storage (S3), and custom services deployable from a catalog or defined in `ci.yml`.

## ci.yml File Reference

The `ci.yml` is the central IaC file. It uses `schemaVersion: v0.2` and has two main sections:

### Structure

```yaml
schemaVersion: v0.2

# PREPARE: Install dependencies and build the application.
# Runs on the IDE pod after code is cloned. Only re-run when deps/build logic changes.
prepare:
  steps:
    - name: <step name>
      command: <bash command>

# RUN: Define and orchestrate the Landscape services.
# Each top-level key is an independent service provisioned in parallel.
run:
  <service-name>:
    plan: <number>              # Compute tier ID (vCPU/memory allocation)
    replicas: <number>          # Horizontal scaling (default 1)
    baseImage: <image>          # Only for Managed Containers (e.g., nginx:1.25-alpine)
    runAsUser: <uid>            # Only for Managed Containers
    runAsGroup: <gid>           # Only for Managed Containers
    healthEndpoint: <url>       # Custom health check (e.g., http://localhost:8080/health)
    env:
      KEY: value
      SECRET: ${{ vault.secretName }}          # From OpenBao vault
      FROM_WS: ${{ workspace.env.VAR_NAME }}   # From workspace env vars
      WS_ID: ${{ workspace.id }}               # Workspace ID
      DEV_DOMAIN: ${{ workspace.devDomain }}    # Dev domain
      TEAM: ${{ team.id }}                      # Team ID
    network:
      ports:
        - port: <number>
          isPublic: false       # Always false; public access is via paths
      paths:
        - port: <number>
          path: /               # Path-based routing (public entry point)
    volumes:
      - name: _workspace
        mountPath: /home/user/app
        workspacePath: <subdirectory>   # Optional: restrict to subdirectory
    steps:
      - name: <step name>
        command: <bash command>

  # Managed Service defined in ci.yml (Infrastructure as Code)
  <managed-service-name>:
    provider:
      name: <provider>          # e.g., postgres, s3
      version: <version>        # e.g., v1
    plan:
      id: <number>              # Resource tier for the managed service
```

### Key Rules for Generating ci.yml Files

1. **Always start with** `schemaVersion: v0.2`.
2. **Always include a test section**: Even if empty, include `test:\n  steps: []` at the top level. This is a legacy requirement that must be present for proper schema validation.
3. **prepare** section: Use for installing system dependencies (via Nix), application dependencies (`npm ci`, `pip install`, etc.), and building the application. Commands run sequentially. Files persist in `/home/user/app`.
4. **run** section: Each service is a top-level key. Services are provisioned in parallel. Steps within a service run sequentially.
5. **Use Nix for system dependencies**: `nix-env -iA nixpkgs.<package>`. No root/sudo access. Search packages at `search.nixos.org/packages`. Pin versions with channels: `nix-channel --add https://nixos.org/channels/nixos-25.11 nixos-25_11 && nix-channel --update && nix-env -iA nixos-25_11.<package>`.
6. **Plan IDs must be valid**: Use real plan IDs like `101` (Standard Developer), `201` (Micro), `301` (Boost), `401` (Pro). Do NOT use placeholder values like `1` or `2`.
7. **Ports**: Set `isPublic: false` on port definitions. Public access is configured via `paths` entries that route from the Landscape Router.
8. **Health checks**: Default health check targets port 3000. Override with `healthEndpoint` if your app uses a different port or path.
9. **Secrets**: Reference vault secrets with `${{ vault.secretName }}`. Values are prompted during sync and stored encrypted.
10. **Environment variables**: Reference workspace env vars with `${{ workspace.env.VAR_NAME }}`.
11. **Internal networking**: Services communicate via internal DNS. Managed services get deterministic hostnames like `ms-{providerName}-{version}-{teamId}-landscape-{workspaceId}-{serviceName}.ms-postgres`. Reactive services use `http://ws-server-[WorkspaceId]-[serviceName]:[port]`.
12. **Volume mounts**: By default, `/home/user/app` is shared across all Reactives. Use `volumes` with `workspacePath` to restrict which subdirectory is mounted.
13. **Managed services in ci.yml**: Define with `provider` block. Renaming a service recreates it (potential data loss).
14. **CI Profiles**: Use `ci.<profile>.yml` files (e.g., `ci.dev.yml`, `ci.prod.yml`) for environment-specific configurations. A plain `ci.yml` file maps to the `__cs_default__` profile.

### Example: Node.js API with PostgreSQL

```yaml
schemaVersion: v0.2

prepare:
  steps:
    - name: Install system deps
      command: nix-env -iA nixpkgs.nodejs_20
    - name: Install app deps
      command: npm ci
    - name: Build
      command: npm run build

run:
  api:
    plan: 21
    replicas: 2
    env:
      NODE_ENV: production
      DATABASE_URL: ${{ vault.databaseUrl }}
    network:
      ports:
        - port: 3000
          isPublic: false
      paths:
        - port: 3000
          path: /
    steps:
      - name: Start API
        command: npm start

  db:
    provider:
      name: postgres
      version: v1
    plan:
      id: 0
```

### Example: Multi-Service Architecture (Frontend + Backend + Worker)

```yaml
schemaVersion: v0.2

prepare:
  steps:
    - name: Install deps
      command: nix-env -iA nixpkgs.nodejs_20
    - name: Install packages
      command: npm ci
    - name: Build all
      command: npm run build

run:
  frontend:
    plan: 21
    env:
      API_URL: /api
    network:
      ports:
        - port: 3000
          isPublic: false
      paths:
        - port: 3000
          path: /
    steps:
      - name: Start frontend
        command: npm run start:frontend

  backend:
    plan: 21
    env:
      DATABASE_URL: ${{ vault.dbUrl }}
      REDIS_URL: ${{ vault.redisUrl }}
    network:
      ports:
        - port: 8080
          isPublic: false
      paths:
        - port: 8080
          path: /api
    steps:
      - name: Start backend
        command: npm run start:backend

  worker:
    plan: 21
    env:
      DATABASE_URL: ${{ vault.dbUrl }}
    network:
      ports:
        - port: 3000
          isPublic: false
    steps:
      - name: Start worker
        command: npm run start:worker
```

### Example: Managed Container (Nginx)

```yaml
schemaVersion: v0.2

run:
  nginx-server:
    baseImage: nginx-unprivileged:1.29-alpine
    plan: 21
    steps:
      - command: nginx -g "daemon off;"
    healthEndpoint: http://localhost:8080/
    network:
      ports:
        - port: 8080
          isPublic: false
      paths:
        - port: 8080
          path: /
    runAsUser: 1000
    runAsGroup: 1000
```

### Example: Python Application with S3 Storage

```yaml
schemaVersion: v0.2

prepare:
  steps:
    - name: Install Python
      command: nix-env -iA nixpkgs.python311
    - name: Install dependencies
      command: pip install -r requirements.txt

run:
  app:
    plan: 21
    env:
      S3_ENDPOINT: ${{ vault.s3Endpoint }}
      S3_ACCESS_KEY: ${{ vault.s3AccessKey }}
      S3_SECRET_KEY: ${{ vault.s3SecretKey }}
      S3_BUCKET: my-bucket
    network:
      ports:
        - port: 8000
          isPublic: false
      paths:
        - port: 8000
          path: /
    healthEndpoint: http://localhost:8000/health
    steps:
      - name: Start app
        command: python -m uvicorn main:app --host 0.0.0.0 --port 8000

  storage:
    provider:
      name: s3
      version: v1
    plan:
      id: 0
```

## Landscape Lifecycle

1. **Define**: Write or edit `ci.yml` in the repo.
2. **Sync**: In the Execution Manager, click Sync to provision all resources. The landscape does NOT auto-sync on git pull.
3. **Start/Stop**: Manage service execution via the Execution Manager.
4. **Off-When-Unused**: Services auto-shut down when idle and wake on incoming requests (ideal for dev/staging).
5. **Teardown**: Deprovisions resources but preserves persistent volumes. Re-sync anytime.
6. **Deletion**: Permanent removal of all resources and data.

## Networking

- **Dev domain format**: `[workspace-id]-[port].[datacenter-id].[instance-url]`
- **Path-based routing**: Route different paths on one domain to different services or workspaces.
- **Custom domains**: Add in team dashboard, verify via CNAME or A+TXT DNS records, route via path configuration. TLS certificates are auto-managed.
- **Internal communication**: Services in the same Landscape communicate via private network. All ports are internal by default.

## Codesphere MCP Server

You have access to the Codesphere MCP server which lets you interact with the Codesphere platform directly from this chat. Use the available tools to automate workflows instead of asking the user to do things manually in the UI.

### Remote SSH Development Context

A common setup is connecting to a Codesphere workspace from a local IDE (e.g., VS Code) via **SSH Remote Development**. Both the Copilot agent and the MCP server run on the remote Codesphere workspace. Understanding the architecture:

- **File edits land directly on the workspace.** Your code changes write to `/home/user/app` on the Codesphere workspace filesystem. No git push or file transfer is needed — changes are already on disk.
- **`WORKSPACE_ID` and `TEAM_ID` are NOT available as env vars** in SSH sessions. The SSH connection provides a minimal environment without these variables. To identify the current workspace:
  - **Use the MCP server**: Call `list_teams`, then `list_workspaces` to find the workspace matching the current context.
  - **Ask the user**: If you need the workspace ID, ask the user once and reuse it for the rest of the session.
- **No git pull before deploying.** Since file edits are already on the workspace filesystem, the deploy flow is: edit code -> (optionally run prepare if deps changed) -> deploy landscape / restart services. Do not suggest `git pull` when the user is editing files directly via Remote SSH.
- **The user expects a tight edit-deploy loop.** When the user says "deploy", "sync", or "restart", they mean the current workspace they are connected to. Act on it directly.

### Available MCP Tools

**Workspace Management:**
- `create_workspace` - Create a new workspace
- `get_workspace` - Get details for a specific workspace
- `delete_workspace` - Delete a workspace by ID
- `list_workspaces` - List all workspaces for a given team
- `workspace_status` - Get the runtime status of a workspace
- `scale_workspace` - Scale the number of replicas for a workspace
- `set_workspace_env_var` - Set environment variables on a workspace
- `exec_command` - Execute a command inside a workspace

**CI/CD Pipeline:**
- `start_pipeline_stage` - Start a CI pipeline stage (prepare, run, etc.)
- `get_pipeline_state` - Get the status of a pipeline stage
- `deploy_landscape` - Deploy a workspace landscape

**Landscape & Services:**
- `scale_landscape_services` - Scale specific services in a landscape
- `get_landscape_service_events` - Get landscape service events
- `get_usage_summary_landscape` - Get overall usage summary for a landscape

**Logs & Monitoring:**
- `get_logs_of_server` - Retrieve logs of a workspace by server
- `get_logs_of_replica` - Retrieve logs of a workspace by replica
- `get_logs_of_stage` - Retrieve logs of a workspace by stage

**Domains & Networking:**
- `create_domain` - Create a domain for a team
- `get_domain` - Get a specific domain by name
- `list_domains` - List all domains for a team
- `update_domain` - Update a domain (routing rules, access settings)
- `verify_domain` - Trigger verification for a domain
- `delete_domain` - Delete a domain

**Teams:**
- `create_team` - Create a new team
- `get_team` - Get details of a single team
- `list_teams` - List all teams the authenticated user belongs to
- `delete_team` - Delete a team by ID

**Platform Info:**
- `list_base_images` - List all base images available for workspaces
- `list_data_centers` - List all available data centers in Codesphere
- `list_workspace_plans` - List all standard Codesphere workspace plans

### Critical: Landscape Deployment vs. Direct Execution

**DO NOT confuse direct execution with proper Landscape deployment.** When in a Codesphere workspace via SSH Remote Development, you can exec commands directly inside the workspace container (`exec_command`). However, this is NOT the same as a proper landscape deployment.

**Proper Landscape Deployment:**
- Services defined under `run:` are scheduled as **standalone, independently-managed Reactive containers** on Codesphere's infrastructure
- Each service runs on its own compute instance with its own lifecycle, health checks, and resource isolation
- Replicas scale independently
- Services receive persistent DNS names for internal communication

**Direct Execution (what NOT to do):**
- Running services directly inside the workspace container via `exec_command` are temporary processes on the workspace itself
- They share workspace compute resources with the IDE
- No independent health checks, no automatic restart on crash
- No landscape-managed scaling or orchestration
- This is only acceptable for temporary debugging — never for production deployment

**When deploying a new service:**
1. Always use `deploy_landscape` + `start_pipeline_stage` workflow
2. Never use `exec_command` as a substitute for proper service deployment
3. Verify with `get_landscape_service_events` that services provisioned correctly

### Common MCP Workflows in SSH Remote Development

#### The Correct Deployment Sequence (CRITICAL)

When deploying a landscape in SSH Remote Development, follow this exact sequence. **Order matters.**

**For initial deployment or after `ci.yml` changes:**
1. Call `deploy_landscape` with the correct profile name (usually `__cs_default__` for `ci.yml`)
2. Wait for the landscape sync to complete
3. Call `start_pipeline_stage` for `prepare` stage
4. Poll with `get_pipeline_state` until complete
5. Call `start_pipeline_stage` for `run` stage
6. Poll with `get_pipeline_state` until services are running

**Why the order matters:**
- **Must sync landscape BEFORE running stages.** The `run` stage cannot start until the landscape definition is synced. Attempting to run stages before sync will fail with 500 errors or "not running" errors.
- **Profile names are critical.** A file named `ci.yml` maps to profile `__cs_default__`. A file named `ci.dev.yml` maps to profile `__cs_dev__`, etc. Using the wrong profile name will cause the sync to fail.
- **The test section is required.** Even if empty, include `test:\n  steps: []` at the top level of every ci.yml. Missing this causes schema validation errors.
- **Plan IDs must be valid.** Only use real plan IDs like 101, 201, 301, 401. Invalid IDs cause schema validation errors.

**Example deployment code:**
```python
# Wrong: This will fail
mcp_codesphere_start_pipeline_stage(profile="default", stage="run", workspaceId=12345)

# Correct: Sync first, then run stages in order
mcp_codesphere_deploy_landscape(profile="__cs_default__", workspaceId=12345)
mcp_codesphere_start_pipeline_stage(profile="__cs_default__", stage="prepare", workspaceId=12345)
# poll until complete
mcp_codesphere_start_pipeline_stage(profile="__cs_default__", stage="run", workspaceId=12345)
# poll until complete
```

#### Practical Gotchas (Learned from Real Sessions)

- **"sync" is NOT a valid pipeline stage.** When the user says "deploy" or "sync", they mean the full sequence: `prepare` → `deploy_landscape` (sync) → `run`. Never call `start_pipeline_stage` with `stage="sync"` — the API will reject it. The landscape sync is its own separate MCP tool: `deploy_landscape`.
- **Skipping `deploy_landscape` causes 500 errors on `run`.** If you call `start_pipeline_stage` for `run` without first calling `deploy_landscape`, the API will return a 500 error. The error looks transient but is actually caused by the landscape not being synced. Always call `deploy_landscape` before `run`.
- **Always confirm the workspace ID with the user before deploying.** Do not assume the workspace ID from context or prior messages. In SSH Remote Development, the user is connected to a specific workspace and knows its ID. Acting on the wrong workspace ID wastes time and deploys to the wrong environment. Ask once at the start of a session if not already provided.
- **`volumeMounts` vs `volumes`**: The correct key in `ci.yml` for mounting the workspace filesystem is `volumes`, not `volumeMounts`. Using `volumeMounts` may be silently ignored or cause schema errors.

#### Remote SSH Workflows (editing files directly on the workspace)

**Quick deploy after code changes (most common):**
The user has edited files and wants to see them live. No git pull needed — files are already on disk.
1. (Skip landscape sync if `ci.yml` unchanged)
2. `start_pipeline_stage` to run `run` (restarts services with updated code)
3. `get_pipeline_state` to poll until running

**Rebuild and deploy (after dependency or build changes):**
Use when `package.json`, `requirements.txt`, or build logic changed.
1. `start_pipeline_stage` to run `prepare` (reinstalls deps, rebuilds)
2. `get_pipeline_state` to poll until prepare completes
3. `start_pipeline_stage` to run `run`
4. `get_pipeline_state` to poll until running

**Edit ci.yml and redeploy (most important to get right):**
The user modified the `ci.yml` (e.g., added a service, changed env vars, adjusted ports).
1. Verify the ci.yml has correct schema: `schemaVersion: v0.2`, `test: steps: []`, valid plan IDs
2. `deploy_landscape` with the correct profile name (e.g., `__cs_default__` for `ci.yml`)
3. Wait for sync to complete
4. `start_pipeline_stage` to run `prepare`
5. `get_pipeline_state` to poll until prepare completes
6. `start_pipeline_stage` to run `run`
7. `get_pipeline_state` to poll until running

**Check status of current workspace:**
1. `workspace_status` to see runtime state
2. `get_logs_of_server` or `get_logs_of_replica` to inspect recent logs
3. `get_usage_summary_landscape` to check resource consumption

#### General Workflows (any context)

**Deploy latest code from git to an existing workspace:**
1. `exec_command` to run `git pull` in the workspace
2. `start_pipeline_stage` to run `prepare` (if deps/build changed)
3. `get_pipeline_state` to poll until prepare completes
4. `start_pipeline_stage` to run `run`
5. `get_pipeline_state` to poll until running

**Provision a new environment from scratch:**
1. `list_teams` to find the target team
2. `list_workspace_plans` to pick a plan
3. `create_workspace` with git repo URL, branch, team ID, and plan
4. `set_workspace_env_var` to inject configuration
5. `deploy_landscape` to provision the landscape
6. `start_pipeline_stage` for prepare, then run

**Zero-downtime deploy (blue/green):**
1. `create_workspace` for the new (green) environment
2. `start_pipeline_stage` prepare + run on the new workspace
3. `workspace_status` to confirm it's healthy
4. `update_domain` to switch routing from old to new workspace
5. `delete_workspace` to remove the old (blue) environment

**Debug a running service:**
1. `workspace_status` to check runtime state
2. `get_logs_of_server` or `get_logs_of_replica` to inspect logs
3. `exec_command` to run diagnostic commands inside the workspace
4. `get_landscape_service_events` to check for orchestration issues

**Scale services for traffic:**
1. `scale_landscape_services` to adjust replica counts for specific services
2. `get_usage_summary_landscape` to monitor resource consumption

## Managed Services

Available managed service providers:
- **PostgreSQL**: Port 5432, connect via `psql` or any Postgres client.
- **Babelfish**: SQL Server-compatible (T-SQL) on port 1433, backed by PostgreSQL. Use `TDSENCRYPTION=required` for connections.
- **S3**: S3-compatible object storage. Use `forcePathStyle: true` with AWS SDK.

Connection details (host, DSN) are available in the service details UI after deployment.

## Nix Package Management

Codesphere uses Nix for reproducible dependency management (no root required).

```bash
nix-env -iA nixpkgs.<package>     # Install
nix-env -q                         # List installed
nix-env -e <package>               # Remove
```

For pinned versions, add a specific channel:
```bash
nix-channel --add https://nixos.org/channels/nixos-25.11 nixos-25_11
nix-channel --update
nix-env -iA nixos-25_11.<package>
```

Use `nix-shell` for ephemeral environments or define a `shell.nix` for reproducible dev setups.

## Common Pitfalls

| Issue | Cause | Solution |
|-------|-------|---------|
| Data loss on restart | Writing outside `/home/user/app` | Ensure all persistent writes go to the app directory |
| Concurrent write conflicts | Multiple replicas writing same files | Use separate directories per replica or external databases |
| Health check failures | Wrong port or missing endpoint | Verify `healthEndpoint` matches your app's actual port and path |
| 404 after path-based routing | App doesn't handle the subpath | Configure app to serve on the routed path (e.g., Express route, React `basename`) |
| Landscape not updating after git pull | Sync not triggered | Explicitly sync in the Execution Manager after pulling |
| OOM errors | Undersized plan | Monitor memory usage and upgrade the plan tier |
