<p align="center">
  <img src="icon.png" alt="Validate" width="120" />
</p>

<h1 align="center">Validate</h1>

<p align="center">
  A customer discovery co-pilot that plugs into Claude. Guiding founders from raw idea through to product-market fit signals using objective, emotionless and logical discovery call techniques. Channel your inner Spock to PMF!
</p>

<p align="center">
  <a href="#installation">Install</a> · <a href="#tools">Tools</a> · <a href="#development">Development</a> · <a href="#deployment">Deployment</a>
</p>

---

## What it does

Building the wrong thing is a direct route to startup failure. Validate helps you avoid that by structuring the messy process of customer discovery into a repeatable workflow:

1. **Define testable hypotheses:** break your idea into specific assumptions
2. **Find the right people:** build ideal customer profiles, source contacts
3. **Run discovery calls:** AI-generated call guides following Mom Test principles
4. **Capture insights:** structured debrief, transcript analysis, bias detection
5. **Synthesize and decide:** cross-call pattern analysis, pivot signals, validation scorecards

It runs as an [MCP server](https://modelcontextprotocol.io), so it works inside Claude Desktop, Claude Code, or any MCP-compatible client.

## Architecture

| Layer | Tech |
|---|---|
| Protocol | [Model Context Protocol](https://modelcontextprotocol.io) (stdio + SSE transport) |
| Runtime | Node.js / TypeScript |
| Database | SQLite via [Drizzle ORM](https://orm.drizzle.team) (WAL mode, auto-creates tables) |
| AI | Claude API for coaching, transcript analysis, and synthesis |
| Packaging | `.mcpb` bundle for one-click install |
| Deployment | Local (stdio) or remote ([Fly.io](https://fly.io) via SSE) |

## Installation

### One-click install (recommended)

Download the latest `validator.mcpb` from [Releases](../../releases), then double-click or drag it into Claude Desktop.

### Manual setup

```bash
git clone https://github.com/harrykeen/validator.git && cd validator
npm install && npm run build
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "validator": {
      "command": "node",
      "args": ["/path/to/validator/dist/server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-...",
        "DB_MODE": "sqlite",
        "DB_PATH": "~/.validator/data.db"
      }
    }
  }
}
```

## Tools

### Project & Hypothesis Management

| Tool | Description |
|---|---|
| `validate_idea` | Start validating a new idea — welcome message and coaching questions |
| `create_project` | Create a project record after the initial discussion |
| `list_projects` | List all validation projects |
| `get_project_status` | Full project overview with hypotheses, progress, and metrics |
| `create_hypothesis` | Add a testable hypothesis with acceptance criteria |
| `update_hypothesis` | Update status or confidence score |
| `list_hypotheses` | List hypotheses with confidence scores |
| `prioritize_hypotheses` | AI-ranked by importance and testability |

### Customer Identification

| Tool | Description |
|---|---|
| `create_icp` | Define an ideal customer profile |
| `suggest_channels` | AI suggests where to find your target customers |
| `add_contact` | Add a potential interviewee |
| `list_contacts` | List contacts with outreach status |
| `update_contact_status` | Track progress through the pipeline |
| `search_linkedin` | LinkedIn search queries for your ICP |
| `get_linkedin_profile` | Fetch LinkedIn profile details |

### Outreach

| Tool | Description |
|---|---|
| `generate_outreach` | AI-generated personalised outreach (no pitch, short, specific) |
| `list_outreach` | View all messages with status |
| `update_outreach_status` | Track sends and responses |
| `get_outreach_stats` | Response rates by channel |
| `suggest_outreach_variant` | AI A/B variant generation |

### Conversation Coaching

| Tool | Description |
|---|---|
| `generate_call_guide` | AI discussion guide following Mom Test principles |
| `get_call_principles` | Mom Test principles reference |
| `start_debrief` | Structured post-call debrief |
| `record_insight` | Capture insights tagged to hypotheses |
| `analyze_transcript` | AI transcript analysis with bias detection |

### Synthesis & Decision

| Tool | Description |
|---|---|
| `synthesize_insights` | Cross-call pattern analysis |
| `get_validation_scorecard` | Hypothesis evidence summary |
| `suggest_next_steps` | AI-recommended next actions |
| `detect_pivot_signals` | Pivot indicator analysis |
| `get_progress_report` | Metrics dashboard |

## Prompts

| Prompt | Description |
|---|---|
| `start-validation` | Kick off idea validation |
| `prep-for-call` | Pre-call coaching |
| `debrief-call` | Post-call insight extraction |
| `weekly-review` | Weekly synthesis and planning |
| `pivot-or-persevere` | Direction decision analysis |

## Development

```bash
npm install          # install dependencies
npm run build        # compile TypeScript
npm run dev          # watch mode
npm run lint         # check linting
npm run format       # auto-fix formatting
npm run test         # run test suite
npm run bundle       # build .mcpb package
```

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (required for AI features) | — |
| `DB_MODE` | `sqlite` or `postgres` | `sqlite` |
| `DB_PATH` | SQLite database path | `./validator.db` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `TRANSPORT` | `stdio` or `sse` | `stdio` |
| `PORT` | Port for SSE transport | `3000` |

## Deployment

Validate can run remotely on [Fly.io](https://fly.io) using SSE transport:

```bash
fly launch
fly secrets set ANTHROPIC_API_KEY=sk-...
fly volumes create validator_data --size 1
fly deploy
```

See `Dockerfile` and `fly.toml` for the production configuration.

## License

[MIT](LICENSE)
