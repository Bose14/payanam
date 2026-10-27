# API Documentation

## Base URL

```
http://localhost:3001 (development)
https://api.payanam.com (production)
```

## Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Response Format

All successful responses follow this format:

```json
{
  "status": "success",
  "data": {},
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "uuid"
}
```

Error responses:

```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Error description",
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "uuid"
}
```

## Endpoints

### Authentication

#### POST /api/auth/register

Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "fullName": "John Doe"
}
```

**Response:** (201 Created)
```json
{
  "status": "success",
  "data": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Error Codes:**
- `EMAIL_ALREADY_EXISTS`: Email already registered
- `VALIDATION_ERROR`: Invalid input format

---

#### POST /api/auth/login

Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:** (200 OK)
```json
{
  "status": "success",
  "data": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Error Codes:**
- `AUTH_INVALID_CREDENTIALS`: Invalid email or password
- `VALIDATION_ERROR`: Invalid input format

---

#### GET /api/auth/me

Get current authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** (200 OK)
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Error Codes:**
- `UNAUTHORIZED`: Missing or invalid token
- `USER_NOT_FOUND`: User does not exist

---

#### POST /api/auth/logout

Logout (client-side: remove tokens from localStorage).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** (200 OK)
```json
{
  "status": "success",
  "message": "Logged out successfully",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

### Health Check

#### GET /api/health

Check API health status.

**Response:** (200 OK)
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

## Error Codes Reference

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Missing/invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `EMAIL_ALREADY_EXISTS` | 409 | Email already registered |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | JWT token expired |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

Currently not implemented. Will be added in future versions.

## Versioning

API version: v1 (implied in `/api/` prefix)
