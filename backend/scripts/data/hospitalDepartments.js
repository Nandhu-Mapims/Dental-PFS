/**
 * Departments seeded by `npm run seed` (names must be unique per DB constraint).
 * The list lives in src/hospital.js so each deployment configures it in one place.
 */
import { HOSPITAL } from "../../src/hospital.js";

export const HOSPITAL_DEPARTMENTS = HOSPITAL.departments;
