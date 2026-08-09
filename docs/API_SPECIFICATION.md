# 🌐 CityVerse API Specification

## Base URL

```
https://api.cityverse.app/v1
```

---

# Authentication

CityVerse uses JWT Authentication.

Example:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

# API Modules

## Authentication

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Login |
| POST | /auth/logout | Logout |
| POST | /auth/refresh | Refresh token |

---

## Users

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /users/profile | Current profile |
| PATCH | /users/profile | Update profile |
| DELETE | /users/profile | Delete account |

---

## Cities

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /cities | List all supported cities |
| GET | /cities/{id} | City details |
| GET | /cities/search | Search city |

---

## Weather

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /weather/current | Current weather |
| GET | /weather/hourly | Hourly forecast |
| GET | /weather/daily | Daily forecast |

---

## Traffic

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /traffic/live | Live traffic |
| GET | /traffic/incidents | Road incidents |
| GET | /traffic/routes | Suggested routes |

---

## Public Transport

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /transport/bus | Bus locations |
| GET | /transport/train | Train status |
| GET | /transport/routes | Available routes |

---

## Places

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /places | Nearby places |
| GET | /places/hospitals | Hospitals |
| GET | /places/restaurants | Restaurants |
| GET | /places/mosques | Mosques |
| GET | /places/hotels | Hotels |

---

## Events

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /events | Upcoming events |
| GET | /events/{id} | Event details |

---

## Emergency

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /emergency | Emergency services |
| GET | /emergency/hospitals | Nearest hospitals |
| GET | /emergency/police | Police stations |
| GET | /emergency/fire | Fire stations |

---

## AI Services

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /ai/recommendations | Smart city recommendations |
| POST | /ai/chat | City AI Assistant |
| POST | /ai/predict | Traffic prediction |

---

## Favorites

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | /favorites | User favorites |
| POST | /favorites | Add favorite |
| DELETE | /favorites/{id} | Remove favorite |

---

# Response Example

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {}
}
```

---

# Error Response

```json
{
  "success": false,
  "message": "Unauthorized",
  "code": 401
}
```

---

# Version

Current API Version

```
v1.0.0
```