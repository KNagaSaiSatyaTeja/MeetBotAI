import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

export interface RecordingOptions {
    device?: string;
    sampleRate?: number;
    channels?: number;
    format?: string;
}

export class RecordingService extends EventEmitter {
    private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
    private outputPath: string | null = null;
    private isRecording = false;

    async startRecording(outputPath: string, options: RecordingOptions = {}): Promise<void> {
        if (this.isRecording) {
            throw new Error('Recording already in progress');
        }

        this.outputPath = outputPath;
        const ffmpegPath = this.getFFmpegPath();

        const args = this.buildFFmpegArgs(outputPath, options);

        console.log(`Starting recording: ${ffmpegPath} ${args.join(' ')}`);

        this.ffmpegProcess = spawn(ffmpegPath, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.setupProcessHandlers();
        this.isRecording = true;

        // Give FFmpeg a moment to start
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!this.isRecording) {
            throw new Error('Failed to start recording');
        }
    }

    async stopRecording(): Promise<string | null> {
        if (!this.isRecording || !this.ffmpegProcess) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.forceKillProcess();
                reject(new Error('Recording stop timeout'));
            }, 5000);

            this.ffmpegProcess!.once('exit', () => {
                clearTimeout(timeout);
                this.isRecording = false;
                resolve(this.outputPath);
            });

            // Send 'q' to gracefully stop FFmpeg
            try {
                this.ffmpegProcess!.stdin.write('q\n');
            } catch (error) {
                this.forceKillProcess();
                clearTimeout(timeout);
                resolve(this.outputPath);
            }
        });
    }

    private getFFmpegPath(): string {
        try {
            return require('ffmpeg-static') as string;
        } catch {
            return 'ffmpeg';
        }
    }

    private buildFFmpegArgs(outputPath: string, options: RecordingOptions): string[] {
        const device = options.device || 'default';
        const sampleRate = options.sampleRate || 48000;
        const channels = options.channels || 2;

        // Platform-specific input configuration
        const inputArgs = this.getInputArgs(device);

        return [
            '-y', // Overwrite output file
            ...inputArgs,
            '-ac', channels.toString(),
            '-ar', sampleRate.toString(),
            '-c:a', 'pcm_s16le',
            '-f', 'wav',
            outputPath
        ];
    }

    private getInputArgs(device: string): string[] {
        const platform = process.platform;

        switch (platform) {
            case 'win32':
                // For Windows, use the configured device or fallback
                let windowsDevice = device;
                if (device === 'default' || !device) {
                    windowsDevice = process.env.FFMPEG_AUDIO_DEVICE || 'Stereo Mix (Realtek(R) Audio)';
                }
                console.log(`🎙️ Using Windows audio device: "${windowsDevice}"`);
                return ['-f', 'dshow', '-i', `audio=${windowsDevice}`];
            case 'darwin':
                return ['-f', 'avfoundation', '-i', `:${device === 'default' ? '0' : device}`];
            case 'linux':
                return ['-f', 'pulse', '-i', device === 'default' ? 'default' : device];
            default:
                return ['-f', 'pulse', '-i', 'default'];
        }
    }

    private setupProcessHandlers(): void {
        if (!this.ffmpegProcess) return;

        this.ffmpegProcess.stdout.on('data', (data) => {
            // FFmpeg writes to stderr, not stdout
        });

        this.ffmpegProcess.stderr.on('data', (data) => {
            const output = data.toString();
            if (output.includes('size=') || output.includes('time=')) {
                // Recording progress
                this.emit('progress', output);
            }
        });

        this.ffmpegProcess.on('error', (error) => {
            console.error('FFmpeg error:', error);
            this.isRecording = false;
            this.emit('error', error);
        });

        this.ffmpegProcess.on('exit', (code, signal) => {
            console.log(`FFmpeg exited with code ${code}, signal ${signal}`);
            this.isRecording = false;
            this.ffmpegProcess = null;
            this.emit('stopped', code);
        });
    }

    private forceKillProcess(): void {
        if (this.ffmpegProcess) {
            try {
                this.ffmpegProcess.kill('SIGKILL');
            } catch (error) {
                console.error('Failed to kill FFmpeg process:', error);
            }
            this.ffmpegProcess = null;
        }
        this.isRecording = false;
    }

    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    getCurrentOutputPath(): string | null {
        return this.outputPath;
    }
}
