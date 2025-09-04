import { OpenAIAdapter } from './openai';
import { AzureOpenAIAdapter } from './azure';
import { GeminiAdapter } from './gemini';
import { HuggingFaceAdapter } from './hf';

export interface SummaryResult {
    summaryText: string;
    decisions: Array<{
        decision: string;
        owner?: string;
        dueDate?: string;
    }>;
    actionItems: Array<{
        task: string;
        owner?: string;
        dueDate?: string;
        priority?: 'low' | 'medium' | 'high';
    }>;
    participants: Array<{
        name: string;
        email?: string;
        role?: string;
        speakingTime?: number;
    }>;
    keyTopics: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    metadata?: Record<string, any>;
}

export interface LLMAdapter {
    summarize(transcript: string, schema?: any): Promise<SummaryResult>;
    getSupportedModels(): string[];
    getName(): string;
}

// Factory function to create LLM adapter based on configuration
function createLLMAdapter(): LLMAdapter {
    const provider = process.env.LLM_PROVIDER || 'openai';

    switch (provider.toLowerCase()) {
        case 'azure':
            return new AzureOpenAIAdapter({
                endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
                apiKey: process.env.AZURE_OPENAI_KEY!,
                deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT!,
            });

        case 'gemini':
            return new GeminiAdapter({
                apiKey: process.env.GEMINI_API_KEY!,
                model: process.env.GEMINI_MODEL || 'gemini-pro',
            });

        case 'hf':
        case 'huggingface':
            return new HuggingFaceAdapter({
                apiKey: process.env.HF_API_KEY!,
                model: process.env.HF_MODEL || 'microsoft/DialoGPT-large',
            });

        case 'openai':
        default:
            return new OpenAIAdapter({
                apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key',
                model: process.env.OPENAI_MODEL || 'gpt-4',
            });
    }
}

// Export singleton instance
export const llmAdapter = createLLMAdapter();

// Export adapter classes for testing
export { OpenAIAdapter, AzureOpenAIAdapter, GeminiAdapter, HuggingFaceAdapter };
