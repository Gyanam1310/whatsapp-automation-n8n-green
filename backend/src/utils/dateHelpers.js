/**
 * Date normalization and comparison utilities for batch automation
 * Handles converting various date formats to YYYY-MM-DD for filtering
 */

function normalizeDate(dateInput) {
  if (!dateInput) {
    return null;
  }

  // If already in YYYY-MM-DD format, return as-is
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  // Convert to Date object if string (ISO format or others)
  let date;
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    return null;
  }

  // Check if valid date
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Return YYYY-MM-DD format
  return toTodayDateString(date.toISOString());
}

function getTodayDate() {
  // Get today's date in YYYY-MM-DD format
  // Uses local timezone, not UTC
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isTodayDate(dateString) {
  if (!dateString) {
    return false;
  }

  const normalized = normalizeDate(dateString);
  const today = getTodayDate();

  return normalized === today;
}

function toTodayDateString(isoString) {
  // Extract YYYY-MM-DD from ISO timestamp
  // Input: "2026-05-14T10:30:45.123Z" → Output: "2026-05-14"
  // Input: "2026-05-14" → Output: "2026-05-14"
  if (!isoString || typeof isoString !== 'string') {
    return null;
  }

  // Extract date portion (first 10 characters)
  const match = isoString.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

module.exports = {
  normalizeDate,
  getTodayDate,
  isTodayDate,
  toTodayDateString,
};
