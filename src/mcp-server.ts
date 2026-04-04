import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response, Router } from "express";
import { TrelloClient } from "./trello-client.js";
import {
  validateString,
  validateOptionalString,
  validateOptionalNumber,
  validateOptionalBoolean,
  validateOptionalStringArray,
  validateOptionalDateString,
} from "./validators.js";

const TOOL_DEFINITIONS = [
  // --- Boards ---
  {
    name: "list_boards",
    description: "List all open Trello boards for the authenticated user",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "set_active_board",
    description:
      "Set the active board for subsequent operations. Once set, boardId becomes optional in other tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "The ID of the board to set as active" },
      },
      required: ["boardId"],
    },
  },
  {
    name: "create_board",
    description: "Create a new Trello board",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Name of the new board" },
        desc: { type: "string", description: "Description of the board" },
        idOrganization: { type: "string", description: "Workspace ID to create the board in" },
        defaultLabels: { type: "boolean", description: "Whether to create default labels" },
        defaultLists: { type: "boolean", description: "Whether to create default lists" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_active_board_info",
    description:
      "Get detailed info about the active board including lists, members, and labels",
    inputSchema: { type: "object" as const, properties: {} },
  },

  // --- Workspaces ---
  {
    name: "list_workspaces",
    description: "List all Trello workspaces (organizations) the user belongs to",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "set_active_workspace",
    description: "Set the active workspace",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceId: { type: "string", description: "The workspace ID to set as active" },
      },
      required: ["workspaceId"],
    },
  },
  {
    name: "list_boards_in_workspace",
    description: "List all open boards in a specific workspace",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceId: { type: "string", description: "The workspace ID" },
      },
      required: ["workspaceId"],
    },
  },

  // --- Lists ---
  {
    name: "get_lists",
    description: "Get all open lists on a board",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
    },
  },
  {
    name: "add_list_to_board",
    description: "Add a new list to a board",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        name: { type: "string", description: "Name of the new list" },
      },
      required: ["name"],
    },
  },
  {
    name: "archive_list",
    description: "Archive (close) a list",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        listId: { type: "string", description: "The list ID to archive" },
      },
      required: ["listId"],
    },
  },

  // --- Cards ---
  {
    name: "get_cards_by_list_id",
    description: "Get all cards in a specific list",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        listId: { type: "string", description: "The list ID to get cards from" },
      },
      required: ["listId"],
    },
  },
  {
    name: "get_card",
    description:
      "Get detailed information about a specific card including checklists, members, attachments, comments",
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "The card ID" },
        includeMarkdown: {
          type: "boolean",
          description: "Return card as formatted markdown instead of JSON",
        },
      },
      required: ["cardId"],
    },
  },
  {
    name: "add_card_to_list",
    description: "Create a new card in a list",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        listId: { type: "string", description: "The list ID to add the card to" },
        name: { type: "string", description: "Card title" },
        description: { type: "string", description: "Card description (supports markdown)" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
        start: { type: "string", description: "Start date in YYYY-MM-DD format" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Array of label IDs to add",
        },
      },
      required: ["listId", "name"],
    },
  },
  {
    name: "update_card_details",
    description: "Update an existing card's details",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        cardId: { type: "string", description: "The card ID to update" },
        name: { type: "string", description: "New card title" },
        description: { type: "string", description: "New description" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
        start: { type: "string", description: "Start date in YYYY-MM-DD format" },
        dueComplete: { type: "boolean", description: "Whether the due date is complete" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Array of label IDs",
        },
      },
      required: ["cardId"],
    },
  },
  {
    name: "archive_card",
    description: "Archive (close) a card",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        cardId: { type: "string", description: "The card ID to archive" },
      },
      required: ["cardId"],
    },
  },
  {
    name: "move_card",
    description: "Move a card to a different list",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        cardId: { type: "string", description: "The card ID to move" },
        listId: { type: "string", description: "The destination list ID" },
      },
      required: ["cardId", "listId"],
    },
  },
  {
    name: "get_my_cards",
    description: "Get all cards assigned to the authenticated user across all boards",
    inputSchema: { type: "object" as const, properties: {} },
  },

  // --- Comments ---
  {
    name: "add_comment",
    description: "Add a comment to a card",
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "The card ID" },
        text: { type: "string", description: "Comment text" },
      },
      required: ["cardId", "text"],
    },
  },
  {
    name: "update_comment",
    description: "Update an existing comment",
    inputSchema: {
      type: "object" as const,
      properties: {
        commentId: { type: "string", description: "The comment/action ID" },
        text: { type: "string", description: "New comment text" },
      },
      required: ["commentId", "text"],
    },
  },
  {
    name: "delete_comment",
    description: "Delete a comment",
    inputSchema: {
      type: "object" as const,
      properties: {
        commentId: { type: "string", description: "The comment/action ID to delete" },
      },
      required: ["commentId"],
    },
  },
  {
    name: "get_card_comments",
    description: "Get comments on a card",
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "The card ID" },
        limit: { type: "number", description: "Max comments to return (default: 50)" },
      },
      required: ["cardId"],
    },
  },

  // --- Checklists ---
  {
    name: "create_checklist",
    description: "Create a new checklist on a card",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Checklist name" },
        cardId: { type: "string", description: "The card ID to add the checklist to" },
      },
      required: ["name", "cardId"],
    },
  },
  {
    name: "get_checklist_items",
    description: "Get all items in a checklist by name",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Checklist name to search for" },
        cardId: { type: "string", description: "Card ID to search in (optional)" },
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_checklist_item",
    description: "Add an item to an existing checklist",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Item text" },
        checkListName: { type: "string", description: "Name of the checklist to add to" },
        cardId: { type: "string", description: "Card ID (optional)" },
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
      required: ["text", "checkListName"],
    },
  },
  {
    name: "update_checklist_item",
    description: "Update a checklist item's state (complete/incomplete)",
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "The card ID containing the checklist" },
        checkItemId: { type: "string", description: "The check item ID" },
        state: {
          type: "string",
          enum: ["complete", "incomplete"],
          description: "New state",
        },
      },
      required: ["cardId", "checkItemId", "state"],
    },
  },
  {
    name: "find_checklist_items_by_description",
    description: "Search for checklist items by text across cards",
    inputSchema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "Text to search for in checklist items" },
        cardId: { type: "string", description: "Card ID to limit search (optional)" },
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
      required: ["description"],
    },
  },
  {
    name: "get_acceptance_criteria",
    description:
      'Get items from a checklist named "Acceptance Criteria" on a card',
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "Card ID (optional)" },
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
    },
  },
  {
    name: "get_checklist_by_name",
    description: "Find a checklist by name and get its full details",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Checklist name" },
        cardId: { type: "string", description: "Card ID (optional)" },
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
      required: ["name"],
    },
  },

  // --- Attachments ---
  {
    name: "attach_image_to_card",
    description: "Attach an image to a card by URL",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        cardId: { type: "string", description: "The card ID" },
        imageUrl: { type: "string", description: "URL of the image to attach" },
        name: { type: "string", description: "Name for the attachment" },
      },
      required: ["cardId", "imageUrl"],
    },
  },
  {
    name: "attach_file_to_card",
    description: "Attach a file to a card by URL",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        cardId: { type: "string", description: "The card ID" },
        fileUrl: { type: "string", description: "URL of the file to attach" },
        name: { type: "string", description: "Name for the attachment" },
        mimeType: { type: "string", description: "MIME type of the file" },
      },
      required: ["cardId", "fileUrl"],
    },
  },
  {
    name: "attach_image_data_to_card",
    description: "Attach image data (base64 or data URL) directly to a card",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        cardId: { type: "string", description: "The card ID" },
        imageData: {
          type: "string",
          description: "Base64 encoded image data or data URL",
        },
        name: { type: "string", description: "Filename for the image" },
        mimeType: { type: "string", description: "MIME type (default: image/png)" },
      },
      required: ["cardId", "imageData"],
    },
  },

  // --- Members ---
  {
    name: "get_board_members",
    description: "Get all members of a board",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
    },
  },
  {
    name: "assign_member_to_card",
    description: "Assign a member to a card",
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "The card ID" },
        memberId: { type: "string", description: "The member ID to assign" },
      },
      required: ["cardId", "memberId"],
    },
  },
  {
    name: "remove_member_from_card",
    description: "Remove a member from a card",
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "The card ID" },
        memberId: { type: "string", description: "The member ID to remove" },
      },
      required: ["cardId", "memberId"],
    },
  },

  // --- Labels ---
  {
    name: "get_board_labels",
    description: "Get all labels on a board",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
      },
    },
  },
  {
    name: "create_label",
    description: "Create a new label on a board",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        name: { type: "string", description: "Label name" },
        color: {
          type: "string",
          description:
            "Label color (green, yellow, orange, red, purple, blue, sky, lime, pink, black, null)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_label",
    description: "Update a label's name or color",
    inputSchema: {
      type: "object" as const,
      properties: {
        labelId: { type: "string", description: "The label ID" },
        name: { type: "string", description: "New label name" },
        color: { type: "string", description: "New label color" },
      },
      required: ["labelId"],
    },
  },
  {
    name: "delete_label",
    description: "Delete a label",
    inputSchema: {
      type: "object" as const,
      properties: {
        labelId: { type: "string", description: "The label ID to delete" },
      },
      required: ["labelId"],
    },
  },

  // --- Activity ---
  {
    name: "get_recent_activity",
    description: "Get recent activity on a board",
    inputSchema: {
      type: "object" as const,
      properties: {
        boardId: { type: "string", description: "Board ID (optional if active board is set)" },
        limit: { type: "number", description: "Max actions to return (default: 10)" },
      },
    },
  },
  {
    name: "get_card_history",
    description: "Get the action history of a specific card",
    inputSchema: {
      type: "object" as const,
      properties: {
        cardId: { type: "string", description: "The card ID" },
        filter: { type: "string", description: "Action type filter (default: all)" },
        limit: { type: "number", description: "Max actions to return (default: 50)" },
      },
      required: ["cardId"],
    },
  },
];

export class MCPServer {
  private trelloClient: TrelloClient;

  constructor(trelloClient: TrelloClient) {
    this.trelloClient = trelloClient;
  }

  private createServer(): Server {
    const server = new Server(
      { name: "trello-mcp", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers(server);
    return server;
  }

  private setupHandlers(server: Server): void {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOL_DEFINITIONS };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await this.handleToolCall(name, args ?? {});
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  private async handleToolCall(name: string, args: Record<string, unknown>) {
    const json = (data: unknown) => ({
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    });

    switch (name) {
      // --- Boards ---
      case "list_boards":
        return json(await this.trelloClient.listBoards());

      case "set_active_board": {
        const boardId = validateString(args.boardId, "boardId");
        return json(await this.trelloClient.setActiveBoard(boardId));
      }

      case "create_board": {
        const boardName = validateString(args.name, "name");
        return json(
          await this.trelloClient.createBoard({
            name: boardName,
            desc: validateOptionalString(args.desc),
            idOrganization: validateOptionalString(args.idOrganization),
            defaultLabels: validateOptionalBoolean(args.defaultLabels),
            defaultLists: validateOptionalBoolean(args.defaultLists),
          })
        );
      }

      case "get_active_board_info":
        return json(await this.trelloClient.getActiveBoardInfo());

      // --- Workspaces ---
      case "list_workspaces":
        return json(await this.trelloClient.listWorkspaces());

      case "set_active_workspace": {
        const workspaceId = validateString(args.workspaceId, "workspaceId");
        return json(await this.trelloClient.setActiveWorkspace(workspaceId));
      }

      case "list_boards_in_workspace": {
        const workspaceId = validateString(args.workspaceId, "workspaceId");
        return json(await this.trelloClient.listBoardsInWorkspace(workspaceId));
      }

      // --- Lists ---
      case "get_lists":
        return json(
          await this.trelloClient.getLists(
            validateOptionalString(args.boardId)
          )
        );

      case "add_list_to_board": {
        const listName = validateString(args.name, "name");
        return json(
          await this.trelloClient.addList(
            validateOptionalString(args.boardId),
            listName
          )
        );
      }

      case "archive_list": {
        const listId = validateString(args.listId, "listId");
        return json(
          await this.trelloClient.archiveList(
            validateOptionalString(args.boardId),
            listId
          )
        );
      }

      // --- Cards ---
      case "get_cards_by_list_id": {
        const listId = validateString(args.listId, "listId");
        return json(
          await this.trelloClient.getCardsByList(
            validateOptionalString(args.boardId),
            listId
          )
        );
      }

      case "get_card": {
        const cardId = validateString(args.cardId, "cardId");
        const result = await this.trelloClient.getCard(
          cardId,
          validateOptionalBoolean(args.includeMarkdown)
        );
        if (typeof result === "string") {
          return { content: [{ type: "text" as const, text: result }] };
        }
        return json(result);
      }

      case "add_card_to_list": {
        const listId = validateString(args.listId, "listId");
        const cardName = validateString(args.name, "name");
        return json(
          await this.trelloClient.addCard(
            validateOptionalString(args.boardId),
            {
              listId,
              name: cardName,
              description: validateOptionalString(args.description),
              dueDate: validateOptionalDateString(args.dueDate),
              start: validateOptionalDateString(args.start),
              labels: validateOptionalStringArray(args.labels),
            }
          )
        );
      }

      case "update_card_details": {
        const cardId = validateString(args.cardId, "cardId");
        return json(
          await this.trelloClient.updateCard(
            validateOptionalString(args.boardId),
            {
              cardId,
              name: validateOptionalString(args.name),
              description: validateOptionalString(args.description),
              dueDate: validateOptionalDateString(args.dueDate),
              start: validateOptionalDateString(args.start),
              dueComplete: validateOptionalBoolean(args.dueComplete),
              labels: validateOptionalStringArray(args.labels),
            }
          )
        );
      }

      case "archive_card": {
        const cardId = validateString(args.cardId, "cardId");
        return json(
          await this.trelloClient.archiveCard(
            validateOptionalString(args.boardId),
            cardId
          )
        );
      }

      case "move_card": {
        const cardId = validateString(args.cardId, "cardId");
        const listId = validateString(args.listId, "listId");
        return json(
          await this.trelloClient.moveCard(
            validateOptionalString(args.boardId),
            cardId,
            listId
          )
        );
      }

      case "get_my_cards":
        return json(await this.trelloClient.getMyCards());

      // --- Comments ---
      case "add_comment": {
        const cardId = validateString(args.cardId, "cardId");
        const text = validateString(args.text, "text");
        return json(await this.trelloClient.addCommentToCard(cardId, text));
      }

      case "update_comment": {
        const commentId = validateString(args.commentId, "commentId");
        const text = validateString(args.text, "text");
        return json(
          await this.trelloClient.updateCommentOnCard(commentId, text)
        );
      }

      case "delete_comment": {
        const commentId = validateString(args.commentId, "commentId");
        return json(await this.trelloClient.deleteCommentFromCard(commentId));
      }

      case "get_card_comments": {
        const cardId = validateString(args.cardId, "cardId");
        return json(
          await this.trelloClient.getCardComments(
            cardId,
            validateOptionalNumber(args.limit)
          )
        );
      }

      // --- Checklists ---
      case "create_checklist": {
        const clName = validateString(args.name, "name");
        const cardId = validateString(args.cardId, "cardId");
        return json(await this.trelloClient.createChecklist(clName, cardId));
      }

      case "get_checklist_items": {
        const clName = validateString(args.name, "name");
        return json(
          await this.trelloClient.getChecklistItems(
            clName,
            validateOptionalString(args.cardId),
            validateOptionalString(args.boardId)
          )
        );
      }

      case "add_checklist_item": {
        const text = validateString(args.text, "text");
        const checkListName = validateString(
          args.checkListName,
          "checkListName"
        );
        return json(
          await this.trelloClient.addChecklistItem(
            text,
            checkListName,
            validateOptionalString(args.cardId),
            validateOptionalString(args.boardId)
          )
        );
      }

      case "update_checklist_item": {
        const cardId = validateString(args.cardId, "cardId");
        const checkItemId = validateString(args.checkItemId, "checkItemId");
        const state = validateString(args.state, "state") as
          | "complete"
          | "incomplete";
        return json(
          await this.trelloClient.updateChecklistItem(
            cardId,
            checkItemId,
            state
          )
        );
      }

      case "find_checklist_items_by_description": {
        const description = validateString(args.description, "description");
        return json(
          await this.trelloClient.findChecklistItemsByDescription(
            description,
            validateOptionalString(args.cardId),
            validateOptionalString(args.boardId)
          )
        );
      }

      case "get_acceptance_criteria":
        return json(
          await this.trelloClient.getAcceptanceCriteria(
            validateOptionalString(args.cardId),
            validateOptionalString(args.boardId)
          )
        );

      case "get_checklist_by_name": {
        const clName = validateString(args.name, "name");
        return json(
          await this.trelloClient.getChecklistByName(
            clName,
            validateOptionalString(args.cardId),
            validateOptionalString(args.boardId)
          )
        );
      }

      // --- Attachments ---
      case "attach_image_to_card": {
        const cardId = validateString(args.cardId, "cardId");
        const imageUrl = validateString(args.imageUrl, "imageUrl");
        return json(
          await this.trelloClient.attachImageToCard(
            validateOptionalString(args.boardId),
            cardId,
            imageUrl,
            validateOptionalString(args.name)
          )
        );
      }

      case "attach_file_to_card": {
        const cardId = validateString(args.cardId, "cardId");
        const fileUrl = validateString(args.fileUrl, "fileUrl");
        return json(
          await this.trelloClient.attachFileToCard(
            validateOptionalString(args.boardId),
            cardId,
            fileUrl,
            validateOptionalString(args.name),
            validateOptionalString(args.mimeType)
          )
        );
      }

      case "attach_image_data_to_card": {
        const cardId = validateString(args.cardId, "cardId");
        const imageData = validateString(args.imageData, "imageData");
        return json(
          await this.trelloClient.attachImageDataToCard(
            validateOptionalString(args.boardId),
            cardId,
            imageData,
            validateOptionalString(args.name),
            validateOptionalString(args.mimeType)
          )
        );
      }

      // --- Members ---
      case "get_board_members":
        return json(
          await this.trelloClient.getBoardMembers(
            validateOptionalString(args.boardId)
          )
        );

      case "assign_member_to_card": {
        const cardId = validateString(args.cardId, "cardId");
        const memberId = validateString(args.memberId, "memberId");
        return json(
          await this.trelloClient.assignMemberToCard(cardId, memberId)
        );
      }

      case "remove_member_from_card": {
        const cardId = validateString(args.cardId, "cardId");
        const memberId = validateString(args.memberId, "memberId");
        return json(
          await this.trelloClient.removeMemberFromCard(cardId, memberId)
        );
      }

      // --- Labels ---
      case "get_board_labels":
        return json(
          await this.trelloClient.getBoardLabels(
            validateOptionalString(args.boardId)
          )
        );

      case "create_label": {
        const labelName = validateString(args.name, "name");
        return json(
          await this.trelloClient.createLabel(
            validateOptionalString(args.boardId),
            labelName,
            validateOptionalString(args.color)
          )
        );
      }

      case "update_label": {
        const labelId = validateString(args.labelId, "labelId");
        return json(
          await this.trelloClient.updateLabel(
            labelId,
            validateOptionalString(args.name),
            validateOptionalString(args.color)
          )
        );
      }

      case "delete_label": {
        const labelId = validateString(args.labelId, "labelId");
        return json(await this.trelloClient.deleteLabel(labelId));
      }

      // --- Activity ---
      case "get_recent_activity":
        return json(
          await this.trelloClient.getRecentActivity(
            validateOptionalString(args.boardId),
            validateOptionalNumber(args.limit)
          )
        );

      case "get_card_history": {
        const cardId = validateString(args.cardId, "cardId");
        return json(
          await this.trelloClient.getCardHistory(
            cardId,
            validateOptionalString(args.filter),
            validateOptionalNumber(args.limit)
          )
        );
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  getToolDefinitions() {
    return TOOL_DEFINITIONS;
  }

  createRouter(): Router {
    const router = Router();

    router.post("/", express.json(), async (req: Request, res: Response) => {
      const server = this.createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        server.close().catch(console.error);
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    return router;
  }

  async stop(): Promise<void> {
    console.log("MCP Server stopped");
  }
}
