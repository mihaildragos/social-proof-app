import { Router, Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { validateScimRequest } from "../middleware/scimMiddleware";
import { scimService } from "../services/scimService";
import { scimAuthMiddleware } from "../middleware/scimAuthMiddleware";

const router = Router();

// Apply SCIM authentication middleware to all SCIM routes
router.use(scimAuthMiddleware);

/**
 * @route GET /scim/v2/Users
 * @desc Get all users (with filtering, pagination)
 * @access SCIM Auth
 */
router.get("/Users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startIndex, count, filter } = req.query;

    const result = await scimService.getUsers({
      organizationId: req.organizationId,
      startIndex: startIndex ? parseInt(startIndex as string, 10) : 1,
      count: count ? parseInt(count as string, 10) : 100,
      filter: filter as string,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /scim/v2/Users/:id
 * @desc Get a specific user by ID
 * @access SCIM Auth
 */
router.get("/Users/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;

    const user = await scimService.getUserById({
      organizationId: req.organizationId,
      id: userId,
    });

    if (!user) {
      throw NotFoundError("User not found");
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /scim/v2/Users
 * @desc Create a new user
 * @access SCIM Auth
 */
router.post(
  "/Users",
  validateScimRequest("user"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await scimService.createUser({
        organizationId: req.organizationId,
        userData: req.body,
      });

      logger.info("SCIM user created", {
        organizationId: req.organizationId,
        externalId: req.body.externalId,
      });

      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /scim/v2/Users/:id
 * @desc Replace a user
 * @access SCIM Auth
 */
router.put(
  "/Users/:id",
  validateScimRequest("user"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id;

      const user = await scimService.replaceUser({
        organizationId: req.organizationId,
        id: userId,
        userData: req.body,
      });

      if (!user) {
        throw NotFoundError("User not found");
      }

      logger.info("SCIM user replaced", {
        organizationId: req.organizationId,
        externalId: req.body.externalId,
      });

      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PATCH /scim/v2/Users/:id
 * @desc Update a user (partial)
 * @access SCIM Auth
 */
router.patch(
  "/Users/:id",
  validateScimRequest("patchOp"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id;

      const user = await scimService.updateUser({
        organizationId: req.organizationId,
        id: userId,
        operations: req.body.Operations,
      });

      if (!user) {
        throw NotFoundError("User not found");
      }

      logger.info("SCIM user updated", {
        organizationId: req.organizationId,
        id: userId,
      });

      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /scim/v2/Users/:id
 * @desc Delete a user
 * @access SCIM Auth
 */
router.delete("/Users/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;

    await scimService.deleteUser({
      organizationId: req.organizationId,
      id: userId,
    });

    logger.info("SCIM user deleted", {
      organizationId: req.organizationId,
      id: userId,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /scim/v2/Groups
 * @desc Get all groups (with filtering, pagination)
 * @access SCIM Auth
 */
router.get("/Groups", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startIndex, count, filter } = req.query;

    const result = await scimService.getGroups({
      organizationId: req.organizationId,
      startIndex: startIndex ? parseInt(startIndex as string, 10) : 1,
      count: count ? parseInt(count as string, 10) : 100,
      filter: filter as string,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /scim/v2/Groups/:id
 * @desc Get a specific group by ID
 * @access SCIM Auth
 */
router.get("/Groups/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;

    const group = await scimService.getGroupById({
      organizationId: req.organizationId,
      id: groupId,
    });

    if (!group) {
      throw NotFoundError("Group not found");
    }

    res.status(200).json(group);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /scim/v2/Groups
 * @desc Create a new group
 * @access SCIM Auth
 */
router.post(
  "/Groups",
  validateScimRequest("group"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await scimService.createGroup({
        organizationId: req.organizationId,
        groupData: req.body,
      });

      logger.info("SCIM group created", {
        organizationId: req.organizationId,
        displayName: req.body.displayName,
      });

      res.status(201).json(group);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /scim/v2/Groups/:id
 * @desc Replace a group
 * @access SCIM Auth
 */
router.put(
  "/Groups/:id",
  validateScimRequest("group"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = req.params.id;

      const group = await scimService.replaceGroup({
        organizationId: req.organizationId,
        id: groupId,
        groupData: req.body,
      });

      if (!group) {
        throw NotFoundError("Group not found");
      }

      logger.info("SCIM group replaced", {
        organizationId: req.organizationId,
        id: groupId,
      });

      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PATCH /scim/v2/Groups/:id
 * @desc Update a group (partial)
 * @access SCIM Auth
 */
router.patch(
  "/Groups/:id",
  validateScimRequest("patchOp"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = req.params.id;

      const group = await scimService.updateGroup({
        organizationId: req.organizationId,
        id: groupId,
        operations: req.body.Operations,
      });

      if (!group) {
        throw NotFoundError("Group not found");
      }

      logger.info("SCIM group updated", {
        organizationId: req.organizationId,
        id: groupId,
      });

      res.status(200).json(group);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /scim/v2/Groups/:id
 * @desc Delete a group
 * @access SCIM Auth
 */
router.delete("/Groups/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = req.params.id;

    await scimService.deleteGroup({
      organizationId: req.organizationId,
      id: groupId,
    });

    logger.info("SCIM group deleted", {
      organizationId: req.organizationId,
      id: groupId,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as scimRoutes };
