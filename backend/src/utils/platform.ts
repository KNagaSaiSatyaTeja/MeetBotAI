export type MeetingPlatform = 'zoom' | 'google-meet' | 'teams' | 'unknown';

export interface DetectedPlatform {
    platform: MeetingPlatform;
    canonicalMeetingKey: string; // normalized key to de-duplicate (e.g., meeting id)
    meetingId?: string;
    password?: string;
}

export function detectPlatform(meetingLink: string): DetectedPlatform {
    const url = meetingLink.trim();

    // Zoom patterns
    const zoomRegex = /^(?:https?:\/\/)?(?:[\w.-]+\.)?zoom\.(?:us|com)\/(?:j|w)\/([0-9]{9,12})(?:\?([^\s#]*))?/i;
    const zoomMatch = url.match(zoomRegex);
    if (zoomMatch) {
        const meetingId = zoomMatch[1];
        const query = zoomMatch[2] || '';
        const params = new URLSearchParams(query);
        const pwd = params.get('pwd') || undefined;
        return {
            platform: 'zoom',
            canonicalMeetingKey: `zoom:${meetingId}`,
            meetingId,
            password: pwd,
        };
    }

    // Google Meet
    const meetRegex = /(?:https?:\/\/)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:\?[^\s]*)?/i;
    const meetMatch = url.match(meetRegex);
    if (meetMatch) {
        const code = meetMatch[1];
        return {
            platform: 'google-meet',
            canonicalMeetingKey: `gmeet:${code}`,
            meetingId: code,
        };
    }

    // Microsoft Teams
    const teamsRegex = /(?:https?:\/\/)?teams\.microsoft\.com\/l\/meetup-join\/.+/i;
    const teamsMatch = url.match(teamsRegex);
    if (teamsMatch) {
        return {
            platform: 'teams',
            canonicalMeetingKey: `teams:${hashString(url)}`,
        };
    }

    return { platform: 'unknown', canonicalMeetingKey: `unknown:${hashString(url)}` };
}

function hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const chr = input.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}


