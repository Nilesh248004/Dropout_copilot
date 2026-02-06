import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Snackbar,
  Alert,
  MenuItem,
  Divider,
  Stack,
  Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import { normalizeFacultyId } from "../utils/faculty";

const AddStudentPage = () => {
  const navigate = useNavigate();
  const { role, facultyId } = useRole();
  const [student, setStudent] = useState({
    name: "",
    register_number: "",
    year: "",
    semester: "",
    faculty_id: role === "faculty" ? facultyId : "",
    phone_number: "",
    attendance: "",
    cgpa: "",
    arrear_count: "",
    fees_paid: "",
    disciplinary_issues: "",
  });
  const [loading, setLoading] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkInvalidRows, setBulkInvalidRows] = useState([]);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Snackbar for feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const headerMap = useMemo(
    () => ({
      name: "name",
      studentname: "name",
      fullname: "name",
      register: "register_number",
      regno: "register_number",
      regnumber: "register_number",
      registernumber: "register_number",
      studentid: "register_number",
      year: "year",
      semester: "semester",
      sem: "semester",
      faculty: "faculty_id",
      facultyid: "faculty_id",
      phone: "phone_number",
      phonenumber: "phone_number",
      mobile: "phone_number",
      attendance: "attendance",
      attendancepercent: "attendance",
      cgpa: "cgpa",
      gpa: "cgpa",
      arrear: "arrear_count",
      arrears: "arrear_count",
      arrearcount: "arrear_count",
      fees: "fees_paid",
      feespaid: "fees_paid",
      feesstatus: "fees_paid",
      disciplinary: "disciplinary_issues",
      disciplinaryissues: "disciplinary_issues",
      discipline: "disciplinary_issues",
    }),
    []
  );
  const requiredColumns = useMemo(
    () => [
      "name",
      "register_number",
      "year",
      "semester",
      "attendance",
      "cgpa",
      "arrear_count",
      "fees_paid",
    ],
    []
  );

  const handleChange = (e) => {
    setStudent({ ...student, [e.target.name]: e.target.value });
  };

  const normalizeHeader = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const normalizeFeesPaid = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const normalized = String(value).trim().toLowerCase();
    if (["paid", "yes", "true", "1", "y"].includes(normalized)) return true;
    if (["unpaid", "no", "false", "0", "n", "due"].includes(normalized)) return false;
    return null;
  };

  const parseBulkRows = (rawRows) =>
    rawRows.map((row, index) => {
      const mapped = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        const normalizedKey = normalizeHeader(key);
        const mappedKey = headerMap[normalizedKey];
        if (!mappedKey) return;
        if (mapped[mappedKey] !== undefined && mapped[mappedKey] !== "") return;
        mapped[mappedKey] = value;
      });

      const cleaned = {
        name: String(mapped.name || "").trim(),
        register_number: String(mapped.register_number || "").trim(),
        year: toNumberOrNull(mapped.year),
        semester: toNumberOrNull(mapped.semester),
        faculty_id: mapped.faculty_id ? String(mapped.faculty_id).trim() : "",
        phone_number: mapped.phone_number ? String(mapped.phone_number).trim() : "",
        attendance: toNumberOrNull(mapped.attendance),
        cgpa: toNumberOrNull(mapped.cgpa),
        arrear_count: toNumberOrNull(mapped.arrear_count),
        fees_paid: normalizeFeesPaid(mapped.fees_paid),
        disciplinary_issues: toNumberOrNull(mapped.disciplinary_issues),
      };

      const missing = [];
      if (!cleaned.name) missing.push("name");
      if (!cleaned.register_number) missing.push("register_number");
      if (cleaned.year === null) missing.push("year");
      if (cleaned.semester === null) missing.push("semester");
      if (cleaned.attendance === null) missing.push("attendance");
      if (cleaned.cgpa === null) missing.push("cgpa");
      if (cleaned.arrear_count === null) missing.push("arrear_count");
      if (cleaned.fees_paid === null) missing.push("fees_paid");

      return {
        index,
        row: cleaned,
        issues: missing,
      };
    });

  const handleBulkFile = async (file) => {
    if (!file) return;
    setBulkStatus(null);
    setBulkRows([]);
    setBulkInvalidRows([]);
    setBulkFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("No worksheet found.");
      }
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })[0] || [];
      const mappedHeaders = new Set(
        headerRow
          .map((header) => headerMap[normalizeHeader(header)])
          .filter(Boolean)
      );
      const missingHeaders = requiredColumns.filter(
        (key) => !mappedHeaders.has(key)
      );
      if (missingHeaders.length > 0) {
        setBulkStatus({
          type: "error",
          message: `Missing required columns: ${missingHeaders.join(", ")}`,
        });
        setBulkRows([]);
        setBulkInvalidRows([]);
        return;
      }
      if (!rawRows.length) {
        throw new Error("No rows found in the file.");
      }
      const parsed = parseBulkRows(rawRows);
      const validRows = parsed.filter((item) => item.issues.length === 0).map((item) => item.row);
      const invalidRows = parsed.filter((item) => item.issues.length > 0);

      setBulkRows(validRows);
      setBulkInvalidRows(invalidRows);
      if (!validRows.length) {
        setBulkStatus({ type: "error", message: "No valid rows found. Check required fields." });
      } else {
        setBulkStatus({
          type: "success",
          message: `Loaded ${validRows.length} valid row(s).`,
        });
      }
    } catch (err) {
      setBulkStatus({ type: "error", message: err.message || "Unable to read file." });
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      handleBulkFile(file);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleBulkFile(file);
    }
  };

  const uploadBulkStudents = async () => {
    if (!bulkRows.length) {
      setBulkStatus({ type: "error", message: "No valid rows to upload." });
      return;
    }
    try {
      setBulkUploading(true);
      const forcedFacultyId = role === "faculty" ? normalizeFacultyId(facultyId) : "";
      const payloadRows = bulkRows.map((row) => ({
        ...row,
        faculty_id: forcedFacultyId || row.faculty_id || "",
      }));
      const res = await axios.post(`${API_BASE_URL}/students/bulk`, {
        students: payloadRows,
        force_faculty_id: forcedFacultyId || null,
      });
      const created = res.data?.created || 0;
      const failed = res.data?.failed || 0;
      setBulkStatus({
        type: failed ? "warning" : "success",
        message: `Imported ${created} student(s).${failed ? ` ${failed} failed.` : ""}`,
      });
      if (!failed) {
        setTimeout(() => navigate("/dashboard"), 1500);
      }
    } catch (err) {
      setBulkStatus({
        type: "error",
        message: err.response?.data?.error || "Bulk import failed.",
      });
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "name",
      "register_number",
      "year",
      "semester",
      "phone_number",
      "attendance",
      "cgpa",
      "arrear_count",
      "fees_paid",
      "disciplinary_issues",
    ];
    const sample = [
      "Asha Patel",
      "STU001",
      "2",
      "4",
      "9876543210",
      "86",
      "7.4",
      "0",
      "Paid",
      "0",
    ];
    const csv = [headers, sample]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (role === "faculty") {
      setStudent((prev) => ({ ...prev, faculty_id: facultyId || "" }));
    }
  }, [role, facultyId]);


  const handleSubmit = async () => {
    const {
      name,
      register_number,
      year,
      semester,
      faculty_id,
      phone_number,
      attendance,
      cgpa,
      arrear_count,
      fees_paid,
      disciplinary_issues,
    } = student;

    // Basic validation
    if (!name || !register_number || !year || !semester) {
      setSnackbar({ open: true, message: "Please fill all fields", severity: "error" });
      return;
    }
    const normalizedFacultyId = normalizeFacultyId(faculty_id);
    if ((role === "faculty" || role === "admin") && !normalizedFacultyId) {
      setSnackbar({ open: true, message: "Please enter the faculty ID", severity: "error" });
      return;
    }
    if (attendance === "" || cgpa === "" || arrear_count === "" || fees_paid === "") {
      setSnackbar({
        open: true,
        message: "Please enter attendance, CGPA, arrear count, and fees status.",
        severity: "error",
      });
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        `${API_BASE_URL}/students`,
        {
          name,
          register_number,
          year,
          semester,
          faculty_id: normalizedFacultyId || null,
          phone_number: phone_number || null,
          attendance: attendance === "" ? null : Number(attendance),
          cgpa: cgpa === "" ? null : Number(cgpa),
          arrear_count: arrear_count === "" ? null : Number(arrear_count),
          fees_paid: fees_paid === "" ? null : Boolean(fees_paid),
          disciplinary_issues: disciplinary_issues === "" ? null : Number(disciplinary_issues),
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      setSnackbar({ open: true, message: "Student added successfully!", severity: "success" });

      // Redirect after short delay
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      console.error("Error adding student:", err.response?.data || err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || err.response?.data?.detail || "Failed to add student",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 5 }}>
      <Paper sx={{ p: 4, boxShadow: 3 }}>
        <Typography variant="h5" mb={3}>
          + Add New Student
        </Typography>
        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="Name"
            name="name"
            value={student.name}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Register Number"
            name="register_number"
            value={student.register_number}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Year"
            name="year"
            type="number"
            value={student.year}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Semester"
            name="semester"
            type="number"
            value={student.semester}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Phone Number"
            name="phone_number"
            value={student.phone_number}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Attendance %"
            name="attendance"
            type="number"
            value={student.attendance}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            label="CGPA"
            name="cgpa"
            type="number"
            value={student.cgpa}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            label="Arrear Count"
            name="arrear_count"
            type="number"
            value={student.arrear_count}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            select
            label="Fees Status"
            name="fees_paid"
            value={student.fees_paid}
            onChange={handleChange}
            fullWidth
            required
          >
            <MenuItem value={true}>Paid</MenuItem>
            <MenuItem value={false}>Not Paid</MenuItem>
          </TextField>
          <TextField
            label="Disciplinary Issues"
            name="disciplinary_issues"
            type="number"
            value={student.disciplinary_issues}
            onChange={handleChange}
            fullWidth
          />
          {role === "faculty" ? (
            <TextField
              label="Faculty ID"
              name="faculty_id"
              value={student.faculty_id}
              fullWidth
              disabled
              helperText="Students will be mapped to your faculty ID"
            />
          ) : (
            <TextField
              label="Faculty ID"
              name="faculty_id"
              value={student.faculty_id}
              onChange={handleChange}
              fullWidth
              required
            />
          )}

          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Student"}
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={() => navigate("/dashboard")}
          >
            Cancel
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Bulk Import (Excel/CSV)</Typography>
            <Typography variant="body2" color="text.secondary">
              Drag and drop an Excel/CSV file to add multiple students at once. Required columns:
              name, register_number, year, semester, attendance, cgpa, arrear_count, fees_paid.
            </Typography>
          </Box>

          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              p: 3,
              borderRadius: 2.5,
              border: "2px dashed",
              borderColor: isDragActive ? "primary.main" : "rgba(148, 163, 184, 0.6)",
              bgcolor: isDragActive ? "rgba(59, 130, 246, 0.08)" : "rgba(148, 163, 184, 0.08)",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={handleFileChange}
            />
            <Typography variant="subtitle1" fontWeight={600}>
              Drop your file here or click to upload
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supported: .xlsx, .xls, .csv
            </Typography>
            {bulkFileName && (
              <Box mt={1}>
                <Chip label={bulkFileName} variant="outlined" />
              </Box>
            )}
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button variant="outlined" onClick={downloadTemplate}>
              Download Template
            </Button>
            <Button
              variant="contained"
              onClick={uploadBulkStudents}
              disabled={bulkUploading || bulkRows.length === 0}
            >
              {bulkUploading ? "Importing..." : "Import Students"}
            </Button>
            {role === "faculty" && (
              <Chip
                label={`Faculty ID locked: ${normalizeFacultyId(facultyId) || "N/A"}`}
                color="info"
                variant="outlined"
                sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
              />
            )}
          </Stack>

          {bulkStatus && (
            <Alert severity={bulkStatus.type}>{bulkStatus.message}</Alert>
          )}

          {bulkInvalidRows.length > 0 && (
            <Alert severity="warning">
              {bulkInvalidRows.length} row(s) skipped due to missing/invalid fields.
              Example: Row {bulkInvalidRows[0].index + 2} missing {bulkInvalidRows[0].issues.join(", ")}.
            </Alert>
          )}

        </Stack>

        {/* Snackbar for messages */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Paper>
    </Container>
  );
};

export default AddStudentPage;
