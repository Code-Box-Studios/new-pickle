/** Booking timestamps encode Philippine wall-clock times in UTC fields. */
export function bookingWallNow(now = new Date()): Date {
  // The Philippines uses UTC+08:00 year-round. Hold expiry timestamps stay real UTC.
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}
