# @brontoio/n8n-nodes-bronto

An [n8n](https://n8n.io/) community node for the [Bronto.io](https://bronto.io) log management platform.

Search and query your Bronto log data directly from n8n workflows.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Usage](#usage)
[Resources](#resources)

## Installation

### In n8n (Community Nodes)

1. Open **Settings > Community Nodes**
2. Enter `@brontoio/n8n-nodes-bronto`
3. Click **Install**

### Manual

```bash
cd ~/.n8n
npm install @brontoio/n8n-nodes-bronto
```

Restart n8n after installation.

## Operations

- **Search logs** — query log datasets using Bronto's Search API
- **Dynamic log selection** — pick logs from a dropdown populated from your account
- **Tag-based search** — search by tags instead of specific datasets
- **Aggregations** — use `count()`, `sum()`, `avg()`, `min()`, `max()` with optional group-by
- **Pagination** — optionally follow `next_page_url` to retrieve all results
- **Multi-region** — supports both EU and US Bronto regions

## Credentials

1. In n8n, go to **Credentials > New Credential > Bronto API**
2. Select your **Region** (EU or US)
3. Enter your **API Key**
4. Click **Test** to verify the connection

API keys can be generated from the [Bronto.io dashboard](https://bronto.io).

## Usage

### Node Parameters

| Parameter | Description |
|-----------|-------------|
| **Source Type** | Search by log datasets or tags |
| **Logs** | Multi-select dropdown of available log datasets (fetched from your account) |
| **Time Range** | Relative time range, e.g. `Last 1 hour`, `Last 2 days` |
| **Where** | SQL-like filter expression, e.g. `level:error AND duration_ms>2000` |
| **Select** | Comma-separated columns or aggregates, e.g. `*, @raw` or `count()` |
| **Groups** | Key to group aggregate results by |
| **Limit** | Max results to return (1–6666, default 100) |

### Additional Options

| Option | Description |
|--------|-------------|
| **Most Recent First** | Return newest results first (default: true) |
| **Number of Slices** | Time series buckets for aggregate queries |
| **From/To Timestamp** | Absolute time range in Unix milliseconds |
| **Paginate** | Automatically fetch all pages of results |

### Example

1. Add a **Bronto** node to your workflow
2. Select one or more logs from the dropdown
3. Set a time range and optional filters
4. Execute the node to retrieve matching log events

Results are returned as individual items — one per log event (or per aggregate group) — ready to be processed by downstream nodes.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Bronto.io documentation](https://bronto.io)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally with Docker
docker compose up --build -d
# Open http://localhost:5678
```

## License

[MIT](LICENSE)
