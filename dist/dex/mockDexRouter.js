"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDexRouter = void 0;
const sleep_1 = require("../utils/sleep");
const uuid_1 = require("uuid");
class MockDexRouter {
    constructor() {
        this.basePrice = 100; // arbitrary base price for simulation
    }
    async getRaydiumQuote(tokenIn, tokenOut, amount) {
        await (0, sleep_1.sleep)(200 + Math.random() * 100);
        const price = this.basePrice * (0.98 + Math.random() * 0.04);
        return { price, fee: 0.003 };
    }
    async getMeteoraQuote(tokenIn, tokenOut, amount) {
        await (0, sleep_1.sleep)(200 + Math.random() * 100);
        const price = this.basePrice * (0.97 + Math.random() * 0.05);
        return { price, fee: 0.002 };
    }
    async executeSwap(dex, order) {
        // Simulate execution delay
        await (0, sleep_1.sleep)(2000 + Math.random() * 1000);
        const finalPrice = this.basePrice * (0.98 + Math.random() * 0.04);
        return { txHash: (0, uuid_1.v4)(), executedPrice: finalPrice };
    }
}
exports.MockDexRouter = MockDexRouter;
