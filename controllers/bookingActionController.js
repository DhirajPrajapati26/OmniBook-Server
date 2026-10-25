
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Service from "../models/Service.js";



export const confirmAppointment = async (req, res) => {
  try {
    const { serviceId, startTime, confirmed, notes } = req.body;

    if (confirmed !== true) {
      return res.status(400).json({
        success: false,
        message: "Explicit appointment confirmation is required.",
      });
    }

    if (!serviceId || !startTime) {
      return res.status(400).json({
        success: false,
        message: "Service ID and start time are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const start = new Date(startTime);

    if (
      Number.isNaN(start.getTime()) ||
      start <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid future appointment time is required.",
      });
    }


    const startMinutes =
      start.getHours() * 60 + start.getMinutes();

    // Only allow 15-minute start intervals.
    if (
      start.getSeconds() !== 0 ||
      start.getMilliseconds() !== 0 ||
      startMinutes % 15 !== 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Appointments must start on a 15-minute interval.",
      });
    }

    // Salon hours: 9:00 AM to 6:00 PM.
    const OPEN_MINUTES = 9 * 60;
    const CLOSE_MINUTES = 18 * 60;

    if (
      startMinutes < OPEN_MINUTES ||
      startMinutes >= CLOSE_MINUTES
    ) {
      return res.status(400).json({
        success: false,
        message: "Appointments must start between 9 AM and 6 PM.",
      });
    }

    const service = await Service.findOne({
      _id: serviceId,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or inactive.",
      });
    }

    if (
      !Number.isFinite(service.duration) ||
      service.duration <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Service duration is invalid.",
      });
    }


    const end = new Date(
      start.getTime() + service.duration * 60 * 1000
    );

    const endMinutes =
      end.getHours() * 60 + end.getMinutes();

    // Prevent appointments from extending beyond closing
    // or crossing into another calendar day.
    if (
      end.toDateString() !== start.toDateString() ||
      endMinutes > CLOSE_MINUTES ||
      (endMinutes === CLOSE_MINUTES &&
        (end.getSeconds() !== 0 ||
          end.getMilliseconds() !== 0))
    ) {
      return res.status(400).json({
        success: false,
        message: "The appointment must finish by 6 PM.",
      });
    }

    // Check overlaps across all services because the salon
    // currently has one shared scheduling resource.
    const conflict = await Booking.findOne({
      status: { $in: ["Pending", "Confirmed"] },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message:
          "This slot is no longer available. Please choose another time.",
      });
    }

    const booking = await Booking.create({
      user: req.user._id,
      service: service._id,
      appointmentDate: start,
      startTime: start,
      endTime: end,
      notes: typeof notes === "string" ? notes.trim() : "",
      totalAmount: service.price,
    });

    return res.status(201).json({
      success: true,
      message: "Appointment created successfully.",
      booking,
    });
  } catch (error) {
    console.error("Confirm appointment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create appointment.",
    });
  }
};

// Update an existing appointment status 

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "Completed",
      "Cancelled",
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment status.",
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    booking.status = status;
    await booking.save();

    // Fetch the updated booking with customer and service details.
    const updatedBooking = await Booking.findById(id)
      .populate("user", "name email")
      .populate("service", "name duration price");

    return res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}.`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Update booking status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update appointment status.",
    });
  }
};
