// Netlify wrapper around the same handler used on Vercel (api/subscribe.js).
import handler from '../../api/subscribe.js';
import { toNetlify } from '../adapter.mjs';

export default toNetlify(handler);
export const config = { path: '/api/subscribe' };
