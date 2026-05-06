import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * M39.2 — Verifies that GET /auth/me returns the membership/context block
 * the frontend uses to auto-resolve org/branch after global Nimbus login.
 */
describe('AuthService.me — M39.2 membership context', () => {
    let service: AuthService;
    let prisma: any;

    beforeEach(async () => {
        prisma = {
            user: { findUnique: jest.fn() },
            session: { findUnique: jest.fn() },
            membership: { findMany: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: prisma },
                { provide: JwtService, useValue: { sign: jest.fn() } },
                {
                    provide: ConfigService,
                    useValue: { get: (_k: string, def?: any) => def ?? 'test' },
                },
                { provide: AuditService, useValue: { log: jest.fn() } },
            ],
        }).compile();

        service = module.get(AuthService);
    });

    function userFixture() {
        return {
            id: 'u1',
            email: 'owner@demo.local',
            firstName: 'Olivia',
            lastName: 'Owner',
            displayName: 'Olivia Owner',
            isActive: true,
            userRoles: [
                {
                    role: {
                        id: 'r1',
                        name: 'Owner',
                        level: 'L5',
                        jobRole: 'OWNER',
                        rolePermissions: [{ permission: { action: 'onboarding:write' } }],
                    },
                },
            ],
        };
    }

    function membershipFixture(overrides: Partial<any> = {}) {
        return {
            id: 'm1',
            userId: 'u1',
            organizationId: 'org-1',
            branchId: 'branch-1',
            roleId: 'r1',
            status: 'ACTIVE',
            isDefaultBranch: true,
            organization: { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE' },
            branch: { id: 'branch-1', name: 'Main', slug: 'main', status: 'ACTIVE' },
            role: { id: 'r1', name: 'Owner', level: 'L5', jobRole: 'OWNER' },
            ...overrides,
        };
    }

    it('returns memberships array and context when user has one org/one branch', async () => {
        prisma.user.findUnique.mockResolvedValue(userFixture());
        prisma.session.findUnique.mockResolvedValue({
            id: 's1', platform: 'WEB', source: 'WEB', lastActivityAt: new Date(), createdAt: new Date(),
        });
        prisma.membership.findMany.mockResolvedValue([membershipFixture()]);

        const me = await service.me('u1', 's1');

        expect(me.memberships).toHaveLength(1);
        expect(me.memberships[0].organizationName).toBe('Acme');
        expect(me.memberships[0].branchName).toBe('Main');
        expect(me.memberships[0].roleName).toBe('Owner');
        expect(me.context.organizationCount).toBe(1);
        expect(me.context.branchCount).toBe(1);
        expect(me.context.requiresContextSelection).toBe(false);
        expect(me.context.defaultOrganizationId).toBe('org-1');
        expect(me.context.defaultBranchId).toBe('branch-1');
    });

    it('flags requiresContextSelection when user has multiple orgs', async () => {
        prisma.user.findUnique.mockResolvedValue(userFixture());
        prisma.session.findUnique.mockResolvedValue({
            id: 's1', platform: 'WEB', source: 'WEB', lastActivityAt: new Date(), createdAt: new Date(),
        });
        prisma.membership.findMany.mockResolvedValue([
            membershipFixture(),
            membershipFixture({
                id: 'm2', organizationId: 'org-2', branchId: 'branch-2', isDefaultBranch: false,
                organization: { id: 'org-2', name: 'Other', slug: 'other', status: 'ACTIVE' },
                branch: { id: 'branch-2', name: 'OtherMain', slug: 'other-main', status: 'ACTIVE' },
            }),
        ]);

        const me = await service.me('u1', 's1');
        expect(me.context.organizationCount).toBe(2);
        expect(me.context.requiresContextSelection).toBe(true);
        expect(me.context.defaultOrganizationId).toBe('org-1'); // isDefaultBranch first
    });

    it('flags requiresContextSelection when one org but multiple branches', async () => {
        prisma.user.findUnique.mockResolvedValue(userFixture());
        prisma.session.findUnique.mockResolvedValue({
            id: 's1', platform: 'WEB', source: 'WEB', lastActivityAt: new Date(), createdAt: new Date(),
        });
        prisma.membership.findMany.mockResolvedValue([
            membershipFixture({ isDefaultBranch: false }),
            membershipFixture({
                id: 'm2', branchId: 'branch-2',
                branch: { id: 'branch-2', name: 'Second', slug: 'second', status: 'ACTIVE' },
                isDefaultBranch: true,
            }),
        ]);

        const me = await service.me('u1', 's1');
        expect(me.context.organizationCount).toBe(1);
        expect(me.context.branchCount).toBe(2);
        expect(me.context.requiresContextSelection).toBe(true);
        // Default branch wins regardless of array order
        expect(me.context.defaultBranchId).toBe('branch-2');
    });

    it('returns empty memberships and null defaults when user has no memberships (e.g. just-invited user before activation flow finished)', async () => {
        prisma.user.findUnique.mockResolvedValue(userFixture());
        prisma.session.findUnique.mockResolvedValue({
            id: 's1', platform: 'WEB', source: 'WEB', lastActivityAt: new Date(), createdAt: new Date(),
        });
        prisma.membership.findMany.mockResolvedValue([]);

        const me = await service.me('u1', 's1');
        expect(me.memberships).toEqual([]);
        expect(me.context.organizationCount).toBe(0);
        expect(me.context.branchCount).toBe(0);
        expect(me.context.requiresContextSelection).toBe(false);
        expect(me.context.defaultOrganizationId).toBeNull();
        expect(me.context.defaultBranchId).toBeNull();
    });
});
