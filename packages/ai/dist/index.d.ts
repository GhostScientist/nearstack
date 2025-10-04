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
export declare class FakeAdapter implements AIAdapter {
    generate(messages: Message[]): Promise<string>;
}
export declare class WebLLMAdapter implements AIAdapter {
    generate(messages: Message[]): Promise<string>;
}
export declare function createAIContext(adapter?: AIAdapter): AIContext;
//# sourceMappingURL=index.d.ts.map