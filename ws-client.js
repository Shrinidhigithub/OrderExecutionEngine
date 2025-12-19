// ws-client.js
const WebSocket = require('ws');
const id = process.argv[2];
if (!id) { console.error('usage: node ws-client.js <orderId>'); process.exit(1); }
const ws = new WebSocket(`ws://localhost:3000/api/orders/execute?orderId=${id}`);
ws.on('open', () => console.log('open'));
ws.on('message', (m) => console.log('msg:', m.toString()));
ws.on('error', (e) => console.error('err:', e));
ws.on('close', (c, r) => console.log('closed', c, r));
