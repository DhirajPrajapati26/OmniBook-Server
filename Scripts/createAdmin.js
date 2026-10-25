
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      existingUser.role = "admin";
      await existingUser.save();
      console.log("Existing account promoted to admin.");
    } else {
      const hashedPassword = await bcrypt.hash(password, 12);

      await User.create({
        name: "Admin",
      email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
      });

      console.log("Admin account created.");
    }

    console.log("Admin email:", email);
    console.log("Admin password:", password);
  } catch (error) {
    console.error("Failed to create admin:", error.message);
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
