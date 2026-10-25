
import express from "express";

import {
  createBooking,
  getMyBookings,
  cancelBooking,
  checkAvailability,
  getAllBookings,
  getAvailableSlots
} from "../controllers/bookingController.js";

import {
  confirmAppointment,
  updateBookingStatus,
} from "../controllers/bookingActionController.js";

import adminMiddleware from "../middleware/adminMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin: get all appointments
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  getAllBookings
);

router.get(
  "/slots",
  authMiddleware,
  getAvailableSlots
);

// Admin: update an existing appointment's status
router.patch(
  "/admin/:id/status",
  authMiddleware,
  adminMiddleware,
  updateBookingStatus
);

// Create an appointment after explicit confirmation
router.post(
  "/confirm",
  authMiddleware,
  confirmAppointment
);

// Check appointment availability
router.get(
  "/availability",
  authMiddleware,
  checkAvailability
);

// Standard booking routes
router.post("/", authMiddleware, createBooking);

router.get(
  "/my",
  authMiddleware,
  getMyBookings
);

router.patch(
  "/:id/cancel",
  authMiddleware,
  cancelBooking
);

export default router;
