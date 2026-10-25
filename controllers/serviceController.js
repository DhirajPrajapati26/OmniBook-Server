
import mongoose from "mongoose";
import Service from "../models/Service.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateServiceFields = (data, partial = false) => {
  const errors = [];

  if (!partial || data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      errors.push("Service name is required.");
    }
  }

  if (!partial || data.description !== undefined) {
    if (
      typeof data.description !== "string" ||
      !data.description.trim()
    ) {
      errors.push("Service description is required.");
    }
  }

  if (!partial || data.duration !== undefined) {
    const duration = Number(data.duration);

    if (
      data.duration === null ||
      data.duration === "" ||
      !Number.isFinite(duration) ||
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      errors.push("Duration must be a positive integer.");
    }
  }

  if (!partial || data.price !== undefined) {
    const price = Number(data.price);

    if (
      data.price === null ||
      data.price === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      errors.push("Price must be a non-negative number.");
    }
  }

  if (
    data.isActive !== undefined &&
    typeof data.isActive !== "boolean"
  ) {
    errors.push("isActive must be a boolean.");
  }

  return errors;
};

export const createService = async (req, res) => {
  try {
    const errors = validateServiceFields(req.body);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors.join(" "),
      });
    }

    const { name, description, duration, price } = req.body;

    const service = await Service.create({
      name: name.trim(),
      description: description.trim(),
      duration: Number(duration),
      price: Number(price),
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Service created successfully.",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create service.",
    });
  }
};

export const getActiveServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    console.error("Get active services error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
};

export const getAllServices = async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    console.error("Get all services error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "duration",
      "price",
      "isActive",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    const errors = validateServiceFields(updates, true);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors.join(" "),
      });
    }

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    if (updates.description !== undefined) {
      updates.description = updates.description.trim();
    }

    if (updates.duration !== undefined) {
      updates.duration = Number(updates.duration);
    }

    if (updates.price !== undefined) {
      updates.price = Number(updates.price);
    }

    const service = await Service.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      service,
    });
  } catch (error) {
    console.error("Update service error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update service.",
    });
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Service.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deactivated successfully.",
      service,
    });
  } catch (error) {
    console.error("Deactivate service error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate service.",
    });
  }
};
