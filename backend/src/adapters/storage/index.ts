import { S3Adapter } from './s3';
import { MinIOAdapter } from './minio';

export interface StorageAdapter {
    uploadFile(key: string, data: Buffer, contentType: string): Promise<{
        url: string;
        checksum: string;
        encryptionMeta?: Record<string, any>;
    }>;

    downloadFile(key: string): Promise<Buffer>;

    getSignedUrl(key: string, expiresIn: number): Promise<string>;

    deleteFile(key: string): Promise<void>;

    listFiles(prefix: string): Promise<string[]>;

    getFileInfo(key: string): Promise<{
        size: number;
        lastModified: Date;
        contentType: string;
    }>;
}

// Factory function to create storage adapter based on configuration
function createStorageAdapter(): StorageAdapter {
    const endpoint = process.env.S3_ENDPOINT;
    const isMinIO = endpoint && endpoint.includes('localhost') || endpoint?.includes('minio');

    if (isMinIO) {
        return new MinIOAdapter({
            endpoint: endpoint!,
            accessKey: process.env.S3_ACCESS_KEY!,
            secretKey: process.env.S3_SECRET_KEY!,
            bucket: process.env.S3_BUCKET!,
            region: process.env.S3_REGION || 'us-east-1',
        });
    } else {
        return new S3Adapter({
            region: process.env.S3_REGION || 'us-east-1',
            accessKeyId: process.env.S3_ACCESS_KEY!,
            secretAccessKey: process.env.S3_SECRET_KEY!,
            bucket: process.env.S3_BUCKET!,
        });
    }
}

// Export singleton instance
export const storageAdapter = createStorageAdapter();

// Export adapter classes for testing
export { S3Adapter, MinIOAdapter };
