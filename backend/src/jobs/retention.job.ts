import { Job } from 'bullmq';
import { JobContext, JobStatus, updateJobStatus } from './queue';
import { storageAdapter } from '../adapters/storage';

export interface RetentionJobData {
    type: 'cleanup';
    orgId?: string; // If specified, only clean up for this org
    dryRun?: boolean; // If true, only log what would be deleted
    jobId?: string;
}

export async function retentionHandler(job: Job<RetentionJobData>, context: JobContext): Promise<void> {
    const { type, orgId, dryRun = false, jobId } = job.data;

    console.log(`Starting retention cleanup job (dryRun: ${dryRun})`);

    try {
        // Update job status to in progress
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.IN_PROGRESS);
        }

        let deletedCount = 0;
        let freedBytes = 0;

        if (type === 'cleanup') {
            const result = await performRetentionCleanup(context, orgId, dryRun);
            deletedCount = result.deletedCount;
            freedBytes = result.freedBytes;
        }

        // Update job status to completed
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.COMPLETED);
        }

        console.log(`Retention cleanup completed. Deleted ${deletedCount} recordings, freed ${formatBytes(freedBytes)}`);
    } catch (error) {
        console.error('Retention cleanup job failed:', error);

        // Update job status to failed
        if (jobId) {
            await updateJobStatus(context.prisma, jobId, JobStatus.FAILED, error.message);
        }

        throw error;
    }
}

async function performRetentionCleanup(
    context: JobContext,
    orgId?: string,
    dryRun = false
): Promise<{ deletedCount: number; freedBytes: number }> {
    let deletedCount = 0;
    let freedBytes = 0;

    // Get organizations to process
    const organizations = orgId
        ? await context.prisma.organization.findMany({ where: { id: orgId } })
        : await context.prisma.organization.findMany();

    for (const org of organizations) {
        console.log(`Processing retention for organization ${org.name} (${org.id})`);

        // Calculate cutoff date based on organization's retention policy
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - org.retentionDays);

        // Find meetings older than retention period
        const expiredMeetings = await context.prisma.meeting.findMany({
            where: {
                orgId: org.id,
                createdAt: { lt: cutoffDate },
            },
            include: {
                recordings: true,
                transcripts: true,
                summaries: true,
            },
        });

        console.log(`Found ${expiredMeetings.length} expired meetings for org ${org.name}`);

        for (const meeting of expiredMeetings) {
            try {
                // Calculate total size of recordings
                const meetingSize = meeting.recordings.reduce((total, recording) => {
                    return total + Number(recording.sizeBytes);
                }, 0);

                if (dryRun) {
                    console.log(`[DRY RUN] Would delete meeting ${meeting.id} (${meeting.title}) - ${formatBytes(meetingSize)}`);
                    deletedCount++;
                    freedBytes += meetingSize;
                    continue;
                }

                // Delete recordings from storage
                for (const recording of meeting.recordings) {
                    try {
                        if (recording.audioUrl) {
                            const audioKey = extractStorageKey(recording.audioUrl);
                            await storageAdapter.deleteFile(audioKey);
                            console.log(`Deleted audio file: ${audioKey}`);
                        }

                        if (recording.videoUrl) {
                            const videoKey = extractStorageKey(recording.videoUrl);
                            await storageAdapter.deleteFile(videoKey);
                            console.log(`Deleted video file: ${videoKey}`);
                        }
                    } catch (storageError) {
                        console.error(`Failed to delete storage files for recording ${recording.id}:`, storageError);
                        // Continue with database cleanup even if storage deletion fails
                    }
                }

                // Delete meeting and related records from database
                // Prisma cascade delete will handle recordings, transcripts, summaries
                await context.prisma.meeting.delete({
                    where: { id: meeting.id },
                });

                // Log audit event
                await context.prisma.auditLog.create({
                    data: {
                        orgId: org.id,
                        actorType: 'SYSTEM',
                        actorId: 'retention-job',
                        action: 'meeting.deleted',
                        metaJson: {
                            meetingId: meeting.id,
                            title: meeting.title,
                            reason: 'retention_policy',
                            retentionDays: org.retentionDays,
                            sizeBytes: meetingSize,
                        },
                    },
                });

                deletedCount++;
                freedBytes += meetingSize;

                console.log(`Deleted meeting ${meeting.id} (${meeting.title}) - ${formatBytes(meetingSize)}`);
            } catch (meetingError) {
                console.error(`Failed to delete meeting ${meeting.id}:`, meetingError);
                // Continue with other meetings
            }
        }
    }

    return { deletedCount, freedBytes };
}

// Helper function to extract storage key from URL
function extractStorageKey(url: string): string {
    if (url.startsWith('s3://') || url.startsWith('minio://')) {
        const parts = url.split('/');
        return parts.slice(3).join('/'); // Remove scheme, bucket
    }
    return url;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to schedule organization-specific retention cleanup
export async function scheduleOrganizationRetention(
    context: JobContext,
    orgId: string
): Promise<void> {
    const { retentionQueue } = context as any;

    if (retentionQueue) {
        await retentionQueue.add('cleanup', {
            type: 'cleanup',
            orgId,
        }, {
            attempts: 1,
            removeOnComplete: 5,
            removeOnFail: 5,
        });

        console.log(`Scheduled retention cleanup for organization ${orgId}`);
    }
}

// Helper function to get retention statistics
export async function getRetentionStats(
    context: JobContext,
    orgId: string
): Promise<{
    totalMeetings: number;
    expiredMeetings: number;
    totalSize: number;
    expiredSize: number;
}> {
    const org = await context.prisma.organization.findUnique({
        where: { id: orgId },
    });

    if (!org) {
        throw new Error(`Organization ${orgId} not found`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - org.retentionDays);

    // Get total meetings and size
    const totalMeetings = await context.prisma.meeting.count({
        where: { orgId },
    });

    const allRecordings = await context.prisma.recording.findMany({
        where: {
            meeting: { orgId },
        },
        select: { sizeBytes: true },
    });

    const totalSize = allRecordings.reduce((total, recording) => {
        return total + Number(recording.sizeBytes);
    }, 0);

    // Get expired meetings and size
    const expiredMeetings = await context.prisma.meeting.count({
        where: {
            orgId,
            createdAt: { lt: cutoffDate },
        },
    });

    const expiredRecordings = await context.prisma.recording.findMany({
        where: {
            meeting: {
                orgId,
                createdAt: { lt: cutoffDate },
            },
        },
        select: { sizeBytes: true },
    });

    const expiredSize = expiredRecordings.reduce((total, recording) => {
        return total + Number(recording.sizeBytes);
    }, 0);

    return {
        totalMeetings,
        expiredMeetings,
        totalSize,
        expiredSize,
    };
}
