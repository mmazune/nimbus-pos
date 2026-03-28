# M23 — Employees + Contracts + HR Core — Completion Report

## Summary

M23 adds the foundational HR layer to Nimbus POS: Employee master data, Employment Contracts, Positions, and Compensation Profiles. This is HR master data only — not attendance, scheduling, payroll, or performance.

## Deliverables

### Database
- **4 new enums**: EmployeeStatus, EmploymentType, ContractStatus, SalaryBasis
- **4 new models**: Employee, EmploymentContract, Position, CompensationProfile
- **Migration #28**: `20260330100000_m23_employees_contracts_hr_core`
- Relations added to User, Organization, Branch models
- Unique constraints: employeeCode per org, contractNumber per org, position code per org, compensation profile code per org

### API Module
- **Module**: `apps/api/src/modules/hr/`
- **Service**: 10 methods — CRUD for all 4 entities
- **Controller**: 10 endpoints under `/hr` prefix
- **DTOs**: 7 validation classes + barrel export
- **Guards**: JwtAuthGuard + PermissionGuard + BranchContextGuard on all endpoints

### Permissions
- **9 new permissions**: `pos:hr:employees:{read,create,update}`, `pos:hr:contracts:{read,create}`, `pos:hr:positions:{read,create}`, `pos:hr:compensation:{read,create}`
- **Total permissions**: 139
- **Role matrix**: Owner (full), Manager (all except comp:create), Accountant (read-only), Supervisor (read employees/contracts/positions)

### Tests
- **Unit tests**: 26 tests in `hr.service.spec.ts` — all pass
- **E2e tests**: 20+ tests in `hr.e2e-spec.ts`

### Seed Data
- 8 positions, 4 compensation profiles, 4 employees, 3 contracts
- Idempotent (findUnique + skip/create pattern)

### Postman
- Collection: `M23-Employees-Contracts-HR-Core.postman_collection.json`
- 13 requests with auto-capture test scripts

### Documentation
- `docs/HR_CORE_GUIDE.md` — full guide
- `docs/MODULES.md` — updated
- `ai/AI_STATUS.md` — updated (M23 checklist, current milestone)

## Commits
1. `m23 scaffold ok` — Schema, migration, DTOs, service, controller, module
2. `m23 tests + seed` — Unit tests, e2e spec, permissions, seed data
3. `m23 milestone complete` — Postman, docs, status, completion report

## Known State
- M13.1 (MTN Native) = PENDING
- M13.2 (Airtel Native) = PENDING
- Branch: `milestone/m23-employees-contracts-hr-core`
