
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const createAdmin = async () => {
  try {
    const { MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error("Missing MONGO_URI, ADMIN_EMAIL, or ADMIN_PASSWORD.");
    }

    await mongoose.connect(MONGO_URI);

    const email = ADMIN_EMAIL.trim().toLowerCase();
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      existingUser.role = "admin";
      await existingUser.save();

      console.log("Existing account promoted to admin.");
    } else {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

      await User.create({
        name: "Admin",
        email,
        password: hashedPassword,
        role: "admin",
      });

      console.log("Admin account created.");
    }

    console.log("Admin email:", email);
    console.log("Admin password was not displayed for security.");
  } catch (error) {
    console.error("Failed to create admin:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

createAdmin();
