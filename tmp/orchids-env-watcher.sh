#!/bin/sh
EXPECTED_URL="https://3002-bde0b8e7-ddd4-41df-83a5-21442caf022a.orchids.cloud"
ENV_FILE="/home/user/app/frontend/.env.local"

while true; do
  sleep 3
  if [ -f "$ENV_FILE" ]; then
    CURRENT=$(grep "^EXPO_PUBLIC_BACKEND_URL=" "$ENV_FILE" | head -1 | cut -d= -f2-)
    if [ "$CURRENT" != "$EXPECTED_URL" ]; then
      if grep -q "^EXPO_PUBLIC_BACKEND_URL=" "$ENV_FILE"; then
        sed -i "s|^EXPO_PUBLIC_BACKEND_URL=.*|EXPO_PUBLIC_BACKEND_URL=$EXPECTED_URL|" "$ENV_FILE"
      else
        echo "EXPO_PUBLIC_BACKEND_URL=$EXPECTED_URL" >> "$ENV_FILE"
      fi
    fi
  else
    echo "EXPO_PUBLIC_BACKEND_URL=$EXPECTED_URL" > "$ENV_FILE"
  fi
done