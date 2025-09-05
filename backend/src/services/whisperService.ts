import { EventEmitter } from 'events';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

export interface WhisperConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    language?: string;
    temperature?: number;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export interface TranscriptionResult {
    text: string;
    language: string;
    duration: number;
    segments?: Array<{
        id: number;
        seek: number;
        start: number;
        end: number;
        text: string;
        tokens: number[];
        temperature: number;
        avg_logprob: number;
        compression_ratio: number;
        no_speech_prob: number;
    }>;
    confidence?: number;
}

export class WhisperService extends EventEmitter {
    private config: WhisperConfig;
    private baseUrl: string;

    constructor(config: WhisperConfig) {
        super();
        this.config = {
            baseUrl: 'https://api.openai.com/v1',
            model: 'whisper-1',
            language: 'en',
            temperature: 0.0,
            responseFormat: 'verbose_json',
            ...config
        };
        this.baseUrl = this.config.baseUrl!;
    }

    async transcribeAudio(audioFilePath: string, options?: Partial<WhisperConfig>): Promise<TranscriptionResult> {
        try {
            console.log(`🎤 Starting Whisper transcription for: ${audioFilePath}`);

            // Check if file exists
            if (!fs.existsSync(audioFilePath)) {
                throw new Error(`Audio file not found: ${audioFilePath}`);
            }

            // Get file stats
            const stats = fs.statSync(audioFilePath);
            const fileSize = stats.size;

            if (fileSize === 0) {
                throw new Error('Audio file is empty');
            }

            console.log(`📁 Audio file size: ${fileSize} bytes`);

            // Create form data
            const formData = new FormData();
            formData.append('file', fs.createReadStream(audioFilePath));
            formData.append('model', options?.model || this.config.model!);
            formData.append('language', options?.language || this.config.language!);
            formData.append('temperature', (options?.temperature || this.config.temperature!).toString());
            formData.append('response_format', options?.responseFormat || this.config.responseFormat!);

            // Add prompt for better transcription quality
            formData.append('prompt', 'This is a meeting recording. Please transcribe accurately with proper punctuation and speaker identification when possible.');

            // Make API request
            const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Whisper API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`✅ Whisper transcription completed`);

            // Process result based on response format
            let transcriptionResult: TranscriptionResult;

            if (this.config.responseFormat === 'verbose_json') {
                transcriptionResult = {
                    text: result.text,
                    language: result.language,
                    duration: result.duration,
                    segments: result.segments,
                    confidence: this.calculateConfidence(result.segments)
                };
            } else {
                transcriptionResult = {
                    text: result.text || result,
                    language: result.language || this.config.language!,
                    duration: result.duration || 0,
                    confidence: 0.8 // Default confidence for non-verbose format
                };
            }

            this.emit('transcription.completed', {
                filePath: audioFilePath,
                result: transcriptionResult
            });

            return transcriptionResult;

        } catch (error) {
            console.error('❌ Whisper transcription failed:', error);
            this.emit('transcription.failed', {
                filePath: audioFilePath,
                error: error as Error
            });
            throw error;
        }
    }

    async transcribeFromUrl(audioUrl: string, options?: Partial<WhisperConfig>): Promise<TranscriptionResult> {
        try {
            console.log(`🎤 Starting Whisper transcription from URL: ${audioUrl}`);

            // Download audio file
            const response = await fetch(audioUrl);
            if (!response.ok) {
                throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
            }

            // Create temporary file
            const tempDir = process.env.RECORDINGS_DIR || './recordings';
            const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
            const tempFilePath = path.join(tempDir, tempFileName);

            // Ensure directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Write file
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(tempFilePath, Buffer.from(buffer));

            try {
                // Transcribe
                const result = await this.transcribeAudio(tempFilePath, options);
                return result;
            } finally {
                // Clean up temporary file
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }

        } catch (error) {
            console.error('❌ Whisper transcription from URL failed:', error);
            throw error;
        }
    }

    private calculateConfidence(segments?: Array<any>): number {
        if (!segments || segments.length === 0) {
            return 0.8; // Default confidence
        }

        // Calculate average confidence from segments
        const avgLogProb = segments.reduce((sum, segment) => sum + segment.avg_logprob, 0) / segments.length;
        const noSpeechProb = segments.reduce((sum, segment) => sum + segment.no_speech_prob, 0) / segments.length;

        // Convert log probability to confidence (0-1 scale)
        const confidence = Math.max(0, Math.min(1, Math.exp(avgLogProb) * (1 - noSpeechProb)));
        return Math.round(confidence * 100) / 100;
    }

    async getSupportedLanguages(): Promise<string[]> {
        return [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
            'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no',
            'fi', 'cs', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv',
            'lt', 'mt', 'el', 'he', 'fa', 'ur', 'bn', 'ta', 'te', 'ml',
            'kn', 'gu', 'pa', 'or', 'as', 'ne', 'si', 'my', 'km', 'lo',
            'ka', 'am', 'sw', 'zu', 'af', 'sq', 'eu', 'be', 'bs', 'ca',
            'cy', 'eo', 'gl', 'is', 'mk', 'ms', 'sr', 'tl', 'uk', 'uz'
        ];
    }

    async getModelInfo(): Promise<{ model: string; description: string; maxFileSize: string; supportedFormats: string[] }> {
        return {
            model: this.config.model!,
            description: 'Whisper is a general-purpose speech recognition model trained on diverse audio data',
            maxFileSize: '25MB',
            supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']
        };
    }
}

// Global Whisper service instance
export const whisperService = new WhisperService({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.WHISPER_MODEL || 'whisper-1',
    language: process.env.WHISPER_LANGUAGE || 'en',
    temperature: parseFloat(process.env.WHISPER_TEMPERATURE || '0.0'),
    responseFormat: (process.env.WHISPER_RESPONSE_FORMAT as any) || 'verbose_json'
});
