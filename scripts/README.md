# AI Meeting Bot Scripts

Database seeding and utility scripts for the AI Meeting Bot platform.

## Overview

This directory contains scripts for:

- **Database Seeding**: Create demo organizations, users, and meetings
- **Data Migration**: Migrate data between environments  
- **Cleanup**: Clean up test data and reset databases
- **Fixtures**: Sample audio/video files for testing

## Scripts

### Seeding

```bash
# Seed basic demo data
npm run seed

# Seed comprehensive demo data with sample meetings
npm run seed:demo

# Clean all data (careful in production!)
npm run clean

# Run database migrations
npm run migrate
```

### Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Code formatting
npm run format
```

## Environment Variables

The scripts use the same environment variables as the backend:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/aimeet
NODE_ENV=development
```

## Seed Data Structure

The seeding scripts create:

### Organizations
- **Demo Corp**: Free tier organization
- **Enterprise Inc**: Enterprise tier organization  
- **Startup LLC**: Pro tier organization

### Users
- **Admin users**: Full access to organization
- **Regular users**: Standard access
- **Service accounts**: API-only access

### Sample Meetings
- **Completed meetings**: With transcripts and summaries
- **In-progress meetings**: Currently being processed
- **Failed meetings**: For error handling testing
- **Scheduled meetings**: Future meetings

### API Keys
- **Admin keys**: Full scope access
- **Read-only keys**: Limited to read operations
- **Webhook keys**: For webhook testing

### Webhooks
- **Development webhooks**: Point to localhost
- **Test webhooks**: For integration testing

## File Structure

```
scripts/
├── seed/
│   ├── seed.ts              # Main seeding script
│   ├── demo-data.ts         # Comprehensive demo data
│   ├── clean.ts             # Database cleanup
│   └── migrate.ts           # Data migration utilities
├── fixtures/
│   ├── sample-audio.mp3     # Sample audio file
│   ├── sample-video.mp4     # Sample video file
│   └── sample-transcript.json # Sample transcript data
└── utils/
    ├── db.ts                # Database utilities
    ├── faker.ts             # Data generation helpers
    └── constants.ts         # Seeding constants
```

## Usage Examples

### Basic Setup

```bash
# Install dependencies
npm install

# Seed demo organization and user
npm run seed

# Access the application with:
# Email: admin@democorp.com
# Password: demo123
```

### Full Demo Environment

```bash
# Create comprehensive demo environment
npm run seed:demo

# This creates:
# - 3 organizations with different plans
# - 10+ users across organizations  
# - 20+ sample meetings with various statuses
# - API keys for testing
# - Webhook endpoints for development
```

### Testing Data Cleanup

```bash
# Clean all seeded data
npm run clean

# Re-seed fresh data
npm run seed
```

## Sample Data Details

### Meeting Types Created

1. **Q3 Planning Session**
   - Platform: Zoom
   - Status: Completed
   - Has: Transcript, Summary, Action Items
   - Duration: 45 minutes

2. **Marketing Campaign Brainstorm** 
   - Platform: Google Meet
   - Status: Completed
   - Has: Transcript, Summary, Decisions
   - Duration: 30 minutes

3. **Client Onboarding Session**
   - Platform: Microsoft Teams
   - Status: In Progress
   - Has: Recording uploaded, transcribing
   - Duration: Ongoing

4. **Sprint Planning - Project X**
   - Platform: Zoom  
   - Status: Scheduled
   - Scheduled for: Tomorrow 9:00 AM

### Generated API Keys

- **Admin Key**: `sk-admin-...` (all scopes)
- **Read Key**: `sk-read-...` (read-only scopes)  
- **Write Key**: `sk-write-...` (read/write scopes)

### Sample Webhooks

- **Local Development**: `http://localhost:4000/webhook`
- **ngrok Tunnel**: `https://abc123.ngrok.io/webhook`
- **Webhook.site**: `https://webhook.site/unique-id`

## Safety

⚠️ **Warning**: The cleanup script will delete ALL data in the database. Never run in production!

The scripts include safety checks:
- Require explicit confirmation for destructive operations
- Check NODE_ENV before running cleanup
- Create backups before major operations

## Customization

To customize the seed data:

1. Edit `seed/constants.ts` for basic configuration
2. Modify `seed/demo-data.ts` for meeting scenarios  
3. Add new fixtures to `fixtures/` directory
4. Update `utils/faker.ts` for data generation patterns

## Troubleshooting

### Common Issues

**Database Connection Error**
```bash
Error: P1001: Can't reach database server
```
- Ensure PostgreSQL is running
- Check DATABASE_URL environment variable
- Verify network connectivity

**Permission Denied**
```bash
Error: P3009: migrate failed due to insufficient privileges
```
- Check database user permissions
- Ensure user can create/drop tables
- Run with elevated privileges if needed

**Seed Data Already Exists**
```bash
Error: Unique constraint failed
```
- Run `npm run clean` first
- Check for existing data conflicts
- Use `--force` flag to overwrite

### Getting Help

1. Check the logs in `/tmp/aimeet-seed.log`
2. Enable debug mode with `DEBUG=* npm run seed`
3. Review the database schema in `../backend/prisma/schema.prisma`
4. Contact the development team for support
