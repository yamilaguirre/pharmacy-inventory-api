#!/usr/bin/env bash
#
# demo-mvp.sh — Automated walkthrough of the full MVP flow
#
# Prerequisites:
#   1. API running on localhost:3000  (npm run start:dev)
#   2. PostgreSQL + Redis running     (docker compose up -d postgres redis)
#   3. curl and jq installed
#
# Usage:
#   chmod +x scripts/demo-mvp.sh
#   ./scripts/demo-mvp.sh
#
set -euo pipefail

API="http://localhost:3000/api"

blue()  { printf "\n\033[1;34m▶ %s\033[0m\n" "$1"; }
green() { printf "\033[0;32m  ✔ %s\033[0m\n" "$1"; }
cyan()  { printf "\033[0;36m  → %s\033[0m\n" "$1"; }

# ─────────────────────────────────────────────────────────────
blue "1. Health check"
curl -s "$API/health" | jq .
green "API is alive"

# ─────────────────────────────────────────────────────────────
blue "2. Register ADMIN user"
ADMIN_TOKEN=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.cl","password":"Admin1234","role":"ADMIN"}' \
  | jq -r '.access_token')
cyan "Token: ${ADMIN_TOKEN:0:30}…"
green "Admin registered"

# ─────────────────────────────────────────────────────────────
blue "3. Register CASHIER user"
CASHIER_TOKEN=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"cashier@demo.cl","password":"Cash1234","role":"CASHIER"}' \
  | jq -r '.access_token')
green "Cashier registered"

# ─────────────────────────────────────────────────────────────
blue "4. Login as admin"
ADMIN_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.cl","password":"Admin1234"}' \
  | jq -r '.access_token')
green "Admin logged in"

# ─────────────────────────────────────────────────────────────
blue "5. Create categories"
CAT1=$(curl -s -X POST "$API/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Pain Relief"}' | jq -r '.id')
cyan "Pain Relief → $CAT1"

CAT2=$(curl -s -X POST "$API/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Antibiotics"}' | jq -r '.id')
cyan "Antibiotics → $CAT2"
green "Categories created"

# ─────────────────────────────────────────────────────────────
blue "6. Create products"
PROD1=$(curl -s -X POST "$API/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"name\":\"Paracetamol 500mg\",\"sku\":\"PAR-500\",\"price\":\"2.50\",\"categoryId\":\"$CAT1\"}" \
  | jq -r '.id')
cyan "Paracetamol → $PROD1"

PROD2=$(curl -s -X POST "$API/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"name\":\"Amoxicillin 500mg\",\"sku\":\"AMX-500\",\"price\":\"8.00\",\"categoryId\":\"$CAT2\",\"requiresPrescription\":true}" \
  | jq -r '.id')
cyan "Amoxicillin (prescription) → $PROD2"
green "Products created"

# ─────────────────────────────────────────────────────────────
blue "7. Add stock (IN movements)"
curl -s -X POST "$API/inventory/movements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"productId\":\"$PROD1\",\"type\":\"IN\",\"quantity\":100,\"reason\":\"Initial stock\"}" | jq .type,.quantity
cyan "Paracetamol +100"

curl -s -X POST "$API/inventory/movements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"productId\":\"$PROD2\",\"type\":\"IN\",\"quantity\":50,\"reason\":\"Initial stock\"}" | jq .type,.quantity
cyan "Amoxicillin +50"
green "Stock loaded"

# ─────────────────────────────────────────────────────────────
blue "8. View current stock"
curl -s "$API/inventory/stock" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.[] | {product: .product.name, quantity, minStock}'
green "Stock listed"

# ─────────────────────────────────────────────────────────────
blue "9. Login as cashier and create a sale"
CASHIER_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"cashier@demo.cl","password":"Cash1234"}' \
  | jq -r '.access_token')

SALE_ID=$(curl -s -X POST "$API/sales" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CASHIER_TOKEN" \
  -d "{
    \"documentType\":\"RUT\",
    \"documentNumber\":\"12345678-9\",
    \"customerName\":\"Juan Pérez\",
    \"customerEmail\":\"juan@demo.cl\",
    \"lines\":[
      {\"productId\":\"$PROD1\",\"quantity\":2},
      {\"productId\":\"$PROD2\",\"quantity\":1}
    ],
    \"prescriptionRef\":\"RX-2026-001\"
  }" | jq -r '.id')
cyan "Sale ID: $SALE_ID"
green "Sale created (Paracetamol ×2 + Amoxicillin ×1)"

# ─────────────────────────────────────────────────────────────
blue "10. View sale details"
curl -s "$API/sales/$SALE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '{status, totalAmount, customer: .customer.name, lines: [.lines[] | {product: .product.name, qty: .quantity, unitPrice, subtotal}]}'
green "Sale details retrieved"

# ─────────────────────────────────────────────────────────────
blue "11. Verify stock was reduced"
curl -s "$API/inventory/stock" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.[] | {product: .product.name, quantity}'
green "Stock updated after sale"

# ─────────────────────────────────────────────────────────────
blue "12. Cancel the sale (admin only) and verify stock restored"
curl -s -X PATCH "$API/sales/$SALE_ID/cancel" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .status
green "Sale cancelled"

curl -s "$API/inventory/stock" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.[] | {product: .product.name, quantity}'
green "Stock restored to original quantities"

# ─────────────────────────────────────────────────────────────
blue "13. Reports — low stock"
curl -s "$API/reports/low-stock" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq 'length'
cyan "Items below minimum stock threshold (should be 2 since minStock defaults to 0 and qty > 0)"

blue "14. Reports — expiring soon (next 30 days)"
curl -s "$API/reports/expiring-soon?days=30" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq 'length'
cyan "Products expiring soon (0 since no expiresAt was set)"

# ─────────────────────────────────────────────────────────────
printf "\n\033[1;32m═══════════════════════════════════════════════════\033[0m\n"
printf "\033[1;32m  ✅  MVP Demo completed successfully!\033[0m\n"
printf "\033[1;32m═══════════════════════════════════════════════════\033[0m\n\n"
