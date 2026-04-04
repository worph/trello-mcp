import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import { createTrelloRateLimiters } from "./rate-limiter.js";
import type {
  TrelloConfig,
  TrelloBoard,
  TrelloWorkspace,
  TrelloCard,
  TrelloList,
  TrelloAction,
  TrelloMember,
  TrelloAttachment,
  TrelloCheckItem,
  TrelloChecklist,
  TrelloLabelDetails,
  TrelloComment,
  EnhancedTrelloCard,
  CheckList,
  CheckListItem,
} from "./types.js";

export class TrelloClient {
  private axiosInstance: AxiosInstance;
  private rateLimiter;
  private _activeBoardId?: string;
  private _activeWorkspaceId?: string;

  constructor(private config: TrelloConfig) {
    this._activeBoardId = config.boardId || config.defaultBoardId;
    this._activeWorkspaceId = config.workspaceId;

    this.axiosInstance = axios.create({
      baseURL: "https://api.trello.com/1",
      params: {
        key: config.apiKey,
        token: config.token,
      },
    });

    this.rateLimiter = createTrelloRateLimiters();
    this.axiosInstance.interceptors.request.use(async (reqConfig) => {
      await this.rateLimiter.waitForAvailableToken();
      return reqConfig;
    });
  }

  get activeBoardId(): string | undefined {
    return this._activeBoardId;
  }

  get activeWorkspaceId(): string | undefined {
    return this._activeWorkspaceId;
  }

  private resolveBoardId(boardId?: string): string {
    const id = boardId || this._activeBoardId;
    if (!id) {
      throw new Error(
        "No board ID provided and no active board set. Use set_active_board first."
      );
    }
    return id;
  }

  // --- Boards & Workspaces ---

  async setActiveBoard(boardId: string): Promise<TrelloBoard> {
    const board = await this.getBoardById(boardId);
    this._activeBoardId = boardId;
    return board;
  }

  async setActiveWorkspace(workspaceId: string): Promise<TrelloWorkspace> {
    const workspace = await this.getWorkspaceById(workspaceId);
    this._activeWorkspaceId = workspaceId;
    return workspace;
  }

  async listBoards(): Promise<TrelloBoard[]> {
    const resp = await this.axiosInstance.get("/members/me/boards", {
      params: { filter: "open" },
    });
    return resp.data;
  }

  async getBoardById(boardId: string): Promise<TrelloBoard> {
    const resp = await this.axiosInstance.get(`/boards/${boardId}`);
    return resp.data;
  }

  async createBoard(params: {
    name: string;
    desc?: string;
    idOrganization?: string;
    defaultLabels?: boolean;
    defaultLists?: boolean;
  }): Promise<TrelloBoard> {
    const resp = await this.axiosInstance.post("/boards", null, {
      params: {
        name: params.name,
        desc: params.desc,
        idOrganization: params.idOrganization,
        defaultLabels: params.defaultLabels,
        defaultLists: params.defaultLists,
      },
    });
    return resp.data;
  }

  async listWorkspaces(): Promise<TrelloWorkspace[]> {
    const resp = await this.axiosInstance.get("/members/me/organizations");
    return resp.data;
  }

  async getWorkspaceById(workspaceId: string): Promise<TrelloWorkspace> {
    const resp = await this.axiosInstance.get(`/organizations/${workspaceId}`);
    return resp.data;
  }

  async listBoardsInWorkspace(workspaceId: string): Promise<TrelloBoard[]> {
    const resp = await this.axiosInstance.get(
      `/organizations/${workspaceId}/boards`,
      { params: { filter: "open" } }
    );
    return resp.data;
  }

  async getActiveBoardInfo(): Promise<{
    board: TrelloBoard;
    lists: TrelloList[];
    members: TrelloMember[];
    labels: TrelloLabelDetails[];
  }> {
    const boardId = this.resolveBoardId();
    const [board, lists, members, labels] = await Promise.all([
      this.getBoardById(boardId),
      this.getLists(boardId),
      this.getBoardMembers(boardId),
      this.getBoardLabels(boardId),
    ]);
    return { board, lists, members, labels };
  }

  // --- Lists ---

  async getLists(boardId?: string): Promise<TrelloList[]> {
    const id = this.resolveBoardId(boardId);
    const resp = await this.axiosInstance.get(`/boards/${id}/lists`, {
      params: { filter: "open" },
    });
    return resp.data;
  }

  async addList(boardId: string | undefined, name: string): Promise<TrelloList> {
    const id = this.resolveBoardId(boardId);
    const resp = await this.axiosInstance.post("/lists", null, {
      params: { name, idBoard: id },
    });
    return resp.data;
  }

  async archiveList(
    boardId: string | undefined,
    listId: string
  ): Promise<TrelloList> {
    const resp = await this.axiosInstance.put(`/lists/${listId}/closed`, null, {
      params: { value: true },
    });
    return resp.data;
  }

  // --- Cards ---

  async getCardsByList(
    boardId: string | undefined,
    listId: string
  ): Promise<TrelloCard[]> {
    const resp = await this.axiosInstance.get(`/lists/${listId}/cards`);
    return resp.data;
  }

  async getCard(
    cardId: string,
    includeMarkdown?: boolean
  ): Promise<EnhancedTrelloCard | string> {
    const resp = await this.axiosInstance.get(`/cards/${cardId}`, {
      params: {
        fields: "all",
        checklists: "all",
        checklist_fields: "all",
        members: true,
        member_fields: "id,fullName,username,avatarUrl",
        attachments: true,
        attachment_fields: "all",
        actions: "commentCard",
        actions_limit: 50,
        customFieldItems: true,
        board: true,
        board_fields: "id,name,url",
        list: true,
        list_fields: "id,name",
      },
    });

    const card = resp.data as EnhancedTrelloCard;
    if (includeMarkdown) {
      return this.formatCardAsMarkdown(card);
    }
    return card;
  }

  private formatCardAsMarkdown(card: EnhancedTrelloCard): string {
    const lines: string[] = [];
    lines.push(`# ${card.name}`);
    lines.push("");
    if (card.desc) {
      lines.push(card.desc);
      lines.push("");
    }
    lines.push(`**Board:** ${card.board?.name || "N/A"}`);
    lines.push(`**List:** ${card.list?.name || "N/A"}`);
    lines.push(`**URL:** ${card.url}`);
    if (card.due) lines.push(`**Due:** ${card.due}`);
    if (card.labels.length > 0) {
      lines.push(
        `**Labels:** ${card.labels.map((l) => l.name || l.color).join(", ")}`
      );
    }
    if (card.members.length > 0) {
      lines.push(
        `**Members:** ${card.members.map((m) => m.fullName).join(", ")}`
      );
    }
    if (card.checklists.length > 0) {
      lines.push("");
      lines.push("## Checklists");
      for (const cl of card.checklists) {
        lines.push(`### ${cl.name}`);
        for (const item of cl.checkItems) {
          const check = item.state === "complete" ? "x" : " ";
          lines.push(`- [${check}] ${item.name}`);
        }
      }
    }
    if (card.comments.length > 0) {
      lines.push("");
      lines.push("## Comments");
      for (const c of card.comments) {
        lines.push(
          `**${c.memberCreator.fullName}** (${c.date}):\n${c.data.text}`
        );
        lines.push("");
      }
    }
    return lines.join("\n");
  }

  async addCard(
    boardId: string | undefined,
    params: {
      listId: string;
      name: string;
      description?: string;
      dueDate?: string;
      start?: string;
      labels?: string[];
    }
  ): Promise<TrelloCard> {
    const resp = await this.axiosInstance.post("/cards", null, {
      params: {
        idList: params.listId,
        name: params.name,
        desc: params.description,
        due: params.dueDate,
        start: params.start,
        idLabels: params.labels?.join(","),
      },
    });
    return resp.data;
  }

  async updateCard(
    boardId: string | undefined,
    params: {
      cardId: string;
      name?: string;
      description?: string;
      dueDate?: string;
      start?: string;
      dueComplete?: boolean;
      labels?: string[];
    }
  ): Promise<TrelloCard> {
    const updateParams: Record<string, unknown> = {};
    if (params.name !== undefined) updateParams.name = params.name;
    if (params.description !== undefined) updateParams.desc = params.description;
    if (params.dueDate !== undefined) updateParams.due = params.dueDate;
    if (params.start !== undefined) updateParams.start = params.start;
    if (params.dueComplete !== undefined)
      updateParams.dueComplete = params.dueComplete;
    if (params.labels !== undefined)
      updateParams.idLabels = params.labels.join(",");

    const resp = await this.axiosInstance.put(
      `/cards/${params.cardId}`,
      null,
      { params: updateParams }
    );
    return resp.data;
  }

  async archiveCard(
    boardId: string | undefined,
    cardId: string
  ): Promise<TrelloCard> {
    const resp = await this.axiosInstance.put(`/cards/${cardId}`, null, {
      params: { closed: true },
    });
    return resp.data;
  }

  async moveCard(
    boardId: string | undefined,
    cardId: string,
    listId: string
  ): Promise<TrelloCard> {
    const resp = await this.axiosInstance.put(`/cards/${cardId}`, null, {
      params: { idList: listId },
    });
    return resp.data;
  }

  async getMyCards(): Promise<TrelloCard[]> {
    const resp = await this.axiosInstance.get("/members/me/cards");
    return resp.data;
  }

  async getMe(): Promise<{ id: string; fullName: string; username: string }> {
    const resp = await this.axiosInstance.get("/members/me", {
      params: { fields: "id,fullName,username" },
    });
    return resp.data;
  }

  // --- Comments ---

  async addCommentToCard(
    cardId: string,
    text: string
  ): Promise<TrelloComment> {
    const resp = await this.axiosInstance.post(
      `/cards/${cardId}/actions/comments`,
      null,
      { params: { text } }
    );
    return resp.data;
  }

  async updateCommentOnCard(
    commentId: string,
    text: string
  ): Promise<boolean> {
    await this.axiosInstance.put(`/actions/${commentId}`, null, {
      params: { text },
    });
    return true;
  }

  async deleteCommentFromCard(commentId: string): Promise<boolean> {
    await this.axiosInstance.delete(`/actions/${commentId}`);
    return true;
  }

  async getCardComments(
    cardId: string,
    limit?: number
  ): Promise<TrelloComment[]> {
    const resp = await this.axiosInstance.get(`/cards/${cardId}/actions`, {
      params: { filter: "commentCard", limit: limit || 50 },
    });
    return resp.data;
  }

  // --- Attachments ---

  async attachImageToCard(
    boardId: string | undefined,
    cardId: string,
    imageUrl: string,
    name?: string
  ): Promise<TrelloAttachment> {
    const resp = await this.axiosInstance.post(
      `/cards/${cardId}/attachments`,
      null,
      { params: { url: imageUrl, name: name || "image" } }
    );
    return resp.data;
  }

  async attachFileToCard(
    boardId: string | undefined,
    cardId: string,
    fileUrl: string,
    name?: string,
    mimeType?: string
  ): Promise<TrelloAttachment> {
    const resp = await this.axiosInstance.post(
      `/cards/${cardId}/attachments`,
      null,
      { params: { url: fileUrl, name: name || "file", mimeType } }
    );
    return resp.data;
  }

  async attachImageDataToCard(
    boardId: string | undefined,
    cardId: string,
    imageData: string,
    name?: string,
    mimeType?: string
  ): Promise<TrelloAttachment> {
    // Handle base64 data URLs or raw base64
    let base64Data = imageData;
    let detectedMimeType = mimeType || "image/png";

    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMimeType = match[1];
        base64Data = match[2];
      }
    }

    const buffer = Buffer.from(base64Data, "base64");
    const form = new FormData();
    form.append("file", buffer, {
      filename: name || "image.png",
      contentType: detectedMimeType,
    });

    const resp = await this.axiosInstance.post(
      `/cards/${cardId}/attachments`,
      form,
      { headers: form.getHeaders() }
    );
    return resp.data;
  }

  // --- Checklists ---

  async createChecklist(
    name: string,
    cardId: string
  ): Promise<TrelloChecklist> {
    const resp = await this.axiosInstance.post("/checklists", null, {
      params: { idCard: cardId, name },
    });
    return resp.data;
  }

  async getChecklistItems(
    name: string,
    cardId?: string,
    boardId?: string
  ): Promise<CheckListItem[]> {
    const checklist = await this.getChecklistByName(name, cardId, boardId);
    if (!checklist) return [];
    return checklist.items;
  }

  async addChecklistItem(
    text: string,
    checkListName: string,
    cardId?: string,
    boardId?: string
  ): Promise<CheckListItem> {
    const checklist = await this.getChecklistByName(
      checkListName,
      cardId,
      boardId
    );
    if (!checklist) {
      throw new Error(`Checklist "${checkListName}" not found`);
    }

    const resp = await this.axiosInstance.post(
      `/checklists/${checklist.id}/checkItems`,
      null,
      { params: { name: text } }
    );

    const item = resp.data as TrelloCheckItem;
    return {
      id: item.id,
      text: item.name,
      complete: item.state === "complete",
      parentCheckListId: checklist.id,
    };
  }

  async findChecklistItemsByDescription(
    description: string,
    cardId?: string,
    boardId?: string
  ): Promise<CheckListItem[]> {
    const resolvedBoardId = this.resolveBoardId(boardId);
    const lists = await this.getLists(resolvedBoardId);
    const results: CheckListItem[] = [];
    const descLower = description.toLowerCase();

    for (const list of lists) {
      const cards = await this.getCardsByList(resolvedBoardId, list.id);
      for (const card of cards) {
        if (cardId && card.id !== cardId) continue;
        const fullCard = (await this.getCard(card.id)) as EnhancedTrelloCard;
        for (const cl of fullCard.checklists) {
          for (const item of cl.checkItems) {
            if (item.name.toLowerCase().includes(descLower)) {
              results.push({
                id: item.id,
                text: item.name,
                complete: item.state === "complete",
                parentCheckListId: cl.id,
              });
            }
          }
        }
      }
    }

    return results;
  }

  async getAcceptanceCriteria(
    cardId?: string,
    boardId?: string
  ): Promise<CheckListItem[]> {
    return this.getChecklistItems("Acceptance Criteria", cardId, boardId);
  }

  async getChecklistByName(
    name: string,
    cardId?: string,
    boardId?: string
  ): Promise<CheckList | null> {
    let cardIds: string[] = [];

    if (cardId) {
      cardIds = [cardId];
    } else {
      const resolvedBoardId = this.resolveBoardId(boardId);
      const lists = await this.getLists(resolvedBoardId);
      for (const list of lists) {
        const cards = await this.getCardsByList(resolvedBoardId, list.id);
        cardIds.push(...cards.map((c) => c.id));
      }
    }

    const nameLower = name.toLowerCase();
    for (const cid of cardIds) {
      const resp = await this.axiosInstance.get(`/cards/${cid}/checklists`);
      const checklists = resp.data as TrelloChecklist[];
      for (const cl of checklists) {
        if (cl.name.toLowerCase() === nameLower) {
          const completed = cl.checkItems.filter(
            (i) => i.state === "complete"
          ).length;
          return {
            id: cl.id,
            name: cl.name,
            items: cl.checkItems.map((i) => ({
              id: i.id,
              text: i.name,
              complete: i.state === "complete",
              parentCheckListId: cl.id,
            })),
            percentComplete:
              cl.checkItems.length > 0
                ? Math.round((completed / cl.checkItems.length) * 100)
                : 0,
          };
        }
      }
    }

    return null;
  }

  async updateChecklistItem(
    cardId: string,
    checkItemId: string,
    state: "complete" | "incomplete"
  ): Promise<TrelloCheckItem> {
    const resp = await this.axiosInstance.put(
      `/cards/${cardId}/checkItem/${checkItemId}`,
      null,
      { params: { state } }
    );
    return resp.data;
  }

  // --- Members ---

  async getBoardMembers(boardId?: string): Promise<TrelloMember[]> {
    const id = this.resolveBoardId(boardId);
    const resp = await this.axiosInstance.get(`/boards/${id}/members`);
    return resp.data;
  }

  async assignMemberToCard(
    cardId: string,
    memberId: string
  ): Promise<TrelloCard> {
    const resp = await this.axiosInstance.post(
      `/cards/${cardId}/idMembers`,
      null,
      { params: { value: memberId } }
    );
    return resp.data;
  }

  async removeMemberFromCard(
    cardId: string,
    memberId: string
  ): Promise<unknown[]> {
    const resp = await this.axiosInstance.delete(
      `/cards/${cardId}/idMembers/${memberId}`
    );
    return resp.data;
  }

  // --- Labels ---

  async getBoardLabels(boardId?: string): Promise<TrelloLabelDetails[]> {
    const id = this.resolveBoardId(boardId);
    const resp = await this.axiosInstance.get(`/boards/${id}/labels`);
    return resp.data;
  }

  async createLabel(
    boardId: string | undefined,
    name: string,
    color?: string
  ): Promise<TrelloLabelDetails> {
    const id = this.resolveBoardId(boardId);
    const resp = await this.axiosInstance.post("/labels", null, {
      params: { name, color: color || "null", idBoard: id },
    });
    return resp.data;
  }

  async updateLabel(
    labelId: string,
    name?: string,
    color?: string
  ): Promise<TrelloLabelDetails> {
    const params: Record<string, string> = {};
    if (name !== undefined) params.name = name;
    if (color !== undefined) params.color = color;
    const resp = await this.axiosInstance.put(`/labels/${labelId}`, null, {
      params,
    });
    return resp.data;
  }

  async deleteLabel(labelId: string): Promise<boolean> {
    await this.axiosInstance.delete(`/labels/${labelId}`);
    return true;
  }

  // --- Activity ---

  async getRecentActivity(
    boardId?: string,
    limit?: number
  ): Promise<TrelloAction[]> {
    const id = this.resolveBoardId(boardId);
    const resp = await this.axiosInstance.get(`/boards/${id}/actions`, {
      params: { limit: limit || 10 },
    });
    return resp.data;
  }

  async getCardHistory(
    cardId: string,
    filter?: string,
    limit?: number
  ): Promise<TrelloAction[]> {
    const resp = await this.axiosInstance.get(`/cards/${cardId}/actions`, {
      params: { filter: filter || "all", limit: limit || 50 },
    });
    return resp.data;
  }
}
