# <img src="static/icon-transparent.png" alt="Summer Logo" width="36"> Summer

Summer is a terrible pun, and also the app I use to track my spending. You probably should not use it. In case you're curious, here's what it looks like:

<img src="static/screenshot.png" alt="Screenshot of Summer app interface with demo data" width="800">

## Setup

### Docker Compose (Recommended)

The easiest way to run Summer is with Docker Compose, which includes a built-in SurrealDB instance:

1. Clone the repository: `git clone https://github.com/eventualbuddha/summer.git`
2. Run with Docker Compose: `docker compose up`
3. Open http://localhost:3000 in your browser

The database uses the `summer` namespace and `summer` database by default. Data is persisted on the host via a volume mount.

### Self-Hosted

1. Clone the repository: `git clone https://github.com/eventualbuddha/summer.git`
2. Install [Node.js](https://nodejs.org/) (v25 or later)
3. Install and start [SurrealDB](https://surrealdb.com/) locally
4. Install dependencies: `npm install`
5. Build the app: `npm run build`
6. Set environment variables and start the server:
   ```bash
   export SURREALDB_URL=http://localhost:8000
   npm start
   ```
7. Open http://localhost:3000

#### Environment Variables

| Variable              | Default   | Description              |
| --------------------- | --------- | ------------------------ |
| `SURREALDB_URL`       | (none)    | SurrealDB connection URL |
| `SURREALDB_NAMESPACE` | `summer`  | SurrealDB namespace      |
| `SURREALDB_DATABASE`  | `summer`  | SurrealDB database name  |
| `PORT`                | `3000`    | Server port              |
| `HOST`                | `0.0.0.0` | Server bind address      |

### Development

For development with hot reload:

```bash
npm run dev
```

This automatically starts a local SurrealDB instance and the Vite dev server.

## License

MIT License
