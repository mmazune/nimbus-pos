# HR Core Guide — Employees + Contracts + HR Master Data

> Nimbus POS M23 — Employees + Contracts + HR Core

## Overview

M23 adds employee master data, employment contracts, organizational positions, and compensation profiles to the Nimbus POS backend. This is the foundational HR layer — it stores **who works here** (not attendance, scheduling, payroll, or performance, which are planned for later milestones).

## Data Model

### Employee

The central HR record. Each employee has a unique `employeeCode` per organization (auto-generated as `EMP-XXXXX` if not provided). An employee can optionally link to a `User` (for auth-enabled staff) via the `userId` field (unique — one employee per user).

| Field | Type | Notes |
|-------|------|-------|
| employeeCode | String | Unique per org, auto-generated |
| firstName, lastName | String | Required |
| status | EmployeeStatus | ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED |
| employmentType | EmploymentType | PERMANENT, TEMPORARY, CASUAL, CONTRACTOR |
| positionId | FK → Position | Optional link to position |
| compensationProfileId | FK → CompensationProfile | Optional link |
| userId | FK → User | Optional, unique per employee |

### EmploymentContract

Tracks formal contracts per employee. Auto-generates `contractNumber` as `CTR-XXXXX` if not provided.

| Field | Type | Notes |
|-------|------|-------|
| contractNumber | String | Unique per org |
| contractStatus | ContractStatus | DRAFT, ACTIVE, EXPIRED, TERMINATED |
| startsAt, endsAt | DateTime | Contract period |
| salaryBasis | SalaryBasis | HOURLY, DAILY, WEEKLY, MONTHLY |
| salaryAmount | Decimal | Optional |
| createdById | FK → User | Who created the contract |

### Position

Organizational positions (e.g., Head Chef, Waiter). Unique `code` per org.

### CompensationProfile

Salary templates (e.g., Monthly Senior, Daily Casual). Unique `code` per org.

## Endpoints

All under `/api/hr`, protected by JWT + Permission + BranchContext guards.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | /hr/employees | pos:hr:employees:create | Create employee |
| GET | /hr/employees | pos:hr:employees:read | List (paginated, filterable) |
| GET | /hr/employees/:id | pos:hr:employees:read | Get with contracts |
| PATCH | /hr/employees/:id | pos:hr:employees:update | Update fields |
| POST | /hr/contracts | pos:hr:contracts:create | Create contract |
| GET | /hr/contracts | pos:hr:contracts:read | List (filterable) |
| POST | /hr/positions | pos:hr:positions:create | Create position |
| GET | /hr/positions | pos:hr:positions:read | List all |
| POST | /hr/compensation-profiles | pos:hr:compensation:create | Create profile |
| GET | /hr/compensation-profiles | pos:hr:compensation:read | List all |

## Permissions (9 total)

| Permission | Description |
|-----------|-------------|
| pos:hr:employees:read | List and view employees |
| pos:hr:employees:create | Create employee records |
| pos:hr:employees:update | Update employee records |
| pos:hr:contracts:read | List and view employment contracts |
| pos:hr:contracts:create | Create employment contracts |
| pos:hr:positions:read | List and view positions |
| pos:hr:positions:create | Create positions |
| pos:hr:compensation:read | List and view compensation profiles |
| pos:hr:compensation:create | Create compensation profiles |

## Role Access Matrix

| Role | Access |
|------|--------|
| Owner | Full access (all 9 permissions) |
| Manager | All except compensation:create |
| Accountant | Read-only (employees, contracts, compensation) |
| Supervisor | Read employees, contracts, positions |
| Cashier/Chef/Waiter/Bartender | No HR access |

## Query Filters

### GET /hr/employees
- `status` — Filter by EmployeeStatus
- `employmentType` — Filter by EmploymentType
- `positionId` — Filter by position
- `search` — Search firstName, lastName, employeeCode, email
- `skip`, `take` — Pagination (default take=50)

### GET /hr/contracts
- `employeeId` — Filter by employee
- `contractStatus` — Filter by ContractStatus
- `salaryBasis` — Filter by SalaryBasis
- `skip`, `take` — Pagination

## Audit Events

All writes produce audit log entries: `EMPLOYEE_CREATED`, `EMPLOYEE_UPDATED`, `CONTRACT_CREATED`, `POSITION_CREATED`, `COMPENSATION_PROFILE_CREATED`.

## Seed Data

The seed creates demo data for development:
- 8 positions (Head Chef, Sous Chef, Line Cook, Head Waiter, Waiter, Bartender, Cashier, Manager)
- 4 compensation profiles (Monthly Senior/Mid/Junior, Daily Casual)
- 4 employees (Alice, Brian, Cissy, David — covering PERMANENT, TEMPORARY, CASUAL types)
- 3 employment contracts

## Future Milestones

This module is the foundation for:
- **M24: Attendance + Leave + Shift Swaps** ✅ (implemented)
- M29: Scheduling / Roster
- M30: Payroll
- M31: Staff Insights
