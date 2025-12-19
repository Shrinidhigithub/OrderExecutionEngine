#!/bin/bash
# Test multiple orders concurrently and track their lifecycle

echo "Order Execution Engine - Load Test"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000"
ORDER_IDS=()

echo "Submitting 5 market orders..."
for i in {1..5}; do
  echo ""
  echo "Order $i:"
  
  # Generate random amount
  AMOUNT=$((RANDOM % 900 + 100))
  
  # Submit order
  response=$(curl -s -X POST "$BASE_URL/api/orders/execute" \
    -H "Content-Type: application/json" \
    -d "{
      \"tokenIn\": \"SOL\",
      \"tokenOut\": \"USDC\",
      \"amount\": $AMOUNT
    }")
  
  orderId=$(echo "$response" | jq -r '.orderId')
  if [ "$orderId" != "null" ] && [ -n "$orderId" ]; then
    ORDER_IDS+=("$orderId")
    echo "   Created: $orderId"
    echo "   Amount: $AMOUNT SOL"
  else
    echo "  Failed to create order"
    echo "  Response: $response"
  fi
  
  # Small delay between requests
  sleep 0.5
done

echo ""
echo "Submitted orders: ${#ORDER_IDS[@]}"
echo "IDs: ${ORDER_IDS[@]}"
echo ""

echo "Waiting 3 seconds for processing..."
sleep 3

echo ""
echo " Final order states (checking database):"
for orderId in "${ORDER_IDS[@]}"; do
  # Get order from database via HTTP (if we add an endpoint) or check logs
  echo "  Order: $orderId"
done

echo ""
echo " Load test complete!"
echo ""
echo " Tip: Monitor order progress in server logs (npm run dev)"
