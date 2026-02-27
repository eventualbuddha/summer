import express from 'express';
import { createServer } from 'http';

// Statement import posts base64-encoded PDF bytes and can exceed adapter-node's
// default 512K body limit. Allow override via env, but default to a safer limit.
process.env.BODY_SIZE_LIMIT ??= '10M';

const { handler } = await import('./build/handler.js');

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Use SvelteKit handler for all requests
app.use(handler);

server.listen(PORT, HOST, () => {
	console.log(`Server listening on http://${HOST}:${PORT}`);
});
