import { PrismaClient } from '@prisma/client';

// Global Prisma client instance
declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
const prisma = globalThis.__prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
});

if (process.env.NODE_ENV === 'development') {
    globalThis.__prisma = prisma;
}

export { prisma };

// Helper types
export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Repository base class
export abstract class BaseRepository<T> {
    constructor(protected prisma: PrismaClient) { }

    abstract create(data: any): Promise<T>;
    abstract findById(id: string): Promise<T | null>;
    abstract update(id: string, data: any): Promise<T>;
    abstract delete(id: string): Promise<void>;
}
