const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const axios = require("axios");
const pool = require("../db");
const bcrypt = require("bcryptjs");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

const request = async (method, url, data) => {
  const res = await axios({
    method,
    url,
    data,
    validateStatus: () => true,
  });
  return res;
};

const expectStatus = (res, status, label) => {
  if (res.status !== status) {
    throw new Error(`${label} expected ${status} but got ${res.status} (${JSON.stringify(res.data)})`);
  }
};

const run = async () => {
  const runId = Date.now();
  const facultyId = `fac-${runId}`;
  const studentRegUpper = `REG-${runId}`;
  const studentRegLower = studentRegUpper.toLowerCase();
  const studentEmail = `student-${runId}@example.com`;
  const facultyEmail = `faculty-${runId}@example.com`;
  const legacyFacultyEmail = `legacy-faculty-${runId}@example.com`;
  const legacyFacultyId = `legacy-${runId}`;
  const password = "Test@1234";

  let studentDbId = null;

  try {
    console.log("Creating student record...");
    const studentCreate = await request("post", `${API_BASE_URL}/students`, {
      name: `Test Student ${runId}`,
      register_number: studentRegUpper,
      year: 2,
      semester: 3,
      faculty_id: facultyId,
      phone_number: "0000000000",
    });
    expectStatus(studentCreate, 201, "Create student");
    studentDbId = studentCreate.data.studentId;

    console.log("Student signup (local)...");
    const signupStudent = await request("post", `${API_BASE_URL}/auth/signup`, {
      email: studentEmail,
      password,
      role: "student",
      student_id: studentRegLower,
    });
    expectStatus(signupStudent, 200, "Student signup");

    console.log("Student login (local)...");
    const loginStudent = await request("post", `${API_BASE_URL}/auth/login`, {
      email: studentEmail,
      password,
      role: "student",
    });
    expectStatus(loginStudent, 200, "Student login");

    console.log("Student signup with missing student ID should fail...");
    const missingStudent = await request("post", `${API_BASE_URL}/auth/signup`, {
      email: `missing-${runId}@example.com`,
      password,
      role: "student",
      student_id: `missing-${runId}`,
    });
    expectStatus(missingStudent, 404, "Missing student ID check");

    console.log("Duplicate student ID mapping should fail...");
    const dupStudent = await request("post", `${API_BASE_URL}/auth/signup`, {
      email: `student-dup-${runId}@example.com`,
      password,
      role: "student",
      student_id: studentRegLower,
    });
    expectStatus(dupStudent, 409, "Duplicate student ID mapping");

    console.log("Faculty signup (local)...");
    const signupFaculty = await request("post", `${API_BASE_URL}/auth/signup`, {
      email: facultyEmail,
      password,
      role: "faculty",
      faculty_id: facultyId,
    });
    expectStatus(signupFaculty, 200, "Faculty signup");

    console.log("Faculty login (local)...");
    const loginFaculty = await request("post", `${API_BASE_URL}/auth/login`, {
      email: facultyEmail,
      password,
      role: "faculty",
    });
    expectStatus(loginFaculty, 200, "Faculty login");

    console.log("Duplicate faculty ID mapping should fail...");
    const dupFaculty = await request("post", `${API_BASE_URL}/auth/signup`, {
      email: `faculty-dup-${runId}@example.com`,
      password,
      role: "faculty",
      faculty_id: facultyId,
    });
    expectStatus(dupFaculty, 409, "Duplicate faculty ID mapping");

    console.log("Create legacy faculty without faculty ID...");
    const legacyHash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO app_users (email, role, password_hash, auth_provider) VALUES ($1, 'faculty', $2, 'local')",
      [legacyFacultyEmail, legacyHash]
    );

    console.log("Legacy faculty login should return needs_faculty_id...");
    const legacyLogin = await request("post", `${API_BASE_URL}/auth/login`, {
      email: legacyFacultyEmail,
      password,
      role: "faculty",
    });
    expectStatus(legacyLogin, 200, "Legacy faculty login");
    if (!legacyLogin.data?.needs_faculty_id) {
      throw new Error("Legacy faculty login did not return needs_faculty_id=true");
    }

    console.log("Link faculty ID for legacy account...");
    const linkLegacy = await request("post", `${API_BASE_URL}/auth/link-faculty`, {
      email: legacyFacultyEmail,
      password,
      faculty_id: legacyFacultyId,
    });
    expectStatus(linkLegacy, 200, "Link legacy faculty ID");

    console.log("Role mismatch should fail...");
    const roleMismatch = await request("post", `${API_BASE_URL}/auth/login`, {
      email: studentEmail,
      password,
      role: "faculty",
    });
    expectStatus(roleMismatch, 403, "Role mismatch");

    console.log("Google mode validation should fail without valid mode...");
    const googleMode = await request("post", `${API_BASE_URL}/auth/google`, {
      id_token: "invalid-token",
      role: "student",
      mode: "invalid",
    });
    expectStatus(googleMode, 400, "Google mode validation");

    console.log("All checks passed.");
  } finally {
    try {
      if (studentDbId) {
        await pool.query("DELETE FROM students WHERE id=$1", [studentDbId]);
      }
      await pool.query(
        "DELETE FROM app_users WHERE email=$1 OR email=$2 OR email=$3",
        [studentEmail, facultyEmail, legacyFacultyEmail]
      );
    } catch (cleanupErr) {
      console.error("Cleanup failed:", cleanupErr.message);
    } finally {
      await pool.end();
    }
  }
};

run().catch((err) => {
  console.error("Auth mapping verification failed:", err.message);
  process.exit(1);
});
