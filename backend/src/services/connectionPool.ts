import { PrismaClient } from '@prisma/client';

export interface PoolConfig {
    minConnections: number;
    maxConnections: number;
    acquireTimeoutMs: number;
    idleTimeoutMs: number;
}

export class ConnectionPool {
    private connections: PrismaClient[] = [];
    private availableConnections: PrismaClient[] = [];
    private config: PoolConfig;
    private isInitialized = false;

    constructor(config?: Partial<PoolConfig>) {
        this.config = {
            minConnections: config?.minConnections || 5,
            maxConnections: config?.maxConnections || 50,
            acquireTimeoutMs: config?.acquireTimeoutMs || 30000,
            idleTimeoutMs: config?.idleTimeoutMs || 300000, // 5 minutes
        };
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log(`🔗 Initializing connection pool with ${this.config.minConnections} connections`);

        // Create initial connections
        for (let i = 0; i < this.config.minConnections; i++) {
            const connection = this.createConnection();
            this.connections.push(connection);
            this.availableConnections.push(connection);
        }

        this.isInitialized = true;
        console.log(`✅ Connection pool initialized with ${this.connections.length} connections`);
    }

    async acquire(): Promise<PrismaClient> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Try to get an available connection
        if (this.availableConnections.length > 0) {
            const connection = this.availableConnections.pop()!;
            return connection;
        }

        // Create a new connection if under limit
        if (this.connections.length < this.config.maxConnections) {
            const connection = this.createConnection();
            this.connections.push(connection);
            console.log(`🔗 Created new connection (${this.connections.length}/${this.config.maxConnections})`);
            return connection;
        }

        // Wait for a connection to become available
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Connection pool timeout after ${this.config.acquireTimeoutMs}ms`));
            }, this.config.acquireTimeoutMs);

            const checkForConnection = () => {
                if (this.availableConnections.length > 0) {
                    clearTimeout(timeout);
                    const connection = this.availableConnections.pop()!;
                    resolve(connection);
                } else {
                    setTimeout(checkForConnection, 100);
                }
            };

            checkForConnection();
        });
    }

    release(connection: PrismaClient): void {
        if (this.availableConnections.includes(connection)) {
            return; // Already released
        }

        this.availableConnections.push(connection);
    }

    private createConnection(): PrismaClient {
        const connection = new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
            datasources: {
                db: {
                    url: process.env.DATABASE_URL
                }
            }
        });

        // Add connection monitoring
        connection.$on('beforeExit', () => {
            console.log('🔗 Database connection closed');
        });

        return connection;
    }

    async close(): Promise<void> {
        console.log('🔗 Closing connection pool...');

        await Promise.all(
            this.connections.map(connection =>
                connection.$disconnect().catch(console.error)
            )
        );

        this.connections = [];
        this.availableConnections = [];
        this.isInitialized = false;

        console.log('✅ Connection pool closed');
    }

    getStats() {
        return {
            totalConnections: this.connections.length,
            availableConnections: this.availableConnections.length,
            inUseConnections: this.connections.length - this.availableConnections.length,
            config: this.config
        };
    }
}

// Global connection pool instance
export const connectionPool = new ConnectionPool({
    minConnections: 10,
    maxConnections: 100,
    acquireTimeoutMs: 30000,
    idleTimeoutMs: 300000
});
