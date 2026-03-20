import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status ok', () => {
      const result = controller.getHealth();
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('nimbus-pos-api');
      expect(result.timestamp).toBeDefined();
    });
  });
});
