export type AdminActionError = {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};

export type AdminActionSuccess<T = void> = {
  success: true;
  message?: string;
  data?: T;
};

export type AdminActionResult<T = void> =
  | AdminActionSuccess<T>
  | AdminActionError;

export function formDataToObject(
  formData: FormData,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}
