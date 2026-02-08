import { json, type RequestHandler } from '@sveltejs/kit';

const BACKEND_SURREALDB_WS_URL = process.env.BACKEND_SURREALDB_WS_URL || '';
const DEFAULT_NAMESPACE = process.env.DEFAULT_NAMESPACE || 'summer';
const DEFAULT_DATABASE = process.env.DEFAULT_DATABASE || 'summer';

export const GET: RequestHandler = async ({ url, request }) => {
	const hasBackend = !!BACKEND_SURREALDB_WS_URL;

	// Construct the WebSocket proxy URL based on the current request
	// For localhost, always use ws:// (not secure)
	// For other hosts, check for forwarded protocol from reverse proxies
	const forwardedProto = request.headers.get('x-forwarded-proto');
	const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	const isSecure = !isLocalhost && (forwardedProto === 'https' || url.protocol === 'https:');
	const protocol = isSecure ? 'wss:' : 'ws:';
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
