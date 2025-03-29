# <img src="static/icon-transparent.png" alt="Summer Logo" width="36"> Summer

Summer is a terrible pun, and also the app I use to track my spending. You probably should not use it. In case you're curious, here's what it looks like:

<img src="static/screenshot.png" alt="Screenshot of Summer app interface with demo data" width="800">

## Setup

### Self-Hosted

1. Clone the repository: `git clone https://github.com/eventualbuddha/summer.git`
2. Install [Bun](https://bun.sh/)
3. Install [SurrealDB](https://surrealdb.com/)
4. Install dependencies: `bun install`
5. Run the app: `bun run dev --open`
6. Enter the URL and namespace/database for the your SurrealDB instance. This can just be `ws://localhost:8000/rpc` if you're running SurrealDB locally, and the namespace and database can be whatever you want.

### Cloud

TBD. I'd like to host it somewhere static and just connect directly to SurrealDB from the browser, but haven't worked out exactly how to do that yet.

## License

MIT License
