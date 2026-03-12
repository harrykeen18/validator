# Validator — Customer Discovery Co-Pilot

MCP server that acts as a customer discovery co-pilot, guiding founders from raw idea through to product-market fit signals. Plugs into Claude.ai / Claude Desktop.

## Quick Start (Local)

```bash
git clone <repo-url> && cd validator
npm install
npm run build
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
- `create_project` — Initialize a new validation project
- `list_projects` — List all projects
- `get_project_status` — Full project overview with metrics
- `create_hypothesis` — Add a testable hypothesis
- `update_hypothesis` — Update status with evidence
- `list_hypotheses` — List hypotheses with confidence scores
- `prioritize_hypotheses` — AI-ranked by importance and testability

### Customer Identification
- `create_icp` — Define an ideal customer profile
- `suggest_channels` — AI suggests where to find your customers
- `add_contact` — Add a potential interviewee
- `list_contacts` — List contacts with status
- `update_contact_status` — Track outreach progress
- `search_linkedin` / `get_linkedin_profile` — LinkedIn integration

### Outreach
- `generate_outreach` — AI-generated personalized outreach (no pitch, short, specific)
- `list_outreach` — View all messages with status
- `update_outreach_status` — Track sends and responses
- `get_outreach_stats` — Response rates by channel
- `suggest_outreach_variant` — AI A/B variant generation

### Conversation Coaching
- `generate_call_guide` — AI discussion guide following Mom Test principles
- `get_call_principles` — Mom Test principles reference
- `start_debrief` — Structured post-call debrief
- `record_insight` — Capture insights tagged to hypotheses
- `analyze_transcript` — AI transcript analysis with bias detection

### Synthesis
- `synthesize_insights` — AI cross-call pattern analysis
- `get_validation_scorecard` — Hypothesis evidence summary
- `suggest_next_steps` — AI-recommended next actions
- `detect_pivot_signals` — AI pivot indicator analysis
- `get_progress_report` — Metrics dashboard

## Prompts

- **start-validation** — Kick off idea validation
- **prep-for-call** — Pre-call coaching
- **debrief-call** — Post-call insight extraction
- **weekly-review** — Weekly synthesis and planning
- **pivot-or-persevere** — Direction decision analysis

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (required for AI features) | — |
| `DB_MODE` | `sqlite` or `postgres` | `sqlite` |
| `DB_PATH` | SQLite database path | `./validator.db` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `TRANSPORT` | `stdio` or `sse` | `stdio` |
| `PORT` | Port for SSE transport | `3000` |

## Hosted Deployment (fly.io)

```bash
fly launch
fly secrets set ANTHROPIC_API_KEY=sk-...
fly volumes create validator_data --size 1
fly deploy
```
