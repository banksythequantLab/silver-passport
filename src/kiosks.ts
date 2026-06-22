import 'dotenv/config';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { kiosk } from '@mysten/kiosk';
const c = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' }).$extend(kiosk());
const k = await c.kiosk.getOwnedKiosks({ address: '0x6e38f5b2b3957a54c74aaec24594d3ef68b27fede24d0b9a99d562a6c58e5bb2' });
console.log('operator kiosks:', JSON.stringify(k.kioskIds));