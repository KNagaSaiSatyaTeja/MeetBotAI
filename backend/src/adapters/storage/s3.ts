import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { StorageAdapter } from './index';

export interface S3Config {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint?: string;
}

export class S3Adapter implements StorageAdapter {
    private client: S3Client;
    private bucket: string;

    constructor(config: S3Config) {
        this.bucket = config.bucket;
        this.client = new S3Client({
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            endpoint: config.endpoint,
        });
    }

    async uploadFile(key: string, data: Buffer, contentType: string): Promise<{
        url: string;
        checksum: string;
        encryptionMeta?: Record<string, any>;
    }> {
        try {
            // Calculate checksum
            const checksum = crypto.createHash('sha256').update(data).digest('hex');

            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: data,
                ContentType: contentType,
                ServerSideEncryption: 'AES256',
                Metadata: {
                    checksum,
                    uploadedAt: new Date().toISOString(),
                },
            });

            await this.client.send(command);

            return {
                url: `s3://${this.bucket}/${key}`,
                checksum,
                encryptionMeta: {
                    algorithm: 'AES256',
                    provider: 'AWS-S3',
                },
            };
        } catch (error) {
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }

    async downloadFile(key: string): Promise<Buffer> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            const response = await this.client.send(command);

            if (!response.Body) {
                throw new Error('No file content received');
            }

            // Convert stream to buffer
            const chunks: Uint8Array[] = [];
            const reader = response.Body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            return Buffer.concat(chunks);
        } catch (error) {
            throw new Error(`Failed to download file from S3: ${error.message}`);
        }
    }

    async getSignedUrl(key: string, expiresIn: number): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            const signedUrl = await getSignedUrl(this.client, command, {
                expiresIn,
            });

            return signedUrl;
        } catch (error) {
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }

    async deleteFile(key: string): Promise<void> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            await this.client.send(command);
        } catch (error) {
            throw new Error(`Failed to delete file from S3: ${error.message}`);
        }
    }

    async listFiles(prefix: string): Promise<string[]> {
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix,
            });

            const response = await this.client.send(command);
            return response.Contents?.map(obj => obj.Key!) || [];
        } catch (error) {
            throw new Error(`Failed to list files from S3: ${error.message}`);
        }
    }

    async getFileInfo(key: string): Promise<{
        size: number;
        lastModified: Date;
        contentType: string;
    }> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            const response = await this.client.send(command);

            return {
                size: response.ContentLength || 0,
                lastModified: response.LastModified || new Date(),
                contentType: response.ContentType || 'application/octet-stream',
            };
        } catch (error) {
            throw new Error(`Failed to get file info from S3: ${error.message}`);
        }
    }
}
