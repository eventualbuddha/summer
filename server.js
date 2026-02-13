import { handler } from './build/handler.js';
import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Use SvelteKit handler for all requests
app.use(handler);

server.listen(PORT, HOST, () => {
	console.log(`Server listening on http://${HOST}:${PORT}`);
});
