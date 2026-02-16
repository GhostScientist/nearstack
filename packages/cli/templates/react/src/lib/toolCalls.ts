export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'error';
  result?: string;
}

export interface TextSegment {
  type: 'text';
  content: string;
}

export interface ToolCallSegment {
  type: 'tool_call';
  toolCallId: string;
  toolCall: ToolCall;
}

export type ParsedSegment = TextSegment | ToolCallSegment;

export interface ParsedMessage {
  segments: ParsedSegment[];
  toolCalls: ToolCall[];
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

const TOOL_CALL_REGEX = /<tool_call>([\s\S]*?)<\/tool_call>/g;

export function parseToolCalls(text: string): ParsedMessage {
  const segments: ParsedSegment[] = [];
  const toolCalls: ToolCall[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(TOOL_CALL_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    // Add text before this tool call
    if (match.index > lastIndex) {
      const content = text.slice(lastIndex, match.index).trim();
      if (content) {
        segments.push({ type: 'text', content });
      }
    }

    try {
      const parsed = JSON.parse(match[1].trim());
      // Deterministic ID based on position + content hash for stable React keys
      const id = `tc-${match.index}-${hashCode(match[1])}`;
      const toolCall: ToolCall = {
        id,
        name: parsed.name || 'unknown',
        args: parsed.args || {},
        status: 'pending',
      };
      toolCalls.push(toolCall);
      segments.push({ type: 'tool_call', toolCallId: id, toolCall });
    } catch {
      // If JSON parsing fails, treat it as text
      segments.push({ type: 'text', content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const content = text.slice(lastIndex).trim();
    if (content) {
      segments.push({ type: 'text', content });
    }
  }

  // If no segments were created, treat entire text as one segment
  if (segments.length === 0 && text.trim()) {
    segments.push({ type: 'text', content: text.trim() });
  }

  return { segments, toolCalls };
}

export function hasIncompleteToolCall(text: string): boolean {
  const openTag = '<tool_call>';
  const closeTag = '</tool_call>';
  const lastOpen = text.lastIndexOf(openTag);
  if (lastOpen === -1) return false;
  const lastClose = text.lastIndexOf(closeTag);
  return lastClose < lastOpen;
}

export const TOOL_DEFINITIONS = `
You have access to tools that can create, update, and delete notes. To use a tool, output a tool_call XML block with a JSON body containing "name" and "args".

Available tools:

1. create_note - Create a new note
   Args: { "title": string, "content": string, "tags"?: string[] }

2. update_note - Update an existing note
   Args: { "id": string, "title"?: string, "content"?: string, "tags"?: string[] }

3. delete_note - Delete a note
   Args: { "id": string }

Example:
<tool_call>{"name": "create_note", "args": {"title": "Meeting Notes", "content": "Discussed project timeline", "tags": ["work"]}}</tool_call>

Important rules:
- Only use one tool call per response
- Always explain what you're about to do before the tool call
- For update_note and delete_note, use the note ID provided in the context
`.trim();
