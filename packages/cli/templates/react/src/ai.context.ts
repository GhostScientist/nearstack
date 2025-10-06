import { createAIContext, FakeAdapter } from '@nearstack-dev/ai';

// Default AI context using FakeAdapter for testing
export const aiContext = createAIContext(new FakeAdapter());
