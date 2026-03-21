import { SetMetadata } from '@nestjs/common';

export const BRANCH_CONTEXT_KEY = 'requireBranchContext';
export const RequireBranchContext = () => SetMetadata(BRANCH_CONTEXT_KEY, true);
