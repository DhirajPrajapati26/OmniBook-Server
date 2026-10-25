import express from "express";

import {
  createBooking,
  getMyBookings,
  cancelBooking,
  checkAvailability,
  getAllBookings,
  getAvailableSlots,
} from "../controllers/bookingController.js";

import {
  confirmAppointment,
  updateBookingStatus,
} from "../controllers/bookingActionController.js";

import adminMiddleware from "../middleware/adminMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/admin/all", authMiddleware, adminMiddleware, getAllBookings);

router.get("/slots", authMiddleware, getAvailableSlots);

router.patch(
  "/admin/:id/status",
  authMiddleware,
  adminMiddleware,
  updateBookingStatus,
);

router.post("/confirm", authMiddleware, confirmAppointment);

router.get("/availability", authMiddleware, checkAvailability);

router.post("/", authMiddleware, createBooking);

router.get("/my", authMiddleware, getMyBookings);

router.patch("/:id/cancel", authMiddleware, cancelBooking);

export default router;
