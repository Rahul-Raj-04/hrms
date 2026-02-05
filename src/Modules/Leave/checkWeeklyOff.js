import WeeklyHoliday from "./WeeklyHoliday.model.js";

export const checkWeeklyOffBetweenDates = async (startDate, endDate) => {
  // Fetch all weekly off days (e.g. Sunday)
  const weeklyOffs = await WeeklyHoliday.find({}, "day");

  const offDays = weeklyOffs.map((w) => w.day); // ["Sunday", "Saturday"]

  let current = new Date(startDate);

  while (current <= endDate) {
    const dayName = current.toLocaleDateString("en-US", {
      weekday: "long",
    });

    if (offDays.includes(dayName)) {
      return dayName; // ❌ found weekly off
    }

    current.setDate(current.getDate() + 1);
  }

  return null; // ✅ no weekly off found
};
