import * as Minio from 'minio';
import crypto from 'crypto';
import { StorageAdapter } from './index';

export interface MinIOConfig {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
}

export class MinIOAdapter implements StorageAdapter {
    private client: Minio.Client;
    private bucket: string;

    constructor(config: MinIOConfig) {
        this.bucket = config.bucket;

        // Parse endpoint to get host and port
        const url = new URL(config.endpoint);
        const useSSL = url.protocol === 'https:';
        const port = url.port ? parseInt(url.port) : (useSSL ? 443 : 80);

        this.client = new Minio.Client({
            endPoint: url.hostname,
            port,
            useSSL,
            accessKey: config.accessKey,
            secretKey: config.secretKey,
            region: config.region,
        });

        // Ensure bucket exists
        this.initializeBucket();
    }

    private async initializeBucket(): Promise<void> {
        try {
            const exists = await this.client.bucketExists(this.bucket);
            if (!exists) {
                await this.client.makeBucket(this.bucket);
                console.log(`Created MinIO bucket: ${this.bucket}`);
            }
        } catch (error) {
            console.error(`Failed to initialize MinIO bucket: ${error.message}`);
        }
    }

    async uploadFile(key: string, data: Buffer, contentType: string): Promise<{
        url: string;
        checksum: string;
        encryptionMeta?: Record<string, any>;
    }> {
        try {
            // Calculate checksum
            const checksum = crypto.createHash('sha256').update(data).digest('hex');

            const metadata = {
                'Content-Type': contentType,
                'x-amz-meta-checksum': checksum,
                'x-amz-meta-uploaded-at': new Date().toISOString(),
            };

            await this.client.putObject(
                this.bucket,
                key,
                data,
                data.length,
                metadata
            );

            return {
                url: `minio://${this.bucket}/${key}`,
                checksum,
                encryptionMeta: {
                    algorithm: 'none',
                    provider: 'MinIO',
                },
            };
        } catch (error) {
            throw new Error(`Failed to upload file to MinIO: ${error.message}`);
        }
    }

    async downloadFile(key: string): Promise<Buffer> {
        try {
            const stream = await this.client.getObject(this.bucket, key);

            return new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];

                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                stream.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });

                stream.on('error', (error) => {
                    reject(new Error(`Failed to download file from MinIO: ${error.message}`));
                });
            });
        } catch (error) {
            throw new Error(`Failed to download file from MinIO: ${error.message}`);
        }
    }

    async getSignedUrl(key: string, expiresIn: number): Promise<string> {
        try {
            const signedUrl = await this.client.presignedGetObject(
                this.bucket,
                key,
                expiresIn
            );

            return signedUrl;
        } catch (error) {
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }

    async deleteFile(key: string): Promise<void> {
        try {
            await this.client.removeObject(this.bucket, key);
        } catch (error) {
            throw new Error(`Failed to delete file from MinIO: ${error.message}`);
        }
    }

    async listFiles(prefix: string): Promise<string[]> {
        try {
            const objects: string[] = [];

            return new Promise((resolve, reject) => {
                const stream = this.client.listObjects(this.bucket, prefix, true);

                stream.on('data', (obj) => {
                    if (obj.name) {
                        objects.push(obj.name);
                    }
                });

                stream.on('end', () => {
                    resolve(objects);
                });

                stream.on('error', (error) => {
                    reject(new Error(`Failed to list files from MinIO: ${error.message}`));
                });
            });
        } catch (error) {
            throw new Error(`Failed to list files from MinIO: ${error.message}`);
        }
    }

    async getFileInfo(key: string): Promise<{
        size: number;
        lastModified: Date;
        contentType: string;
    }> {
        try {
            const stat = await this.client.statObject(this.bucket, key);

            return {
                size: stat.size,
                lastModified: stat.lastModified,
                contentType: stat.metaData['content-type'] || 'application/octet-stream',
            };
        } catch (error) {
            throw new Error(`Failed to get file info from MinIO: ${error.message}`);
        }
    }
}
