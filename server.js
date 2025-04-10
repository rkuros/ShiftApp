const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');

// Import jsPDF and autoTable plugin
const { jsPDF } = require('jspdf');
// Import and apply the autotable plugin
const autoTable = require('jspdf-autotable').default;

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'shift-management-secret-key'; // In production, use environment variable

// Middleware
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log(`Authentication attempt for ${req.method} ${req.path}`);
  console.log('Authorization header:', authHeader);
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: '認証が必要です' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification error:', err.message);
      return res.status(403).json({ error: 'トークンが無効です' });
    }
    console.log('Token verified successfully for user:', user.username);
    req.user = user;
    next();
  });
};

// Initialize database
db.initializeDatabase().then(() => {
  // Delete old read notifications on server startup
  console.log('Cleaning up old read notifications on server startup');
  db.deleteOldReadNotifications(7);
  
  // Set up periodic cleanup of old read notifications (every 24 hours)
  setInterval(() => {
    console.log('Performing scheduled cleanup of old read notifications');
    db.deleteOldReadNotifications(7);
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
});

// Routes

// Authentication routes
app.post('/api/login', async (req, res) => {
  console.log('Login request received:', req.body);
  console.log('Request headers:', req.headers);
  
  if (!req.body || typeof req.body !== 'object') {
    console.error('Invalid request body:', req.body);
    return res.status(400).json({ error: 'リクエストボディが無効です' });
  }
  
  const { username, password } = req.body;
  
  if (!username || !password) {
    console.error('Missing username or password');
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
  }
  
  try {
    console.log('Fetching user:', username);
    const user = await db.getUserByUsername(username);
    
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています' });
    }
    
    console.log('Comparing passwords');
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      console.log('Password mismatch for user:', username);
      return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています' });
    }
    
    // Create token - shorter expiration to require more frequent authentication
    console.log('Creating token for user:', username);
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' } // Reduced from 30d to 1h to require frequent authentication
    );
    
    // Remove password from user object
    delete user.password;
    
    console.log('Login successful for user:', username);
    
    // Set content type explicitly
    res.setHeader('Content-Type', 'application/json');
    
    // Send response
    const responseData = { token, user };
    console.log('Sending response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Public registration route (no authentication required)
app.post('/api/register', async (req, res) => {
  console.log('Registration request received:', req.body);
  
  const { username, password, email, department, role } = req.body;
  
  // Validate required fields
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
  }
  
  try {
    // Check if username already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'このユーザー名は既に使用されています' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user with specified role or default to staff
    const newUser = await db.createUser({
      username,
      password: hashedPassword,
      role: role || 'staff', // Use provided role or default to staff
      email,
      department
    });
    
    console.log('User registered successfully:', username);
    
    // Create token for automatic login
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1h' } // Reduced from 30d to 1h to match login token
    );
    
    // Return token and user data
    res.status(201).json({ 
      message: '登録が完了しました',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// User routes
app.get('/api/users', authenticateToken, async (req, res) => {
  // Only managers can get all users
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: '権限がありません' });
  }
  
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  // Only managers can create users
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: '権限がありません' });
  }
  
  const { username, password, role, email, department } = req.body;
  
  try {
    // Check if username already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'このユーザー名は既に使用されています' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const newUser = await db.createUser({
      username,
      password: hashedPassword,
      role,
      email,
      department
    });
    
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  // Only managers can delete users
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: '権限がありません' });
  }
  
  const userId = req.params.id;
  
  try {
    // Prevent deleting admin user
    const user = await db.getUserById(userId);
    if (user.username === 'admin') {
      return res.status(400).json({ error: '管理者アカウントは削除できません' });
    }
    
    await db.deleteUser(userId);
    res.json({ message: 'ユーザーが削除されました' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Shift routes
app.get('/api/shifts', authenticateToken, async (req, res) => {
  try {
    let shifts;
    
    // Managers can see all shifts, staff can only see their own
    if (req.user.role === 'manager') {
      shifts = await db.getAllShifts();
    } else {
      shifts = await db.getShiftsByUsername(req.user.username);
    }
    
    res.json(shifts);
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/shifts', authenticateToken, async (req, res) => {
  const { date, startTime, endTime, notes, repeatOption } = req.body;
  
  try {
    // Create base shift
    const newShift = {
      username: req.user.username,
      date,
      startTime,
      endTime,
      notes,
      department: req.body.department || '',
      status: req.user.role === 'manager' ? 'approved' : 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Handle repeating shifts
    if (repeatOption && repeatOption !== 'none') {
      const shifts = await db.createRepeatingShifts(newShift, repeatOption);
      
      // Create notification for managers if approval required
      if (req.user.role !== 'manager') {
        await db.createNotification({
          type: 'approval_needed',
          username: req.user.username,
          targetRole: 'manager',
          date,
          message: `${req.user.username}からの新しいシフト申請があります (${date}: ${startTime}-${endTime})`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
      
      res.status(201).json(shifts);
    } else {
      // Create single shift
      const shift = await db.createShift(newShift);
      
      // Create notification for managers if approval required
      if (req.user.role !== 'manager') {
        await db.createNotification({
          type: 'approval_needed',
          username: req.user.username,
          targetRole: 'manager',
          date,
          message: `${req.user.username}からの新しいシフト申請があります (${date}: ${startTime}-${endTime})`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
      
      res.status(201).json(shift);
    }
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.delete('/api/shifts/:id', authenticateToken, async (req, res) => {
  const shiftId = req.params.id;
  
  try {
    // Check if user has permission to delete this shift
    const shift = await db.getShiftById(shiftId);
    
    if (!shift) {
      return res.status(404).json({ error: 'シフトが見つかりません' });
    }
    
    if (shift.username !== req.user.username && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'このシフトを削除する権限がありません' });
    }
    
    await db.deleteShift(shiftId);
    
    // Create notification if manager deletes staff's shift
    if (req.user.role === 'manager' && shift.username !== req.user.username) {
      await db.createNotification({
        type: 'shift_deleted',
        username: shift.username,
        targetRole: shift.username,
        date: shift.date,
        message: `管理者によりシフトが削除されました (${shift.date}: ${shift.startTime}-${shift.endTime})`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
    
    res.json({ message: 'シフトが削除されました' });
  } catch (error) {
    console.error('Delete shift error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Shift approval routes
app.put('/api/shifts/:id/approve', authenticateToken, async (req, res) => {
  // Only managers can approve shifts
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: '権限がありません' });
  }
  
  const shiftId = req.params.id;
  
  try {
    const shift = await db.getShiftById(shiftId);
    
    if (!shift) {
      return res.status(404).json({ error: 'シフトが見つかりません' });
    }
    
    await db.updateShiftStatus(shiftId, 'approved', req.user.username);
    
    // Create notification for the shift owner
    await db.createNotification({
      type: 'shift_approved',
      username: shift.username,
      targetRole: shift.username,
      date: shift.date,
      message: `シフトが承認されました (${shift.date}: ${shift.startTime}-${shift.endTime})`,
      isRead: false,
      createdAt: new Date().toISOString()
    });
    
    res.json({ message: 'シフトが承認されました' });
  } catch (error) {
    console.error('Approve shift error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.put('/api/shifts/:id/reject', authenticateToken, async (req, res) => {
  // Only managers can reject shifts
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: '権限がありません' });
  }
  
  const shiftId = req.params.id;
  
  try {
    const shift = await db.getShiftById(shiftId);
    
    if (!shift) {
      return res.status(404).json({ error: 'シフトが見つかりません' });
    }
    
    await db.updateShiftStatus(shiftId, 'rejected', req.user.username);
    
    // Create notification for the shift owner
    await db.createNotification({
      type: 'shift_rejected',
      username: shift.username,
      targetRole: shift.username,
      date: shift.date,
      message: `シフトが却下されました (${shift.date}: ${shift.startTime}-${shift.endTime})`,
      isRead: false,
      createdAt: new Date().toISOString()
    });
    
    res.json({ message: 'シフトが却下されました' });
  } catch (error) {
    console.error('Reject shift error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Template routes
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const templates = await db.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  const { name, startTime, endTime } = req.body;
  
  try {
    const template = await db.createTemplate({ name, startTime, endTime });
    res.status(201).json(template);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  const templateId = req.params.id;
  const { name, startTime, endTime } = req.body;
  
  try {
    const template = await db.updateTemplate(templateId, { name, startTime, endTime });
    res.json(template);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  const templateId = req.params.id;
  
  try {
    await db.deleteTemplate(templateId);
    res.json({ message: 'テンプレートが削除されました' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Notification routes
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await db.getNotificationsForUser(req.user.username, req.user.role);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Mark all notifications as read - this route must come before the :id route
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await db.markAllNotificationsAsRead(req.user.username, req.user.role);
    res.json({ message: 'すべての通知が既読になりました' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Mark single notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  const notificationId = req.params.id;
  
  try {
    await db.markNotificationAsRead(notificationId);
    res.json({ message: '通知が既読になりました' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Department routes
app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    const departments = await db.getDepartments();
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Search routes
app.get('/api/search', authenticateToken, async (req, res) => {
  const { type, term } = req.query;
  
  try {
    let results;
    
    switch (type) {
      case 'user':
        results = await db.searchShiftsByUser(term);
        break;
      case 'date':
        results = await db.searchShiftsByDate(term);
        break;
      case 'department':
        results = await db.searchShiftsByDepartment(term);
        break;
      case 'notes':
        results = await db.searchShiftsByNotes(term);
        break;
      default:
        return res.status(400).json({ error: '無効な検索タイプです' });
    }
    
    // Filter results based on user role
    if (req.user.role !== 'manager') {
      results = results.filter(shift => shift.username === req.user.username);
    }
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Export shifts as CSV
app.get('/api/export/csv', authenticateToken, async (req, res) => {
  console.log('CSV export requested by user:', req.user.username);
  
  try {
    // Get shifts data using the Promise-based helper functions
    let shifts;
    
    // Managers can export all shifts, staff can only export their own
    if (req.user.role === 'manager') {
      shifts = await db.getAllShifts();
      console.log(`Found ${shifts.length} shifts for manager export`);
    } else {
      shifts = await db.getShiftsByUsername(req.user.username);
      console.log(`Found ${shifts.length} shifts for user ${req.user.username}`);
    }
    
    if (!shifts || !Array.isArray(shifts)) {
      console.error('Invalid shifts data:', shifts);
      throw new Error('シフトデータの取得に失敗しました');
    }
    
    // Add BOM for UTF-8 encoding to ensure Excel recognizes Japanese characters correctly
    let csvContent = "\uFEFF";  // UTF-8 BOM
    
    // Create CSV content with Japanese headers
    csvContent += "日付,開始時間,終了時間,担当者,部署,ステータス,備考\r\n";
    
    for (const shift of shifts) {
      try {
        if (!shift) {
          console.error('Invalid shift entry:', shift);
          continue; // Skip null or undefined shifts
        }
        
        // Safely extract and format each field
        const date = shift.date || '';
        const startTime = shift.startTime || '';
        const endTime = shift.endTime || '';
        
        // Properly escape values for CSV format
        // Double quotes around fields and escape internal quotes by doubling them
        const escapeCsvField = (field) => {
          if (field === null || field === undefined) return '""';
          return `"${String(field).replace(/"/g, '""')}"`;
        };
        
        const username = escapeCsvField(shift.username);
        const department = escapeCsvField(shift.department);
        const status = escapeCsvField(shift.status);
        const notes = escapeCsvField(shift.notes);
        
        // Use CRLF line endings for better Excel compatibility
        csvContent += `${escapeCsvField(date)},${escapeCsvField(startTime)},${escapeCsvField(endTime)},${username},${department},${status},${notes}\r\n`;
      } catch (fieldError) {
        console.error('Error processing shift data:', fieldError, shift);
        // Skip problematic rows but continue processing
      }
    }
    
    console.log('Sending CSV response with content length:', csvContent.length);
    
    // Set proper headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`シフト一覧_${new Date().toISOString().split('T')[0]}.csv`)}`);
    
    // Send the CSV data
    res.status(200).send(csvContent);
    console.log('CSV export completed successfully with content length:', csvContent.length);
    
  } catch (error) {
    console.error('CSV export error:', error);
    // Return a user-friendly error message
    res.status(500).json({ error: 'CSVエクスポートに失敗しました: ' + (error.message || '不明なエラー') });
  }
});

// Export shifts as PDF
app.get('/api/export/pdf', authenticateToken, async (req, res) => {
  console.log('PDF export requested by user:', req.user.username);
  
  try {
    // Get shifts data
    let shifts;
    
    // Managers can export all shifts, staff can only export their own
    if (req.user.role === 'manager') {
      shifts = await db.getAllShifts();
      console.log(`Found ${shifts.length} shifts for manager PDF export`);
    } else {
      shifts = await db.getShiftsByUsername(req.user.username);
      console.log(`Found ${shifts.length} shifts for user ${req.user.username} PDF export`);
    }
    
    if (!shifts || !Array.isArray(shifts)) {
      console.error('Invalid shifts data for PDF export:', shifts);
      throw new Error('シフトデータの取得に失敗しました');
    }
    
    // Sort shifts by date and start time
    shifts.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    });
    
    // Function to get status text with Japanese
    const getStatusText = (status) => {
      switch (status) {
        case 'pending': return '承認待ち';
        case 'approved': return '承認済み';
        case 'rejected': return '却下';
        default: return status;
      }
    };
    
    try {
      // Load Japanese font file
      console.log('Loading Japanese font for PDF');
      const fontPath = path.join(__dirname, 'public/fonts/NotoSansJP-Regular.otf');
      const fontBytes = fs.readFileSync(fontPath);
      
      // Create a new jsPDF document with default Latin-1 font
      const doc = new jsPDF({
        orientation: 'landscape',  // Use landscape for better table fit
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 16 // or "smart", to avoid rounding errors
      });
      
      // Add the Japanese font to the PDF document
      doc.addFileToVFS('NotoSansJP-Regular.otf', fontBytes.toString('base64'));
      doc.addFont('NotoSansJP-Regular.otf', 'NotoSansJP', 'normal');
      
      // Log available fonts for debugging
      console.log('Available fonts:', doc.getFontList());
    
    // Set document properties
    doc.setProperties({
      title: 'シフト表',
      author: 'シフト管理アプリ'
    });
    
    // Use the Japanese font - explicitly set 'normal' style
    doc.setFont('NotoSansJP', 'normal');
    
    // Add document title in Japanese
    doc.setFontSize(16);
    doc.text('シフト表', 15, 15);
    
    // Add export date in Japanese
    const exportDate = new Date().toISOString().split('T')[0];
    const jpDate = exportDate.replace(/-/g, '/');
    doc.setFontSize(10);
    doc.text(`エクスポート日: ${jpDate}`, 15, 22);
    
    // Use a fallback approach for simpler table rendering
    // Prepare table data with Japanese content
    const tableData = shifts.map(shift => [
      shift.date,
      shift.startTime,
      shift.endTime,
      shift.username,
      shift.department || '-',
      getStatusText(shift.status),
      // Trim notes to avoid overflow issues
      (shift.notes || '').substring(0, 15) + ((shift.notes || '').length > 15 ? '...' : '')
    ]);
    
    // Define table headers in Japanese
    const headers = [['日付', '開始', '終了', '担当者', '部署', 'ステータス', '備考']];
    
    // Add table with autotable plugin with simplified configuration
    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 25,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'ellipsize',
        font: 'NotoSansJP'
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontSize: 9,
        // No fontStyle to prevent issues
        font: 'NotoSansJP'
      },
      columnStyles: {
        0: { cellWidth: 20 },  // 日付
        1: { cellWidth: 15 },  // 開始
        2: { cellWidth: 15 },  // 終了
        3: { cellWidth: 22 },  // 担当者
        4: { cellWidth: 20 },  // 部署
        5: { cellWidth: 18 },  // ステータス
        6: { cellWidth: 'auto' } // 備考
      },
      // Avoid using fancy features that might cause errors
      showHead: 'firstPage',
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
      didDrawPage: (data) => {
        // Add page number in Japanese
        doc.setFont('NotoSansJP', 'normal');
        const str = `ページ ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="shifts-${exportDate}.pdf"`);
    
    // Get PDF as buffer and send
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.send(pdfBuffer);
    
    console.log('PDF export completed successfully');
    } catch (err) {
      console.error('Error in PDF generation process:', err);
      // Add more specific error handling for PDF generation issues
      res.status(500).json({ error: `PDFエクスポートに失敗しました: ${err.message}` });
    }
    
  } catch (error) {
    console.error('PDF export error:', error);
    // Return a user-friendly error message
    res.status(500).json({ error: 'PDFエクスポートに失敗しました: ' + (error.message || '不明なエラー') });
  }
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
