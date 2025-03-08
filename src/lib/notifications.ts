import { toast } from "react-hot-toast";

// Toast IDs for preventing duplicates
export const TOAST_IDS = {
  SYNC_SUCCESS: "sync-success",
  SYNC_UP_TO_DATE: "sync-up-to-date",
  SYNC_ERROR: "sync-error",
  MINING_START: "mining-start",
  MINING_ERROR: "mining-error",
  ACCOUNT_SYNC: "account-sync",
  ACCOUNT_SYNC_ERROR: "account-sync-error",
};

/**
 * Show a success notification
 * @param message Message to display
 * @param id Optional ID to prevent duplicates
 * @param duration Duration in ms
 * @param icon Optional icon to display
 */
export function showSuccess(
  message: string,
  id?: string,
  duration = 3000,
  icon?: string
) {
  // Dismiss any existing toast with this ID
  if (id) toast.dismiss(id);

  // Log to console also for debugging
  console.log(`[NOTIFICATION] Success: ${message}`);

  // Show toast
  return toast.success(message, {
    id: id,
    duration: duration,
    icon: icon || "✅",
  });
}

/**
 * Show an error notification
 * @param message Message to display
 * @param id Optional ID to prevent duplicates
 * @param duration Duration in ms
 */
export function showError(message: string, id?: string, duration = 3000) {
  // Dismiss any existing toast with this ID
  if (id) toast.dismiss(id);

  // Log to console also for debugging
  console.error(`[NOTIFICATION] Error: ${message}`);

  // Show toast
  return toast.error(message, {
    id: id,
    duration: duration,
  });
}

/**
 * Show an info notification
 * @param message Message to display
 * @param id Optional ID to prevent duplicates
 * @param duration Duration in ms
 */
export function showInfo(message: string, id?: string, duration = 3000) {
  // Dismiss any existing toast with this ID
  if (id) toast.dismiss(id);

  // Log to console also for debugging
  console.log(`[NOTIFICATION] Info: ${message}`);

  // Show toast
  return toast.success(message, {
    id: id,
    duration: duration,
    icon: "ℹ️",
  });
}

// For debugging toast system
export function testToasts() {
  showSuccess("This is a test success message", "test-success");
  setTimeout(() => {
    showInfo("This is a test info message", "test-info");
  }, 1000);
  setTimeout(() => {
    showError("This is a test error message", "test-error");
  }, 2000);
}
