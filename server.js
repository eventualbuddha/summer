import { handler } from './build/handler.js';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND_SURREALDB_WS_URL = process.env.BACKEND_SURREALDB_WS_URL;
const BACKEND_SURREALDB_HTTP_URL = process.env.BACKEND_SURREALDB_HTTP_URL;

// WebSocket proxy for SurrealDB
if (BACKEND_SURREALDB_WS_URL && BACKEND_SURREALDB_HTTP_URL) {
	// HTTP proxy for SurrealDB REST endpoints (like /version)
	app.use('/database', async (req, res, next) => {
		// Skip if this is a WebSocket upgrade request
		if (req.headers.upgrade === 'websocket') {
			return next();
		}

		const path = req.path;
		const targetUrl = BACKEND_SURREALDB_HTTP_URL + path;

		try {
			const response = await fetch(targetUrl, {
				method: req.method,
				headers: req.headers
			});

			// Set status
			res.status(response.status);

			// Copy headers (excluding content-length and transfer-encoding to avoid conflicts)
			response.headers.forEach((value, key) => {
				if (key.toLowerCase() !== 'content-length' && key.toLowerCase() !== 'transfer-encoding') {
					res.setHeader(key, value);
				}
			});

			// Send the response
			const text = await response.text();
			res.send(text);
		} catch (error) {
			console.error('HTTP proxy error:', error);
			res.status(502).send('Bad Gateway');
		}
	});

	const wss = new WebSocketServer({
		noServer: true // Handle upgrade manually
	});

	server.on('upgrade', (request, socket, head) => {
		if (request.url === '/database' || request.url.startsWith('/database/')) {
			wss.handleUpgrade(request, socket, head, (clientWs) => {
				// Get the subprotocol if specified
				const protocols = request.headers['sec-websocket-protocol'];

				// Connect to backend SurrealDB with same protocols
				const backendWs = new WebSocket(
					BACKEND_SURREALDB_WS_URL,
					protocols ? protocols.split(',').map((p) => p.trim()) : undefined
				);

				backendWs.on('message', (data, isBinary) => {
					clientWs.send(data, { binary: isBinary });
				});

				backendWs.on('error', (error) => {
					console.error('Backend WebSocket error:', error);
					clientWs.close();
				});

				backendWs.on('close', () => {
					clientWs.close();
				});

				clientWs.on('message', (data, isBinary) => {
					if (backendWs.readyState === WebSocket.OPEN) {
						backendWs.send(data, { binary: isBinary });
					}
				});

				clientWs.on('error', (error) => {
					console.error('Client WebSocket error:', error);
					backendWs.close();
				});

				clientWs.on('close', () => {
					backendWs.close();
				});
			});
		} else {
			socket.destroy();
		}
	});

	console.log('WebSocket proxy enabled at /database');
}

// Use SvelteKit handler for all requests
app.use(handler);

server.listen(PORT, HOST, () => {
	console.log(`Server listening on http://${HOST}:${PORT}`);
	if (BACKEND_SURREALDB_WS_URL) {
		console.log('Backend SurrealDB proxy enabled');
	}
});
