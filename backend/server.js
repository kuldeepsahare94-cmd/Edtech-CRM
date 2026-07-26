const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { requireAuth } = require('./middleware/auth');

const app = express();
// In production, set FRONTEND_URL to your Vercel URL (e.g. https://your-crm.vercel.app)
// so only your deployed frontend can call this API. Left open (*) if unset, for local dev.
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Public routes
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Everything below requires a valid, active login
app.use('/api/leads', requireAuth, require('./routes/leads'));
app.use('/api/students', requireAuth, require('./routes/students'));
app.use('/api/courses', requireAuth, require('./routes/courses'));
app.use('/api/admissions', requireAuth, require('./routes/admissions'));
app.use('/api/payments', requireAuth, require('./routes/payments'));
app.use('/api/companies', requireAuth, require('./routes/companies'));
app.use('/api/placements', requireAuth, require('./routes/placements'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/reports', requireAuth, require('./routes/reports'));
app.use('/api/notifications', requireAuth, require('./routes/notifications'));
app.use('/api/roles', requireAuth, require('./routes/roles'));
app.use('/api/users', requireAuth, require('./routes/users'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/assistant', requireAuth, require('./routes/assistant'));
app.use('/api/dev', requireAuth, require('./routes/dev'));
app.use('/api/whatsapp', requireAuth, require('./routes/whatsapp'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Placement CRM API running on port ${PORT}`));
