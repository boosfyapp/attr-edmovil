#!/usr/bin/env bash
set -Eeuo pipefail

# Installed as /usr/local/sbin/att-redmovil-deploy and invoked only by the
# forced-command SSH key. Never execute deployment instructions from the repo.
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 022

if [[ ! "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  echo 'Expected: deploy <40-character commit SHA>' >&2
  exit 2
fi
revision="${BASH_REMATCH[1]}"

remote='https://github.com/boosfyapp/attr-edmovil.git'
source_dir='/var/lib/att-redmovil-deploy/source'
easypanel_code='/etc/easypanel/projects/att-redmovil/app/code'
service='att-redmovil_app'
image="att-redmovil:git-${revision:0:12}"

exec 9>/run/lock/att-redmovil-deploy.lock
flock -w 600 9

mkdir -p "$(dirname "$source_dir")"
if [[ ! -d "$source_dir/.git" ]]; then
  git clone --quiet --no-checkout --depth=1 --branch=main "$remote" "$source_dir"
fi
git -C "$source_dir" fetch --quiet --prune origin main
head_revision="$(git -C "$source_dir" rev-parse FETCH_HEAD)"
if [[ "$revision" != "$head_revision" ]]; then
  echo "Skipping superseded revision $revision; main is $head_revision"
  exit 0
fi
git -C "$source_dir" checkout --quiet --force --detach "$revision"
chmod -R a+rX "$source_dir"

docker build --pull --label "org.opencontainers.image.revision=$revision" -t "$image" "$source_dir"

smoke_container="att-redmovil-smoke-$$"
cleanup() { docker rm -f "$smoke_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$smoke_container" "$image" >/dev/null
smoke_ok=false
for _ in {1..20}; do
  if docker exec "$smoke_container" wget -q -O /dev/null http://127.0.0.1/ \
      && docker exec "$smoke_container" wget -q -O /dev/null http://127.0.0.1/styles.css \
      && docker exec "$smoke_container" wget -q -O /dev/null http://127.0.0.1/script.js; then
    smoke_ok=true
    break
  fi
  sleep 1
done
if [[ "$smoke_ok" != true ]]; then
  echo 'Image smoke test failed; current service was not changed.' >&2
  exit 1
fi
cleanup
trap - EXIT

latest_revision="$(git ls-remote "$remote" refs/heads/main | cut -f1)"
if [[ "$revision" != "$latest_revision" ]]; then
  echo "Skipping superseded revision $revision; main is $latest_revision"
  exit 0
fi

previous_image="$(docker service inspect "$service" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')"
docker service update \
  --image "$image" \
  --update-order start-first \
  --update-failure-action rollback \
  --detach=false \
  "$service"

public_ok=false
for _ in {1..15}; do
  if curl --fail --silent --show-error --location --max-time 15 \
      --output /dev/null https://att.fracesolutions.com/; then
    public_ok=true
    break
  fi
  sleep 2
done
if [[ "$public_ok" != true ]]; then
  echo "Public health check failed; rolling back to $previous_image" >&2
  docker service update --rollback --detach=false "$service" || true
  exit 1
fi

# Keep EasyPanel's source copy aligned for later rebuilds from its UI.
rsync -a --delete --exclude='.git/' "$source_dir/" "$easypanel_code/"
echo "Deployed $revision to $service ($image)"
