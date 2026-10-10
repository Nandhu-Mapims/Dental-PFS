/**
 * Hospital identity for this deployment. Change these values to deploy for another hospital.
 * Keep in sync with frontend/src/app/lib/hospital.ts.
 */
export const HOSPITAL = {
  name: "Adhiparasakthi Dental College And Hospital",
  shortName: "APDCH",
  /** Tamil name with the locative suffix ("at the hospital"), used in the bot greeting. */
  nameTaLocative: "ஆதிபராசக்தி பல் மருத்துவக் கல்லூரி மற்றும் மருத்துவமனையில்",
  /** Default brand colours (admins can change them in Settings; "Reset" returns to these). */
  theme: {
    primaryColor: "#8B1538",
    accentColor: "#C9A227",
    pageBackgroundColor: "#FAF7F2",
  },
  /** Clinical departments seeded into a new database (`npm run seed`). Admins manage them afterwards. */
  departments: [
    { name: "Oral Medicine & Radiology", description: "Diagnosis, oral medicine and dental imaging" },
    { name: "Conservative Dentistry & Endodontics", description: "Fillings, restorations and root canal treatment" },
    { name: "Oral & Maxillofacial Surgery", description: "Extractions, jaw and facial surgery" },
    { name: "Orthodontics & Dentofacial Orthopaedics", description: "Braces, aligners and jaw growth correction" },
    { name: "Prosthodontics and Crown & Bridge", description: "Dentures, crowns and bridges" },
    { name: "Periodontics & Implantology", description: "Gum treatment and periodontal care" },
    { name: "Pedodontics & Preventive Dentistry", description: "Children's dental care and prevention" },
    { name: "Public Health Dentistry", description: "Community dental health and outreach" },
    { name: "Oral & Maxillofacial Pathology", description: "Biopsies and oral disease diagnosis" },
    { name: "Department of Implantology", description: "Dental implant treatment" },
  ],
};
