/**
 * Hospital identity for this deployment. Change these values to deploy for another hospital.
 * Keep in sync with backend/src/hospital.js.
 */
export const HOSPITAL = {
  name: "Adhiparasakthi Dental College And Hospital",
  shortName: "APDCH",
  /** Tamil name with the locative suffix ("at the hospital"), used in the bot greeting. */
  nameTaLocative: "ஆதிபராசக்தி பல் மருத்துவக் கல்லூரி மற்றும் மருத்துவமனையில்",
  /** Off: patients only enter their name; the UHID / EMR look-up option is hidden. */
  emrLookupEnabled: false,
};
