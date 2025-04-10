const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Create a database connection
const dbPath = path.join(__dirname, 'shift_management.db');
const db = new sqlite3.Database(dbPath);

// Helper function to run queries as promises
const run = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID });
    });
  });
};

// Helper function to get a single row
const get = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

// Helper function to get all rows
const all = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

// Initialize database with tables
const initializeDatabase = async () => {
  // Enable foreign keys
  await run('PRAGMA foreign_keys = ON');
  
  // Create users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      department TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create shifts table
  await run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      department TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      approved_by TEXT,
      approved_at TIMESTAMP,
      rejected_by TEXT,
      rejected_at TIMESTAMP,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    )
  `);
  
  // Create templates table
  await run(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create notifications table
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      username TEXT NOT NULL,
      target_role TEXT NOT NULL,
      date TEXT,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL,
      FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    )
  `);
  
  // Create departments table
  await run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);
  
  // Check if default data needs to be inserted
  const adminUser = await get('SELECT * FROM users WHERE username = ?', ['admin']);
  
  if (!adminUser) {
    // Insert default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await run(
      'INSERT INTO users (username, password, role, email, department) VALUES (?, ?, ?, ?, ?)',
      ['admin', hashedPassword, 'manager', 'admin@example.com', '管理部']
    );
    
    // Insert default staff user
    const staffPassword = await bcrypt.hash('staff123', 10);
    await run(
      'INSERT INTO users (username, password, role, email, department) VALUES (?, ?, ?, ?, ?)',
      ['staff1', staffPassword, 'staff', 'staff1@example.com', '営業部']
    );
    
    // Insert default departments
    const departments = ['管理部', '営業部', '開発部', 'カスタマーサポート'];
    for (const dept of departments) {
      await run('INSERT INTO departments (name) VALUES (?)', [dept]);
    }
    
    // Insert default templates
    const templates = [
      { name: '早番', startTime: '08:00', endTime: '17:00' },
      { name: '遅番', startTime: '13:00', endTime: '22:00' },
      { name: '通常', startTime: '09:00', endTime: '18:00' }
    ];
    
    for (const template of templates) {
      await run(
        'INSERT INTO templates (name, start_time, end_time) VALUES (?, ?, ?)',
        [template.name, template.startTime, template.endTime]
      );
    }
  }
};

// User operations
const getAllUsers = async () => {
  const users = await all('SELECT id, username, role, email, department, created_at FROM users');
  return users;
};

const getUserById = async (id) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [id]);
  return user;
};

const getUserByUsername = async (username) => {
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  return user;
};

const createUser = async (userData) => {
  const { username, password, role, email, department } = userData;
  
  await run(
    'INSERT INTO users (username, password, role, email, department) VALUES (?, ?, ?, ?, ?)',
    [username, password, role, email, department]
  );
  
  // Return the created user without password
  const user = await getUserByUsername(username);
  delete user.password;
  
  return user;
};

const deleteUser = async (id) => {
  await run('DELETE FROM users WHERE id = ?', [id]);
};

// Shift operations
const getAllShifts = async () => {
  const shifts = await all(`
    SELECT s.*, u.department
    FROM shifts s
    LEFT JOIN users u ON s.username = u.username
    ORDER BY s.date, s.start_time
  `);
  
  return shifts.map(shift => ({
    id: shift.id,
    username: shift.username,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    notes: shift.notes,
    department: shift.department,
    status: shift.status,
    createdAt: shift.created_at,
    approvedBy: shift.approved_by,
    approvedAt: shift.approved_at,
    rejectedBy: shift.rejected_by,
    rejectedAt: shift.rejected_at
  }));
};

const getShiftsByUsername = async (username) => {
  const shifts = await all(`
    SELECT s.*, u.department
    FROM shifts s
    LEFT JOIN users u ON s.username = u.username
    WHERE s.username = ?
    ORDER BY s.date, s.start_time
  `, [username]);
  
  return shifts.map(shift => ({
    id: shift.id,
    username: shift.username,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    notes: shift.notes,
    department: shift.department,
    status: shift.status,
    createdAt: shift.created_at,
    approvedBy: shift.approved_by,
    approvedAt: shift.approved_at,
    rejectedBy: shift.rejected_by,
    rejectedAt: shift.rejected_at
  }));
};

const getShiftById = async (id) => {
  const shift = await get(`
    SELECT s.*, u.department
    FROM shifts s
    LEFT JOIN users u ON s.username = u.username
    WHERE s.id = ?
  `, [id]);
  
  if (!shift) return null;
  
  return {
    id: shift.id,
    username: shift.username,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    notes: shift.notes,
    department: shift.department,
    status: shift.status,
    createdAt: shift.created_at,
    approvedBy: shift.approved_by,
    approvedAt: shift.approved_at,
    rejectedBy: shift.rejected_by,
    rejectedAt: shift.rejected_at
  };
};

const createShift = async (shiftData) => {
  const { username, date, startTime, endTime, notes, department, status, createdAt } = shiftData;
  
  const result = await run(
    `INSERT INTO shifts 
     (username, date, start_time, end_time, notes, department, status, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, date, startTime, endTime, notes, department, status, createdAt]
  );
  
  return getShiftById(result.id);
};

const createRepeatingShifts = async (baseShift, repeatOption) => {
  const { username, date, startTime, endTime, notes, department, status, createdAt } = baseShift;
  
  // Parse base date
  const baseDate = new Date(date);
  let numWeeks = 0;
  
  switch (repeatOption) {
    case 'weekly':
      numWeeks = 4; // 4 weeks
      break;
    case 'biweekly':
      numWeeks = 8; // 8 weeks (4 occurrences)
      break;
    case 'monthly':
      numWeeks = 12; // 12 weeks (3 occurrences)
      break;
  }
  
  // Create base shift
  const baseShiftResult = await createShift(baseShift);
  const shifts = [baseShiftResult];
  
  // Create repeating shifts
  for (let i = 1; i <= numWeeks; i++) {
    if (repeatOption === 'biweekly' && i % 2 !== 0) continue;
    if (repeatOption === 'monthly' && i % 4 !== 0) continue;
    
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + (i * 7)); // Add weeks
    
    const formattedDate = formatDate(newDate);
    
    const newShift = await createShift({
      username,
      date: formattedDate,
      startTime,
      endTime,
      notes,
      department,
      status,
      createdAt
    });
    
    shifts.push(newShift);
  }
  
  return shifts;
};

const updateShiftStatus = async (id, status, username) => {
  const now = new Date().toISOString();
  
  if (status === 'approved') {
    await run(
      'UPDATE shifts SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?',
      [status, username, now, id]
    );
  } else if (status === 'rejected') {
    await run(
      'UPDATE shifts SET status = ?, rejected_by = ?, rejected_at = ? WHERE id = ?',
      [status, username, now, id]
    );
  }
  
  return getShiftById(id);
};

const deleteShift = async (id) => {
  await run('DELETE FROM shifts WHERE id = ?', [id]);
};

// Template operations
const getTemplates = async () => {
  const templates = await all('SELECT * FROM templates');
  
  return templates.map(template => ({
    id: template.id,
    name: template.name,
    startTime: template.start_time,
    endTime: template.end_time,
    createdAt: template.created_at
  }));
};

const createTemplate = async (templateData) => {
  const { name, startTime, endTime } = templateData;
  
  const result = await run(
    'INSERT INTO templates (name, start_time, end_time) VALUES (?, ?, ?)',
    [name, startTime, endTime]
  );
  
  const template = await get('SELECT * FROM templates WHERE id = ?', [result.id]);
  
  return {
    id: template.id,
    name: template.name,
    startTime: template.start_time,
    endTime: template.end_time,
    createdAt: template.created_at
  };
};

const updateTemplate = async (id, templateData) => {
  const { name, startTime, endTime } = templateData;
  
  await run(
    'UPDATE templates SET name = ?, start_time = ?, end_time = ? WHERE id = ?',
    [name, startTime, endTime, id]
  );
  
  const template = await get('SELECT * FROM templates WHERE id = ?', [id]);
  
  return {
    id: template.id,
    name: template.name,
    startTime: template.start_time,
    endTime: template.end_time,
    createdAt: template.created_at
  };
};

const deleteTemplate = async (id) => {
  await run('DELETE FROM templates WHERE id = ?', [id]);
};

// Notification operations
const createNotification = async (notificationData) => {
  const { type, username, targetRole, date, message, isRead, createdAt } = notificationData;
  
  const result = await run(
    `INSERT INTO notifications 
     (type, username, target_role, date, message, is_read, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [type, username, targetRole, date, message, isRead ? 1 : 0, createdAt]
  );
  
  return result;
};

const getNotificationsForUser = async (username, role) => {
  const notifications = await all(`
    SELECT * FROM notifications 
    WHERE (username = ? OR target_role = ? OR target_role = ?)
    ORDER BY created_at DESC
  `, [username, username, role]);
  
  return notifications.map(notification => ({
    id: notification.id,
    type: notification.type,
    username: notification.username,
    targetRole: notification.target_role,
    date: notification.date,
    message: notification.message,
    isRead: notification.is_read === 1,
    createdAt: notification.created_at
  }));
};

const markNotificationAsRead = async (id) => {
  await run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
};

const markAllNotificationsAsRead = async (username, role) => {
  await run(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE (username = ? OR target_role = ? OR target_role = ?)
  `, [username, username, role]);
};

// Delete read notifications that are older than N days
const deleteOldReadNotifications = async (days = 7) => {
  const date = new Date();
  date.setDate(date.getDate() - days); // N days ago
  const cutoffDate = date.toISOString();
  
  const result = await run(
    'DELETE FROM notifications WHERE is_read = 1 AND created_at < ?',
    [cutoffDate]
  );
  
  console.log(`Deleted old read notifications older than ${days} days (cutoff: ${cutoffDate})`);
  return result;
};

// Department operations
const getDepartments = async () => {
  const departments = await all('SELECT * FROM departments');
  return departments.map(dept => dept.name);
};

// Search operations
const searchShiftsByUser = async (term) => {
  const shifts = await all(`
    SELECT s.*, u.department
    FROM shifts s
    LEFT JOIN users u ON s.username = u.username
    WHERE s.username LIKE ?
    ORDER BY s.date, s.start_time
  `, [`%${term}%`]);
  
  return shifts.map(shift => ({
    id: shift.id,
    username: shift.username,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    notes: shift.notes,
    department: shift.department,
    status: shift.status,
    createdAt: shift.created_at
  }));
};

const searchShiftsByDate = async (term) => {
  const shifts = await all(`
    SELECT s.*, u.department
    FROM shifts s
    LEFT JOIN users u ON s.username = u.username
    WHERE s.date LIKE ?
    ORDER BY s.date, s.start_time
  `, [`%${term}%`]);
  
  return shifts.map(shift => ({
    id: shift.id,
    username: shift.username,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    notes: shift.notes,
    department: shift.department,
    status: shift.status,
    createdAt: shift.created_at
  }));
};

const searchShiftsByDepartment = async (term) => {
  const shifts = await all(`
    SELECT s.*, u.department
    FROM shifts s
    LEFT JOIN users u ON s.username = u.username
    WHERE u.department LIKE ?
    ORDER BY s.date, s.start_time
  `, [`%${term}%`]);
  
  return shifts.map(shift => ({
    id: shift.id,
    username: shift.username,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    notes: shift.notes,
    department: shift.department,
    status: shift.status,
    createdAt: shift.created_at
  }));
};

const searchShiftsByNotes = async (term) => {
  const shifts = await all(`
    SELECT s.*, u.department
    FROM shifts s
    LEFT JOIN users u ON s.username = u.username
    WHERE s.notes LIKE ?
    ORDER BY s.date, s.start_time
  `, [`%${term}%`]);
  
  return shifts.map(shift => ({
    id: shift.id,
    username: shift.username,
    date: shift.date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    notes: shift.notes,
    department: shift.department,
    status: shift.status,
    createdAt: shift.created_at
  }));
};

// Helper function to format date as YYYY-MM-DD
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Export all functions
module.exports = {
  initializeDatabase,
  getAllUsers,
  getUserById,
  getUserByUsername,
  createUser,
  deleteUser,
  getAllShifts,
  getShiftsByUsername,
  getShiftById,
  createShift,
  createRepeatingShifts,
  updateShiftStatus,
  deleteShift,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createNotification,
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteOldReadNotifications,
  getDepartments,
  searchShiftsByUser,
  searchShiftsByDate,
  searchShiftsByDepartment,
  searchShiftsByNotes
};
