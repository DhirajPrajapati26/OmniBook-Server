import express from "express";

import {
  createService,
  getActiveServices,
  getAllServices,
  updateService,
  deleteService,
} from "../controllers/serviceController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

// Public: list active services
router.get("/", getActiveServices);

// Admin: list all services, including inactive ones
router.get("/admin/all", authMiddleware, adminMiddleware, getAllServices);

// Admin: create a service
router.post("/", authMiddleware, adminMiddleware, createService);

// Admin: update a service
router.patch("/:id", authMiddleware, adminMiddleware, updateService);

// Admin: deactivate a service
router.delete("/:id", authMiddleware, adminMiddleware, deleteService);

export default router;