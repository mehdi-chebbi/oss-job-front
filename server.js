
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Microsoft Graph API dependencies
const { ConfidentialClientApplication } = require('@azure/msal-node');
const axios = require('axios');

const app = express();

const allowedOrigins = [
  'http://10.1.10.182',
  'http://192.168.2.136',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('Blocked CORS request from:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

// Microsoft Graph API Configuration
const OUTLOOK_CONFIG = {
    clientId: process.env.OUTLOOK_CLIENT_ID || '',
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
    tenantId: process.env.OUTLOOK_TENANT_ID || '',
    userEmail: process.env.OUTLOOK_USER_EMAIL || ''
};

// MSAL Configuration
const clientConfig = {
    auth: {
        clientId: OUTLOOK_CONFIG.clientId,
        clientSecret: OUTLOOK_CONFIG.clientSecret,
        authority: `https://login.microsoftonline.com/${OUTLOOK_CONFIG.tenantId}`
    }
};

const cca = new ConfidentialClientApplication(clientConfig);

// Function to get access token for Microsoft Graph
async function getAccessToken() {
    const clientCredentialRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    try {
        const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
        return response.accessToken;
    } catch (error) {
        console.error('Error getting Microsoft Graph access token:', error.message);
        throw error;
    }
}

// Enhanced email sending function using Microsoft Graph API
async function sendEmailWithGraphAPI(to, subject, htmlContent, textContent = null) {
    try {
        const accessToken = await getAccessToken();

        const emailData = {
            message: {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: htmlContent
                },
                from: {
                    emailAddress: {
                        address: OUTLOOK_CONFIG.userEmail,
                        name: "HR Job Portal"
                    }
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: to
                        }
                    }
                ]
            }
        };

        const response = await axios.post(
            `https://graph.microsoft.com/v1.0/users/${OUTLOOK_CONFIG.userEmail}/sendMail`,
            emailData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`Email sent successfully to ${to}`);
        return response.data;

    } catch (error) {
        console.error('Error sending email via Graph API:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Create email templates (unchanged)
function createHRNotificationEmail(hrName, offerTitle, applicantName, applicantEmail) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #343a40; margin: 0;">New Application Received</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Hello <strong>${hrName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    You have received a new application for your job offer:
                </p>

                <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Offer:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Applicant:</strong> ${applicantName}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${applicantEmail}</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    Please log into the HR portal to review the application and download the submitted documents.
                </p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        This is an automated notification from the HR Job Portal
                    </p>
                </div>
            </div>
        </div>
    `;
}

function createApplicantConfirmationEmail(applicantName, offerTitle) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #155724; margin: 0;">Application Submitted Successfully</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Dear <strong>${applicantName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    Thank you for your application! We have successfully received your submission for:
                </p>

                <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Position:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    Our HR team will review your application and contact you if your profile matches our requirements.
                    This process may take some time, so please be patient.
                </p>

                <p style="color: #495057; font-size: 14px;">
                    <strong>Next Steps:</strong>
                </p>
                <ul style="color: #495057; font-size: 14px;">
                    <li>Your application is now under review</li>
                    <li>We will contact you if you are selected for the next stage</li>
                    <li>Please keep your contact information up to date</li>
                </ul>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        Best regards,<br>
                        HR Team<br>
                        Job Portal System
                    </p>
                </div>
            </div>
        </div>
    `;
}

function createExpirationNotificationEmail(recipientName, offerTitle, deadline) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #721c24; margin: 0;">Offer Expired</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Hello <strong>${recipientName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    Your job offer has reached its deadline and has now expired:
                </p>

                <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                    <p style="margin: 5px 0;"><strong>Offer:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Deadline:</strong> ${deadline}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Expired</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    <strong>Recommended Actions:</strong>
                </p>
                <ul style="color: #495057; font-size: 14px;">
                    <li>Review and process any pending applications</li>
                    <li>Close the position if filled</li>
                    <li>Extend the deadline if you need more time</li>
                    <li>Create a new offer if needed</li>
                </ul>

                <p style="color: #495057; font-size: 14px;">
                    Please log into the HR portal to take the necessary actions.
                </p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        This is an automated notification from the HR Job Portal
                    </p>
                </div>
            </div>
        </div>
    `;
}

function createUpcomingExpirationNotificationEmail(recipientName, offerTitle, deadline, daysUntilExpiration) {
    const urgencyColor = daysUntilExpiration === 1 ? '#f8d7da' : '#fff3cd';
    const urgencyTextColor = daysUntilExpiration === 1 ? '#721c24' : '#856404';
    const urgencyBorder = daysUntilExpiration === 1 ? '#dc3545' : '#ffc107';
    const urgencyTitle = daysUntilExpiration === 1 ? 'Offer Expiring Tomorrow' : 'Offer Expiring in 2 Days';

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: ${urgencyColor}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: ${urgencyTextColor}; margin: 0;">${urgencyTitle}</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Hello <strong>${recipientName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    Your job offer is approaching its deadline:
                </p>

                <div style="background-color: ${urgencyColor}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${urgencyBorder};">
                    <p style="margin: 5px 0;"><strong>Offer:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Deadline:</strong> ${deadline}</p>
                    <p style="margin: 5px 0;"><strong>Time Remaining:</strong> ${daysUntilExpiration} day${daysUntilExpiration > 1 ? 's' : ''}</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    <strong>Recommended Actions:</strong>
                </p>
                <ul style="color: #495057; font-size: 14px;">
                    <li>Review current applications</li>
                    <li>Extend the deadline if you need more candidates</li>
                    <li>Prepare for application processing when the offer expires</li>
                    <li>Note that you'll have ${daysUntilExpiration === 1 ? '1 day' : '2 days'} after expiration to archive applications</li>
                </ul>

                <p style="color: #495057; font-size: 14px;">
                    Please log into the HR portal to manage your offer and applications.
                </p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        This is an automated notification from the HR Job Portal
                    </p>
                </div>
            </div>
        </div>
    `;
}

// Create base directories if they don't exist
const baseFilesDir = path.join(__dirname, 'files');
const tdrDir = path.join(baseFilesDir, 'tdr');
const applicantsDir = path.join(baseFilesDir, 'applicants');
[baseFilesDir, tdrDir, applicantsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Function to sanitize filenames
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Multer setup for TDR files
const tdrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tdrDir);
  },
  filename: (req, file, cb) => {
    const title = req.body.title || 'unknown';
    const sanitizedTitle = sanitizeFilename(title);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${sanitizedTitle}-tdr-${uniqueSuffix}.pdf`);
  }
});

// Multer setup for applicant files
const applicantStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fullName = req.body.full_name || 'unknown';
    const sanitizedName = sanitizeFilename(fullName);
    const applicantDir = path.join(applicantsDir, sanitizedName);

    // Create applicant directory if it doesn't exist
    if (!fs.existsSync(applicantDir)) {
      fs.mkdirSync(applicantDir, { recursive: true });
    }

    cb(null, applicantDir);
  },
  filename: (req, file, cb) => {
    const documentType = file.fieldname;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${documentType}-${uniqueSuffix}.pdf`);
  }
});

const uploadTdr = multer({ storage: tdrStorage });
const uploadApplicant = multer({ storage: applicantStorage });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rh_app', // optional fallback
  port: Number(process.env.DB_PORT) || 3306,
};

const JWT_SECRET = 'your_jwt_secret'; // Use env var in production
let pool;

// ───── Initialize DB ─────
(async () => {
  try {
    console.log('Attempting to connect to MySQL...');
    const connection = await mysql.createConnection(DB_CONFIG);
    console.log('Connected to MySQL successfully');

    console.log('Creating database if not exists...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS rh_app`);
    console.log('Database creation query executed');

    await connection.end();
    console.log('Disconnected from initial connection');

    console.log('Creating connection pool with rh_app database...');
    pool = mysql.createPool({ ...DB_CONFIG, database: 'rh_app' });
    console.log('Connection pool created');

    console.log('Creating tables...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'comite_ajout', 'comite_ouverture') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY (name, created_by)
      )
    `);
    console.log('Departments table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        department_id INT NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY (name, department_id, created_by)
      )
    `);
    console.log('Projects table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('candidature', 'manifestation', 'appel_d_offre_service', 'appel_d_offre_equipement', 'consultation') NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        country VARCHAR(100) NOT NULL,
        project_id INT NOT NULL,
        reference VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        deadline DATE NOT NULL,
        two_day_notified BOOLEAN DEFAULT FALSE,
        one_day_notified BOOLEAN DEFAULT FALSE,
        deadline_notified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tdr_filename VARCHAR(255) NULL,
        tdr_filepath VARCHAR(255) NULL,
        notification_emails TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    console.log('Offers table created');

    // FIXED: Check if columns exist before adding them
    try {
      console.log('Checking if notification columns exist in offers table...');
      const [columns] = await pool.query(`SHOW COLUMNS FROM offers LIKE 'two_day_notified'`);

      if (columns.length === 0) {
        console.log('Adding two_day_notified column...');
        await pool.query(`ALTER TABLE offers ADD COLUMN two_day_notified BOOLEAN DEFAULT FALSE AFTER deadline`);
        console.log('two_day_notified column added');
      }

      const [columns2] = await pool.query(`SHOW COLUMNS FROM offers LIKE 'one_day_notified'`);

      if (columns2.length === 0) {
        console.log('Adding one_day_notified column...');
        await pool.query(`ALTER TABLE offers ADD COLUMN one_day_notified BOOLEAN DEFAULT FALSE AFTER two_day_notified`);
        console.log('one_day_notified column added');
      }
    } catch (err) {
      console.error('Error adding notification columns:', err.message);
    }

    // FIXED: Use separate UPDATE statement for changing enum values
    try {
      console.log('Updating appel_d_offre to appel_d_offre_service...');
      await pool.query(`
        UPDATE offers SET type = 'appel_d_offre_service' WHERE type = 'appel_d_offre'
      `);
      console.log('Enum values updated');
    } catch (err) {
      console.error('Error updating enum values:', err.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        offer_id INT NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        tel_number VARCHAR(50) NOT NULL,
        applicant_country VARCHAR(100) NOT NULL,
        cv_filename VARCHAR(255) NOT NULL,
        cv_filepath VARCHAR(255) NOT NULL,
        diplome_filename VARCHAR(255) NOT NULL,
        diplome_filepath VARCHAR(255) NOT NULL,
        id_card_filename VARCHAR(255) NOT NULL,
        id_card_filepath VARCHAR(255) NOT NULL,
        cover_letter_filename VARCHAR(255) NOT NULL,
        cover_letter_filepath VARCHAR(255) NOT NULL,
        declaration_sur_honneur_filename VARCHAR(255) NULL,
        declaration_sur_honneur_filepath VARCHAR(255) NULL,
        fiche_de_referencement_filename VARCHAR(255) NULL,
        fiche_de_referencement_filepath VARCHAR(255) NULL,
        extrait_registre_filename VARCHAR(255) NULL,
        extrait_registre_filepath VARCHAR(255) NULL,
        note_methodologique_filename VARCHAR(255) NULL,
        note_methodologique_filepath VARCHAR(255) NULL,
        liste_references_filename VARCHAR(255) NULL,
        liste_references_filepath VARCHAR(255) NULL,
        offre_financiere_filename VARCHAR(255) NULL,
        offre_financiere_filepath VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        archived_at TIMESTAMP NULL,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
        UNIQUE KEY (offer_id, email)
      )
    `);
    console.log('Applications table created');

    // FIXED: Check if archived_at column exists before adding it
    try {
      console.log('Checking if archived_at column exists in applications table...');
      const [columns] = await pool.query(`SHOW COLUMNS FROM applications LIKE 'archived_at'`);

      if (columns.length === 0) {
        console.log('Adding archived_at column...');
        await pool.query(`ALTER TABLE applications ADD COLUMN archived_at TIMESTAMP NULL`);
        console.log('archived_at column added');
      }
    } catch (err) {
      console.error('Error adding archived_at column:', err.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Logs table created');

    console.log('Database and tables initialized successfully.');

    // Schedule daily check for expired offers at midnight
    cron.schedule('0 0 * * *', checkExpiredOffers);
    console.log('Scheduled cron job for checking expired offers');
  } catch (err) {
    console.error('DB Init Error:', err);
  }
})();

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (Array.isArray(role)) {
      if (!role.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    } else {
      if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function logAction(message) {
  pool.query('INSERT INTO logs (message) VALUES (?)', [message]);
}

function logOfferAction(user, action, offerTitle) {
  const message = `${user.name} (${user.email}) ${action} offer "${offerTitle}"`;
  logAction(message);
}

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// ───── Auth ─────
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── Users (Admin only) ─────
app.post('/users', auth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['admin', 'comite_ajout', 'comite_ouverture'].includes(role)) {
    return res.status(400).json({ error: 'Invalid user data' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashed, role]);
    logAction(`${req.user.name} (${req.user.email}) created user ${name} (${role})`);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'User creation failed' });
  }
});

app.get('/users', auth, requireRole('admin'), async (req, res) => {
  const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users');
  res.json(users);
});

app.put('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, email, role } = req.body;
  const { id } = req.params;
  if (!name || !email || !['admin', 'comite_ajout', 'comite_ouverture'].includes(role)) {
    return res.status(400).json({ error: 'Invalid user data' });
  }
  try {
    await pool.query('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, id]);
    logAction(`${req.user.name} (${req.user.email}) updated user ${id}`);
    res.json({ message: 'User updated' });
  } catch {
    res.status(500).json({ error: 'User update failed' });
  }
});

app.delete('/users/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    logAction(`${req.user.name} (${req.user.email}) deleted user ${req.params.id}`);
    res.json({ message: 'User deleted' });
  } catch {
    res.status(500).json({ error: 'User delete failed' });
  }
});

app.get('/logs', auth, requireRole('admin'), async (req, res) => {
  const [logs] = await pool.query('SELECT * FROM logs ORDER BY created_at DESC');
  res.json(logs);
});

// ───── Departments (RH only) ─────
app.get('/departments', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    const [departments] = await pool.query(`
      SELECT d.*, u.name as created_by_name
      FROM departments d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.created_by = ?
      ORDER BY d.name ASC
    `, [req.user.id]);
    res.json(departments);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

app.post('/departments', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO departments (name, description, created_by) VALUES (?, ?, ?)',
      [name, '', req.user.id]
    );
    logAction(`${req.user.name} (${req.user.email}) created department "${name}"`);
    res.json({ id: result.insertId, name });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Department with this name already exists' });
    }
    console.error('Error creating department:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

app.put('/departments/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;

  if (!name) return res.status(400).json({ error: 'Department name is required' });

  try {
    // Verify department belongs to user
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    await pool.query('UPDATE departments SET name = ? WHERE id = ?', [name, id]);
    logAction(`${req.user.name} (${req.user.email}) updated department "${name}"`);
    res.json({ message: 'Department updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Department with this name already exists' });
    }
    console.error('Error updating department:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

app.delete('/departments/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    // Verify department belongs to user and has no projects
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [req.params.id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    const [projectCheck] = await pool.query('SELECT COUNT(*) as count FROM projects WHERE department_id = ?', [req.params.id]);
    if (projectCheck[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete department with existing projects' });
    }

    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    logAction(`${req.user.name} (${req.user.email}) deleted department id ${req.params.id}`);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ───── Projects (RH only) ─────
app.get('/projects', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    const [projects] = await pool.query(`
      SELECT p.*, d.name as department_name, u.name as created_by_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.created_by = ?
      ORDER BY d.name ASC, p.name ASC
    `, [req.user.id]);
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.get('/projects/department/:departmentId', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    const { departmentId } = req.params;

    // Verify department belongs to user
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [departmentId]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    const [projects] = await pool.query(`
      SELECT p.*, d.name as department_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.department_id = ? AND p.created_by = ?
      ORDER BY p.name ASC
    `, [departmentId, req.user.id]);
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects for department:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/projects', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name, department_id } = req.body;
  if (!name || !department_id) return res.status(400).json({ error: 'Project name and department are required' });

  try {
    // Verify department belongs to user
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [department_id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (name, description, department_id, created_by) VALUES (?, ?, ?, ?)',
      [name, '', department_id, req.user.id]
    );
    logAction(`${req.user.name} (${req.user.email}) created project "${name}"`);
    res.json({ id: result.insertId, name, department_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Project with this name already exists in this department' });
    }
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/projects/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name, department_id } = req.body;
  const { id } = req.params;

  if (!name || !department_id) return res.status(400).json({ error: 'Project name and department are required' });

  try {
    // Verify project belongs to user and department belongs to user
    const [projectCheck] = await pool.query(`
      SELECT p.created_by, d.created_by as dept_created_by
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ?
    `, [id]);

    if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [department_id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    await pool.query('UPDATE projects SET name = ?, department_id = ? WHERE id = ?',
      [name, department_id, id]);
    logAction(`${req.user.name} (${req.user.email}) updated project "${name}"`);
    res.json({ message: 'Project updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Project with this name already exists in this department' });
    }
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/projects/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    // Verify project belongs to user and has no offers
    const [projectCheck] = await pool.query('SELECT created_by FROM projects WHERE id = ?', [req.params.id]);
    if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const [offerCheck] = await pool.query('SELECT COUNT(*) as count FROM offers WHERE project_id = ?', [req.params.id]);
    if (offerCheck[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete project with existing offers' });
    }

    await pool.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    logAction(`${req.user.name} (${req.user.email}) deleted project id ${req.params.id}`);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ───── Offers ─────
// Get all offers with tdr url if exists
app.get('/offers', async (req, res) => {
  try {
    const [offers] = await pool.query(`
      SELECT o.id, o.type, o.title, o.description, o.country,
             p.name as project_name, d.name as department_name,
             o.reference, o.deadline, o.created_at, o.tdr_filename, o.tdr_filepath
      FROM offers o
      LEFT JOIN projects p ON o.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      ORDER BY o.created_at DESC
    `);
    const offersWithUrl = offers.map(offer => ({
      ...offer,
      tdr_url: offer.tdr_filename ? `/offers/${offer.id}/tdr` : null
    }));
    res.json(offersWithUrl);
  } catch (err) {
    console.error('Error fetching offers:', err);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Get a single offer by ID
app.get('/offers/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.id, o.type, o.title, o.description, o.country,
             p.name as project_name, d.name as department_name,
             o.reference, o.deadline, o.created_at, o.tdr_filename, o.tdr_filepath,
             o.notification_emails, o.project_id
      FROM offers o
      LEFT JOIN projects p ON o.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = rows[0];
    const offerWithUrl = {
      ...offer,
      tdr_url: offer.tdr_filename ? `/offers/${offer.id}/tdr` : null
    };

    res.json(offerWithUrl);
  } catch (err) {
    console.error('Error fetching offer:', err);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

app.post('/offers', auth, requireRole('comite_ajout'), uploadTdr.single('tdr'), async (req, res) => {
  try {
    const { type, title, description, country, project_id, reference, deadline, notification_emails } = req.body;
    const tdrFile = req.file;

    if (!type || !title || !country || !project_id || !reference || !deadline) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    if (tdrFile && tdrFile.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'TDR must be a PDF file' });
    }

    // Verify project belongs to user
    const [projectCheck] = await pool.query('SELECT created_by FROM projects WHERE id = ?', [project_id]);
    if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const tdrFilename = tdrFile ? tdrFile.filename : null;
    const tdrFilepath = tdrFile ? tdrFile.path : null;

    // Parse notification emails
    let emails = [];
    if (notification_emails) {
      try {
        emails = JSON.parse(notification_emails);
        // Validate emails (simple validation)
        emails = emails.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        // Limit to 10 emails
        emails = emails.slice(0, 10);
      } catch (e) {
        console.error('Error parsing notification emails:', e);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO offers (type, title, description, country, project_id, reference, deadline, created_by, tdr_filename, tdr_filepath, notification_emails)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, title, description, country, project_id, reference, deadline, req.user.id, tdrFilename, tdrFilepath, JSON.stringify(emails)]
    );

    // Get the complete offer data to return to frontend
    const [newOffer] = await pool.query(
      `SELECT o.*, p.name as project_name, d.name as department_name, u.name as created_by_name, u.email as created_by_email
       FROM offers o
       LEFT JOIN projects p ON o.project_id = p.id
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.id = ?`,
      [result.insertId]
    );

    logOfferAction(req.user, 'created', title);
    res.json(newOffer[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/offers/:id', auth, requireRole('comite_ajout'), uploadTdr.single('tdr'), async (req, res) => {
  try {
    const { type, title, description, country, project_id, reference, deadline, notification_emails } = req.body;
    const tdrFile = req.file;
    const { id } = req.params;

    if (tdrFile && tdrFile.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'TDR must be a PDF file' });
    }

    // Verify project belongs to user
    if (project_id) {
      const [projectCheck] = await pool.query('SELECT created_by FROM projects WHERE id = ?', [project_id]);
      if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
        return res.status(403).json({ error: 'Project not found or access denied' });
      }
    }

    // Get existing TDR info to delete old file if replacing
    const [existingOffer] = await pool.query('SELECT tdr_filename, tdr_filepath FROM offers WHERE id = ?', [id]);
    const oldTdrInfo = existingOffer[0];

    let tdrFilename = oldTdrInfo?.tdr_filename || null;
    let tdrFilepath = oldTdrInfo?.tdr_filepath || null;

    if (tdrFile) {
      tdrFilename = tdrFile.filename;
      tdrFilepath = tdrFile.path;

      // Delete old TDR file if exists
      if (oldTdrInfo?.tdr_filepath && fs.existsSync(oldTdrInfo.tdr_filepath)) {
        fs.unlinkSync(oldTdrInfo.tdr_filepath);
      }
    }

    // Parse notification emails
    let emails = [];
    if (notification_emails) {
      try {
        emails = JSON.parse(notification_emails);
        // Validate emails (simple validation)
        emails = emails.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        // Limit to 10 emails
        emails = emails.slice(0, 10);
      } catch (e) {
        console.error('Error parsing notification emails:', e);
      }
    }

    await pool.query(
      `UPDATE offers SET type = ?, title = ?, description = ?, country = ?, project_id = ?, reference = ?, deadline = ?, tdr_filename = ?, tdr_filepath = ?, notification_emails = ? WHERE id = ?`,
      [type, title, description, country, project_id, reference, deadline, tdrFilename, tdrFilepath, JSON.stringify(emails), id]
    );

    // Get the updated offer data to return to frontend
    const [updatedOffer] = await pool.query(
      `SELECT o.*, p.name as project_name, d.name as department_name, u.name as created_by_name, u.email as created_by_email
       FROM offers o
       LEFT JOIN projects p ON o.project_id = p.id
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.id = ?`,
      [id]
    );

    logOfferAction(req.user, 'updated', title);
    res.json(updatedOffer[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/offers/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    // Get TDR info to delete file
    const [offer] = await pool.query('SELECT tdr_filename, tdr_filepath FROM offers WHERE id = ?', [req.params.id]);
    const tdrInfo = offer[0];

    await pool.query('DELETE FROM offers WHERE id = ?', [req.params.id]);

    // Delete TDR file if exists
    if (tdrInfo?.tdr_filepath && fs.existsSync(tdrInfo.tdr_filepath)) {
      fs.unlinkSync(tdrInfo.tdr_filepath);
    }

    logOfferAction(req.user, 'deleted', `offer id ${req.params.id}`);
    res.json({ message: 'Offer deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/offers/:id/tdr', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT tdr_filename, tdr_filepath FROM offers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'TDR not found' });
    const { tdr_filename, tdr_filepath } = rows[0];
    if (!tdr_filename || !tdr_filepath) return res.status(404).json({ error: 'TDR not found' });

    if (!fs.existsSync(tdr_filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${tdr_filename}"`);
    res.sendFile(tdr_filepath);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── Applications ─────
app.post('/apply', uploadApplicant.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'diplome', maxCount: 1 },
  { name: 'id_card', maxCount: 1 },
  { name: 'cover_letter', maxCount: 1 },
  { name: 'declaration_sur_honneur', maxCount: 1 },
  { name: 'fiche_de_referencement', maxCount: 1 },
  { name: 'extrait_registre', maxCount: 1 },
  { name: 'note_methodologique', maxCount: 1 },
  { name: 'liste_references', maxCount: 1 },
  { name: 'offre_financiere', maxCount: 1 }
]), async (req, res) => {
  try {
    const { offer_id, full_name, email, tel_number, applicant_country } = req.body;
    const files = req.files;

    // Check required fields
    if (!offer_id || !full_name || !email || !tel_number || !applicant_country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check required files
    const requiredFiles = ['cv', 'diplome', 'id_card', 'cover_letter'];
    for (const file of requiredFiles) {
      if (!files[file] || files[file].length === 0) {
        return res.status(400).json({ error: `${file} file is required` });
      }
      if (files[file][0].mimetype !== 'application/pdf') {
        return res.status(400).json({ error: `${file} must be a PDF file` });
      }
    }

    // Verify offer exists
    const [offerRows] = await pool.query('SELECT id, title, type, created_by FROM offers WHERE id = ?', [offer_id]);
    if (offerRows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    const offer = offerRows[0];

    // Check if user already applied to this offer
    const [existingApp] = await pool.query('SELECT id FROM applications WHERE offer_id = ? AND email = ?', [offer_id, email]);
    if (existingApp.length > 0) {
      return res.status(400).json({ error: 'You have already applied to this offer' });
    }

    // Check additional required files based on offer type
    const additionalRequiredFiles = [];
    if (['manifestation', 'appel_d_offre_service', 'appel_d_offre_equipement', 'consultation'].includes(offer.type)) {
      additionalRequiredFiles.push(
        'declaration_sur_honneur',
        'fiche_de_referencement',
        'extrait_registre',
        'note_methodologique',
        'liste_references',
        'offre_financiere'
      );
    }

    for (const file of additionalRequiredFiles) {
      if (!files[file] || files[file].length === 0) {
        return res.status(400).json({ error: `${file} file is required for this offer type` });
      }
      if (files[file][0].mimetype !== 'application/pdf') {
        return res.status(400).json({ error: `${file} must be a PDF file` });
      }
    }

    // Prepare application data with filenames and filepaths
    const applicationData = {
      offer_id,
      full_name,
      email,
      tel_number,
      applicant_country,
      cv_filename: files.cv[0].filename,
      cv_filepath: files.cv[0].path,
      diplome_filename: files.diplome[0].filename,
      diplome_filepath: files.diplome[0].path,
      id_card_filename: files.id_card[0].filename,
      id_card_filepath: files.id_card[0].path,
      cover_letter_filename: files.cover_letter[0].filename,
      cover_letter_filepath: files.cover_letter[0].path,
    };

    // Add additional files if they exist
    if (files.declaration_sur_honneur) {
      applicationData.declaration_sur_honneur_filename = files.declaration_sur_honneur[0].filename;
      applicationData.declaration_sur_honneur_filepath = files.declaration_sur_honneur[0].path;
    }
    if (files.fiche_de_referencement) {
      applicationData.fiche_de_referencement_filename = files.fiche_de_referencement[0].filename;
      applicationData.fiche_de_referencement_filepath = files.fiche_de_referencement[0].path;
    }
    if (files.extrait_registre) {
      applicationData.extrait_registre_filename = files.extrait_registre[0].filename;
      applicationData.extrait_registre_filepath = files.extrait_registre[0].path;
    }
    if (files.note_methodologique) {
      applicationData.note_methodologique_filename = files.note_methodologique[0].filename;
      applicationData.note_methodologique_filepath = files.note_methodologique[0].path;
    }
    if (files.liste_references) {
      applicationData.liste_references_filename = files.liste_references[0].filename;
      applicationData.liste_references_filepath = files.liste_references[0].path;
    }
    if (files.offre_financiere) {
      applicationData.offre_financiere_filename = files.offre_financiere[0].filename;
      applicationData.offre_financiere_filepath = files.offre_financiere[0].path;
    }

    // Insert application
    const [result] = await pool.query(`
      INSERT INTO applications
      (offer_id, full_name, email, tel_number, applicant_country, cv_filename, cv_filepath,
      diplome_filename, diplome_filepath, id_card_filename, id_card_filepath, cover_letter_filename, cover_letter_filepath,
      declaration_sur_honneur_filename, declaration_sur_honneur_filepath, fiche_de_referencement_filename, fiche_de_referencement_filepath,
      extrait_registre_filename, extrait_registre_filepath, note_methodologique_filename, note_methodologique_filepath,
      liste_references_filename, liste_references_filepath, offre_financiere_filename, offre_financiere_filepath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationData.offer_id, applicationData.full_name, applicationData.email, applicationData.tel_number,
        applicationData.applicant_country, applicationData.cv_filename, applicationData.cv_filepath,
        applicationData.diplome_filename, applicationData.diplome_filepath, applicationData.id_card_filename, applicationData.id_card_filepath,
        applicationData.cover_letter_filename, applicationData.cover_letter_filepath,
        applicationData.declaration_sur_honneur_filename, applicationData.declaration_sur_honneur_filepath,
        applicationData.fiche_de_referencement_filename, applicationData.fiche_de_referencement_filepath,
        applicationData.extrait_registre_filename, applicationData.extrait_registre_filepath,
        applicationData.note_methodologique_filename, applicationData.note_methodologique_filepath,
        applicationData.liste_references_filename, applicationData.liste_references_filepath,
        applicationData.offre_financiere_filename, applicationData.offre_financiere_filepath
      ]
    );

    // Get HR user (offer creator) info and send emails using Microsoft Graph API
    const [hrRows] = await pool.query('SELECT name, email FROM users WHERE id = ?', [offer.created_by]);
    if (hrRows.length === 0) {
      console.warn('HR user not found for offer:', offer_id);
    } else {
      const hrUser = hrRows[0];

      try {
        // Send email only to applicant
        await sendEmailWithGraphAPI(
          email,
          `Application Confirmation: ${offer.title}`,
          createApplicantConfirmationEmail(full_name, offer.title)
        );

        console.log('Application confirmation email sent successfully to applicant');
      } catch (emailError) {
        console.error('Error sending application confirmation email:', emailError.message);
        // Application was still saved successfully, just email failed
      }
    }

    res.json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── View Applications (RH only) ─────
// Get all applications with offer details and document download URLs
app.get('/applications', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    // For comite_ouverture, show all applications. For comite_ajout, show only applications from user's offers.
    const whereClause = req.user.role === 'comite_ouverture' ? '' : 'WHERE o.created_by = ?';
    const params = req.user.role === 'comite_ouverture' ? [] : [req.user.id];

    const [applications] = await pool.query(`
      SELECT
        a.id,
        a.offer_id,
        o.title AS offer_title,
        o.type AS offer_type,
        d.name AS offer_department,
        a.full_name,
        a.email,
        a.tel_number,
        a.applicant_country,
        a.created_at,
        a.cv_filename, a.cv_filepath,
        a.diplome_filename, a.diplome_filepath,
        a.id_card_filename, a.id_card_filepath,
        a.cover_letter_filename, a.cover_letter_filepath,
        a.declaration_sur_honneur_filename, a.declaration_sur_honneur_filepath,
        a.fiche_de_referencement_filename, a.fiche_de_referencement_filepath,
        a.extrait_registre_filename, a.extrait_registre_filepath,
        a.note_methodologique_filename, a.note_methodologique_filepath,
        a.liste_references_filename, a.liste_references_filepath,
        a.offre_financiere_filename, a.offre_financiere_filepath
      FROM applications a
      JOIN offers o ON a.offer_id = o.id
      LEFT JOIN departments d ON o.department_id = d.id
      ${whereClause}
      ORDER BY a.created_at DESC
    `, params);

    // Add document download URLs to each application
    const applicationsWithUrls = applications.map(app => ({
      ...app,
      cv_url: `/applications/${app.id}/cv`,
      diplome_url: `/applications/${app.id}/diplome`,
      id_card_url: `/applications/${app.id}/id_card`,
      cover_letter_url: `/applications/${app.id}/cover_letter`,
      declaration_sur_honneur_url: app.declaration_sur_honneur_filename ? `/applications/${app.id}/declaration_sur_honneur` : null,
      fiche_de_referencement_url: app.fiche_de_referencement_filename ? `/applications/${app.id}/fiche_de_referencement` : null,
      extrait_registre_url: app.extrait_registre_filename ? `/applications/${app.id}/extrait_registre` : null,
      note_methodologique_url: app.note_methodologique_filename ? `/applications/${app.id}/note_methodologique` : null,
      liste_references_url: app.liste_references_filename ? `/applications/${app.id}/liste_references` : null,
      offre_financiere_url: app.offre_financiere_filename ? `/applications/${app.id}/offre_financiere` : null
    }));

    res.json(applicationsWithUrls);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get application counts by offer (for summary view)
app.get('/applications/summary', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    // For comite_ouverture, show all offers. For comite_ajout, show only user's offers.
    const whereClause = req.user.role === 'comite_ouverture' ? '' : 'WHERE o.created_by = ?';
    const params = req.user.role === 'comite_ouverture' ? [] : [req.user.id];

    const [summary] = await pool.query(`
      SELECT
        o.id as offer_id,
        o.title as offer_title,
        o.type as offer_type,
        d.name as offer_department,
        p.name as offer_project,
        o.deadline,
        COUNT(a.id) as application_count,
        CASE
          WHEN o.deadline < CURDATE() THEN 'expired'
          ELSE 'active'
        END as offer_status,
        CASE
          WHEN o.deadline < CURDATE() THEN
            CASE
              WHEN DATEDIFF(CURDATE(), o.deadline) <= 14 THEN 'archive_window_open'
              ELSE 'archive_window_closed'
            END
          ELSE 'active'
        END as archive_window_status,
        DATEDIFF(CURDATE(), o.deadline) as days_since_expiry
      FROM offers o
      LEFT JOIN applications a ON o.id = a.offer_id
      LEFT JOIN projects p ON o.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      ${whereClause}
      GROUP BY o.id, o.title, o.type, d.name, p.name, o.deadline
      ORDER BY o.deadline ASC
    `, params);

    res.json(summary);
  } catch (err) {
    console.error('Error fetching application summary:', err);
    res.status(500).json({ error: 'Failed to fetch application summary' });
  }
});

// Archive applications for an expired offer
app.post('/applications/archive/:offerId', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { offerId } = req.params;

    // For comite_ouverture, verify the offer exists and is expired (any offer)
    // For comite_ajout, verify the offer belongs to the user and is expired
    const whereClause = req.user.role === 'comite_ouverture'
      ? 'WHERE id = ? AND deadline < CURDATE()'
      : 'WHERE id = ? AND created_by = ? AND deadline < CURDATE()';
    const params = req.user.role === 'comite_ouverture'
      ? [offerId]
      : [offerId, req.user.id];

    const [offerCheck] = await pool.query(`
      SELECT id, title, deadline, DATEDIFF(CURDATE(), deadline) as days_since_expiry FROM offers
      ${whereClause}
    `, params);

    if (offerCheck.length === 0) {
      return res.status(404).json({ error: 'Offer not found, not expired, or not authorized' });
    }

    const offer = offerCheck[0];

    // Check if offer is within the 2-week archive window (14 days)
    if (offer.days_since_expiry > 14) {
      return res.status(400).json({
        error: 'Archive window closed',
        message: 'This offer expired more than 2 weeks ago and can no longer be archived.'
      });
    }

    // Get all non-archived applications for this offer
    const [applications] = await pool.query(`
      SELECT * FROM applications WHERE offer_id = ? AND archived_at IS NULL
    `, [offerId]);

    if (applications.length === 0) {
      return res.status(404).json({ error: 'No applications found for this offer' });
    }

    // Create a zip file with all applications
    const JSZip = require('jszip');
    const zip = new JSZip();

    for (const app of applications) {
      // Create folder structure: OfferTitle/CandidateName/
      const folderName = `${offer.title.replace(/[^a-zA-Z0-9]/g, '_')}/${app.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Add each document if it exists
      const documents = [
        { filename: app.cv_filename, filepath: app.cv_filepath, type: 'CV' },
        { filename: app.diplome_filename, filepath: app.diplome_filepath, type: 'Diploma' },
        { filename: app.id_card_filename, filepath: app.id_card_filepath, type: 'ID_Card' },
        { filename: app.cover_letter_filename, filepath: app.cover_letter_filepath, type: 'Cover_Letter' },
        { filename: app.declaration_sur_honneur_filename, filepath: app.declaration_sur_honneur_filepath, type: 'Declaration_Honneur' },
        { filename: app.fiche_de_referencement_filename, filepath: app.fiche_de_referencement_filepath, type: 'Fiche_Referencement' },
        { filename: app.extrait_registre_filename, filepath: app.extrait_registre_filepath, type: 'Extrait_Registre' },
        { filename: app.note_methodologique_filename, filepath: app.note_methodologique_filepath, type: 'Note_Methodologique' },
        { filename: app.liste_references_filename, filepath: app.liste_references_filepath, type: 'Liste_References' },
        { filename: app.offre_financiere_filename, filepath: app.offre_financiere_filepath, type: 'Offre_Financiere' }
      ];

      for (const doc of documents) {
        if (doc.filename && doc.filepath && fs.existsSync(doc.filepath)) {
          try {
            const fileData = fs.readFileSync(doc.filepath);
            const fileExtension = doc.filename.split('.').pop();
            const cleanFilename = `${doc.type}.${fileExtension}`;
            zip.file(`${folderName}/${cleanFilename}`, fileData);
          } catch (error) {
            console.error(`Error reading ${doc.type} for ${app.full_name}:`, error);
          }
        }
      }

      // Add a summary text file for each candidate
      const summaryText = `
Candidate Information:
- Name: ${app.full_name}
- Email: ${app.email}
- Phone: ${app.tel_number}
- Country: ${app.applicant_country}
- Applied for: ${offer.title}
- Offer Type: ${offer.type}
- Department: ${offer.department}
- Application Date: ${new Date(app.created_at).toLocaleDateString()}
`;
      zip.file(`${folderName}/candidate_info.txt`, summaryText);
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create a unique filename
    const archiveFilename = `archived_applications_${offer.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
    const archivePath = `./archives/${archiveFilename}`;

    // Ensure archives directory exists
    if (!fs.existsSync('./archives')) {
      fs.mkdirSync('./archives', { recursive: true });
    }

    // Save the zip file
    fs.writeFileSync(archivePath, zipBuffer);

    // Log the action (download only, no actual archiving)
    logAction(`${req.user.name} (${req.user.email}) downloaded ${applications.length} applications for offer "${offer.title}"`);

    res.json({
      message: `Successfully downloaded ${applications.length} applications for offer "${offer.title}"`,
      archiveFile: archiveFilename,
      applicationsCount: applications.length
    });

  } catch (err) {
    console.error('Error archiving applications:', err);
    res.status(500).json({ error: 'Failed to archive applications' });
  }
});

// Download archived applications file
app.get('/applications/archive/:filename', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = `./archives/${filename}`;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archive file not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(filePath));

  } catch (err) {
    console.error('Error downloading archive:', err);
    res.status(500).json({ error: 'Failed to download archive' });
  }
});

// Download documents for a specific application
app.get('/applications/:id/:documentType', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { id, documentType } = req.params;

    // Validate document type
    const validDocumentTypes = [
      'cv', 'diplome', 'id_card', 'cover_letter',
      'declaration_sur_honneur', 'fiche_de_referencement',
      'extrait_registre', 'note_methodologique',
      'liste_references', 'offre_financiere'
    ];

    if (!validDocumentTypes.includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const [rows] = await pool.query(
      `SELECT ${documentType}_filename, ${documentType}_filepath FROM applications WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });

    const filename = rows[0][`${documentType}_filename`];
    const filepath = rows[0][`${documentType}_filepath`];

    if (!filename || !filepath) return res.status(404).json({ error: 'Document not found' });

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filepath);
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── Check for expired offers ─────
async function checkExpiredOffers() {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const twoDaysFromNowStr = twoDaysFromNow.toISOString().split('T')[0];

    // Check for offers expiring tomorrow (1 day warning) - haven't been notified for 1-day warning
    const [expiringTomorrowOffers] = await pool.query(`
      SELECT o.*, u.name as hr_name, u.email as hr_email
      FROM offers o
      JOIN users u ON o.created_by = u.id
      WHERE o.deadline = ? AND (o.one_day_notified IS NULL OR o.one_day_notified = FALSE)
    `, [tomorrowStr]);

    for (const offer of expiringTomorrowOffers) {
      try {
        // Send 1-day expiration warning notifications
        let notificationEmails = [];
        if (offer.notification_emails) {
          try {
            notificationEmails = JSON.parse(offer.notification_emails);
          } catch (e) {
            console.error('Error parsing notification emails for offer', offer.id, ':', e.message);
          }
        }

        // Add HR creator email to the notification list if not already included
        if (offer.hr_email && !notificationEmails.includes(offer.hr_email)) {
          notificationEmails.unshift(offer.hr_email); // Add HR email first
        }

        if (notificationEmails.length > 0) {
          for (const email of notificationEmails) {
            try {
              const isHR = email === offer.hr_email;
              const recipientName = isHR ? offer.hr_name : 'Notification Recipient';

              await sendEmailWithGraphAPI(
                email,
                `Offer Expiring Tomorrow: ${offer.title}`,
                createUpcomingExpirationNotificationEmail(recipientName, offer.title, offer.deadline, 1)
              );

              const recipientType = isHR ? 'HR creator' : 'notification email';
              logAction(`System sent 1-day expiration warning for offer "${offer.title}" to ${email} (${recipientType})`);
            } catch (emailError) {
              console.error(`Failed to send 1-day warning email to ${email} for offer ${offer.title}:`, emailError.message);
            }
          }
        }
        // Mark as notified for 1-day warning
        await pool.query('UPDATE offers SET one_day_notified = TRUE WHERE id = ?', [offer.id]);

        logAction(`System processed 1-day warning for offer "${offer.title}" with ${notificationEmails.length} notification emails`);

      } catch (error) {
        console.error(`Error processing 1-day warning for offer ${offer.title}:`, error.message);
      }
    }

    // Check for offers expiring in 2 days (2 day warning) - haven't been notified for 2-day warning
    const [expiringInTwoDaysOffers] = await pool.query(`
      SELECT o.*, u.name as hr_name, u.email as hr_email
      FROM offers o
      JOIN users u ON o.created_by = u.id
      WHERE o.deadline = ? AND (o.two_day_notified IS NULL OR o.two_day_notified = FALSE)
    `, [twoDaysFromNowStr]);

    for (const offer of expiringInTwoDaysOffers) {
      try {
        // Send 2-day expiration warning notifications
        let notificationEmails = [];
        if (offer.notification_emails) {
          try {
            notificationEmails = JSON.parse(offer.notification_emails);
          } catch (e) {
            console.error('Error parsing notification emails for offer', offer.id, ':', e.message);
          }
        }

        // Add HR creator email to the notification list if not already included
        if (offer.hr_email && !notificationEmails.includes(offer.hr_email)) {
          notificationEmails.unshift(offer.hr_email); // Add HR email first
        }

        if (notificationEmails.length > 0) {
          for (const email of notificationEmails) {
            try {
              const isHR = email === offer.hr_email;
              const recipientName = isHR ? offer.hr_name : 'Notification Recipient';

              await sendEmailWithGraphAPI(
                email,
                `Offer Expiring in 2 Days: ${offer.title}`,
                createUpcomingExpirationNotificationEmail(recipientName, offer.title, offer.deadline, 2)
              );

              const recipientType = isHR ? 'HR creator' : 'notification email';
              logAction(`System sent 2-day expiration warning for offer "${offer.title}" to ${email} (${recipientType})`);
            } catch (emailError) {
              console.error(`Failed to send 2-day warning email to ${email} for offer ${offer.title}:`, emailError.message);
            }
          }
        }
        // Mark as notified for 2-day warning
        await pool.query('UPDATE offers SET two_day_notified = TRUE WHERE id = ?', [offer.id]);

        logAction(`System processed 2-day warning for offer "${offer.title}" with ${notificationEmails.length} notification emails`);

      } catch (error) {
        console.error(`Error processing 2-day warning for offer ${offer.title}:`, error.message);
      }
    }

    // Check for already expired offers (post-expiration notification)
    const [expiredOffers] = await pool.query(`
      SELECT o.*, u.name as hr_name, u.email as hr_email
      FROM offers o
      JOIN users u ON o.created_by = u.id
      WHERE o.deadline < ? AND (o.deadline_notified IS NULL OR o.deadline_notified = FALSE)
    `, [today]);

    for (const offer of expiredOffers) {
      try {
        // Send email notifications using the notification_emails field AND HR creator
        let notificationEmails = [];
        if (offer.notification_emails) {
          try {
            notificationEmails = JSON.parse(offer.notification_emails);
          } catch (e) {
            console.error('Error parsing notification emails for offer', offer.id, ':', e.message);
          }
        }

        // Add HR creator email to the notification list if not already included
        if (offer.hr_email && !notificationEmails.includes(offer.hr_email)) {
          notificationEmails.unshift(offer.hr_email); // Add HR email first
        }

        if (notificationEmails.length > 0) {
          for (const email of notificationEmails) {
            try {
              // Personalize the email for HR vs other recipients
              const isHR = email === offer.hr_email;
              const recipientName = isHR ? offer.hr_name : 'Notification Recipient';

              await sendEmailWithGraphAPI(
                email,
                `Offer Expired: ${offer.title}`,
                createExpirationNotificationEmail(recipientName, offer.title, offer.deadline)
              );

              // Log action
              const recipientType = isHR ? 'HR creator' : 'notification email';
              logAction(`System sent expiration notification for offer "${offer.title}" to ${email} (${recipientType})`);
            } catch (emailError) {
              console.error(`Failed to send expiration email to ${email} for offer ${offer.title}:`, emailError.message);
            }
          }
        }
        // Mark as notified
        await pool.query('UPDATE offers SET deadline_notified = TRUE WHERE id = ?', [offer.id]);

        // Log action
        logAction(`System processed expired offer "${offer.title}" with ${notificationEmails.length} notification emails`);

      } catch (error) {
        console.error(`Error processing expired offer ${offer.title}:`, error.message);
      }
    }
  } catch (err) {
    console.error('Error checking expired offers:', err);
  }
}

// Test email endpoint for Microsoft Graph API
app.post('/test-email', auth, requireRole('admin'), async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, message' });
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #343a40; margin: 0;">Test Email</h2>
        </div>

        <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
          <p style="color: #495057; font-size: 16px;">Hello,</p>

          <p style="color: #495057; font-size: 14px;">
            ${message}
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px; margin: 0;">
              This is a test email sent via Microsoft Graph API<br>
              Sent by: ${req.user.name} (${req.user.email})<br>
              Time: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await sendEmailWithGraphAPI(to, subject, htmlContent);

    logAction(`${req.user.name} (${req.user.email}) sent test email to ${to}`);
    res.json({ message: 'Test email sent successfully via Microsoft Graph API' });

  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ error: 'Failed to send test email: ' + err.message });
  }
});

// ───── Start Server ─────
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log('Email service: Microsoft Graph API with Outlook');
  console.log(`Email account: ${OUTLOOK_CONFIG.userEmail}`);
});