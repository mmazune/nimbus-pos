import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'nimbus-pos-api',
      timestamp: new Date().toISOString(),
    };
  }
}
