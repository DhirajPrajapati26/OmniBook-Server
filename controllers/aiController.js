import Conversation from "../models/Conversation.js";

import Service from "../models/Service.js";

import Booking from "../models/Booking.js";
import generateAIResponse from "../services/ollamaService.js";



const TIME_ZONE = "Asia/Kolkata";

const emptyPendingBooking = () => ({
  service: null,

  startTime: null,

  notes: "",

  awaitingConfirmation: false,
});

const emptyPendingCancellation = () => ({
  booking: null,

  bookingOptions: [],

  awaitingSelection: false,

  awaitingConfirmation: false,
});

const normalize = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .trim();

const isGreeting = (message) =>
  /^(hi|hello|hey|good morning|good afternoon|good evening|howdy)[!. ]*$/i.test(
    message.trim(),
  );

const isPositiveConfirmation = (message) =>
  /^(yes|yes please|confirm|confirm booking|book it|go ahead|proceed|i confirm|please book|sure|okay|ok)$/i.test(
    normalize(message),
  );

const isNegativeConfirmation = (message) =>
  /^(no|no thanks|cancel|don't book|do not book|not now|change it|choose another time|nope)$/i.test(
    normalize(message),
  );

const isCancellationRequest = (message) =>
  /\b(cancel my appointment|cancel my booking|cancel appointment|cancel booking|cancel an appointment|cancel an existing appointment|cancellation|cancelation)\b/i.test(
    message,
  );

const isRefusalToBook = (message) =>
  /\b(i don't want to book|i dont want to book|do not book|don't book|dont book|no booking|i don't need an appointment|i dont need an appointment)\b/i.test(
    message,
  );

const isBookingRequest = (message) =>
  /\b(book|booking|book me|book an appointment|book a service|make an appointment|schedule|schedule an appointment|reserve|reserve a slot|appointment for|i want to book|i'd like to book|i would like to book|i wanna book|i need an appointment|get an appointment|set up an appointment)\b/i.test(
    message,
  );

const isSimpleNumber = (message) => /^[1-9]\d*$/.test(message.trim());

const getLocalDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return {
    year: Number(values.year),

    month: Number(values.month),

    day: Number(values.day),
  };
};

const addCalendarDays = (parts, days) => {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  return {
    year: date.getUTCFullYear(),

    month: date.getUTCMonth() + 1,

    day: date.getUTCDate(),
  };
};

const getIndiaDate = (year, month, day, hour, minute) => {
  const date = new Date(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );

  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    hour: "2-digit",

    minute: "2-digit",

    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  if (
    Number(values.year) !== year ||
    Number(values.month) !== month ||
    Number(values.day) !== day ||
    Number(values.hour) !== hour ||
    Number(values.minute) !== minute
  ) {
    return null;
  }

  return date;
};

const lastMatch = (text, regex) => {
  const matches = [...text.matchAll(regex)];

  return matches.length ? matches[matches.length - 1] : null;
};


const parseAppointmentDateTime = (input) => {
  const text = input.toLowerCase();
  const today = getLocalDateParts();

  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  let dateParts = null;
  let dateFound = false;

  const relativeMatches = [
    ...text.matchAll(/\b(day after tomorrow|tomorrow|today)\b/g),
  ];

  const relative = relativeMatches.at(-1);

  const iso = lastMatch(text, /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g);


  const slash = lastMatch(text, /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g);

  const named = lastMatch(
    text,
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(20\d{2}))?\b/gi,
  );

  const monthFirst = lastMatch(
    text,
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/gi,
  );

  const weekdays = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const weekday = lastMatch(
    text,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g,
  );

  

  const dateCandidates = [
    relative && {
      index: relative.index,
      kind: "relative",
      match: relative,
    },
    iso && {
      index: iso.index,
      kind: "iso",
      match: iso,
    },
    slash && {
      index: slash.index,
      kind: "slash",
      match: slash,
    },
    named && {
      index: named.index,
      kind: "named",
      match: named,
    },
    // Only use month-first if a day-first date was not found.
    !named &&
      monthFirst && {
        index: monthFirst.index,
        kind: "monthFirst",
        match: monthFirst,
      },
    weekday && {
      index: weekday.index,
      kind: "weekday",
      match: weekday,
    },
  ].filter(Boolean);

  dateCandidates.sort((a, b) => a.index - b.index);

  console.log("INPUT:", text);
  console.log(
    "DATE CANDIDATES:",
    dateCandidates.map((item) => ({
      kind: item.kind,
      match: item.match[0],
      index: item.index,
    })),
  );

  const chosen = dateCandidates.at(-1);

  if (chosen) {
    const { kind, match } = chosen;

    if (kind === "relative") {
      const word = match[1];

      dateParts =
        word === "today"
          ? today
          : addCalendarDays(today, word === "tomorrow" ? 1 : 2);

      dateFound = true;
    } else if (kind === "iso") {
      dateParts = {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };

      dateFound = true;
    } else if (kind === "slash") {
      dateParts = {
        day: Number(match[1]),
        month: Number(match[2]),
        year: Number(match[3]),
      };

      dateFound = true;
    } else if (kind === "named" || kind === "monthFirst") {
      const monthText = (kind === "named" ? match[2] : match[1])
        .slice(0, 3)
        .toLowerCase();

      const day = Number(kind === "named" ? match[1] : match[2]);

      const month = months.indexOf(monthText) + 1;

      let year = Number(match[3] || today.year);

     
      if (!match[3]) {
        const endOfDay = getIndiaDate(year, month, day, 23, 59);

        if (!endOfDay) {
          return {
            dateFound: false,
            timeFound: false,
            date: null,
          };
        }

        if (endOfDay < new Date()) {
          year += 1;
        }
      }

      dateParts = { year, month, day };
      dateFound = true;
    } else if (kind === "weekday") {
      const currentWeekday = new Date(
        Date.UTC(today.year, today.month - 1, today.day),
      ).getUTCDay();

    
      let daysAhead = (weekdays[match[1]] - currentWeekday + 7) % 7;

      if (daysAhead === 0) {
        daysAhead = 7;
      }

      dateParts = addCalendarDays(today, daysAhead);
      dateFound = true;
    }
  }

  const timeCandidates = [
    ...text.matchAll(
      /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/gi,
    ),
  ];

  const time = timeCandidates.at(-1);
  const timeFound = Boolean(time);

  if (!dateFound || !dateParts || !timeFound) {
    return { dateFound, timeFound, date: null };
  }

  let hour;
  let minute;

  if (time[3]) {
    hour = Number(time[1]);
    minute = Number(time[2] || 0);

    if (time[3].toLowerCase() === "pm" && hour !== 12) {
      hour += 12;
    }

    if (time[3].toLowerCase() === "am" && hour === 12) {
      hour = 0;
    }
  } else {
    hour = Number(time[4]);
    minute = Number(time[5]);
  }

  const date = getIndiaDate(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    hour,
    minute,
  );

  return { dateFound, timeFound, date };
};

const formatAppointmentTime = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,

    weekday: "long",

    day: "numeric",

    month: "short",

    year: "numeric",

    hour: "numeric",

    minute: "2-digit",

    hour12: true,
  }).format(new Date(date));

const clearPendingBooking = (conversation) => {
  // Mutate in place so references captured earlier in this request are cleared too.
  if (conversation.pendingBooking) {
    Object.assign(conversation.pendingBooking, emptyPendingBooking());
  } else {
    conversation.pendingBooking = emptyPendingBooking();
  }
};

const clearPendingCancellation = (conversation) => {
  conversation.pendingCancellation = emptyPendingCancellation();
};

const addConversationTurn = (conversation, userMessage, assistantMessage) => {
  conversation.messages.push(
    { role: "user", content: userMessage },

    { role: "assistant", content: assistantMessage },
  );

  conversation.messages = conversation.messages.slice(-50);
};

const replyWithConversation = async (
  res,

  conversation,

  userMessage,

  assistantMessage,

  extra = {},
) => {
  addConversationTurn(conversation, userMessage, assistantMessage);

  await conversation.save();

  return res.status(200).json({
    success: true,

    reply: assistantMessage,

    ...extra,
  });
};


const stringSimilarity = require("string-similarity");

const findServiceFromMessage = (message, services) => {
  const normalizedMessage = normalize(message);

  // First, prefer an exact service-name match.
  const exactMatch = services
    .filter((service) =>
      normalizedMessage.includes(normalize(service.name))
    )
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (exactMatch) return exactMatch;

  // Next, check individual words for likely spelling mistakes.
  const words = normalizedMessage.split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const service of services) {
    const serviceName = normalize(service.name);
    const serviceWords = serviceName.split(/\s+/);

    for (const word of words) {
      // Avoid matching very short words accidentally.
      if (word.length < 4) continue;

      for (const serviceWord of serviceWords) {
        if (serviceWord.length < 4) continue;

        const score = stringSimilarity.compareTwoStrings(
          word,
          serviceWord
        );

        if (score > bestScore) {
          bestScore = score;
          bestMatch = service;
        }
      }
    }
  }

  // Only accept sufficiently close spelling matches.
  return bestScore >= 0.65 ? bestMatch : null;
};


const formatServices = (services) =>
  services

    .map(
      (service) =>
        `• ${service.name} — ${service.duration} minutes — ₹${service.price}`,
    )

    .join("\n");

const formatBookingOption = (booking, index) =>
  `${index + 1}. ${booking.service?.name || "Service"} — ${formatAppointmentTime(
    booking.startTime,
  )} — ${booking.status}`;

const getBookingContext = (conversation, currentMessage, services) => {
  const previous = (conversation.messages || []).filter(
    (item) => item.role === "user",
  );

  let startIndex = -1;

  previous.forEach((item, index) => {
    if (
      isBookingRequest(item.content) ||
      findServiceFromMessage(item.content, services)
    ) {
      startIndex = index;
    }
  });

  const contextMessages =
    startIndex >= 0
      ? previous.slice(startIndex).map((item) => item.content)
      : [];

  contextMessages.push(currentMessage);

  
  return contextMessages.join(" ");
};

export const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,

        message: "Please provide a message.",
      });
    }

    const userMessage = message.trim();

    if (userMessage.length > 2000) {
      return res.status(400).json({
        success: false,

        message: "Message must be 2000 characters or fewer.",
      });
    }

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,

        message: "Please log in to use the appointment assistant.",
      });
    }

    let conversation = await Conversation.findOne({
      user: req.user._id,

      isActive: true,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        user: req.user._id,

        messages: [],

        pendingBooking: emptyPendingBooking(),

        pendingCancellation: emptyPendingCancellation(),
      });
    }

    const services = await Service.find({ isActive: true })

      .select("name description duration price")

      .lean();

    if (!conversation.pendingBooking) {
      conversation.pendingBooking = emptyPendingBooking();
    }

    if (!conversation.pendingCancellation) {
      conversation.pendingCancellation = emptyPendingCancellation();
    }

    const pending = conversation.pendingBooking;

    const cancellation = conversation.pendingCancellation;

    if (typeof conversation.awaitingAnotherBooking !== "boolean") {
      conversation.awaitingAnotherBooking = false;
    }

    if (isGreeting(userMessage)) {
      clearPendingBooking(conversation);

      clearPendingCancellation(conversation);

      return replyWithConversation(
        res,

        conversation,

        userMessage,

        "Hi! How can I help you today? You can ask about our services, prices, or appointments.",
      );
    }

    // Cancellation 

    if (isCancellationRequest(userMessage)) {
      clearPendingBooking(conversation);

      const bookings = await Booking.find({
        user: req.user._id,

        status: { $in: ["Pending", "Confirmed"] },

        startTime: { $gt: new Date() },
      })

        .populate("service", "name")

        .sort({ startTime: 1 })

        .limit(10);

      if (!bookings.length) {
        clearPendingCancellation(conversation);

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          "You don't have any upcoming appointments that can be cancelled.",
        );
      }

      conversation.pendingCancellation = {
        booking: null,

        bookingOptions: bookings.map((booking) => booking._id),

        awaitingSelection: true,

        awaitingConfirmation: false,
      };

      return replyWithConversation(
        res,

        conversation,

        userMessage,

        `Which appointment would you like to cancel?\n\n${bookings

          .map(formatBookingOption)

          .join("\n")}\n\nReply with the appointment number.`,
      );
    }

    if (cancellation.awaitingSelection || cancellation.awaitingConfirmation) {
      if (isNegativeConfirmation(userMessage)) {
        clearPendingCancellation(conversation);

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          "Cancellation stopped. Your appointment has not been changed.",
        );
      }

      if (
        cancellation.awaitingConfirmation &&
        isPositiveConfirmation(userMessage)
      ) {
        const booking = await Booking.findOne({
          _id: cancellation.booking,

          user: req.user._id,

          status: { $in: ["Pending", "Confirmed"] },

          startTime: { $gt: new Date() },
        }).populate("service", "name");

        if (!booking) {
          clearPendingCancellation(conversation);

          return replyWithConversation(
            res,

            conversation,

            userMessage,

            "I couldn't cancel that appointment because its status may have changed. Please check My Appointments.",
          );
        }

        booking.status = "Cancelled";

        await booking.save();

        clearPendingCancellation(conversation);

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          `Your appointment has been cancelled successfully.\n\nService: ${
            booking.service?.name || "Service"
          }\nDate and time: ${formatAppointmentTime(booking.startTime)}`,

          {
            cancellationCompleted: true,

            bookingId: booking._id.toString(),
          },
        );
      }

      if (cancellation.awaitingSelection && isSimpleNumber(userMessage)) {
        const options = cancellation.bookingOptions || [];

        const index = Number(userMessage) - 1;

        if (index < 0 || index >= options.length) {
          return replyWithConversation(
            res,

            conversation,

            userMessage,

            `Please choose a number between 1 and ${options.length}.`,
          );
        }

        const booking = await Booking.findOne({
          _id: options[index],

          user: req.user._id,

          status: { $in: ["Pending", "Confirmed"] },

          startTime: { $gt: new Date() },
        }).populate("service", "name");

        if (!booking) {
          clearPendingCancellation(conversation);

          return replyWithConversation(
            res,

            conversation,

            userMessage,

            "That appointment is no longer eligible for cancellation. Ask me to cancel again to see your current appointments.",
          );
        }

        conversation.pendingCancellation = {
          booking: booking._id,

          bookingOptions: options,

          awaitingSelection: false,

          awaitingConfirmation: true,
        };

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          `Please confirm cancellation:\n\nService: ${
            booking.service?.name || "Service"
          }\nDate and time: ${formatAppointmentTime(
            booking.startTime,
          )}\n\nReply yes to cancel or no to keep the appointment.`,
        );
      }

      return replyWithConversation(
        res,

        conversation,

        userMessage,

        cancellation.awaitingSelection
          ? "Reply with the appointment number you want to cancel, or type 'no' to stop."
          : "Reply 'yes' to confirm cancellation or 'no' to keep your appointment.",
      );
    }

    if (conversation.awaitingAnotherBooking) {
      if (isNegativeConfirmation(userMessage)) {
        conversation.awaitingAnotherBooking = false;

        return replyWithConversation(
          res,
          conversation,
          userMessage,
          "No problem! Your appointment is saved. Thank you for booking with us.",
        );
      }

      if (isPositiveConfirmation(userMessage)) {
        conversation.awaitingAnotherBooking = false;
        clearPendingBooking(conversation);

        return replyWithConversation(
          res,
          conversation,
          userMessage,
          `Sure! Which service would you like to book next?\n\n${formatServices(
            services,
          )}\n\nPlease type the service name.`,
        );
      }
    }

   

    if (pending.awaitingConfirmation) {
      if (isNegativeConfirmation(userMessage)) {
        clearPendingBooking(conversation);

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          "No problem. Nothing has been booked. Tell me another date and time whenever you're ready.",
        );
      }

      if (isPositiveConfirmation(userMessage)) {
       if (!pending.service || !pending.startTime) {
  clearPendingBooking(conversation);

  return replyWithConversation(
    res,
    conversation,
    userMessage,
    "I cannot confirm this booking because the service or appointment time is missing. Please start a new booking.",
  );
}

        const service = await Service.findOne({
          _id: pending.service,

          isActive: true,
        });

        const start = new Date(pending.startTime);

        if (!service || Number.isNaN(start.getTime()) || start <= new Date()) {
          clearPendingBooking(conversation);

          return replyWithConversation(
            res,

            conversation,

            userMessage,

            "That service or appointment time is no longer valid. Please start a new booking with a future date and time.",
          );
        }

        const end = new Date(start.getTime() + service.duration * 60 * 1000);

        // Recheck availability immediately before creating the booking.

        const conflict = await Booking.findOne({
          service: service._id,

          status: { $in: ["Pending", "Confirmed"] },

          startTime: { $lt: end },

          endTime: { $gt: start },
        });

        if (conflict) {
          clearPendingBooking(conversation);

          return replyWithConversation(
            res,

            conversation,

            userMessage,

            `Sorry, ${formatAppointmentTime(
              start,
            )} is no longer available for ${service.name}. Please start again with another date and time.`,
          );
        }

        const booking = await Booking.create({
          user: req.user._id,

          service: service._id,

          appointmentDate: start,

          startTime: start,

          endTime: end,

          notes: pending.notes || "",

          totalAmount: service.price,

          status: "Pending",
        });

        clearPendingBooking(conversation);

conversation.awaitingAnotherBooking = true;
        return replyWithConversation(
          res,

          conversation,

          userMessage,

          `Your appointment request has been saved successfully!\n\nService: ${
            service.name
          }\nDate and time: ${formatAppointmentTime(
            start,
          )}\nDuration: ${service.duration} minutes\nPrice: ₹${
            service.price
          }\nStatus: Pending\n\nYou can view it in My Appointments.`,

          {
            bookingCreated: true,

            bookingId: booking._id.toString(),

            pendingConfirmation: false,
          },
        );
      }

      // A new request must not accidentally confirm an older proposal.

      if (
        isBookingRequest(userMessage) ||
        findServiceFromMessage(userMessage, services)
      ) {
        clearPendingBooking(conversation);
      } else {
       

        const parsedCorrection = parseAppointmentDateTime(userMessage);

        if (parsedCorrection.dateFound || parsedCorrection.timeFound) {
          pending.awaitingConfirmation = false;

          pending.startTime = null;
        } else {
          return replyWithConversation(
            res,

            conversation,

            userMessage,

            "I haven't booked anything yet. Reply yes to confirm the proposed appointment, no to cancel it, or provide a new date and time.",
          );
        }
      }
    }

    if (isRefusalToBook(userMessage)) {
      clearPendingBooking(conversation);

      return replyWithConversation(
        res,

        conversation,

        userMessage,

        "Understood. I won't start a booking. You can still ask me about our services.",
      );
    }

    const mentionedService = findServiceFromMessage(userMessage, services);

    // Continue an active booking only when the user supplies date/time details.

    const hasActiveBooking =
      Boolean(pending.service) && !pending.awaitingConfirmation;

    const parsedCurrent = parseAppointmentDateTime(userMessage);

    const isBookingContinuation =
      hasActiveBooking && (parsedCurrent.dateFound || parsedCurrent.timeFound);

    const serviceAndDateTime =
      Boolean(mentionedService) &&
      parsedCurrent.dateFound &&
      parsedCurrent.timeFound;

    const bookingIntent =
  isBookingRequest(userMessage) ||
  Boolean(isBookingContinuation) ||
  Boolean(mentionedService);

    if (bookingIntent) {
      if (!services.length) {
        clearPendingBooking(conversation);

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          "There are currently no active services available to book. Please try again later.",
        );
      }

      let selectedService = mentionedService;

      if (!selectedService && hasActiveBooking) {
        selectedService = await Service.findOne({
          _id: pending.service,

          isActive: true,
        });
      }

      if (!selectedService) {
        clearPendingBooking(conversation);

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          `Which service would you like to book?\n\n${formatServices(
            services,
          )}\n\nPlease type the service name.`,
        );
      }


      const contextText =
        isBookingContinuation && !isBookingRequest(userMessage)
          ? getBookingContext(conversation, userMessage, services)
          : userMessage;

      const parsed = parseAppointmentDateTime(contextText);

      // DEBUG LOGS — add these three lines
      console.log("CURRENT MESSAGE:", userMessage);
      console.log("BOOKING CONTEXT:", contextText);
      console.log("PARSED DATE/TIME:", parsed);

      conversation.lastServiceDiscussed = selectedService._id;

      pending.service = selectedService._id;

      if (!parsed.dateFound || !parsed.timeFound) {
        pending.startTime = null;

        pending.awaitingConfirmation = false;

        const missing = [];

        if (!parsed.dateFound) {
          missing.push("a date (for example, tomorrow or 29 October)");
        }

        if (!parsed.timeFound) {
          missing.push("a time (for example, 4 PM or 16:30)");
        }

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          `Sure! ${selectedService.name} costs ₹${selectedService.price} and takes ${selectedService.duration} minutes. What ${missing.join(
            " and ",
          )} would you prefer?`,
        );
      }

      if (!parsed.date) {
        pending.startTime = null;

        pending.awaitingConfirmation = false;

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          "I couldn't understand that date and time. Try '29 October at 4 PM', '20/10/2026 at 10:00 AM', or '2026-10-20 at 14:30'.",
        );
      }

      if (parsed.date <= new Date()) {
        pending.startTime = null;

        pending.awaitingConfirmation = false;

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          "That date and time is in the past. Please choose a future date and time.",
        );
      }

      const start = parsed.date;

      const end = new Date(
        start.getTime() + selectedService.duration * 60 * 1000,
      );

      const conflict = await Booking.findOne({
        service: selectedService._id,

        status: { $in: ["Pending", "Confirmed"] },

        startTime: { $lt: end },

        endTime: { $gt: start },
      });

      if (conflict) {
        pending.startTime = null;

        pending.awaitingConfirmation = false;

        return replyWithConversation(
          res,

          conversation,

          userMessage,

          `${formatAppointmentTime(
            start,
          )} is not available for ${selectedService.name}. Please choose another date and time.`,
        );
      }

      pending.startTime = start;

      pending.awaitingConfirmation = true;

      return replyWithConversation(
        res,

        conversation,

        userMessage,

        `Please review your appointment request:\n\nService: ${
          selectedService.name
        }\nDate and time: ${formatAppointmentTime(start)}\nDuration: ${
          selectedService.duration
        } minutes\nPrice: ₹${
          selectedService.price
        }\n\nWould you like to confirm this booking? Reply yes to save the appointment or no to cancel this request.`,

        {
          pendingConfirmation: true,

          proposedAppointment: {
            serviceName: selectedService.name,

            startTime: start.toISOString(),

            duration: selectedService.duration,

            price: selectedService.price,
          },
        },
      );
    }

  
   
if (mentionedService) {
  conversation.pendingBooking.service = mentionedService._id;
  conversation.pendingBooking.startTime = null;
  conversation.pendingBooking.notes = "";
  conversation.pendingBooking.awaitingConfirmation = false;

  return replyWithConversation(
    res,
    conversation,
    userMessage,
    `${mentionedService.name}\n\n${
      mentionedService.description ||
      "No additional description is available."
    }\n\nDuration: ${mentionedService.duration} minutes\nPrice: ₹${mentionedService.price}\n\nWould you like to book this service? Please provide your preferred date and time first.`,
  );
}


    const systemMessage = {
      role: "system",

      content: `You are OmniBook, a friendly appointment and service information assistant.

Rules:

\- Answer the user's actual question directly and concisely.

\- Use only the active service data below for service details, prices and durations.

\- Never invent services, prices, dates, times, availability or booking status.

\- Never claim a booking or cancellation has completed.

\- Only the backend can create or cancel appointments.

\- If the user wants to book, ask them to explicitly name the service and provide a date and time.

\- Do not force users into booking when they are asking a general question.

\- If service data does not answer a question, say so.

ACTIVE SERVICES:

${JSON.stringify(
  services.map((service) => ({
    name: service.name,

    description: service.description,

    duration: service.duration,

    price: service.price,
  })),
)}`,
    };

    const history = (conversation.messages || []).slice(-8).map((item) => ({
      role: item.role,

      content: item.content,
    }));

    const aiReply = await generateAIResponse([
      systemMessage,
      ...history,
      { role: "user", content: userMessage },
    ]);

    // Never let the language model report a booking as complete. Only the
    // database-backed confirmation branch above can return bookingCreated.
    const claimsBookingSuccess =
      /\b(booking|appointment)\b.{0,80}\b(successfully booked|booked successfully|has been booked|is booked|has been confirmed|is confirmed|confirmed successfully)\b/i.test(
        aiReply || "",
      );

    const safeAIReply = claimsBookingSuccess
      ? "I haven't booked or confirmed anything yet. If you'd like to make an appointment, tell me which service you want and your preferred date and time. I'll check availability and ask you to confirm before saving it."
      : aiReply ||
        "I couldn't generate a reply. You can ask about our available services.";

    return replyWithConversation(res, conversation, userMessage, safeAIReply);
  } catch (error) {
    console.error("AI chat error:", error);

    return res.status(502).json({
      success: false,

      message: "The AI assistant is temporarily unavailable. Please try again.",
    });
  }
};
