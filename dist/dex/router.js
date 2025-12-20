"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseBetterDex = chooseBetterDex;
function chooseBetterDex(rQuote, mQuote) {
    if (rQuote.price <= mQuote.price)
        return 'raydium';
    return 'meteora';
}
