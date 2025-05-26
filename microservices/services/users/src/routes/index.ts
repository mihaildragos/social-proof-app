import { Router } from "express";
import { authRoutes } from "./authRoutes";
import { userRoutes } from "./userRoutes";
import { profileRoutes } from "./profileRoutes";
import { organizationRoutes } from "./organizationRoutes";
import { invitationRoutes } from "./invitationRoutes";
import { teamRoutes } from "./teamRoutes";
import { scimRoutes } from "./scimRoutes";

const router = Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/profile", profileRoutes);
router.use("/organizations", organizationRoutes);
router.use("/invitations", invitationRoutes);
router.use("/teams", teamRoutes);
router.use("/scim/v2", scimRoutes);

export { router };
