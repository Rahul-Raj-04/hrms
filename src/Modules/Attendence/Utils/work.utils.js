export const calculateWorkedSeconds = (sessions = []) => {
  let seconds = 0;
  const now = Date.now();

  sessions.forEach((s) => {
    if (s.start_time) {
      const end = s.end_time ? s.end_time.getTime() : now;
      seconds += (end - s.start_time.getTime()) / 1000;
    }
  });

  return Math.floor(seconds);
};

export const calculateWorkHoursFromSessions = (sessions = []) => {
  let seconds = 0;
  sessions.forEach((s) => {
    if (s.start_time && s.end_time) {
      seconds += (s.end_time - s.start_time) / 1000;
    }
  });
  return Number((seconds / 3600).toFixed(2));
};
