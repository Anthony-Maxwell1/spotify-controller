#!/usr/bin/env bash
set -e

echo "[0/5] Checking dependencies..."

if ! command -v spicetify >/dev/null 2>&1; then
  echo "Error: spicetify is not installed or not in PATH."
  echo "Install it from https://spicetify.app/docs/getting-started"
  exit 1
fi

# Paths (relative to script location)
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="$(cd "$(dirname "$MAIN")" && pwd)"
CNF="$BASE_DIR/../localhost.cnf"
KEY="$BASE_DIR/../key.pem"
CERT="$BASE_DIR/../cert.pem"
MAIN="$BASE_DIR/../main.py"
CONTROLLER="$BASE_DIR/../controller.js"

echo "[1/5] Generating key and certificate..."
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$KEY" \
  -out "$CERT" \
  -config "$CNF"

echo "[2/5] Installing certificate (system trust)..."
# Linux (Debian/Arch style)
if [ -d "/usr/local/share/ca-certificates" ]; then
  sudo cp "$CERT" /usr/local/share/ca-certificates/localhost.crt
  sudo update-ca-certificates || true
# macOS
elif command -v security >/dev/null 2>&1; then
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT"
else
  echo "Unknown system, skipping cert install"
fi

echo "[3/5] Creating systemd service..."
SERVICE_NAME="deskos.service"
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"

sudo bash -c "cat > $SERVICE_PATH" <<EOF
[Unit]
Description=Deskos
After=network.target

[Service]
ExecStart=/usr/bin/env python3 $MAIN
WorkingDirectory=$WORKDIR
Restart=always
User=$USER

[Install]
WantedBy=multi-user.target
EOF

echo "[4/5] Enabling and starting service..."
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

echo "[5/5] Configuring Spicetify..."

# Get config path, strip filename to directory
SPICETIFY_CONF_PATH="$(spicetify -c)"
SPICETIFY_DIR="$(dirname "$SPICETIFY_CONF_PATH")"

EXT_DIR="$SPICETIFY_DIR/Extensions"
mkdir -p "$EXT_DIR"

cp "$CONTROLLER" "$EXT_DIR/controller.js"

spicetify config extensions controller.js

echo "Done, run 'spicetify apply' to apply the changes."