import { useCallback, useEffect, useState } from "react";
import {
  getHospitalDepartments,
  lookupPatientRecords,
  type Department,
  type FeedbackPayload,
  type PatientLookupMatch,
} from "./api";

export type IdentificationMode = "name" | "uhid";

export type PatientIdentitySubmitFields = Pick<
  FeedbackPayload,
  | "patientName"
  | "patientRegNo"
  | "patientEncounterType"
  | "department"
  | "lookupDepartment"
  | "visitOrAdmissionDate"
>;

export function usePatientIdentity() {
  const [identificationMode, setIdentificationMode] = useState<IdentificationMode>("name");
  const [manualPatientName, setManualPatientName] = useState("");
  const [manualDepartment, setManualDepartment] = useState("");
  const [hospitalDepartments, setHospitalDepartments] = useState<Department[]>([]);
  const [uhidInput, setUhidInput] = useState("");
  const [lookupFrmDate, setLookupFrmDate] = useState("");
  const [lookupToDate, setLookupToDate] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupMatches, setLookupMatches] = useState<PatientLookupMatch[]>([]);
  const [lookupRangeLabel, setLookupRangeLabel] = useState("");
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);

  const selectedMatch = lookupMatches.find((m) => m.key === selectedMatchKey) ?? null;

  const resolvedPatientName =
    identificationMode === "name"
      ? manualPatientName.trim()
      : selectedMatch?.patientName.trim() ?? "";

  const nameReady =
    identificationMode === "name"
      ? Boolean(manualPatientName.trim())
      : Boolean(selectedMatch?.patientName.trim());

  // Every submission must name the department the patient visited, so department analytics
  // never fall back to "Unassigned". UHID mode takes it from the EMR visit instead.
  const departmentReady =
    identificationMode === "name"
      ? Boolean(manualDepartment.trim())
      : Boolean(selectedMatch?.department.trim());

  const identityReady = Boolean(resolvedPatientName) && departmentReady;

  useEffect(() => {
    if (identificationMode !== "uhid") return;
    if (lookupMatches.length === 1) {
      setSelectedMatchKey(lookupMatches[0].key);
    } else if (lookupMatches.length === 0) {
      setSelectedMatchKey(null);
    } else {
      setSelectedMatchKey((prev) => {
        if (prev && lookupMatches.some((m) => m.key === prev)) return prev;
        return null;
      });
    }
  }, [identificationMode, lookupMatches]);

  useEffect(() => {
    if (identificationMode === "name") {
      setUhidInput("");
      setLookupFrmDate("");
      setLookupToDate("");
      setLookupMatches([]);
      setLookupRangeLabel("");
      setSelectedMatchKey(null);
      setLookupError(null);
    }
  }, [identificationMode]);

  useEffect(() => {
    let cancelled = false;
    void getHospitalDepartments()
      .then((rows) => {
        if (!cancelled) setHospitalDepartments(rows);
      })
      .catch(() => {
        if (!cancelled) setHospitalDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runPatientLookup = useCallback(async () => {
    const reg = uhidInput.trim();
    if (!reg) {
      setLookupError("Enter your hospital registration number (UHID) first.");
      return;
    }
    try {
      setLookupError(null);
      setLookupLoading(true);
      setLookupMatches([]);
      setSelectedMatchKey(null);
      const result = await lookupPatientRecords({
        regNo: reg,
        frmDate: lookupFrmDate.trim() || undefined,
        toDate: lookupToDate.trim() || undefined,
      });
      setLookupMatches(result.matches);
      setLookupRangeLabel(`${result.frmDate} – ${result.toDate}`);
      if (!result.matches.length) {
        setLookupError(
          "No OP visits returned for this number in the selected period. Try a wider optional date range (MM/DD/YYYY), then tap Look up again."
        );
      }
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed.");
      setLookupMatches([]);
    } finally {
      setLookupLoading(false);
    }
  }, [lookupFrmDate, lookupToDate, uhidInput]);

  const onPickMatch = useCallback((m: PatientLookupMatch) => {
    setSelectedMatchKey(m.key);
  }, []);

  const validateForSubmit = useCallback((): string | null => {
    if (identificationMode === "name") {
      if (!manualPatientName.trim()) {
        return "Please enter your name.";
      }
      if (!manualDepartment.trim()) {
        return "Please select your department.";
      }
      return null;
    }
    const regTrim = uhidInput.trim();
    if (!regTrim) {
      return "Enter your UHID and run Look up first.";
    }
    if (!selectedMatch?.patientName.trim()) {
      return "Choose your visit from the EMR list after Look up — name and department come from hospital records only.";
    }
    if (!selectedMatch.department.trim()) {
      return "This visit has no department in hospital records. Please ask the front office for help.";
    }
    return null;
  }, [identificationMode, manualDepartment, manualPatientName, selectedMatch, uhidInput]);

  const getSubmitFields = useCallback((): PatientIdentitySubmitFields => {
    if (identificationMode === "name") {
      const dept = manualDepartment.trim();
      return {
        patientName: manualPatientName.trim(),
        department: dept || undefined,
      };
    }

    const regTrim = uhidInput.trim();
    const sel = selectedMatch!;
    const emrDept = sel.department.trim();
    return {
      patientName: sel.patientName.trim(),
      patientRegNo: regTrim,
      patientEncounterType: sel.encounterType,
      department: emrDept || undefined,
      lookupDepartment: emrDept || undefined,
      visitOrAdmissionDate: sel.visitDate || undefined,
    };
  }, [
    identificationMode,
    manualDepartment,
    manualPatientName,
    selectedMatch,
    uhidInput,
  ]);

  const reset = useCallback(() => {
    setIdentificationMode("name");
    setManualPatientName("");
    setManualDepartment("");
    setUhidInput("");
    setLookupFrmDate("");
    setLookupToDate("");
    setLookupMatches([]);
    setLookupRangeLabel("");
    setSelectedMatchKey(null);
    setLookupError(null);
  }, []);

  const restoreFromSubmitFields = useCallback(
    (fields: PatientIdentitySubmitFields, mode: IdentificationMode, match: PatientLookupMatch | null) => {
      setIdentificationMode(mode);
      setLookupError(null);
      if (mode === "name") {
        setManualPatientName(fields.patientName?.trim() || "");
        setManualDepartment(fields.department?.trim() || "");
        setUhidInput("");
        setLookupMatches([]);
        setLookupRangeLabel("");
        setSelectedMatchKey(null);
        return;
      }
      setUhidInput(fields.patientRegNo?.trim() || "");
      setManualPatientName("");
      setManualDepartment("");
      if (match) {
        setLookupMatches([match]);
        setSelectedMatchKey(match.key);
      } else {
        setLookupMatches([]);
        setSelectedMatchKey(null);
      }
    },
    []
  );

  return {
    identificationMode,
    setIdentificationMode,
    manualPatientName,
    setManualPatientName,
    manualDepartment,
    setManualDepartment,
    hospitalDepartments,
    uhidInput,
    setUhidInput,
    lookupFrmDate,
    setLookupFrmDate,
    lookupToDate,
    setLookupToDate,
    lookupLoading,
    lookupError,
    lookupMatches,
    lookupRangeLabel,
    selectedMatchKey,
    selectedMatch,
    resolvedPatientName,
    nameReady,
    departmentReady,
    identityReady,
    runPatientLookup,
    onPickMatch,
    validateForSubmit,
    getSubmitFields,
    reset,
    restoreFromSubmitFields,
  };
}

export type PatientIdentityState = ReturnType<typeof usePatientIdentity>;
