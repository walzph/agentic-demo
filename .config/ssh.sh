#!/bin/bash

# Define internal paths as variables for cleaner code
INTERNAL_DIR="/home/user/app/.codesphere-internal"
HOST_KEY="$INTERNAL_DIR/ws_host_key"
AUTH_KEYS="$INTERNAL_DIR/authorized_keys"
PID_FILE="$INTERNAL_DIR/sshd.pid"

# 1. Install openssh if missing
which sshd > /dev/null || nix-env -iA nixpkgs.openssh

# 2. Ensure all required directories exist
mkdir -p ~/.ssh /home/user/app "$INTERNAL_DIR"

# 3. Generate host key once (skip if already exists)
if [ ! -f "$HOST_KEY" ]; then
  ssh-keygen -t ed25519 -f "$HOST_KEY" -N "" -q
fi

# 4. Write authorized_keys idempotently
# Using '>' overwrites the file so keys don't duplicate on restart
cat <<EOF > "$AUTH_KEYS"
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIFrhskYFlptRJvVK2i7mYYIDPtKVltrUrvr6KjAOUKe philipp.walz@codesphere.com
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDaJDZ+gO1Zb8BXdyw+TIBq8cguTkLN3oycbaUvFY3dW7JahmV5E5IPSZCWY9s7jB9R0KW/RZIFRhAk1r+L9eXnbtasqdF6kOF+ozqz4JVteLTfnvsKzYxntTZumr/IpdKxVjfQ4pnDdqblb8DvzStVCVBRWKulartmiCWRNPZcNPhjBGVD6sts+kY2lZn52wO9RAoU9Yb4o3OLqqXRlbqwAYPAS/J94tAZRIdEnIBLYF/mAPuIghR6sTDauibHrsM8CVMXmvoLf4YQLN8pFdG7X8d9gGBRSqAmQuGXqImTgzCdIjsHZLmS0clXqUjjXw8/ecYGf702Ooe32T40FYvUWCmCw88dHF9//IU7FTdDb6SRaXs+xX75YJ9BWLs2+rNLMnQAq+58/Ycx7Q5VGIog6+czurTktt8IKp377xqkDlGBulVsLb7qKlLJEXJhjhjQHax5tVYwSt36SRIux3IeGZoGshYl19JXRm/nzNyecgPO8zfiBosodEtJPA1DybufnaQjn7YS9f9zePgWHZfub3UPyomT4rMElnQk31PvIIm1iDDrhsGpoR5dbkA4EmIfRbqPrn22n24sUntwJxgF2HIP0lAgMkadsqmyAULcl3PBcP7ysN8sm1qCGOQrNXvMOCEdSdE6p4uEJVRRemorps4bjDhrZOV8PUmArfOo5Q== simonh@codesphere.com
EOF

# Ensure correct permissions for the keys file
chmod 600 "$AUTH_KEYS"

# 5. Kill existing sshd process on restart
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  # Check if the process is actually running before killing
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID"
    sleep 1 # Allow a moment for the port to unbind
  fi
  # Clean up the stale PID file
  rm -f "$PID_FILE"
fi

# 6. Start sshd in the background
# Removed '-D' so the process detaches and runs as a background daemon
$(which sshd) -p 2222 -h "$HOST_KEY" -e \
  -f /dev/null \
  -o "AuthorizedKeysFile=$AUTH_KEYS" \
  -o "PasswordAuthentication=no" \
  -o "StrictModes=no" \
  -o "UsePAM=no" \
  -o "PidFile=$PID_FILE"
