
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const pendingBookingSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    startTime: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    awaitingConfirmation: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const pendingCancellationSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    bookingOptions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
    awaitingSelection: {
      type: Boolean,
      default: false,
    },
    awaitingConfirmation: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastServiceDiscussed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    pendingBooking: {
      type: pendingBookingSchema,
      default: () => ({}),
    },
    pendingCancellation: {
      type: pendingCancellationSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
