import { LLMAdapter, SummaryResult } from './index';

export interface AzureOpenAIConfig {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
}

export class AzureOpenAIAdapter implements LLMAdapter {
    private config: AzureOpenAIConfig;

    constructor(config: AzureOpenAIConfig) {
        this.config = config;
    }

    getName(): string {
        return 'Azure OpenAI';
    }

    getSupportedModels(): string[] {
        return [
            'gpt-4',
            'gpt-4-turbo',
            'gpt-35-turbo',
            'gpt-35-turbo-16k',
        ];
    }

    async summarize(transcript: string, schema?: any): Promise<SummaryResult> {
        // TODO: Implement Azure OpenAI integration
        // This is a stub implementation

        console.log(`Azure OpenAI: Summarizing transcript with deployment ${this.config.deploymentName}`);

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 3000));

        return this.getStubResult();
    }

    private getStubResult(): SummaryResult {
        return {
            summaryText: "This is a stub summary from Azure OpenAI. The actual implementation would use the Azure OpenAI REST API with the specified deployment.",
            decisions: [
                {
                    decision: "Integrate with Azure OpenAI for production summarization",
                    owner: "DevOps Team",
                },
            ],
            actionItems: [
                {
                    task: "Set up Azure OpenAI deployment",
                    owner: "Platform Team",
                    priority: "high",
                },
            ],
            participants: [
                {
                    name: "System",
                    role: "AI Assistant",
                    speakingTime: 0,
                },
            ],
            keyTopics: ["Azure Integration", "OpenAI Deployment", "Production Setup"],
            sentiment: "neutral",
            metadata: {
                model: 'azure-openai-stub',
                provider: 'azure',
                deployment: this.config.deploymentName,
            },
        };
    }
}
