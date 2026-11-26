import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuAvailabilityController } from './menu-availability.controller';
import { MenuAvailabilityService } from './menu-availability.service';
import { MenuWorkspaceService } from './menu-workspace.service';

@Module({
  controllers: [MenuController, MenuAvailabilityController],
  providers: [MenuService, MenuAvailabilityService, MenuWorkspaceService],
  exports: [MenuService, MenuAvailabilityService, MenuWorkspaceService],
})
export class MenuModule {}
