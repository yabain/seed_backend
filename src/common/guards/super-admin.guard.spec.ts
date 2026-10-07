import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { SuperAdminGuard } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;

  const reqHolder: { value: { user?: { role?: string } } } = { value: {} };
  const context: any = {
    switchToHttp: () => ({
      getRequest: () => reqHolder.value,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SuperAdminGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn(() => false) } },
      ],
    }).compile();

    guard = moduleRef.get(SuperAdminGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('allows superadmin', () => {
    reqHolder.value = { user: { role: 'superadmin' } };
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies admin (no hierarchy escalation)', () => {
    reqHolder.value = { user: { role: 'admin' } };
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies anonymous / missing role', () => {
    reqHolder.value = {};
    expect(guard.canActivate(context)).toBe(false);
  });

  it('returns true for @Public() routes', async () => {
    reqHolder.value = {}; // pas besoin d'utilisateur
    const moduleRef2 = await Test.createTestingModule({
      providers: [
        SuperAdminGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: (key: unknown) => (key === 'isPublic' ? true : false) },
        },
      ],
    }).compile();
    const pubGuard = moduleRef2.get(SuperAdminGuard);
    expect(pubGuard.canActivate(context)).toBe(true);
  });
});