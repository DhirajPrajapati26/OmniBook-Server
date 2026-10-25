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


router.get("/", getActiveServices);


router.get("/admin/all", authMiddleware, adminMiddleware, getAllServices);


router.post("/", authMiddleware, adminMiddleware, createService);


router.patch("/:id", authMiddleware, adminMiddleware, updateService);

router.delete("/:id", authMiddleware, adminMiddleware, deleteService);

export default router;