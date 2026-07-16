function randomSuffix() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildCashierIdempotencyKey({
  operation,
  orderId,
  method,
}: {
  operation: string;
  orderId?: string;
  method?: string;
}) {
  return ["cashier", operation, orderId, method, randomSuffix()]
    .filter(Boolean)
    .join(":");
}
