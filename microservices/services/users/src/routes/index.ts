import { Router } from 'express';
import { authRoutes } from './authRoutes';
import { userRoutes } from './userRoutes';
import { organizationRoutes } from './organizationRoutes';
import { invitationRoutes } from './invitationRoutes';
import { scimRoutes } from './scimRoutes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/invitations', invitationRoutes);
router.use('/scim/v2', scimRoutes);

export { router }; 