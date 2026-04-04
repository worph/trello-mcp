# trello-mcp

A self-contained, Dockerized MCP server for Trello board management, compatible with the [Beacon](../beacon/) discovery protocol.

Based on [delorenj/mcp-server-trello](https://github.com/delorenj/mcp-server-trello) (v1.7.1), rewritten to use **streamable HTTP transport** instead of stdio, with Beacon UDP discovery built in.

## Architecture

```
┌─────────────────────────────────────┐
│           trello-mcp container      │
│                                     │
│  ┌───────────┐   ┌──────────────┐  │
│  │  UDP 9099  │   │  HTTP 9099   │  │
│  │  Beacon    │   │  /mcp        │  │
│  │  Announce  │   │  Streamable  │  │
│  └───────────┘   └──────┬───────┘  │
│                          │          │
│                  ┌───────▼───────┐  │
│                  │ Trello Client │  │
│                  │ (REST API)    │  │
│                  └───────────────┘  │
└──────────────┬──────────────────────┘
               │ mcp-net
        ┌──────▼──────┐
        │   Beacon    │
        │  Aggregator │
        └─────────────┘
```

## Tools (40+)

| Category | Tools |
|---|---|
| **Boards** | `list_boards`, `set_active_board`, `create_board`, `get_active_board_info` |
| **Workspaces** | `list_workspaces`, `set_active_workspace`, `list_boards_in_workspace` |
| **Lists** | `get_lists`, `add_list_to_board`, `archive_list` |
| **Cards** | `get_card`, `get_cards_by_list_id`, `add_card_to_list`, `update_card_details`, `archive_card`, `move_card`, `get_my_cards` |
| **Comments** | `add_comment`, `update_comment`, `delete_comment`, `get_card_comments` |
| **Checklists** | `create_checklist`, `get_checklist_items`, `add_checklist_item`, `update_checklist_item`, `find_checklist_items_by_description`, `get_acceptance_criteria`, `get_checklist_by_name` |
| **Attachments** | `attach_image_to_card`, `attach_file_to_card`, `attach_image_data_to_card` |
| **Members** | `get_board_members`, `assign_member_to_card`, `remove_member_from_card` |
| **Labels** | `get_board_labels`, `create_label`, `update_label`, `delete_label` |
| **Activity** | `get_recent_activity`, `get_card_history` |

## Quick Start

### Prerequisites

- Docker with `mcp-net` network created: `docker network create mcp-net`
- Trello API key and token (see [Authentication](#authentication))
- Beacon aggregator running on `mcp-net`

### Run

```bash
docker compose up -d
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TRELLO_API_KEY` | Yes | Trello API key from Power-Ups Admin |
| `TRELLO_TOKEN` | Yes | Trello authorization token |
| `TRELLO_BOARD_ID` | No | Default board ID to activate on startup |
| `TRELLO_WORKSPACE_ID` | No | Default workspace ID |
| `MCP_PORT` | No | HTTP + UDP port (default: `9099`) |
| `DISCOVERY_PORT` | No | UDP discovery port (default: `9099`) |

### Authentication

You need a Trello **API key** and **token** to authenticate. Both are free and tied to your Trello account.

#### Step 1: Get your API Key

1. Log in to Trello in your browser
2. Go to https://trello.com/power-ups/admin (you may need to create a "Power-Up" first -- just give it any name like "trello-mcp")
3. Your **API Key** is displayed on the Power-Up page -- copy it

#### Step 2: Generate a Token

1. Replace `YOUR_API_KEY` in the URL below with the key from Step 1, then open it in your browser:
   ```
   https://trello.com/1/authorize?expiration=never&name=trello-mcp&scope=read,write&response_type=token&key=YOUR_API_KEY
   ```
2. Trello will ask you to authorize the app -- click **Allow**
3. A **token** string will be displayed on the next page -- copy it

> The token is set to never expire (`expiration=never`) and has read+write access (`scope=read,write`). You can change `expiration` to `1day`, `30days`, etc. if you prefer a shorter-lived token.

#### Step 3: Create your `.env` file

```bash
cp .env.template .env
```

Then edit `.env` with your values:
```env
TRELLO_API_KEY=your_api_key_here
TRELLO_TOKEN=your_token_here
```

#### Optional: Find your Board/Workspace IDs

To pre-set a default board or workspace, you can find their IDs by:
- **Board ID**: Open a board in Trello, look at the URL: `https://trello.com/b/BOARD_ID/board-name`
- **Workspace ID**: Use the `list_workspaces` tool after starting the server, or check the URL when viewing a workspace

Add them to `.env`:
```env
TRELLO_BOARD_ID=your_board_id
TRELLO_WORKSPACE_ID=your_workspace_id
```

## Beacon Integration

This server auto-announces itself on the `mcp-net` Docker network via UDP multicast (`239.255.99.1:9099`). Once Beacon discovers it, all tools become available through the Beacon aggregator as `trello-mcp__<tool_name>`.

No configuration needed -- just ensure both containers are on the same `mcp-net` network.

## Development

```bash
# Install dependencies
bun install

# Run locally (requires .env)
bun run dev

# Build Docker image
docker build -t trello-mcp .

# Run tests
bun test
```

## Tech Stack

- **Runtime**: Bun (Alpine)
- **Language**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` (streamable HTTP transport)
- **HTTP**: Express
- **Trello API**: axios with token-bucket rate limiting
- **Validation**: zod
- **Discovery**: Beacon Node.js SDK (dgram, zero dependencies)
