import { WhisperAdapter } from './whisper';
import { AWSAdapter } from './aws';
import { GCPAdapter } from './gcp';
import { AzureAdapter } from './azure';

export interface TranscriptionResult {
    text: string;
    words: Array<{
        word: string;
        start: number;
        end: number;
        confidence?: number;
    }>;
    speakerTurns: Array<{
        speaker: string;
        start: number;
        end: number;
        text: string;
    }>;
    language: string;
    accuracy?: number;
    metadata?: Record<string, any>;
}

export interface STTAdapter {
    transcribe(fileUrl: string, language?: string): Promise<TranscriptionResult>;
    getSupportedLanguages(): string[];
    getName(): string;
}

// Factory function to create STT adapter based on configuration
function createSTTAdapter(): STTAdapter {
    const provider = process.env.STT_PROVIDER || 'whisper';

    switch (provider.toLowerCase()) {
        case 'aws':
            return new AWSAdapter({
                region: process.env.AWS_REGION || 'us-east-1',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            });

        case 'gcp':
            return new GCPAdapter({
                projectId: process.env.GCP_PROJECT_ID!,
                keyFilename: process.env.GCP_KEY_FILE,
            });

        case 'azure':
            return new AzureAdapter({
                subscriptionKey: process.env.AZURE_SPEECH_KEY!,
                region: process.env.AZURE_SPEECH_REGION!,
            });

        case 'whisper':
        default:
            return new WhisperAdapter({
                model: process.env.WHISPER_MODEL || 'base',
                apiKey: process.env.OPENAI_API_KEY,
            });
    }
}

// Export singleton instance
export const sttAdapter = createSTTAdapter();

// Export adapter classes for testing
export { WhisperAdapter, AWSAdapter, GCPAdapter, AzureAdapter };
