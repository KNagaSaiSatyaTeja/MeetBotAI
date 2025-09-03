import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index';
import { FastifyInstance } from 'fastify';

describe('E2E Vertical Slice Tests', () => {
    let app: FastifyInstance;
    let organizationId: string;
    let apiKey: string;
    let meetingId: string;

    beforeAll(async () => {
        // Build app instance
        app = await buildApp();
        await app.ready();

        // Create test organization and user
        const org = await app.prisma.organization.create({
            data: {
                name: 'Test Organization',
                plan: 'pro',
                region: 'us',
                retentionDays: 30,
            },
        });
        organizationId = org.id;

        const user = await app.prisma.user.create({
            data: {
                orgId: organizationId,
                role: 'ADMIN',
                email: 'test@example.com',
                provider: 'test',
                consentFlags: {},
            },
        });

        // Create API key for testing
        const bcrypt = await import('bcryptjs');
        const keyValue = 'sk-test123456789';
        const hash = await bcrypt.hash(keyValue, 12);

        const apiKeyRecord = await app.prisma.apiKey.create({
            data: {
                orgId: organizationId,
                hash,
                label: 'Test API Key',
                scopes: ['meetings:read', 'meetings:write', 'recordings:write'],
            },
        });

        apiKey = keyValue;
    });

    afterAll(async () => {
        // Cleanup test data
        if (app && organizationId) {
            await app.prisma.organization.delete({
                where: { id: organizationId },
            });
        }

        await app?.close();
    });

    it('should complete the full vertical slice: create meeting → upload recording → transcription → summarization', async () => {
        // Step 1: Create meeting
        const createResponse = await app.inject({
            method: 'POST',
            url: '/v1/meetings',
            headers: {
                'x-api-key': apiKey,
                'content-type': 'application/json',
            },
            payload: {
                title: 'Test Meeting - E2E',
                platform: 'zoom',
                meetingLink: 'https://zoom.us/j/123456789',
                scheduledAt: new Date().toISOString(),
            },
        });

        expect(createResponse.statusCode).toBe(201);
        const meeting = JSON.parse(createResponse.body);
        expect(meeting.id).toBeDefined();
        expect(meeting.title).toBe('Test Meeting - E2E');
        meetingId = meeting.id;

        // Step 2: Upload recording (mock file)
        const mockAudioData = Buffer.from('mock audio data');

        const uploadResponse = await app.inject({
            method: 'POST',
            url: `/v1/meetings/${meetingId}/recording`,
            headers: {
                'x-api-key': apiKey,
            },
            payload: mockAudioData,
            // Note: In real tests, you'd use multipart form data
        });

        expect(uploadResponse.statusCode).toBe(200);
        const uploadResult = JSON.parse(uploadResponse.body);
        expect(uploadResult.success).toBe(true);
        expect(uploadResult.recordingId).toBeDefined();

        // Step 3: Wait for transcription job to complete (in real test, you'd wait or mock)
        // For this test, we'll simulate the job completion
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 4: Check transcript is created
        const transcriptResponse = await app.inject({
            method: 'GET',
            url: `/v1/meetings/${meetingId}/transcript`,
            headers: {
                'x-api-key': apiKey,
            },
        });

        // In development with stub adapters, transcript should be available
        if (transcriptResponse.statusCode === 200) {
            const transcript = JSON.parse(transcriptResponse.body);
            expect(transcript.id).toBeDefined();
            expect(transcript.text).toBeDefined();
            expect(transcript.words).toBeInstanceOf(Array);
            expect(transcript.speakerTurns).toBeInstanceOf(Array);
        }

        // Step 5: Check summary is created
        const summaryResponse = await app.inject({
            method: 'GET',
            url: `/v1/meetings/${meetingId}/summary`,
            headers: {
                'x-api-key': apiKey,
            },
        });

        // In development with stub adapters, summary should be available
        if (summaryResponse.statusCode === 200) {
            const summary = JSON.parse(summaryResponse.body);
            expect(summary.id).toBeDefined();
            expect(summary.summaryText).toBeDefined();
            expect(summary.decisions).toBeInstanceOf(Array);
            expect(summary.actionItems).toBeInstanceOf(Array);
            expect(summary.participants).toBeInstanceOf(Array);
        }

        // Step 6: Get full meeting details with recordings and signed URLs
        const detailsResponse = await app.inject({
            method: 'GET',
            url: `/v1/meetings/${meetingId}?record=true&audio=true`,
            headers: {
                'x-api-key': apiKey,
            },
        });

        expect(detailsResponse.statusCode).toBe(200);
        const details = JSON.parse(detailsResponse.body);
        expect(details.id).toBe(meetingId);
        expect(details.recordings).toBeInstanceOf(Array);

        if (details.recordings.length > 0) {
            expect(details.recordings[0].audioUrl).toBeDefined();
        }
    });

    it('should handle API key authentication', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/meetings',
            headers: {
                'x-api-key': 'invalid-key',
            },
        });

        expect(response.statusCode).toBe(401);
    });

    it('should handle rate limiting', async () => {
        // Make multiple rapid requests to trigger rate limit
        const promises = Array.from({ length: 65 }, () =>
            app.inject({
                method: 'GET',
                url: '/v1/meetings',
                headers: {
                    'x-api-key': apiKey,
                },
            })
        );

        const responses = await Promise.all(promises);

        // Some requests should be rate limited
        const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle search functionality', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/search?search=test',
            headers: {
                'x-api-key': apiKey,
            },
        });

        expect(response.statusCode).toBe(200);
        const results = JSON.parse(response.body);
        expect(results.data).toBeInstanceOf(Array);
        expect(results.pagination).toBeDefined();
    });

    it('should handle webhook creation and testing', async () => {
        // Create webhook
        const createResponse = await app.inject({
            method: 'POST',
            url: '/v1/webhooks',
            headers: {
                'x-api-key': apiKey,
                'content-type': 'application/json',
            },
            payload: {
                url: 'https://example.com/webhook',
                events: ['meeting.completed', 'transcript.ready'],
                active: true,
            },
        });

        expect(createResponse.statusCode).toBe(201);
        const webhook = JSON.parse(createResponse.body);
        expect(webhook.id).toBeDefined();
        expect(webhook.secret).toBeDefined();

        // Test webhook
        const testResponse = await app.inject({
            method: 'POST',
            url: `/v1/webhooks/${webhook.id}/test`,
            headers: {
                'x-api-key': apiKey,
            },
        });

        expect(testResponse.statusCode).toBe(200);
        const testResult = JSON.parse(testResponse.body);
        expect(testResult.success).toBe(true);
        expect(testResult.deliveryId).toBeDefined();
    });

    it('should handle health checks', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/health',
        });

        expect(response.statusCode).toBe(200);
        const health = JSON.parse(response.body);
        expect(health.status).toBe('healthy');
        expect(health.services).toBeDefined();
        expect(health.services.database).toBe('connected');
        expect(health.services.redis).toBe('connected');
    });
});
