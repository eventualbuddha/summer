# <img src="static/icon-transparent.png" alt="Summer Logo" width="36"> Summer

Summer is the app I use to track spending, manage budgets, and review trends over time.

Here are a few views from the app (click any image to open the full-size version):

<table>
  <tr>
    <td align="center">
      <a href="static/screenshots/transactions-filtered-with-category-dropdown.png">
        <img src="static/screenshots/transactions-filtered-with-category-dropdown.png" alt="Transactions screen with filters applied and category dropdown open" width="380">
      </a>
      <br>
      <sub>Transactions: filtered + category dropdown</sub>
    </td>
    <td align="center">
      <a href="static/screenshots/transactions-dark-mode.png">
        <img src="static/screenshots/transactions-dark-mode.png" alt="Transactions screen in dark mode" width="380">
      </a>
      <br>
      <sub>Transactions: dark mode</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="static/screenshots/budget-reports-monthly.png">
        <img src="static/screenshots/budget-reports-monthly.png" alt="Budget reports monthly chart view" width="380">
      </a>
      <br>
      <sub>Budget reports: monthly chart</sub>
    </td>
    <td align="center">
      <a href="static/screenshots/transactions-bulk-edit-modal.png">
        <img src="static/screenshots/transactions-bulk-edit-modal.png" alt="Bulk transaction edit modal" width="380">
      </a>
      <br>
      <sub>Transactions: bulk edit modal</sub>
    </td>
  </tr>
</table>

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

## Screenshot Generation

README screenshots are generated with Playwright using the `create-demo` dataset.

- Generate local screenshots into `static/screenshots/`:
  ```bash
  npm run screenshots:readme
  ```
- Generate screenshots in CI artifact format:
  ```bash
  npm run test:screenshots
  ```

The screenshot suite captures:

- Transactions (filtered view with Categories dropdown open)
- Transactions (dark mode)
- Budget Reports (monthly chart view for the previous complete year)
- Bulk Edit modal

## License

MIT License
