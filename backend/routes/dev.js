const express = require('express');
const router = express.Router();
const db = require('../db');
const { requirePermission } = require('../middleware/auth');

const admissionNumber = (id) => `ADM-${String(id).padStart(5, '0')}`;
const paymentNumber = (id) => `PAY-${String(id).padStart(5, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };

// Admin-only, one-click sample data so every module has something to look at.
// Safe to call more than once — it just adds more rows each time.
router.post('/seed-demo-data', requirePermission('settings', 'edit'), (req, res) => {
  const counts = {};

  // ---- Courses ----
  const courseDefs = [
    ['Full Stack Web Development', 'FSD', 'Development', '6 Months', 60000, 3],
    ['Digital Marketing Mastery', 'DGM', 'Marketing', '3 Months', 30000, 2],
    ['Data Analytics with Python', 'DAP', 'Data', '4 Months', 45000, 2],
    ['UI/UX Design Fundamentals', 'UXD', 'Design', '2 Months', 22000, 1],
    ['Spoken English & Communication', 'SEC', '1 Month', '1 Month', 8000, 1],
  ];
  const courseIds = [];
  for (const [name, code, category, tenure, fees, emi] of courseDefs) {
    const exists = db.prepare('SELECT id FROM courses WHERE course_code=?').get(code);
    if (exists) { courseIds.push(exists.id); continue; }
    const info = db.prepare(`INSERT INTO courses (course_name, course_code, category, course_tenure, total_course_fees, emi_count, status) VALUES (?,?,?,?,?,?, 'Active')`)
      .run(name, code, category, tenure, fees, emi);
    courseIds.push(info.lastInsertRowid);
  }
  counts.courses = courseIds.length;

  // ---- Companies ----
  const companyDefs = [
    ['Nexora Technologies', 'IT Services', 'Radhika Menon', '9812300001'],
    ['BrightPath Digital', 'Marketing', 'Arjun Sethi', '9812300002'],
