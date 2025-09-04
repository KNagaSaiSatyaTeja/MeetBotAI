import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: './env.local' });

interface EnvCheck {
    name: string;
    required: boolean;
    description: string;
    current?: string;
    status?: 'OK' | 'MISSING' | 'INVALID';
}

const environmentChecks: EnvCheck[] = [
    // Core Application
    { name: 'NODE_ENV', required: false, description: 'Environment mode' },
    { name: 'PORT', required: false, description: 'API server port' },
    { name: 'HOST', required: false, description: 'API server host' },

    // Database
    { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
    { name: 'REDIS_URL', required: true, description: 'Redis connection string' },

    // Security
    { name: 'JWT_SECRET', required: true, description: 'JWT signing secret (min 32 chars)' },
    { name: 'API_RATE_LIMIT', required: false, description: 'API rate limit per minute' },

    // Storage
    { name: 'S3_ENDPOINT', required: false, description: 'S3/MinIO endpoint URL' },
    { name: 'S3_BUCKET', required: true, description: 'Storage bucket name' },
    { name: 'S3_ACCESS_KEY', required: true, description: 'Storage access key' },
    { name: 'S3_SECRET_KEY', required: true, description: 'Storage secret key' },
    { name: 'S3_REGION', required: false, description: 'Storage region' },

    // Bot Configuration
    { name: 'BOT_DISPLAY_NAME', required: true, description: 'Bot display name in meetings' },
    { name: 'RECORDINGS_DIR', required: true, description: 'Local recordings directory' },
    { name: 'FFMPEG_AUDIO_DEVICE', required: true, description: 'Audio capture device' },

    // AI Services
    { name: 'OPENAI_API_KEY', required: true, description: 'OpenAI API key for transcription/LLM' },
    { name: 'LLM_PROVIDER', required: false, description: 'LLM provider (openai, azure, gemini, hf)' },
    { name: 'STT_PROVIDER', required: false, description: 'Speech-to-text provider (whisper, aws, gcp, azure)' },

    // Zoom SDK (Optional)
    { name: 'ZOOM_SDK_CLIENT_ID', required: false, description: 'Zoom SDK client ID' },
    { name: 'ZOOM_SDK_CLIENT_SECRET', required: false, description: 'Zoom SDK client secret' },

    // Observability
    { name: 'METRICS_PORT', required: false, description: 'Metrics endpoint port' },
    { name: 'ENABLE_SWAGGER', required: false, description: 'Enable Swagger documentation' }
];

function checkEnvironment(): void {
    console.log('🔍 AI Meeting Bot - Environment Configuration Check');
    console.log('='.repeat(60));

    let hasErrors = false;
    let hasWarnings = false;

    // Check each environment variable
    for (const check of environmentChecks) {
        const value = process.env[check.name];
        check.current = value;

        if (check.required && !value) {
            check.status = 'MISSING';
            hasErrors = true;
        } else if (value) {
            // Special validations
            if (check.name === 'JWT_SECRET' && value.length < 32) {
                check.status = 'INVALID';
                hasWarnings = true;
            } else if (check.name === 'DATABASE_URL' && !value.startsWith('postgresql://')) {
                check.status = 'INVALID';
                hasWarnings = true;
            } else if (check.name === 'REDIS_URL' && !value.startsWith('redis://')) {
                check.status = 'INVALID';
                hasWarnings = true;
            } else if (check.name === 'OPENAI_API_KEY' && !value.startsWith('sk-')) {
                check.status = 'INVALID';
                hasWarnings = true;
            } else {
                check.status = 'OK';
            }
        } else {
            check.status = 'OK'; // Optional and not set
        }
    }

    // Display results
    console.log('\n📋 Configuration Status:');
    console.log('-'.repeat(60));

    for (const check of environmentChecks) {
        const icon = check.status === 'OK' ? '✅' :
            check.status === 'MISSING' ? '❌' : '⚠️';
        const status = check.status === 'OK' ? 'OK' :
            check.status === 'MISSING' ? 'MISSING' : 'INVALID';

        const displayValue = check.current ?
            (check.name.includes('SECRET') || check.name.includes('KEY') || check.name.includes('PASSWORD') ?
                '*'.repeat(Math.min(check.current.length, 8)) :
                check.current.length > 50 ? check.current.substring(0, 47) + '...' : check.current) :
            'not set';

        console.log(`${icon} ${check.name.padEnd(20)} ${status.padEnd(8)} ${displayValue}`);
        if (check.status !== 'OK' && check.required) {
            console.log(`   └─ ${check.description}`);
        }
    }

    // Check recordings directory
    console.log('\n📁 File System Checks:');
    console.log('-'.repeat(60));

    const recordingsDir = process.env.RECORDINGS_DIR || './recordings';
    try {
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
            console.log(`✅ Created recordings directory: ${recordingsDir}`);
        } else {
            console.log(`✅ Recordings directory exists: ${recordingsDir}`);
        }
    } catch (error) {
        console.log(`❌ Cannot access recordings directory: ${recordingsDir}`);
        hasErrors = true;
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('-'.repeat(60));

    if (hasErrors) {
        console.log('❌ ERRORS FOUND: Missing required environment variables');
        console.log('   Please set the missing variables in your .env file');
        process.exit(1);
    } else if (hasWarnings) {
        console.log('⚠️  WARNINGS: Some configurations may need attention');
        console.log('   The system should work but may have reduced functionality');
    } else {
        console.log('✅ ALL CHECKS PASSED: Environment is properly configured');
    }

    console.log('\n🚀 Ready to test with Zoom meeting!');
    console.log('   Run: npm run test:zoom');
    console.log('   Or use the API: POST /v1/bot/join');
}

// Run the check
checkEnvironment();
