#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
RUNTIME_DIR="$PROJECT_ROOT/deploy/runtime"
APP_ENV_FILE="$RUNTIME_DIR/.env.production"
COMPOSE_ENV_FILE="$RUNTIME_DIR/.compose.env"
COMPOSE_FILE="$RUNTIME_DIR/docker-compose.vps.yml"
TRAEFIK_FILE="$RUNTIME_DIR/traefik.yml"
ACME_FILE="$RUNTIME_DIR/acme.json"

WRITE_ONLY=0
NON_INTERACTIVE=0
FORCE=0
USE_LEGACY_DOCKER_COMPOSE=0
SUDO=""

trap 'printf "[install][error] Command failed at line %s.\n" "$LINENO" >&2' ERR

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Options:
  --write-only       Generate deployment files but do not install or start services.
  --non-interactive  Read values from the environment or existing deploy/runtime files.
  --force            Overwrite generated runtime files without prompting.
  -h, --help         Show this help text.

The fully automatic mode expects:
  - a Linux VPS (tested for Ubuntu/Debian automation)
  - a root domain whose DNS A records already point to the VPS

Before running:
  - create an A record for @ pointing to the VPS public IPv4
  - create an A record for * pointing to the VPS public IPv4
EOF
}

log() {
  printf '[install] %s\n' "$*"
}

warn() {
  printf '[install][warn] %s\n' "$*" >&2
}

fail() {
  printf '[install][error] %s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

normalize_domain() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  value="${value#http://}"
  value="${value#https://}"
  value="${value#\*.}"
  value="${value%/}"
  value="${value%%:*}"
  printf '%s' "$value"
}

valid_domain() {
  local value
  value="$(normalize_domain "$1")"

  [[ "$value" == *.* ]] || return 1
  [[ "$value" =~ ^[a-z0-9][a-z0-9.-]*[a-z0-9]$ ]] || return 1
  [[ "$value" != *".."* ]] || return 1
  [[ "$value" != .* ]] || return 1

  return 0
}

valid_email() {
  [[ "$1" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]
}

random_hex() {
  local bytes="${1:-32}"
  if command_exists openssl; then
    openssl rand -hex "$bytes"
  else
    head -c "$bytes" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

random_alnum() {
  local length="${1:-24}"
  local value
  set +o pipefail
  value="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length")"
  set -o pipefail
  printf '%s' "$value"
}

dotenv_escape() {
  local value="${1//$'\r'/}"
  value="${value//$'\n'/}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "$value"
}

write_dotenv_line() {
  local key="$1"
  local value="${2-}"
  printf '%s="%s"\n' "$key" "$(dotenv_escape "$value")"
}

parse_bool() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|y|Y|on|ON) return 0 ;;
    0|false|FALSE|no|NO|n|N|off|OFF) return 1 ;;
    *) return 1 ;;
  esac
}

prompt_required() {
  local var_name="$1"
  local label="$2"
  local default_value="${3-}"
  local input=""

  if [ "$NON_INTERACTIVE" -eq 1 ]; then
    input="${!var_name:-$default_value}"
    [ -n "$input" ] || fail "$var_name is required in --non-interactive mode."
    printf -v "$var_name" '%s' "$input"
    return
  fi

  while true; do
    if [ -n "$default_value" ]; then
      read -r -p "$label [$default_value]: " input
      input="${input:-$default_value}"
    else
      read -r -p "$label: " input
    fi

    if [ -n "$input" ]; then
      printf -v "$var_name" '%s' "$input"
      return
    fi

    warn "Bu alan boş bırakılamaz."
  done
}

prompt_optional() {
  local var_name="$1"
  local label="$2"
  local default_value="${3-}"
  local input=""

  if [ "$NON_INTERACTIVE" -eq 1 ]; then
    printf -v "$var_name" '%s' "${!var_name:-$default_value}"
    return
  fi

  if [ -n "$default_value" ]; then
    read -r -p "$label [$default_value]: " input
    input="${input:-$default_value}"
  else
    read -r -p "$label: " input
  fi

  printf -v "$var_name" '%s' "$input"
}

prompt_secret() {
  local var_name="$1"
  local label="$2"
  local default_value="${3-}"
  local input=""

  if [ "$NON_INTERACTIVE" -eq 1 ]; then
    input="${!var_name:-$default_value}"
    [ -n "$input" ] || fail "$var_name is required in --non-interactive mode."
    printf -v "$var_name" '%s' "$input"
    return
  fi

  while true; do
    if [ -n "$default_value" ]; then
      read -r -s -p "$label [boş bırakılırsa mevcut değer korunur]: " input
      printf '\n'
      input="${input:-$default_value}"
    else
      read -r -s -p "$label: " input
      printf '\n'
    fi

    if [ -n "$input" ]; then
      printf -v "$var_name" '%s' "$input"
      return
    fi

    warn "Bu alan boş bırakılamaz."
  done
}

prompt_yes_no() {
  local var_name="$1"
  local label="$2"
  local default_value="${3:-yes}"
  local input=""
  local normalized_default="yes"

  if parse_bool "$default_value"; then
    normalized_default="yes"
  else
    normalized_default="no"
  fi

  if [ "$NON_INTERACTIVE" -eq 1 ]; then
    input="${!var_name:-$normalized_default}"
    if parse_bool "$input"; then
      printf -v "$var_name" 'yes'
    else
      printf -v "$var_name" 'no'
    fi
    return
  fi

  while true; do
    if [ "$normalized_default" = "yes" ]; then
      read -r -p "$label [Y/n]: " input
      input="${input:-Y}"
    else
      read -r -p "$label [y/N]: " input
      input="${input:-N}"
    fi

    case "$input" in
      Y|y|yes|YES)
        printf -v "$var_name" 'yes'
        return
        ;;
      N|n|no|NO)
        printf -v "$var_name" 'no'
        return
        ;;
      *)
        warn "Lütfen yes veya no gir."
        ;;
    esac
  done
}

first_admin_email() {
  printf '%s' "${1%%,*}"
}

enabled_by_any_value() {
  local value
  for value in "$@"; do
    if [ -n "${value:-}" ]; then
      printf '%s' yes
      return
    fi
  done

  printf '%s' no
}

detect_public_ipv4() {
  local value=""

  if command_exists curl; then
    value="$(curl -4fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
  fi

  printf '%s' "$value"
}

bootstrap_command() {
  if [ -d "$PROJECT_ROOT/prisma/migrations" ] && find "$PROJECT_ROOT/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | grep -q .; then
    printf '%s' 'node scripts/validate-env.mjs && npx prisma migrate deploy'
  else
    printf '%s' 'node scripts/validate-env.mjs && npx prisma db push --skip-generate'
  fi
}

load_existing_runtime_config() {
  if [ -f "$APP_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a && . "$APP_ENV_FILE" && set +a
  fi

  if [ -f "$COMPOSE_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a && . "$COMPOSE_ENV_FILE" && set +a
  fi
}

ensure_runtime_dir() {
  mkdir -p "$RUNTIME_DIR"
}

write_app_env_file() {
  : >"$APP_ENV_FILE"
  {
    write_dotenv_line DATABASE_URL "$DATABASE_URL"
    write_dotenv_line NEXTAUTH_SECRET "$NEXTAUTH_SECRET"
    write_dotenv_line NEXTAUTH_URL "$NEXTAUTH_URL"
    write_dotenv_line ROOT_DOMAIN "$ROOT_DOMAIN"
    write_dotenv_line NEXT_PUBLIC_ROOT_DOMAIN "$ROOT_DOMAIN"
    write_dotenv_line ENCRYPTION_KEY "$ENCRYPTION_KEY"
    write_dotenv_line ADMIN_EMAILS "$ADMIN_EMAILS"
    write_dotenv_line GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
    write_dotenv_line GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
    write_dotenv_line MICROSOFT_CLIENT_ID "$MICROSOFT_CLIENT_ID"
    write_dotenv_line MICROSOFT_CLIENT_SECRET "$MICROSOFT_CLIENT_SECRET"
    write_dotenv_line SMTP_HOST "$SMTP_HOST"
    write_dotenv_line SMTP_PORT "$SMTP_PORT"
    write_dotenv_line SMTP_USER "$SMTP_USER"
    write_dotenv_line SMTP_PASS "$SMTP_PASS"
    write_dotenv_line FROM_EMAIL "$FROM_EMAIL"
    write_dotenv_line DEPLOYMENT_VERSION "$DEPLOYMENT_VERSION"
  } >>"$APP_ENV_FILE"
  chmod 600 "$APP_ENV_FILE"
}

write_compose_env_file() {
  : >"$COMPOSE_ENV_FILE"
  {
    write_dotenv_line ROOT_DOMAIN "$ROOT_DOMAIN"
    write_dotenv_line LETSENCRYPT_EMAIL "$LETSENCRYPT_EMAIL"
    write_dotenv_line POSTGRES_DB "$POSTGRES_DB"
    write_dotenv_line POSTGRES_USER "$POSTGRES_USER"
    write_dotenv_line POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
    write_dotenv_line PRISMA_BOOTSTRAP_COMMAND "$PRISMA_BOOTSTRAP_COMMAND"
  } >>"$COMPOSE_ENV_FILE"
  chmod 600 "$COMPOSE_ENV_FILE"
}

write_traefik_file() {
  cat >"$TRAEFIK_FILE" <<EOF
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${LETSENCRYPT_EMAIL}
      storage: /acme.json
      httpChallenge:
        entryPoint: web

log:
  level: INFO
EOF
}

write_compose_file() {
  cat >"$COMPOSE_FILE" <<EOF
services:
  traefik:
    image: traefik:v3.3
    command:
      - --configFile=/etc/traefik/traefik.yml
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - ./acme.json:/acme.json
    networks:
      - frontend
    security_opt:
      - no-new-privileges:true

EOF

  if [ "$USE_LOCAL_POSTGRES" = "yes" ]; then
    cat >>"$COMPOSE_FILE" <<'EOF'
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - oneflash_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - backend

EOF
  fi

  cat >>"$COMPOSE_FILE" <<'EOF'
  setup:
    build:
      context: ../..
      dockerfile: Dockerfile
      target: tools
    working_dir: /app
    env_file:
      - ./.env.production
    command:
      - sh
      - -lc
      - ${PRISMA_BOOTSTRAP_COMMAND}
    profiles:
      - ops
EOF

  if [ "$USE_LOCAL_POSTGRES" = "yes" ]; then
    cat >>"$COMPOSE_FILE" <<'EOF'
    depends_on:
      db:
        condition: service_healthy
EOF
  fi

  cat >>"$COMPOSE_FILE" <<'EOF'
    networks:
      - backend

  app:
    build:
      context: ../..
      dockerfile: Dockerfile
    restart: unless-stopped
    init: true
    env_file:
      - ./.env.production
EOF

  if [ "$USE_LOCAL_POSTGRES" = "yes" ]; then
    cat >>"$COMPOSE_FILE" <<'EOF'
    depends_on:
      db:
        condition: service_healthy
EOF
  fi

  cat >>"$COMPOSE_FILE" <<'EOF'
    networks:
      - frontend
      - backend
    security_opt:
      - no-new-privileges:true
    labels:
      - traefik.enable=true
      - traefik.docker.network=oneflash_frontend
      - traefik.http.routers.oneflash.rule=Host(`${ROOT_DOMAIN}`) || HostRegexp(`{subdomain:[a-z0-9-]+}.${ROOT_DOMAIN}`)
      - traefik.http.routers.oneflash.entrypoints=websecure
      - traefik.http.routers.oneflash.tls=true
      - traefik.http.routers.oneflash.tls.certresolver=letsencrypt
      - traefik.http.services.oneflash.loadbalancer.server.port=3000

networks:
  frontend:
    name: oneflash_frontend
  backend:
    name: oneflash_backend

volumes:
  oneflash_postgres_data:
    name: oneflash_postgres_data
EOF
}

prepare_runtime_files() {
  ensure_runtime_dir

  if [ -e "$APP_ENV_FILE" ] || [ -e "$COMPOSE_ENV_FILE" ] || [ -e "$COMPOSE_FILE" ] || [ -e "$TRAEFIK_FILE" ]; then
    if [ "$FORCE" -ne 1 ] && [ "$NON_INTERACTIVE" -ne 1 ]; then
      prompt_yes_no OVERWRITE_FILES "deploy/runtime içeriği güncellensin mi?" yes
      [ "$OVERWRITE_FILES" = "yes" ] || fail "İşlem kullanıcı tarafından durduruldu."
    fi
  fi

  write_app_env_file
  write_compose_env_file
  write_traefik_file
  write_compose_file
  touch "$ACME_FILE"
  chmod 600 "$ACME_FILE"
}

require_linux_runtime() {
  if [ "$(uname -s)" != "Linux" ]; then
    fail "--write-only olmadan kurulum sadece Linux VPS üzerinde çalışır."
  fi
}

ensure_sudo() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    command_exists sudo || fail "Root değilsen sudo gerekli."
    SUDO="sudo"
  fi
}

ensure_system_tools() {
  local missing=()

  for cmd in curl jq openssl; do
    command_exists "$cmd" || missing+=("$cmd")
  done

  if [ "${#missing[@]}" -eq 0 ]; then
    return
  fi

  if ! command_exists apt-get; then
    fail "Eksik araçlar: ${missing[*]}. Bunları yükle veya Ubuntu/Debian kullan."
  fi

  log "Eksik paketler kuruluyor: ${missing[*]}"
  $SUDO apt-get update
  $SUDO apt-get install -y ca-certificates curl jq openssl
}

install_docker_if_needed() {
  if command_exists docker; then
    return
  fi

  log "Docker bulunamadı, kuruluyor."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  $SUDO sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
  $SUDO systemctl enable --now docker
}

detect_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    USE_LEGACY_DOCKER_COMPOSE=0
    return
  fi

  if command_exists docker-compose; then
    USE_LEGACY_DOCKER_COMPOSE=1
    return
  fi

  fail "Docker Compose bulunamadı."
}

ensure_docker_daemon() {
  if [ -n "$SUDO" ]; then
    if ! $SUDO docker info >/dev/null 2>&1; then
      $SUDO systemctl enable --now docker
    fi
  elif ! docker info >/dev/null 2>&1; then
    systemctl enable --now docker
  fi
}

dc() {
  if [ "$USE_LEGACY_DOCKER_COMPOSE" -eq 1 ]; then
    if [ -n "$SUDO" ]; then
      $SUDO docker-compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
      docker-compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
    fi
  else
    if [ -n "$SUDO" ]; then
      $SUDO docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
      docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
    fi
  fi
}

docker_inspect() {
  if [ -n "$SUDO" ]; then
    $SUDO docker inspect "$@"
  else
    docker inspect "$@"
  fi
}

wait_for_service_health() {
  local service="$1"
  local timeout="${2:-180}"
  local waited=0
  local container_id=""
  local status=""

  container_id="$(dc ps -q "$service")"
  [ -n "$container_id" ] || fail "$service container id alınamadı."

  while [ "$waited" -lt "$timeout" ]; do
    status="$(docker_inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

    case "$status" in
      healthy|running)
        return 0
        ;;
      unhealthy|exited|dead)
        dc logs --no-color --tail 150 "$service" || true
        fail "$service sağlıklı duruma geçemedi."
        ;;
    esac

    sleep 3
    waited=$((waited + 3))
  done

  dc logs --no-color --tail 150 "$service" || true
  fail "$service ${timeout}s içinde healthy olmadı."
}

deploy_stack() {
  log "Compose yapılandırması doğrulanıyor."
  dc config >/dev/null

  if [ "$USE_LOCAL_POSTGRES" = "yes" ]; then
    log "Traefik ve Postgres başlatılıyor."
    dc up -d traefik db
    wait_for_service_health db 120
  else
    log "Traefik başlatılıyor."
    dc up -d traefik
  fi

  log "Prisma bootstrap çalıştırılıyor."
  dc --profile ops run --rm --build setup

  log "Uygulama başlatılıyor."
  dc up -d --build app
  wait_for_service_health app 240
}

print_summary() {
  cat <<EOF

[install] Kurulum tamamlandı.
[install] Ana adres: https://${ROOT_DOMAIN}
[install] Kullanıcı alt domainleri: https://<subdomain>.${ROOT_DOMAIN}
[install] Üretilen dosyalar:
[install]   - ${APP_ENV_FILE}
[install]   - ${COMPOSE_ENV_FILE}
[install]   - ${COMPOSE_FILE}
[install]   - ${TRAEFIK_FILE}

[install] OAuth callback URL'leri:
[install]   - Google: https://${ROOT_DOMAIN}/api/cloud/google/callback
[install]   - Microsoft: https://${ROOT_DOMAIN}/api/cloud/onedrive/callback

[install] Sonraki deploy/update için:
[install]   git pull && ./install.sh --non-interactive --force
EOF
}

collect_core_config() {
  ROOT_DOMAIN="${ROOT_DOMAIN:-}"
  while true; do
    prompt_required ROOT_DOMAIN "Root domain" "$ROOT_DOMAIN"
    ROOT_DOMAIN="$(normalize_domain "$ROOT_DOMAIN")"
    if valid_domain "$ROOT_DOMAIN"; then
      break
    fi
    warn "Geçerli bir domain gir. Örnek: example.com"
    ROOT_DOMAIN=""
  done

  ADMIN_EMAILS="${ADMIN_EMAILS:-${ADMIN_EMAIL:-}}"
  while true; do
    prompt_required ADMIN_EMAILS "Admin email(ler) (virgülle ayır)" "$ADMIN_EMAILS"
    ADMIN_EMAILS="$(printf '%s' "$ADMIN_EMAILS" | tr -d ' ')"
    if valid_email "$(first_admin_email "$ADMIN_EMAILS")"; then
      break
    fi
    warn "En az bir geçerli admin email gerekli."
    ADMIN_EMAILS=""
  done

  local first_email
  first_email="$(first_admin_email "$ADMIN_EMAILS")"

  LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-$first_email}"
  while true; do
    prompt_required LETSENCRYPT_EMAIL "Let's Encrypt email" "$LETSENCRYPT_EMAIL"
    if valid_email "$LETSENCRYPT_EMAIL"; then
      break
    fi
    warn "Geçerli bir email gir."
    LETSENCRYPT_EMAIL=""
  done

  NEXTAUTH_URL="${NEXTAUTH_URL:-https://$ROOT_DOMAIN}"
  NEXTAUTH_URL="https://$ROOT_DOMAIN"

  NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(random_hex 32)}"
  prompt_secret NEXTAUTH_SECRET "NEXTAUTH secret" "$NEXTAUTH_SECRET"

  ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(random_hex 32)}"
  prompt_secret ENCRYPTION_KEY "Encryption key" "$ENCRYPTION_KEY"

  DEPLOYMENT_VERSION="$(date -u +%Y%m%d%H%M%S)"
}

collect_database_config() {
  local db_mode_default="yes"
  if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL:-}" != *"@db:5432/"* ]]; then
    db_mode_default="no"
  elif [ "${USE_LOCAL_POSTGRES:-yes}" = "no" ]; then
    db_mode_default="no"
  fi

  prompt_yes_no USE_LOCAL_POSTGRES "Local Postgres container kullanılsın mı?" "$db_mode_default"

  if [ "$USE_LOCAL_POSTGRES" = "yes" ]; then
    POSTGRES_DB="${POSTGRES_DB:-oneflash}"
    POSTGRES_USER="${POSTGRES_USER:-oneflash}"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(random_alnum 24)}"

    prompt_required POSTGRES_DB "Postgres database adı" "$POSTGRES_DB"
    prompt_required POSTGRES_USER "Postgres kullanıcı adı" "$POSTGRES_USER"
    while true; do
      prompt_secret POSTGRES_PASSWORD "Postgres şifresi" "$POSTGRES_PASSWORD"
      if [[ "$POSTGRES_PASSWORD" =~ ^[A-Za-z0-9._~-]+$ ]]; then
        break
      fi
      warn "Local Postgres şifresi URL-safe olmalı. Sadece harf, rakam, nokta, alt çizgi, tire veya tilde kullan."
      POSTGRES_PASSWORD=""
    done

    DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
  else
    POSTGRES_DB=""
    POSTGRES_USER=""
    POSTGRES_PASSWORD=""
    while true; do
      prompt_required DATABASE_URL "Harici PostgreSQL DATABASE_URL" "${DATABASE_URL:-}"
      if [[ "$DATABASE_URL" == postgresql://* || "$DATABASE_URL" == postgres://* ]]; then
        break
      fi
      warn "DATABASE_URL PostgreSQL URL formatında olmalı."
      DATABASE_URL=""
    done
  fi

  PRISMA_BOOTSTRAP_COMMAND="$(bootstrap_command)"
}

collect_optional_integrations() {
  local from_email_default="noreply@$ROOT_DOMAIN"

  prompt_yes_no ENABLE_GOOGLE "Google OAuth girilecek mi?" "${ENABLE_GOOGLE:-$(enabled_by_any_value "${GOOGLE_CLIENT_ID:-}" "${GOOGLE_CLIENT_SECRET:-}")}"
  if [ "$ENABLE_GOOGLE" = "yes" ]; then
    prompt_required GOOGLE_CLIENT_ID "Google Client ID" "${GOOGLE_CLIENT_ID:-}"
    prompt_secret GOOGLE_CLIENT_SECRET "Google Client Secret" "${GOOGLE_CLIENT_SECRET:-}"
  else
    GOOGLE_CLIENT_ID=""
    GOOGLE_CLIENT_SECRET=""
  fi

  prompt_yes_no ENABLE_MICROSOFT "Microsoft OAuth girilecek mi?" "${ENABLE_MICROSOFT:-$(enabled_by_any_value "${MICROSOFT_CLIENT_ID:-}" "${MICROSOFT_CLIENT_SECRET:-}")}"
  if [ "$ENABLE_MICROSOFT" = "yes" ]; then
    prompt_required MICROSOFT_CLIENT_ID "Microsoft Client ID" "${MICROSOFT_CLIENT_ID:-}"
    prompt_secret MICROSOFT_CLIENT_SECRET "Microsoft Client Secret" "${MICROSOFT_CLIENT_SECRET:-}"
  else
    MICROSOFT_CLIENT_ID=""
    MICROSOFT_CLIENT_SECRET=""
  fi

  SMTP_PORT="${SMTP_PORT:-465}"
  FROM_EMAIL="${FROM_EMAIL:-$from_email_default}"
  prompt_yes_no ENABLE_SMTP "SMTP ayarlansın mı?" "${ENABLE_SMTP:-$(enabled_by_any_value "${SMTP_HOST:-}" "${SMTP_USER:-}" "${SMTP_PASS:-}")}"
  if [ "$ENABLE_SMTP" = "yes" ]; then
    prompt_required SMTP_HOST "SMTP host" "${SMTP_HOST:-}"
    prompt_required SMTP_PORT "SMTP port" "$SMTP_PORT"
    prompt_required SMTP_USER "SMTP user" "${SMTP_USER:-}"
    prompt_secret SMTP_PASS "SMTP pass" "${SMTP_PASS:-}"
    prompt_required FROM_EMAIL "From email" "$FROM_EMAIL"
  else
    SMTP_HOST=""
    SMTP_PORT=""
    SMTP_USER=""
    SMTP_PASS=""
  fi

}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --write-only)
        WRITE_ONLY=1
        ;;
      --non-interactive)
        NON_INTERACTIVE=1
        ;;
      --force)
        FORCE=1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Bilinmeyen argüman: $1"
        ;;
    esac
    shift
  done
}

main() {
  parse_args "$@"
  load_existing_runtime_config
  collect_core_config
  collect_database_config
  collect_optional_integrations

  log "Kurulum dosyaları yazılıyor."
  prepare_runtime_files

  if [ "$WRITE_ONLY" -eq 1 ]; then
    print_summary
    exit 0
  fi

  require_linux_runtime
  ensure_sudo
  ensure_system_tools
  install_docker_if_needed
  detect_docker_compose
  ensure_docker_daemon
  deploy_stack
  print_summary
}

main "$@"
