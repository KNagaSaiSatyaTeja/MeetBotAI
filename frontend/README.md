# AI Meeting Bot Frontend

Modern web application for AI Meeting Bot built with Next.js, React, and Tailwind CSS.

## Features

- **Dashboard**: Overview of meetings, analytics, and KPIs
- **Meeting Management**: Create, view, and manage meeting recordings
- **Transcription Viewer**: Interactive transcript with timestamps and speaker identification
- **AI Summaries**: Generated meeting summaries with action items and decisions
- **Search**: Full-text search across transcripts and summaries
- **API Key Management**: Generate and manage API keys for programmatic access
- **Webhook Configuration**: Set up webhooks for real-time notifications
- **Multi-tenant**: Organization-based access control

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI**: React 18 + Tailwind CSS + shadcn/ui components
- **State Management**: Zustand + SWR for server state
- **Authentication**: NextAuth.js with OAuth2 (Google, Microsoft)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- Backend API running on http://localhost:3000

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

### Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Authentication
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-here

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id  
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Dashboard
│   ├── meetings/          # Meeting pages
│   ├── search/            # Search page
│   └── settings/          # Settings pages
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── kpis/             # KPI cards and metrics
│   ├── tables/           # Data tables
│   ├── transcript/       # Transcript viewer
│   ├── mom/              # Meeting minutes
│   └── forms/            # Form components
├── lib/                  # Utilities and configurations
│   ├── api.ts           # API client
│   ├── auth.ts          # Authentication config
│   └── utils.ts         # Helper functions
├── hooks/               # Custom React hooks
├── styles/             # Global styles
└── types/              # TypeScript type definitions
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `npm test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests

## UI Components

The application uses pixel-perfect implementations matching the provided design mockups:

- **Dashboard**: KPI cards, recent meetings table, charts
- **Meeting Detail**: Tabbed interface with transcript, summary, and recording
- **Search**: Global search with filtering and highlighting
- **Settings**: API keys, webhooks, and platform configuration

## Authentication Flow

1. User visits application
2. Redirected to OAuth provider (Google/Microsoft)
3. After successful authentication, JWT token is stored
4. API requests include Bearer token for authentication
5. Organization-based access control enforced

## API Integration

The frontend communicates with the backend API using:

- **SWR** for data fetching and caching
- **Typed API client** generated from OpenAPI spec
- **Error handling** with user-friendly messages
- **Loading states** and optimistic updates

## Development

### Code Style

- **ESLint** + **Prettier** for code formatting
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Component composition** over inheritance

### Testing

- **Vitest** for unit tests
- **Playwright** for E2E tests
- **Testing Library** for component testing

## Deployment

The application can be deployed to:

- **Vercel** (recommended for Next.js)
- **Netlify**
- **Docker** containers
- **Static hosting** (after `npm run build`)

## Contributing

1. Follow the established code style
2. Write tests for new features
3. Update documentation as needed
4. Ensure accessibility compliance
5. Test on multiple screen sizes
