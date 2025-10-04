// createAIContext() with Fake + WebLLM adapters
export class FakeAdapter {
    async generate(messages) {
        // Stub: Returns a fake response
        return 'This is a fake AI response for testing purposes.';
    }
}
export class WebLLMAdapter {
    async generate(messages) {
        // Stub: Will implement WebLLM integration
        throw new Error('WebLLM adapter not yet implemented');
    }
}
export function createAIContext(adapter = new FakeAdapter()) {
    const messages = [];
    let currentAdapter = adapter;
    return {
        messages,
        async sendMessage(content) {
            messages.push({ role: 'user', content });
            const response = await currentAdapter.generate(messages);
            messages.push({ role: 'assistant', content: response });
            return response;
        },
        setAdapter(adapter) {
            currentAdapter = adapter;
        },
    };
}
//# sourceMappingURL=index.js.map