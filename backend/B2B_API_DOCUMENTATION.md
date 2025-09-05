# B2B Meeting Bot API Documentation

## Overview

The B2B Meeting Bot API provides a comprehensive solution for automatically joining meetings, recording audio/video, transcribing conversations, and generating summaries and minutes of meeting (MOM). The system is designed to handle 1000+ concurrent users with robust resource management and error handling.

## Base URL

```
https://your-domain.com/v1/b2b
```

## Authentication

All API endpoints require authentication using one of the following methods:

### API Key Authentication
```http
x-api-key: YOUR_API_KEY
```

### JWT Bearer Token
```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## Endpoints

### 1. Create Bot for Meeting

**POST** `/bot/create`

Creates a bot to join a meeting with dynamic parameters.

#### Request Body

```json
{
  "meetingLink": "https://zoom.us/j/123456789?pwd=abc123",
  "title": "Weekly Team Meeting",
  "displayName": "MeetingBot AI",
  "passcode": "abc123",
  "recording": true,
  "transcription": true,
  "summary": true,
  "language": "en",
  "webhookUrl": "https://your-webhook.com/meeting-updates",
  "metadata": {
    "department": "Engineering",
    "priority": "high"
  }
}
```

#### Response

```json
{
  "success": true,
  "botId": "bot_1757055375896_abc123",
  "meetingId": "cmf6hhrhz0001n7v3cfztix6s",
  "platform": "zoom",
  "status": "joining",
  "message": "Bot is joining the meeting",
  "webhookUrl": "https://your-webhook.com/meeting-updates"
}
```

### 2. Get Bot Status

**GET** `/bot/{botId}/status`

Returns the current status and data for a specific bot.

#### Response

```json
{
  "botId": "bot_1757055375896_abc123",
  "meetingId": "cmf6hhrhz0001n7v3cfztix6s",
  "status": "active",
  "platform": "zoom",
  "startTime": "2025-01-09T12:00:00.000Z",
  "lastActivity": "2025-01-09T12:30:00.000Z",
  "recordingStarted": true,
  "recordingFile": "https://storage.example.com/recordings/meeting.wav",
  "transcript": "Welcome to today's meeting. Let's start with the agenda...",
  "summary": "The team discussed project updates and upcoming deadlines...",
  "mom": "MINUTES OF MEETING\n\nDate: January 9, 2025\nAttendees: John Doe, Jane Smith...\n\nAGENDA ITEMS:\n1. Project Updates\n2. Budget Review\n\nDECISIONS:\n- Approve Q1 budget\n- Extend project timeline by 2 weeks\n\nACTION ITEMS:\n- John: Complete budget analysis by Friday\n- Jane: Update project timeline"
}
```

### 3. End Bot

**POST** `/bot/{botId}/end`

Ends a specific bot and leaves the meeting.

#### Response

```json
{
  "success": true,
  "message": "Bot ended successfully"
}
```

### 4. Get Complete Meeting Data

**GET** `/meeting/{meetingId}/data`

Returns complete meeting data including recording, transcript, and summary.

#### Response

```json
{
  "meeting": {
    "id": "cmf6hhrhz0001n7v3cfztix6s",
    "title": "Weekly Team Meeting",
    "platform": "zoom",
    "meetingLink": "https://zoom.us/j/123456789?pwd=abc123",
    "status": "COMPLETED",
    "startedAt": "2025-01-09T12:00:00.000Z",
    "endedAt": "2025-01-09T13:00:00.000Z",
    "duration": 3600
  },
  "recording": {
    "audioUrl": "https://storage.example.com/recordings/meeting.wav",
    "sizeBytes": 1920010,
    "duration": 3600
  },
  "transcript": {
    "content": "Welcome to today's meeting. Let's start with the agenda...",
    "language": "en",
    "confidence": 0.95
  },
  "summary": {
    "content": "The team discussed project updates and upcoming deadlines...",
    "mom": "MINUTES OF MEETING\n\nDate: January 9, 2025...",
    "keyPoints": [
      "Project timeline extended by 2 weeks",
      "Q1 budget approved",
      "New team member onboarding next week"
    ]
  }
}
```

### 5. List Organization Bots

**GET** `/bots`

Returns a list of bots for the organization.

#### Query Parameters

- `status` (optional): Filter by bot status (`joining`, `active`, `ending`, `failed`)
- `limit` (optional): Number of results to return (1-100, default: 20)
- `offset` (optional): Number of results to skip (default: 0)

#### Response

```json
{
  "bots": [
    {
      "botId": "meeting_cmf6hhrhz0001n7v3cfztix6s",
      "meetingId": "cmf6hhrhz0001n7v3cfztix6s",
      "status": "active",
      "platform": "zoom",
      "startTime": "2025-01-09T12:00:00.000Z",
      "lastActivity": "2025-01-09T12:30:00.000Z",
      "recordingStarted": true,
      "recordingFile": "https://storage.example.com/recordings/meeting.wav",
      "transcript": "Welcome to today's meeting...",
      "summary": "The team discussed project updates...",
      "mom": "MINUTES OF MEETING..."
    }
  ],
  "total": 25,
  "limit": 20,
  "offset": 0
}
```

### 6. System Status

**GET** `/system/status`

Returns system status and resource information.

#### Response

```json
{
  "system": {
    "status": "healthy",
    "uptime": 86400,
    "version": "1.0.0"
  },
  "resources": {
    "totalBots": 45,
    "maxBots": 1000,
    "activeBrowsers": 45,
    "activeRecordings": 45,
    "memoryUsage": 2048
  },
  "database": {
    "status": "connected",
    "connections": 12
  }
}
```

## Webhook Events

When a webhook URL is provided, the system will send POST requests to your endpoint with the following events:

### Event Types

1. **bot.joined** - Bot successfully joined the meeting
2. **recording.started** - Audio recording has started
3. **recording.stopped** - Audio recording has stopped
4. **transcript.ready** - Transcript is available
5. **summary.ready** - Summary and MOM are available
6. **meeting.ended** - Meeting has ended
7. **bot.error** - An error occurred

### Webhook Payload Example

```json
{
  "event": "transcript.ready",
  "timestamp": "2025-01-09T12:30:00.000Z",
  "data": {
    "meetingId": "cmf6hhrhz0001n7v3cfztix6s",
    "botId": "bot_1757055375896_abc123",
    "transcriptId": "trans_abc123",
    "language": "en",
    "confidence": 0.95,
    "wordCount": 1250,
    "duration": 1800
  }
}
```

## Supported Platforms

- **Zoom** - Web client and desktop app support
- **Google Meet** - Web client support
- **Microsoft Teams** - Web client support

## Audio Recording

- **Format**: WAV (16-bit PCM, 48kHz, stereo)
- **Device**: Configurable via `FFMPEG_AUDIO_DEVICE` environment variable
- **Storage**: Local files with cloud storage fallback
- **Processing**: Automatic transcription using Whisper AI

## Transcription & AI Processing

- **Speech-to-Text**: OpenAI Whisper API
- **Language Support**: 50+ languages
- **Confidence Scoring**: Automatic confidence calculation
- **Speaker Detection**: Basic speaker identification
- **Summary Generation**: GPT-4 powered summaries
- **MOM Generation**: Structured minutes of meeting

## Error Handling

The API includes comprehensive error handling:

- **Resource Limits**: Automatic queuing when resources are full
- **Storage Failures**: Graceful fallback to local storage
- **Network Issues**: Retry logic with exponential backoff
- **Meeting End Detection**: Robust detection of meeting completion

## Rate Limits

- **Bot Creation**: 10 requests per minute per organization
- **Status Checks**: 100 requests per minute per organization
- **System Status**: 20 requests per minute per organization

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:port/db
OPENAI_API_KEY=sk-your-openai-key
FFMPEG_AUDIO_DEVICE="Microphone (Realtek(R) Audio)"

# Optional
BOT_DISPLAY_NAME="MeetingBot AI"
RECORDINGS_DIR="./recordings"
WHISPER_MODEL="whisper-1"
WHISPER_LANGUAGE="en"
MAX_CONCURRENT_BOTS=1000
```

## Example Usage

### Python Example

```python
import requests

# Create bot
response = requests.post(
    "https://your-domain.com/v1/b2b/bot/create",
    headers={"x-api-key": "YOUR_API_KEY"},
    json={
        "meetingLink": "https://zoom.us/j/123456789?pwd=abc123",
        "title": "Team Meeting",
        "displayName": "MeetingBot AI",
        "recording": True,
        "transcription": True,
        "summary": True,
        "webhookUrl": "https://your-webhook.com/updates"
    }
)

bot_data = response.json()
bot_id = bot_data["botId"]

# Check status
status_response = requests.get(
    f"https://your-domain.com/v1/b2b/bot/{bot_id}/status",
    headers={"x-api-key": "YOUR_API_KEY"}
)

status = status_response.json()
print(f"Bot status: {status['status']}")
print(f"Transcript: {status.get('transcript', 'Not ready yet')}")
```

### JavaScript Example

```javascript
// Create bot
const createResponse = await fetch('https://your-domain.com/v1/b2b/bot/create', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    meetingLink: 'https://zoom.us/j/123456789?pwd=abc123',
    title: 'Team Meeting',
    displayName: 'MeetingBot AI',
    recording: true,
    transcription: true,
    summary: true,
    webhookUrl: 'https://your-webhook.com/updates'
  })
});

const botData = await createResponse.json();
const botId = botData.botId;

// Check status
const statusResponse = await fetch(`https://your-domain.com/v1/b2b/bot/${botId}/status`, {
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});

const status = await statusResponse.json();
console.log('Bot status:', status.status);
console.log('Transcript:', status.transcript || 'Not ready yet');
```

## Support

For technical support or questions, please contact the development team or refer to the system logs for detailed error information.
