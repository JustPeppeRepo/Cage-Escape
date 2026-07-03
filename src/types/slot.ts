export type TimeSlot = {
  startTime: Date;
  endTime: Date;
};

export type DaySchedule = {
  closed: boolean;
  openHour: number;
  closeHour: number;
};

export type SerializedTimeSlot = {
  startTime: string;
  endTime: string;
};
