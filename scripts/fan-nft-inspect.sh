#!/usr/bin/env bash
# Inspect FanPulse soulbound NFT on Somnia Shannon.
# Usage:
#   ./scripts/fan-nft-inspect.sh
#   ./scripts/fan-nft-inspect.sh 0xYourWallet
#   ./scripts/fan-nft-inspect.sh --set-tier 0xWallet 2   # owner only: 0=Rookie..4=Oracle

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

RPC="${RPC_URL:-https://api.infra.testnet.somnia.network}"
NFT="${FAN_NFT_ADDRESS:?Set FAN_NFT_ADDRESS in .env}"
EXPLORER="${SOMNIA_EXPLORER_URL:-https://shannon-explorer.somnia.network}"
PK="${FAN_NFT_PRIVATE_KEY:-${AGENTS_PRIVATE_KEY:-}}"

tier_name() {
  case "$1" in
    0) echo Rookie ;;
    1) echo Scout ;;
    2) echo Analyst ;;
    3) echo Expert ;;
    4) echo Oracle ;;
    *) echo "unknown($1)" ;;
  esac
}

decode_uri() {
  python3 - "$1" <<'PY'
import base64, json, sys
uri = sys.argv[1]
if not uri.startswith("data:application/json;base64,"):
    print(uri[:120] + ("..." if len(uri) > 120 else ""))
    raise SystemExit(0)
meta = json.loads(base64.b64decode(uri.split(",", 1)[1]))
print(json.dumps(meta, indent=2))
PY
}

inspect_wallet() {
  local wallet="$1"
  echo "── Wallet $wallet"
  local token_id
  token_id=$(cast call "$NFT" "tokenOfWallet(address)(uint256)" "$wallet" --rpc-url "$RPC")
  if [[ "$token_id" == "0" ]]; then
    echo "   Not minted yet (Rookie band or never synced)."
    return
  fi
  local tier owner uri
  tier=$(cast call "$NFT" "tierOf(uint256)(uint8)" "$token_id" --rpc-url "$RPC")
  owner=$(cast call "$NFT" "ownerOf(uint256)(address)" "$token_id" --rpc-url "$RPC")
  uri=$(cast call "$NFT" "tokenURI(uint256)(string)" "$token_id" --rpc-url "$RPC")
  echo "   tokenId:  $token_id"
  echo "   owner:    $owner"
  echo "   tier:     $(tier_name "$tier") ($tier)"
  echo "   token:    $EXPLORER/token/$NFT?a=$token_id"
  echo "   contract: $EXPLORER/address/$NFT"
  echo "   metadata:"
  decode_uri "$uri" | sed 's/^/      /'
}

if [[ "${1:-}" == "--set-tier" ]]; then
  wallet="${2:?wallet required}"
  tier="${3:?tier 0-4 required}"
  [[ -n "$PK" ]] || { echo "AGENTS_PRIVATE_KEY or FAN_NFT_PRIVATE_KEY required"; exit 1; }
  echo "Sending setTier($wallet, $tier=$(tier_name "$tier"))..."
  tx=$(cast send "$NFT" "setTier(address,uint8)" "$wallet" "$tier" \
    --rpc-url "$RPC" --private-key "$PK" --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["transactionHash"])')
  echo "tx: $EXPLORER/tx/$tx"
  sleep 3
  inspect_wallet "$wallet"
  exit 0
fi

echo "FanPulse Fan NFT"
echo "  contract: $NFT"
echo "  explorer: $EXPLORER/address/$NFT"
echo "  name:     $(cast call "$NFT" "name()(string)" --rpc-url "$RPC")"
echo "  symbol:   $(cast call "$NFT" "symbol()(string)" --rpc-url "$RPC")"
echo "  owner:    $(cast call "$NFT" "owner()(address)" --rpc-url "$RPC")"
echo "  minted:   $(( $(cast call "$NFT" "nextTokenId()(uint256)" --rpc-url "$RPC") - 1 ))"
echo

if [[ -n "${1:-}" ]]; then
  inspect_wallet "$1"
else
  inspect_wallet "0x2b284c179a65709fC823711e6D76134E55a63798"
  echo
  inspect_wallet "0xf9ab0c3c503d22f52f23e3deabd8ad7b70680cf9"
fi
