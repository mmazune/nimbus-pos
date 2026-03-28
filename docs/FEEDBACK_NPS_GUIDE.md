# Feedback + NPS Guide

## Overview

M21 introduces the Customer Feedback domain: collecting feedback via QR codes / links, NPS scoring, sentiment analysis, and manager review workflows.

## Models

| Model | Purpose |
|-------|---------|
| `FeedbackRequest` | Tracks a request for feedback (token, source, expiry, status) |
| `Feedback` | Submitted feedback with rating, NPS score, sentiment, comment |
| `FeedbackTag` | Key-value tags on feedback entries (unique per feedback + tagKey) |
| `NpsSummary` | (Reserved) Computed NPS snapshots per branch/window |

## Enums

| Enum | Values |
|------|--------|
| `FeedbackStatus` | NEW, ACKNOWLEDGED, RESOLVED, DISMISSED |
| `FeedbackSource` | QR, ORDER_LINK, RESERVATION_LINK, EVENT_LINK, MANUAL, OTHER |
| `FeedbackSentiment` | POSITIVE, NEUTRAL, NEGATIVE, CRITICAL |
| `FeedbackRequestStatus` | PENDING, OPENED, SUBMITTED, EXPIRED, CANCELLED |
| `NpsBucket` | PROMOTER, PASSIVE, DETRACTOR |

## Endpoints

### Admin (Authenticated, Branch-Scoped)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/feedback/requests` | `pos:feedback:request:create` | Create a feedback request |
| GET | `/feedback/requests` | `pos:feedback:read` | List feedback requests |
| PATCH | `/feedback/requests/:id/cancel` | `pos:feedback:request:cancel` | Cancel a pending request |
| GET | `/feedback` | `pos:feedback:read` | List feedback (paginated, filterable) |
| GET | `/feedback/:id` | `pos:feedback:read` | Get feedback detail with tags |
| PATCH | `/feedback/:id/tag` | `pos:feedback:tag` | Add a tag to feedback |
| GET | `/feedback/tags` | `pos:feedback:read` | List all tags |
| PATCH | `/feedback/:id/acknowledge` | `pos:feedback:acknowledge` | Acknowledge feedback (NEW → ACKNOWLEDGED) |
| PATCH | `/feedback/:id/resolve` | `pos:feedback:resolve` | Resolve feedback (→ RESOLVED) |
| GET | `/feedback/nps-summary` | `pos:feedback:nps:read` | NPS analytics (computed from raw data) |

### Public (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/feedback/public/token/:token` | Look up feedback request by token |
| POST | `/feedback/public` | Submit feedback (token-protected) |

## NPS Scoring

- **Score 0-6** → DETRACTOR
- **Score 7-8** → PASSIVE
- **Score 9-10** → PROMOTER
- **NPS** = ((Promoters / Total) − (Detractors / Total)) × 100

## Sentiment Inference

Priority: NPS score > star rating > default NEUTRAL

| NPS Score | Sentiment |
|-----------|-----------|
| 0-3 | CRITICAL |
| 4-6 | NEGATIVE |
| 7-8 | NEUTRAL |
| 9-10 | POSITIVE |

| Star Rating | Sentiment |
|-------------|-----------|
| 1 | CRITICAL |
| 2 | NEGATIVE |
| 3 | NEUTRAL |
| 4-5 | POSITIVE |

## QR Flow

1. Staff creates a `FeedbackRequest` with source `QR` → gets a unique token
2. Token is encoded in a QR code URL (e.g., `https://app.example.com/feedback?token=<hex>`)
3. Customer scans QR → app calls `GET /feedback/public/token/:token`
4. Customer fills form → `POST /feedback/public` with token, rating, npsScore, comment
5. Request moves to SUBMITTED, Feedback is created with inferred sentiment + NPS bucket

## Permissions (9 new)

- `pos:feedback:read`
- `pos:feedback:request:create`
- `pos:feedback:tag`
- `pos:feedback:acknowledge`
- `pos:feedback:resolve`
- `pos:feedback:nps:read`
- `pos:feedback:request:cancel`
- `pos:feedback:public:token:read`
- `pos:feedback:analytics:read`

## Role Access

| Role | Permissions |
|------|------------|
| Owner / Manager / Supervisor | All 8 admin permissions |
| Accountant | read + nps:read |
| Cashier / Waiter | read + request:create |
| Event Manager | read + request:create + nps:read |
| Chef / Bartender | None |
