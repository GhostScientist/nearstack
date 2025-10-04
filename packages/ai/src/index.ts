// createAIContext() with Fake + WebLLM adapters

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIAdapter {
  generate(messages: Message[]): Promise<string>;
}

export interface AIContext {
  messages: Message[];
  sendMessage(content: string): Promise<string>;
  setAdapter(adapter: AIAdapter): void;
}

export class FakeAdapter implements AIAdapter {
  async generate(messages: Message[]): Promise<string> {
    // Stub: Returns a fake response
    return 'This is a fake AI response for testing purposes.';
  }
}

export class WebLLMAdapter implements AIAdapter {
  async generate(messages: Message[]): Promise<string> {
    // Stub: Will implement WebLLM integration
    throw new Error('WebLLM adapter not yet implemented');
  }
}

export function createAIContext(adapter: AIAdapter = new FakeAdapter()): AIContext {
  const messages: Message[] = [];
  let currentAdapter = adapter;

  return {
    messages,
    async sendMessage(content: string): Promise<string> {
      messages.push({ role: 'user', content });
      const response = await currentAdapter.generate(messages);
      messages.push({ role: 'assistant', content: response });
      return response;
    },
    setAdapter(adapter: AIAdapter): void {
      currentAdapter = adapter;
    },
  };
}
