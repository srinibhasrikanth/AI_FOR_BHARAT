/**
 * Medicine Reminder Cron Job
 * ─────────────────────────
 * Fires 4 times a day — once per slot window, 15 min after the window closes:
 *
 *   11:15  →  morning slots   (morning_before_breakfast, morning_after_breakfast)
 *   15:15  →  afternoon slots (afternoon_before_lunch, afternoon_after_lunch)
 *   20:15  →  evening slot    (evening)
 *   22:15  →  night slots     (night_before_dinner, night_after_dinner)
 *
 * For each patient with active prescriptions it sends a friendly reminder
 * in their preferred language (en / hi / te) asking them to take the medicine
 * if not yet done, or to mark it as taken on their dashboard if already taken.
 *
 * SOS medicines are never included — they are on-demand only.
 */

const cron = require('node-cron');
const Patient = require('../models/Patient.model');
const Prescription = require('../models/Prescription.model');
const { sendMedicineReminderEmail } = require('../utils/mailer');

// Human-readable slot labels per language
const SLOT_LABELS = {
  en: {
    morning_before_breakfast: 'Morning (Before Breakfast)',
    morning_after_breakfast:  'Morning (After Breakfast)',
    afternoon_before_lunch:   'Afternoon (Before Lunch)',
    afternoon_after_lunch:    'Afternoon (After Lunch)',
    evening:                  'Evening',
    night_before_dinner:      'Night (Before Dinner)',
    night_after_dinner:       'Night (After Dinner)',
    sos:                      'SOS / As Needed',
  },
  hi: {
    morning_before_breakfast: 'सुबह (नाश्ते से पहले)',
    morning_after_breakfast:  'सुबह (नाश्ते के बाद)',
    afternoon_before_lunch:   'दोपहर (लंच से पहले)',
    afternoon_after_lunch:    'दोपहर (लंच के बाद)',
    evening:                  'शाम',
    night_before_dinner:      'रात (रात के खाने से पहले)',
    night_after_dinner:       'रात (रात के खाने के बाद)',
    sos:                      'आवश्यकता पड़ने पर',
  },
  te: {
    morning_before_breakfast: 'ఉదయం (అల్పాహారానికి ముందు)',
    morning_after_breakfast:  'ఉదయం (అల్పాహారం తర్వాత)',
    afternoon_before_lunch:   'మధ్యాహ్నం (భోజనానికి ముందు)',
    afternoon_after_lunch:    'మధ్యాహ్నం (భోజనం తర్వాత)',
    evening:                  'సాయంత్రం',
    night_before_dinner:      'రాత్రి (రాత్రి భోజనానికి ముందు)',
    night_after_dinner:       'రాత్రి (రాత్రి భోజనం తర్వాత)',
    sos:                      'అవసరమైనప్పుడు',
  },
};

// Maps a named "slot group" to the prescription time-slot keys it covers.
// Each group fires once, 15 min after the window closes.
const SLOT_GROUPS = {
  morning:   ['morning_before_breakfast', 'morning_after_breakfast'],
  afternoon: ['afternoon_before_lunch',   'afternoon_after_lunch'],
  evening:   ['evening'],
  night:     ['night_before_dinner',      'night_after_dinner'],
};

// All non-SOS reminder slots (used as fallback when no group is specified)
const ALL_REMINDER_SLOTS = new Set(Object.values(SLOT_GROUPS).flat());

// SOAP boolean flag (consultationMedicines) → slot group key
// e.g. doctor sets { morning: true, night: true } → reminds in 'morning' + 'evening' groups
const SOAP_FLAG_TO_GROUP = {
  morning:   'morning',
  afternoon: 'afternoon',
  night:     'evening',   // SOAP "night" = evening slot group
  bedtime:   'night',     // SOAP "bedtime" = night slot group
};

/**
 * Core job logic — exported for testing / manual triggering.
 *
 * @param {string|null} slotGroup   - 'morning' | 'afternoon' | 'evening' | 'night' | null
 *   When null, all non-SOS slots are checked (useful for end-of-day full sweep).
 * @param {Date|string|null} targetDate
 *   The date to run the job FOR. Defaults to today.
 *   Pass a past date for ad-hoc backfill (e.g. when the scheduled job failed).
 *   The automatic cron schedule never passes this — it always defaults to today,
 *   so existing behaviour is completely unchanged.
 */
const runMedicineReminderJob = async (slotGroup = null, targetDate = null) => {
  const label = slotGroup ? `[${slotGroup}]` : '[all-slots]';
  const isAdhoc = targetDate !== null;

  // Resolve the reference date — fallback to today for the normal cron path
  const refDate = targetDate ? new Date(targetDate) : new Date();
  if (isNaN(refDate.getTime())) {
    throw new Error(`Invalid targetDate: "${targetDate}"`);
  }
  refDate.setHours(0, 0, 0, 0);

  console.log(
    `[MedicineReminder]${label}${isAdhoc ? ' [AD-HOC]' : ''} Running job at`,
    new Date().toISOString(),
    '| target date:', refDate.toISOString().split('T')[0]
  );

  const activeSlots = slotGroup
    ? new Set(SLOT_GROUPS[slotGroup] || [])
    : ALL_REMINDER_SLOTS;

  try {
    // Load all patients (we only need email, name, preferredLanguage)
    const patients = await Patient.find({}).select('name email preferredLanguage').lean();

    for (const patient of patients) {
      const lang = ['hi', 'te'].includes(patient.preferredLanguage)
        ? patient.preferredLanguage
        : 'en';

      // Use refDate as the reference "today" — allows ad-hoc runs for past dates
      const today = refDate;

      // We consider prescriptions issued up to today as potentially active.
      // A prescription is within range when: issuedAt ≤ today ≤ issuedAt + max(durationDays)
      // Populate medicineId so name is always available even if not stored directly.
      const prescriptions = await Prescription.find({ patientId: patient._id })
        .populate('medicines.medicineId', 'name')
        .sort({ issuedAt: -1 })
        .lean();

      if (!prescriptions || prescriptions.length === 0) continue;

      // Gather medicines that are scheduled for today across all active prescriptions
      const missedMeds = [];

      for (const prescription of prescriptions) {
        const issuedAt = new Date(prescription.issuedAt);
        issuedAt.setHours(0, 0, 0, 0);
        const daysSinceIssued = Math.floor((today - issuedAt) / (1000 * 60 * 60 * 24));

        // ── A: Standard prescription medicines (time[] array format) ──────────
        for (const med of prescription.medicines || []) {
          const duration = med.durationDays || 0;
          if (duration > 0 && daysSinceIssued >= duration) continue;

          // Resolve name: prefer stored string, fall back to populated ref
          const medName = med.name || med.medicineId?.name || 'Unknown Medicine';

          for (const slot of med.time || []) {
            if (!activeSlots.has(slot)) continue;
            const slotLabels = SLOT_LABELS[lang] || SLOT_LABELS.en;
            missedMeds.push({
              name:         medName,
              dosage:       med.dosage || '',
              slot:         slotLabels[slot] || slot,
              instructions: med.instructions || '',
            });
          }
        }

        // ── B: SOAP consultation medicines (boolean flag format) ──────────────
        // Stored in prescription.data.consultationMedicines as:
        // { name, dosage, duration, morning: true, afternoon: false, night: true, bedtime: false }
        const consultMeds = prescription.data?.consultationMedicines || [];
        for (const med of consultMeds) {
          // Parse duration: "5 days" → 5, or a bare number
          const rawDuration = med.durationDays || (typeof med.duration === 'string'
            ? parseInt(med.duration)
            : med.duration) || 0;
          if (rawDuration > 0 && daysSinceIssued >= rawDuration) continue;

          const medName = med.name || 'Unknown Medicine';

          for (const [flag, group] of Object.entries(SOAP_FLAG_TO_GROUP)) {
            if (!med[flag]) continue; // boolean flag not set for this slot

            // Check if this slotGroup is in scope for this run
            const groupSlots = SLOT_GROUPS[group] || [];
            const groupActive = groupSlots.some((s) => activeSlots.has(s));
            if (!groupActive) continue;

            // Use the first slot key of the group for the readable label
            const representativeSlot = groupSlots[0];
            const slotLabels = SLOT_LABELS[lang] || SLOT_LABELS.en;
            missedMeds.push({
              name:         medName,
              dosage:       med.dosage || '',
              slot:         slotLabels[representativeSlot] || representativeSlot,
              instructions: med.instructions || '',
            });
          }
        }
      }

      // De-duplicate by medicine name + slot (in case multiple prescriptions overlap)
      const seen = new Set();
      const uniqueMissed = missedMeds.filter((m) => {
        const key = `${m.name}|${m.slot}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniqueMissed.length === 0) continue;

      // Send reminder
      try {
        await sendMedicineReminderEmail(patient.email, patient.name, uniqueMissed, lang);
        console.log(`[MedicineReminder]${label} Sent reminder to ${patient.email} (${lang}) — ${uniqueMissed.length} medicine(s)`);
      } catch (mailErr) {
        console.error(`[MedicineReminder] Failed to send to ${patient.email}:`, mailErr.message);
      }
    }

    console.log(`[MedicineReminder]${label}${isAdhoc ? ' [AD-HOC]' : ''} Job completed for date: ${refDate.toISOString().split('T')[0]}.`);
  } catch (err) {
    console.error(`[MedicineReminder]${label} Job error:`, err);
  }
};

/**
 * Register all four per-slot cron schedules (IST / Asia/Kolkata).
 *
 *  11:15  after morning window ends  (6–11)
 *  15:15  after afternoon window ends (12–15)
 *  20:15  after evening window ends  (17–20)
 *  22:15  after night window ends    (18–22)
 */
const scheduleMedicineReminders = () => {
  const opts = { scheduled: true, timezone: 'Asia/Kolkata' };

  cron.schedule('15 11 * * *', () => runMedicineReminderJob('morning'),   opts);
  cron.schedule('15 15 * * *', () => runMedicineReminderJob('afternoon'), opts);
  cron.schedule('15 20 * * *', () => runMedicineReminderJob('evening'),   opts);
  cron.schedule('15 22 * * *', () => runMedicineReminderJob('night'),     opts);

  console.log('[MedicineReminder] 4 cron jobs scheduled (IST):');
  console.log('  • 11:15  → morning slots');
  console.log('  • 15:15  → afternoon slots');
  console.log('  • 20:15  → evening slot');
  console.log('  • 22:15  → night slots');
};

module.exports = { scheduleMedicineReminders, runMedicineReminderJob };
