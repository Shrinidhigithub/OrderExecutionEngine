export function chooseBetterDex(rQuote: { price: number }, mQuote: { price: number }) {
  if (rQuote.price <= mQuote.price) return 'raydium';
  return 'meteora';
}
