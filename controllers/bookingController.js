
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Service from "../models/Service.js";

export const createBooking = async (req, res) => {
  try {
    const { serviceId, startTime, notes } = req.body;

    if (!serviceId || !startTime) {
      return res.status(400).json({
        success: false,
        message: "Service ID and appointment start time are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const start = new Date(startTime);

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment start time.",
      });
    }

    if (start <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Appointment must be in the future.",
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

    
    const end = new Date(
      start.getTime() + service.duration * 60 * 1000
    );

    // Check whether another booking overlaps this time
    const conflictingBooking = await Booking.findOne({
      service: serviceId,
      status: { $ne: "Cancelled" },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: "This appointment slot is already booked.",
      });
    }

    const booking = await Booking.create({
      user: req.user._id,
      service: service._id,
      appointmentDate: start,
      startTime: start,
      endTime: end,
      notes: notes || "",
      totalAmount: service.price,
    });

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create appointment.",
    });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.user._id,
    })
      .populate("service", "name description duration price")
      .sort({ startTime: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments.",
    });
  }
};


export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    if (booking.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Appointment is already cancelled.",
      });
    }

    if (booking.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Completed appointments cannot be cancelled.",
      });
    }

    booking.status = "Cancelled";
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully.",
      booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel appointment.",
    });
  }
};


export const checkAvailability = async (req, res) => {
  try {
    const { serviceId, startTime } = req.query;

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

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment start time.",
      });
    }

    if (start <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Appointment must be in the future.",
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

    const end = new Date(
      start.getTime() + service.duration * 60 * 1000
    );

    const conflictingBooking = await Booking.findOne({
      service: serviceId,
      status: { $ne: "Cancelled" },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    return res.status(200).json({
      success: true,
      available: !conflictingBooking,
      message: conflictingBooking
        ? "This time slot is unavailable."
        : "This time slot is available.",
      appointment: {
        serviceId: service._id,
        serviceName: service.name,
        startTime: start,
        endTime: end,
        duration: service.duration,
        price: service.price,
      },
    });
  } catch (error) {
    console.error("Check availability error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check appointment availability.",
    });
  }
};


export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("service", "name duration price")
      .sort({ startTime: 1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get all bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments.",
    });
  }
};



export const getAvailableSlots = async (req, res) => {
  try {
    const { serviceId, date } = req.query;

    if (!serviceId || !date) {
      return res.status(400).json({
        success: false,
        message: "Service ID and date are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    // Validate date format.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must use YYYY-MM-DD format.",
      });
    }

    const [year, month, day] = date.split("-").map(Number);


    const dayStart = new Date(year, month - 1, day);
    const dayEnd = new Date(year, month - 1, day + 1);

    if (
      dayStart.getFullYear() !== year ||
      dayStart.getMonth() !== month - 1 ||
      dayStart.getDate() !== day
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar date.",
      });
    }

    const service = await Service.findOne({
      _id: serviceId,
      isActive: true,
    }).lean();

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

    // Salon business hours: 9 AM to 6 PM.
    const OPEN_MINUTES = 9 * 60;
    const CLOSE_MINUTES = 18 * 60;

    // Generate a possible start time every 15 minutes.
    const SLOT_INTERVAL = 15;

    // Get bookings across ALL services 
    const bookings = await Booking.find({
      status: { $in: ["Pending", "Confirmed"] },
      startTime: { $lt: dayEnd },
      endTime: { $gt: dayStart },
    })
      .select("startTime endTime")
      .lean();

    const now = new Date();
    const slots = [];

    for (
      let minutes = OPEN_MINUTES;
      minutes + service.duration <= CLOSE_MINUTES;
      minutes += SLOT_INTERVAL
    ) {
      const start = new Date(dayStart);
      start.setMinutes(minutes, 0, 0);

      const end = new Date(
        start.getTime() + service.duration * 60 * 1000
      );

    
      if (start <= now) continue;

      const isBooked = bookings.some((booking) => {
        const existingStart = new Date(booking.startTime);
        const existingEnd = new Date(booking.endTime);

        return (
          existingStart < end &&
          existingEnd > start
        );
      });

      slots.push({
        startTime: start.toISOString(),
        time: start.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        available: !isBooked,
      });
    }

    return res.status(200).json({
      success: true,
      date,
      service: {
        _id: service._id,
        name: service.name,
        duration: service.duration,
        price: service.price,
      },
      slots,
    });
  } catch (error) {
    console.error("Get available slots error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch available slots.",
    });
  }
};
