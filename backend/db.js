const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'crm.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- ===== Roles & Permissions =====
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,      -- Super Admin / Admin / Counselor / Accountant / Placement Officer / Trainer
  is_system INTEGER DEFAULT 0,    -- 1 = built-in role, cannot be deleted
  created_at TEXT DEFAULT (datetime('now'))
);

-- Per-role, per-module permission matrix
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  module TEXT NOT NULL,           -- leads / students / courses / admissions / payments / companies / placements / reports / users / settings
  can_view INTEGER DEFAULT 0,
  can_create INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 0,
  can_delete INTEGER DEFAULT 0,
  can_export INTEGER DEFAULT 0,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(role_id, module)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- ===== Master option lists (Lead Source, Payment Mode, etc.) =====
CREATE TABLE IF NOT EXISTS master_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_type TEXT NOT NULL,    -- lead_source | qualification | payment_mode
  label TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_master_options_type ON master_options(list_type);

-- ===== 1. Leads =====
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_name TEXT NOT NULL,
  mobile TEXT,
  alternate_mobile TEXT,
  email TEXT,
  gender TEXT,
  date_of_birth TEXT,
  address TEXT,
  city TEXT,
  qualification TEXT,
  source TEXT,
  interested_course_id INTEGER,
  status TEXT DEFAULT 'New',       -- New / Contacted / Interested / Follow-up / Converted / Dropped / Not Interested
  follow_up_date TEXT,
  assigned_counselor TEXT,
  remarks TEXT,
  converted_student_id INTEGER,    -- set once converted, lead history preserved
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (interested_course_id) REFERENCES courses(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(follow_up_date);

CREATE TABLE IF NOT EXISTS lead_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  type TEXT,                       -- call / whatsapp / email / note / status_change
  note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- ===== 2. Students (master) =====
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER UNIQUE,
  photo TEXT,
  student_name TEXT NOT NULL,
  mobile TEXT,
  alternate_mobile TEXT,
  email TEXT,
  gender TEXT,
  date_of_birth TEXT,
  address TEXT,
  qualification TEXT,
  aadhaar_number TEXT,
  parent_name TEXT,
  parent_mobile TEXT,
  emergency_contact TEXT,
  status TEXT DEFAULT 'Active',    -- Active / Inactive
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

-- ===== 3. Courses (master) =====
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_name TEXT NOT NULL,
  course_code TEXT UNIQUE,
  category TEXT,
  description TEXT,
  course_tenure TEXT,              -- '1 Month' | '2 Months' | ... (dropdown)
  total_course_fees REAL DEFAULT 0,
  emi_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'Active',    -- Active / Inactive
  created_at TEXT DEFAULT (datetime('now'))
);

-- ===== 4. Admissions =====
CREATE TABLE IF NOT EXISTS admissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_number TEXT UNIQUE,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  admission_date TEXT DEFAULT (datetime('now')),
  period TEXT,
  admission_status TEXT DEFAULT 'Active',   -- Active / Hold / Completed / Cancelled / Dropped
  admission_stage TEXT DEFAULT 'New',       -- New / Documents Pending / Fees Pending / Admitted / Ongoing / Completed
  batch TEXT,
  counselor TEXT,
  course_tenure TEXT,               -- auto-copied from course at admission time
  total_course_fees REAL DEFAULT 0, -- auto-copied
  emi_count INTEGER DEFAULT 1,      -- auto-copied
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_admissions_student ON admissions(student_id);
CREATE INDEX IF NOT EXISTS idx_admissions_course ON admissions(course_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(admission_status);

-- ===== 5. Payments =====
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_number TEXT UNIQUE,
  payment_date TEXT,
  student_id INTEGER NOT NULL,
  admission_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  installment_number INTEGER DEFAULT 1,
  amount REAL DEFAULT 0,
  payment_mode TEXT,
  transaction_number TEXT,
  status TEXT DEFAULT 'Pending',   -- Pending / Paid / Partial / Failed
  receipt_institute TEXT,          -- 'A' | 'B' — which template was used for the receipt, once generated
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_payments_admission ON payments(admission_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Configurable receipt templates (admin panel editable) — placeholders until Kuldeep supplies real details
CREATE TABLE IF NOT EXISTS receipt_templates (
  id TEXT PRIMARY KEY,             -- 'A' | 'B'
  institute_name TEXT,
  logo_url TEXT,
  address TEXT,
  footer_text TEXT,
  gst_details TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ===== 6. Companies =====
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  industry TEXT,
  hr_name TEXT,
  hr_mobile TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  contact_person TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ===== 7. Placements =====
CREATE TABLE IF NOT EXISTS placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  admission_id INTEGER,
  course_id INTEGER,
  company_id INTEGER NOT NULL,
  interview_date TEXT,
  interview_round TEXT,
  interview_status TEXT DEFAULT 'Scheduled',  -- Scheduled / Rescheduled / Attended / Cancelled
  result TEXT,                                 -- Selected / Rejected / Waiting / Hold
  package TEXT,
  joining_date TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_placements_student ON placements(student_id);
CREATE INDEX IF NOT EXISTS idx_placements_company ON placements(company_id);
CREATE INDEX IF NOT EXISTS idx_placements_status ON placements(interview_status);

-- Notifications: read-tracking only, items are computed live (same pattern as base project)
CREATE TABLE IF NOT EXISTS notification_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_key TEXT NOT NULL UNIQUE,
  read_at TEXT DEFAULT (datetime('now'))
);

-- ===== AI Chatbot: every request and every tool the assistant ran, per user =====
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  history_json TEXT DEFAULT '[]',   -- full Claude-format message history (source of truth for the model)
  pending_json TEXT,                -- a write tool call awaiting user confirmation, or NULL
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,          -- user | assistant
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

-- One row per tool the assistant actually ran (read or write), for the security audit trail.
CREATE TABLE IF NOT EXISTS ai_action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  conversation_id INTEGER,
  tool_name TEXT NOT NULL,
  module TEXT,
  is_write INTEGER DEFAULT 0,
  input_json TEXT,
  result_summary TEXT,
  status TEXT DEFAULT 'success',  -- success | denied | error
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_user ON ai_action_log(user_id);
`);

// ===== Seed default roles & permission matrix =====
const roleCount = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
if (roleCount === 0) {
  const modules = ['leads', 'students', 'courses', 'admissions', 'payments', 'companies', 'placements', 'reports', 'users', 'settings', 'assistant'];
  const insertRole = db.prepare('INSERT INTO roles (name, is_system) VALUES (?,1)');
  const insertPerm = db.prepare(`INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)`);

  // full = everything on; scoped = per-role default matrix per the spec
  const fullAccess = () => modules.reduce((acc, m) => ({ ...acc, [m]: [1, 1, 1, 1, 1] }), {});
  const roleDefaults = {
    'Super Admin': fullAccess(),
    'Admin': fullAccess(),
    'Counselor': {
      leads: [1, 1, 1, 0, 1], students: [1, 1, 1, 0, 0], courses: [1, 0, 0, 0, 0],
      admissions: [1, 1, 1, 0, 0], payments: [1, 0, 0, 0, 0], companies: [0, 0, 0, 0, 0],
      placements: [0, 0, 0, 0, 0], reports: [1, 0, 0, 0, 1], users: [0, 0, 0, 0, 0], settings: [0, 0, 0, 0, 0],
      assistant: [1, 1, 0, 0, 0],
    },
    'Accountant': {
      leads: [0, 0, 0, 0, 0], students: [1, 0, 0, 0, 0], courses: [1, 0, 0, 0, 0],
      admissions: [1, 0, 0, 0, 0], payments: [1, 1, 1, 0, 1], companies: [0, 0, 0, 0, 0],
      placements: [0, 0, 0, 0, 0], reports: [1, 0, 0, 0, 1], users: [0, 0, 0, 0, 0], settings: [0, 0, 0, 0, 0],
      assistant: [1, 1, 0, 0, 0],
    },
    'Placement Officer': {
      leads: [0, 0, 0, 0, 0], students: [1, 0, 0, 0, 0], courses: [1, 0, 0, 0, 0],
      admissions: [1, 0, 0, 0, 0], payments: [0, 0, 0, 0, 0], companies: [1, 1, 1, 0, 1],
      placements: [1, 1, 1, 0, 1], reports: [1, 0, 0, 0, 1], users: [0, 0, 0, 0, 0], settings: [0, 0, 0, 0, 0],
      assistant: [1, 1, 0, 0, 0],
    },
    'Trainer': {
      leads: [0, 0, 0, 0, 0], students: [1, 0, 0, 0, 0], courses: [1, 0, 0, 0, 0],
      admissions: [1, 0, 0, 0, 0], payments: [0, 0, 0, 0, 0], companies: [0, 0, 0, 0, 0],
      placements: [1, 0, 0, 0, 0], reports: [0, 0, 0, 0, 0], users: [0, 0, 0, 0, 0], settings: [0, 0, 0, 0, 0],
      assistant: [1, 0, 0, 0, 0],
    },
  };

  const tx = db.transaction(() => {
    for (const [roleName, matrix] of Object.entries(roleDefaults)) {
      const info = insertRole.run(roleName);
      const roleId = info.lastInsertRowid;
      for (const mod of modules) {
        const [v, c, e, d, x] = matrix[mod] || [0, 0, 0, 0, 0];
        insertPerm.run(roleId, mod, v, c, e, d, x);
      }
    }
  });
  tx();
}

// Seed default admin user
const bcrypt = require('bcryptjs');
const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
if (userCount === 0) {
  const superAdminRole = db.prepare("SELECT id FROM roles WHERE name = 'Super Admin'").get();
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, full_name, role_id, active) VALUES (?,?,?,?,1)')
    .run('admin', hash, 'Administrator', superAdminRole ? superAdminRole.id : null);
  console.log('Seeded default login -> username: admin / password: admin123 (change this immediately)');
}

// Seed master option lists
const seedOptions = {
  lead_source: ['Walk-in', 'Referral', 'Facebook', 'Instagram', 'Google', 'Website', 'Other'],
  qualification: ['10th', '12th', 'Diploma', 'Graduate', 'Post Graduate', 'Other'],
  payment_mode: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'],
};
const insertOption = db.prepare('INSERT INTO master_options (list_type, label, sort_order) VALUES (?,?,?)');
for (const [listType, labels] of Object.entries(seedOptions)) {
  const count = db.prepare('SELECT COUNT(*) c FROM master_options WHERE list_type=?').get(listType).c;
  if (count === 0) labels.forEach((label, i) => insertOption.run(listType, label, i));
}

// Seed placeholder receipt templates (Institute A / B) — Kuldeep will fill in real details later
const receiptCount = db.prepare('SELECT COUNT(*) c FROM receipt_templates').get().c;
if (receiptCount === 0) {
  const insertReceipt = db.prepare(`INSERT INTO receipt_templates (id, institute_name, logo_url, address, footer_text, gst_details) VALUES (?,?,?,?,?,?)`);
  insertReceipt.run('A', '[Institute A Name — configure in Settings]', '', '[Institute A Address]', '[Institute A Footer / Terms]', '[Institute A GSTIN]');
  insertReceipt.run('B', '[Institute B Name — configure in Settings]', '', '[Institute B Address]', '[Institute B Footer / Terms]', '[Institute B GSTIN]');
}

module.exports = db;
