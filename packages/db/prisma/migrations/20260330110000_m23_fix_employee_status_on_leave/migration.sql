-- Fix M23 EmployeeStatus enum: rename INACTIVE → ON_LEAVE
-- The schema was initially written with INACTIVE but the business requirement
-- and all tests/docs use ON_LEAVE for the "employee is on leave" status.

ALTER TYPE "EmployeeStatus" RENAME VALUE 'INACTIVE' TO 'ON_LEAVE';
