const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

console.log('🔊 Checking Available Audio Devices on Windows');
console.log('='.repeat(50));

// List audio devices using FFmpeg DirectShow
const ffmpeg = spawn(ffmpegPath, [
    '-list_devices', 'true',
    '-f', 'dshow',
    '-i', 'dummy'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let output = '';
let errorOutput = '';

ffmpeg.stdout.on('data', (data) => {
    output += data.toString();
});

ffmpeg.stderr.on('data', (data) => {
    errorOutput += data.toString();
});

ffmpeg.on('close', (code) => {
    console.log('📋 Available Audio Input Devices:');
    console.log('-'.repeat(30));
    
    // Parse the output for audio devices
    const lines = errorOutput.split('\n');
    let inAudioSection = false;
    let deviceCount = 0;
    
    for (const line of lines) {
        if (line.includes('DirectShow audio devices')) {
            inAudioSection = true;
            continue;
        }
        
        if (inAudioSection && line.includes('DirectShow video devices')) {
            break;
        }
        
        if (inAudioSection && line.includes('"')) {
            const match = line.match(/"([^"]+)"/);
            if (match) {
                deviceCount++;
                console.log(`${deviceCount}. "${match[1]}"`);
            }
        }
    }
    
    if (deviceCount === 0) {
        console.log('❌ No audio input devices found');
        console.log('💡 You may need to:');
        console.log('   1. Enable "Stereo Mix" in Windows Sound settings');
        console.log('   2. Install a virtual audio cable');
        console.log('   3. Use "Listen to this device" on your microphone');
    } else {
        console.log(`\n✅ Found ${deviceCount} audio input devices`);
        console.log('\n💡 To use a device, set FFMPEG_AUDIO_DEVICE in your .env file');
        console.log('   Example: FFMPEG_AUDIO_DEVICE="Stereo Mix (Realtek(R) Audio)"');
    }
    
    console.log('\n🔧 Current Configuration:');
    console.log(`   FFMPEG_AUDIO_DEVICE: "${process.env.FFMPEG_AUDIO_DEVICE || 'default'}"`);
    console.log(`   RECORDINGS_DIR: "${process.env.RECORDINGS_DIR || './recordings'}"`);
});

ffmpeg.on('error', (error) => {
    console.error('❌ Error running FFmpeg:', error.message);
});
