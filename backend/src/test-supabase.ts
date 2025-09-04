import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: './env.local' });

async function testSupabaseConnection() {
    console.log('🗄️  Testing Supabase Database Connection');
    console.log('='.repeat(50));

    const prisma = new PrismaClient();

    try {
        console.log('📊 Database URL:', process.env.DATABASE_URL?.split('@')[1] || 'Not configured');

        // Test basic connection
        console.log('\n🔌 Testing connection...');
        await prisma.$connect();
        console.log('✅ Connected to database');

        // Test query
        console.log('\n📋 Testing query...');
        const result = await prisma.$queryRaw`SELECT NOW() as current_time, version() as pg_version`;
        console.log('✅ Query successful:', result);

        // Test organizations table
        console.log('\n🏢 Testing organizations table...');
        const orgCount = await prisma.organization.count();
        console.log(`✅ Organizations table accessible - ${orgCount} records found`);

        // Test meetings table  
        console.log('\n📅 Testing meetings table...');
        const meetingCount = await prisma.meeting.count();
        console.log(`✅ Meetings table accessible - ${meetingCount} records found`);

        // Test bot-related tables
        console.log('\n🤖 Testing bot tables...');
        const botCount = await prisma.meetingsBot.count();
        console.log(`✅ MeetingsBots table accessible - ${botCount} records found`);

        const logCount = await prisma.meetingBotLog.count();
        console.log(`✅ MeetingBotLog table accessible - ${logCount} records found`);

        // Create test organization if needed
        console.log('\n🧪 Creating test data...');
        let testOrg = await prisma.organization.findFirst({
            where: { name: 'Test Organization' }
        });

        if (!testOrg) {
            testOrg = await prisma.organization.create({
                data: {
                    name: 'Test Organization',
                    plan: 'free'
                }
            });
            console.log('✅ Test organization created:', testOrg.id);
        } else {
            console.log('✅ Test organization exists:', testOrg.id);
        }

        // Create test user
        let testUser = await prisma.user.findFirst({
            where: { email: 'test@meetingbot.ai' }
        });

        if (!testUser) {
            testUser = await prisma.user.create({
                data: {
                    email: 'test@meetingbot.ai',
                    orgId: testOrg.id,
                    provider: 'test',
                    role: 'ADMIN'
                }
            });
            console.log('✅ Test user created:', testUser.id);
        } else {
            console.log('✅ Test user exists:', testUser.id);
        }

        // Create test meeting
        console.log('\n📝 Creating test meeting record...');
        const testMeeting = await prisma.meeting.create({
            data: {
                orgId: testOrg.id,
                title: 'Test Meeting for Bot',
                platform: 'zoom',
                meetingLink: 'https://zoom.us/j/93049107200?pwd=FMvt8B',
                status: 'SCHEDULED',
                consentFlags: {
                    recording: true,
                    transcription: true,
                    summary: true
                }
            }
        });
        console.log('✅ Test meeting created:', testMeeting.id);

        // Create test bot record
        console.log('\n🤖 Creating test bot record...');
        const testBot = await prisma.meetingsBot.create({
            data: {
                meetingId: testMeeting.id,
                platform: 'zoom',
                status: 'IDLE',
                joinLink: 'https://zoom.us/j/93049107200?pwd=FMvt8B',
                metaJson: {
                    meetingId: '93049107200',
                    passcode: 'FMvt8B',
                    displayName: 'Ping Me'
                }
            }
        });
        console.log('✅ Test bot created:', testBot.id);

        // Create test log entry
        console.log('\n📄 Creating test log entry...');
        const testLog = await prisma.meetingBotLog.create({
            data: {
                botId: testBot.id,
                level: 'INFO',
                event: 'test.connection',
                message: 'Supabase connection test successful',
                metaJson: {
                    timestamp: new Date().toISOString(),
                    test: true
                }
            }
        });
        console.log('✅ Test log created:', testLog.id);

        console.log('\n🎉 All Supabase tests passed!');
        console.log('📊 Summary:');
        console.log(`   - Organizations: ${orgCount + 1}`);
        console.log(`   - Meetings: ${meetingCount + 1}`);
        console.log(`   - Bots: ${botCount + 1}`);
        console.log(`   - Logs: ${logCount + 1}`);
        console.log('   - Database is ready for bot operations');

        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        await prisma.meetingBotLog.delete({ where: { id: testLog.id } });
        await prisma.meetingsBot.delete({ where: { id: testBot.id } });
        await prisma.meeting.delete({ where: { id: testMeeting.id } });
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('❌ Supabase test failed:', error);
        console.error('   Check your DATABASE_URL configuration');
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testSupabaseConnection();
