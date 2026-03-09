/**
 * Shared validation helpers used across auth service and routes.
 */

/**
 * Parse a DOB string (DD-MM-YYYY or YYYY-MM-DD) into a Date and ensure it is not in the future.
 * @param {string} dob
 * @returns {{ valid: boolean, error?: string }}
 */
const validateDOB = (dob) => {
  if (!dob) return { valid: false, error: 'Date of birth is required' };

  let parsed;
  // Try DD-MM-YYYY
  const ddmmyyyy = dob.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    parsed = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
  } else {
    // Try YYYY-MM-DD
    parsed = new Date(dob);
  }

  if (isNaN(parsed.getTime())) {
    return { valid: false, error: 'Invalid date of birth format' };
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999); // allow today itself
  if (parsed > today) {
    return { valid: false, error: 'Date of birth cannot be in the future' };
  }

  return { valid: true };
};

module.exports = { validateDOB };
