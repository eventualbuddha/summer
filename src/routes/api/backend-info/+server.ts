import { json, type RequestHandler } from '@sveltejs/kit';

const BACKEND_SURREALDB_WS_URL = process.env.BACKEND_SURREALDB_WS_URL || '';
const DEFAULT_NAMESPACE = process.env.DEFAULT_NAMESPACE || 'summer';
const DEFAULT_DATABASE = process.env.DEFAULT_DATABASE || 'summer';

export const GET: RequestHandler = async ({ url }) => {
	const hasBackend = !!BACKEND_SURREALDB_WS_URL;

	// Construct the WebSocket proxy URL based on the current request
	const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	const proxyUrl = hasBackend ? `${protocol}//${url.host}/database` : '';

	return json({
		hasBackend,
		...(hasBackend && {
			url: proxyUrl,
			defaultNamespace: DEFAULT_NAMESPACE,
			defaultDatabase: DEFAULT_DATABASE
		})
	});
};
