# Admin Panel Boilerplate

A production-ready Admin Panel with Next.js frontend and NestJS backend.

## Technology Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Server Components by default

### Backend
- NestJS
- TypeScript
- MySQL
- TypeORM
- JWT Authentication

## Features

- JWT Authentication with HttpOnly cookies
- Refresh token support with revocation
- Role-based access control (PLATFORM_OWNER, OPERATION)
- Server-side authorization
- Responsive layout (Desktop / Tablet / Mobile)
- Theming with CSS variables
- Soft delete support
- Request/Response logging
- Token blacklist support

## Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- MySQL 8.0 (or use Docker)

### Development Setup

1. Clone the repository

2. Backend setup:
```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

3. Frontend setup:
```bash
cd frontend
npm install
npm run dev
```

### Docker Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Environment Variables

#### Backend (.env)
```
NODE_ENV=development
PORT=3001

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_NAME=cw_panel

JWT_ACCESS_SECRET=your-access-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

CORS_ORIGIN=http://localhost:3000
```

#### Frontend
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Default Admin User

After running the seed, use these credentials:
- Email: admin@example.com
- Password: Admin123!

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── users/          # Users module
│   │   ├── common/         # Shared utilities
│   │   └── database/       # Database configuration
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities and helpers
│   │   ├── types/          # TypeScript types
│   │   └── config/         # Configuration
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Roles

| Role | Dashboard | Users | Account |
|------|-----------|-------|---------|
| PLATFORM_OWNER | ✓ | ✓ | ✓ |
| OPERATION | ✗ | ✗ | ✓ |

## API Endpoints

### Authentication
- POST `/api/auth/login` - Login
- POST `/api/auth/logout` - Logout (protected)
- POST `/api/auth/refresh` - Refresh tokens
- GET `/api/auth/me` - Get current user (protected)

### Users (PLATFORM_OWNER only)
- GET `/api/users` - List users with pagination
- GET `/api/users/:id` - Get user by ID
- POST `/api/users` - Create user
- PATCH `/api/users/:id` - Update user
- DELETE `/api/users/:id` - Soft delete user

## Theming

Customize colors via CSS variables in `frontend/src/app/globals.css`:

```css
:root {
  --color-primary: #800020;
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  /* ... */
}
```

## Security Features

- Tokens stored in HttpOnly cookies
- CSRF protection via SameSite cookies
- Refresh token revocation
- Token blacklist for logout
- Role-based route protection
- Server-side authorization checks
- Password hashing with bcrypt
- Input validation with class-validator

## License

MIT
