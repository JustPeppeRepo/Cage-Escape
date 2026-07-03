export type BookingActionError = {
  success: false;
  error: string;
  code: string;
};

export type BookingActionSuccess<T> = {
  success: true;
  data: T;
};

export type BookingActionResult<T> =
  | BookingActionSuccess<T>
  | BookingActionError;
