import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
        redis: Redis;
        jobQueue: {
            transcribeQueue: Queue;
            summarizeQueue: Queue;
            webhookQueue: Queue;
            retentionQueue: Queue;
            close: () => Promise<void>;
        };
    }
}
