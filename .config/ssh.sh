#!/bin/bash

which sshd || nix-env -iA nixpkgs.openssh

mkdir -p ~/.ssh /home/user/app

# Generate host key once (skip if already exists)
if [ ! -f /home/user/app/.codesphere-internal/ws_host_key ]; then
  ssh-keygen -t ed25519 -f /home/user/app/.codesphere-internal/ws_host_key -N "" -q
fi

cat <<EOF >> ~/.ssh/authorized_keys
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIFrhskYFlptRJvVK2i7mYYIDPtKVltrUrvr6KjAOUKe philipp.walz@codesphere.com
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDaJDZ+gO1Zb8BXdyw+TIBq8cguTkLN3oycbaUvFY3dW7JahmV5E5IPSZCWY9s7jB9R0KW/RZIFRhAk1r+L9eXnbtasqdF6kOF+ozqz4JVteLTfnvsKzYxntTZumr/IpdKxVjfQ4pnDdqblb8DvzStVCVBRWKulartmiCWRNPZcNPhjBGVD6sts+kY2lZn52wO9RAoU9Yb4o3OLqqXRlbqwAYPAS/J94tAZRIdEnIBLYF/mAPuIghR6sTDauibHrsM8CVMXmvoLf4YQLN8pFdG7X8d9gGBRSqAmQuGXqImTgzCdIjsHZLmS0clXqUjjXw8/ecYGf702Ooe32T40FYvUWCmCw88dHF9//IU7FTdDb6SRaXs+xX75YJ9BWLs2+rNLMnQAq+58/Ycx7Q5VGIog6+czurTktt8IKp377xqkDlGBulVsLb7qKlLJEXJhjhjQHax5tVYwSt36SRIux3IeGZoGshYl19JXRm/nzNyecgPO8zfiBosodEtJPA1DybufnaQjn7YS9f9zePgWHZfub3UPyomT4rMElnQk31PvIIm1iDDrhsGpoR5dbkA4EmIfRbqPrn22n24sUntwJxgF2HIP0lAgMkadsqmyAULcl3PBcP7ysN8sm1qCGOQrNXvMOCEdSdE6p4uEJVRRemorps4bjDhrZOV8PUmArfOo5Q== simonh@codesphere.com
EOF

$(which sshd) -D -p 2222 -h /home/user/app/.codesphere-internal/ws_host_key -e \
  -f /dev/null \
  -o "AuthorizedKeysFile=.ssh/authorized_keys" \
  -o "PasswordAuthentication=no" \
  -o "StrictModes=no" \
  -o "UsePAM=no" \
  -o "PidFile=$HOME/.ssh/sshd.pid"
