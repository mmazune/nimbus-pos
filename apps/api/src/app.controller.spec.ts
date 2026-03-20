import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma';

const mockPrismaService = {
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useFactory: () => new AppService(mockPrismaService as unknown as PrismaService),
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status ok with db ok', async () => {
      const result = await controller.getHealth();
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.db).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });

    it('should return db error when database is unreachable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await controller.getHealth();
      expect(result.status).toBe('error');
      expect(result.db).toBe('error');
      expect(result.timestamp).toBeDefined();
    });
  });
});
