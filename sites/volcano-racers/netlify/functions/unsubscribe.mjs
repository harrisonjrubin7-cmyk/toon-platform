// Netlify wrapper around the same handler used on Vercel (api/unsubscribe.js).
import handler from '../../api/unsubscribe.js';
import { toNetlify } from '../adapter.mjs';

export default toNetlify(handler);
export const config = { path: '/api/unsubscribe' };
