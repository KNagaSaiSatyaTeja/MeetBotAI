import OpenAI from 'openai';
import { STTAdapter, TranscriptionResult } from './index';
import { storageAdapter } from '../storage';

export interface WhisperConfig {
    model: string;
    apiKey?: string;
}

export class WhisperAdapter implements STTAdapter {
    private openai?: OpenAI;
    private model: string;

    constructor(config: WhisperConfig) {
        this.model = config.model;

        if (config.apiKey) {
            this.openai = new OpenAI({
                apiKey: config.apiKey,
            });
        }
    }

    getName(): string {
        return 'Whisper';
    }

    getSupportedLanguages(): string[] {
        return [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
            'ar', 'hi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi', 'he'
        ];
    }

    async transcribe(fileUrl: string, language = 'en'): Promise<TranscriptionResult> {
        if (!this.openai) {
            // Return stub result for development
            return this.getStubResult(language);
        }

        try {
            // Download file from storage
            const fileKey = this.extractKeyFromUrl(fileUrl);
            const fileBuffer = await storageAdapter.downloadFile(fileKey);

            // Create a File-like object for OpenAI API
            const file = new File([fileBuffer], 'audio.mp3', { type: 'audio/mpeg' });

            // Call Whisper API with word-level timestamps
            const response = await this.openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
                language: language,
                response_format: 'verbose_json',
                timestamp_granularities: ['word'],
            });

            // Process the response
            const words = response.words?.map(word => ({
                word: word.word,
                start: word.start,
                end: word.end,
                confidence: 0.95, // Whisper doesn't provide confidence scores
            })) || [];

            // Generate speaker turns (Whisper doesn't do speaker diarization)
            const speakerTurns = this.generateSpeakerTurns(response.text, words);

            return {
                text: response.text,
                words,
                speakerTurns,
                language: response.language || language,
                accuracy: 0.95, // Estimated accuracy for Whisper
                metadata: {
                    model: 'whisper-1',
                    duration: response.duration,
                    provider: 'openai',
                },
            };
        } catch (error) {
            console.error('Whisper transcription failed:', error);
            throw new Error(`Whisper transcription failed: ${error.message}`);
        }
    }

    private extractKeyFromUrl(url: string): string {
        // Extract storage key from URL (handle both s3:// and minio:// schemes)
        if (url.startsWith('s3://') || url.startsWith('minio://')) {
            const parts = url.split('/');
            return parts.slice(2).join('/'); // Remove scheme and bucket
        }

        // If it's already a key, return as-is
        return url;
    }

    private generateSpeakerTurns(text: string, words: any[]): Array<{
        speaker: string;
        start: number;
        end: number;
        text: string;
    }> {
        // Simple speaker turn generation (Whisper doesn't do diarization)
        // In a real implementation, you'd use a separate speaker diarization service

        if (words.length === 0) {
            return [{
                speaker: 'Speaker 1',
                start: 0,
                end: 0,
                text: text,
            }];
        }

        // For now, create one turn for the entire transcript
        return [{
            speaker: 'Speaker 1',
            start: words[0]?.start || 0,
            end: words[words.length - 1]?.end || 0,
            text: text,
        }];
    }

    private getStubResult(language: string): TranscriptionResult {
        const stubText = "Welcome everyone to the Q3 planning session. Let's start by reviewing the key objectives and strategic initiatives for the upcoming quarter. Our main focus this quarter is to achieve substantial user growth while also improving our customer retention rates. We need to brainstorm innovative strategies for both.";

        const words = stubText.split(' ').map((word, index) => ({
            word: word.replace(/[.,]/g, ''),
            start: index * 0.5,
            end: (index + 1) * 0.5,
            confidence: 0.95,
        }));

        const speakerTurns = [
            {
                speaker: 'Alice',
                start: 0,
                end: 15,
                text: "Welcome everyone to the Q3 planning session. Let's start by reviewing the key objectives and strategic initiatives for the upcoming quarter.",
            },
            {
                speaker: 'Bob',
                start: 15,
                end: 30,
                text: "Our main focus this quarter is to achieve substantial user growth while also improving our customer retention rates.",
            },
            {
                speaker: 'Alice',
                start: 30,
                end: 35,
                text: "We need to brainstorm innovative strategies for both.",
            },
        ];

        return {
            text: stubText,
            words,
            speakerTurns,
            language,
            accuracy: 0.95,
            metadata: {
                model: 'whisper-stub',
                provider: 'stub',
                duration: 35,
            },
        };
    }
}
