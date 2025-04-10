// API base URL - use relative URL
const API_BASE_URL = '/api';

// Shift Management Application
const ShiftApp = {
    // Data storage
    users: [],
    shifts: [],
    shiftTemplates: [],
    notifications: [],
    departments: [],
    currentUser: null,
    currentSection: 'login-section',
    currentDate: new Date(),
    token: null,
    selectedDepartment: null,
    isMobile: false,

    // Initialize the application
    init: function() {
        console.log('Initializing ShiftApp...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check if device is mobile
        this.checkDeviceType();
        
        // Check for stored authentication
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
            try {
                console.log('Found stored authentication, attempting to restore session');
                this.token = storedToken;
                this.currentUser = JSON.parse(storedUser);
                
                // Fetch initial data and show shifts
                this.fetchInitialData()
                    .then(() => {
                        this.showLoggedInState();
                        this.showSection('shifts-section');
                        this.renderCalendar();
                        this.checkNotifications();
                        console.log('Session restored successfully');
                    })
                    .catch(error => {
                        console.error('Error restoring session:', error);
                        // If there's an error (like expired token), clear stored data and show login
                        this.logout();
                    });
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                this.logout();
            }
        } else {
            // No stored authentication, show login section
            this.showSection('login-section');
        }
        
        console.log('ShiftApp initialization complete!');
    },
    
    // Check device type and adjust UI accordingly
    checkDeviceType: function() {
        this.isMobile = window.innerWidth <= 768;
        
        // Listen for resize events
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            
            // If device type changed, adjust UI
            if (wasMobile !== this.isMobile && this.currentUser) {
                this.renderCalendar(); // Re-render calendar with appropriate view
            }
        });
    },
    
    // Show a specific section with animation
    showSection: function(sectionId) {
        console.log(`Showing section: ${sectionId}`);
        
        // Hide all sections
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => {
            section.classList.remove('active', 'fade-in', 'slide-in');
            section.style.display = 'none'; // Explicitly hide all sections
        });

        // Show the selected section with animation
        const targetSection = document.getElementById(sectionId);
        if (!targetSection) {
            console.error(`Section not found: ${sectionId}`);
            return;
        }
        
        targetSection.classList.add('active');
        targetSection.style.display = 'block'; // Explicitly show the target section
        
        // Add animation class (unified for all sections)
        targetSection.classList.add('fade-in');
        
        this.currentSection = sectionId;
    },

    // Set up all event listeners
    setupEventListeners: function() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                this.login(username, password);
            });
        }

        // Registration form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('reg-username').value;
                const password = document.getElementById('reg-password').value;
                const email = document.getElementById('reg-email').value;
                const department = document.getElementById('reg-department').value;
                const role = document.getElementById('reg-role').value;
                this.register(username, password, email, department, role);
            });
        }

        // Login/Register navigation
        const showRegister = document.getElementById('show-register');
        if (showRegister) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('register-section').style.display = 'block';
            });
        }

        const showLogin = document.getElementById('show-login');
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('register-section').style.display = 'none';
                document.getElementById('login-section').style.display = 'block';
            });
        }

        // Login/Logout buttons
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.showSection('login-section');
                const registerSection = document.getElementById('register-section');
                if (registerSection) {
                    registerSection.style.display = 'none';
                }
            });
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Navigation
        this.addNavEventListener('view-shifts', 'shifts-section', () => this.renderCalendar());
        this.addNavEventListener('register-shift', 'shift-register-section', () => this.populateShiftTemplates());
        this.addNavEventListener('shift-templates', 'templates-section', () => this.renderTemplatesList());
        this.addNavEventListener('shift-approvals', 'approvals-section', () => this.renderApprovalsList());
        this.addNavEventListener('manage-users', 'users-section', () => this.renderUsersList());
        this.addNavEventListener('notifications-link', 'notifications-section', () => this.renderNotificationsList());
        this.addNavEventListener('reports-link', 'reports-section', () => this.setupReportsSection());
        
        // Calendar navigation
        const prevMonth = document.getElementById('prev-month');
        if (prevMonth) {
            prevMonth.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            });
        }
        
        const nextMonth = document.getElementById('next-month');
        if (nextMonth) {
            nextMonth.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            });
        }
        
        // Department filter
        const deptFilter = document.getElementById('department-filter');
        if (deptFilter) {
            deptFilter.addEventListener('change', () => {
                this.filterByDepartment();
            });
        }

        // Shift form submission
        const shiftForm = document.getElementById('shift-form');
        if (shiftForm) {
            console.log('Adding event listener to shift form');
            shiftForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Shift form submitted');
                this.registerShift();
            });
        } else {
            console.error('Shift form element not found');
        }

        // Template form submission
        const templateForm = document.getElementById('template-form');
        if (templateForm) {
            console.log('Adding event listener to template form');
            templateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Template form submitted');
                this.saveTemplate();
            });
        } else {
            console.error('Template form element not found');
        }
    },
    
    // Helper method to add navigation event listeners
    addNavEventListener: function(elementId, sectionId, callback) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.currentUser && sectionId !== 'login-section') {
                    alert('ログインしてください');
                    this.showSection('login-section');
                    return;
                }
                this.showSection(sectionId);
                if (callback) callback();
            });
        }
    },

    // Helper function for API requests
    fetchAPI: async function(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        // Add authorization header if token exists
        if (this.token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${this.token}`
            };
        } else {
            console.warn(`Missing token for API request to ${endpoint}`);
            // If we're trying to access a protected endpoint and there's no token, throw an error
            if (endpoint !== '/login' && endpoint !== '/register') {
                throw new Error('認証情報がありません。再度ログインしてください。');
            }
        }
        
        // Add default headers
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };
        
        try {
            console.log(`Making ${options.method || 'GET'} request to ${url} with headers:`, options.headers);
            const response = await fetch(url, options);
            console.log(`Response from ${endpoint}:`, response.status);
            
            // Check if response is ok
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Authentication error (401) for endpoint:', endpoint);
                    // Clear invalid token and user data
                    this.token = null;
                    this.currentUser = null;
                    throw new Error('認証が無効です。再度ログインしてください。');
                }
                
                const errorData = await response.json();
                throw new Error(errorData.error || 'API request failed');
            }
            
            // Return JSON response or empty object for 204 No Content
            return response.status === 204 ? {} : await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    },

    // Login functionality
    login: async function(username, password) {
        try {
            console.log('Attempting login for:', username);
            
            // Clear any existing tokens and user data before login
            this.token = null;
            this.currentUser = null;
            
            // Create the request body
            const requestBody = { username, password };
            
            // Make the API request
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            // Handle HTTP error statuses
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('ユーザー名またはパスワードが間違っています');
                } else {
                    throw new Error(`ログインエラー (${response.status})`);
                }
            }
            
            // Try to parse as JSON
            const responseData = await response.json();
            
            // Validate response data structure
            if (!responseData || !responseData.token || !responseData.user) {
                throw new Error('サーバーからの応答の形式が正しくありません');
            }
            
            console.log('Login successful, received token and user data');
            
            // Store token and user data in memory and localStorage
            this.token = responseData.token;
            this.currentUser = responseData.user;
            
            // Store in localStorage for persistent login
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            // Fetch initial data and show shifts
            try {
                await this.fetchInitialData();
                
                // Update UI
                this.showLoggedInState();
                this.showSection('shifts-section');
                this.renderCalendar();
                this.checkNotifications();
                
                console.log('Login complete and initial data loaded');
            } catch (fetchError) {
                console.error('Error fetching initial data:', fetchError);
                alert('ログインは成功しましたが、データ取得に失敗しました。再読み込みしてみてください。');
                
                // Still show logged in state
                this.showLoggedInState();
                this.showSection('shifts-section');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('ログインに失敗しました: ' + error.message);
            
            // Clear any partial login data to ensure consistent state
            this.token = null;
            this.currentUser = null;
        }
    },

    // Registration functionality
    register: async function(username, password, email, department, role) {
        try {
            console.log('Attempting registration for:', username);
            
            // Create the request body
            const requestBody = { username, password, email, department, role };
            
            // Make the API request
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            // Check if response is ok
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'API request failed');
            }
            
            // Parse the response
            const responseData = await response.json();
            
            // Store token and user data in memory and localStorage
            this.token = responseData.token;
            this.currentUser = responseData.user;
            
            // Store in localStorage for persistent login
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            // Fetch initial data
            await this.fetchInitialData();
            
            // Update UI
            this.showLoggedInState();
            this.showSection('shifts-section');
            this.renderCalendar();
            
            // Show success message
            alert('登録が完了しました');
        } catch (error) {
            console.error('Registration error:', error);
            alert('登録に失敗しました: ' + error.message);
        }
    },

    // Logout functionality
    logout: function() {
        this.token = null;
        this.currentUser = null;
        
        // Clear localStorage authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        document.getElementById('current-user').textContent = 'ゲスト';
        document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('logout-btn').style.display = 'none';
        
        this.showSection('login-section');
    },

    // Fetch initial data after login
    fetchInitialData: async function() {
        try {
            // Fetch shifts
            console.log('Fetching shifts...');
            const shiftsResponse = await this.fetchAPI('/shifts');
            this.shifts = shiftsResponse;
            
            // Fetch templates
            console.log('Fetching templates...');
            const templatesResponse = await this.fetchAPI('/templates');
            this.shiftTemplates = templatesResponse;
            
            // Fetch departments
            console.log('Fetching departments...');
            const departmentsResponse = await this.fetchAPI('/departments');
            this.departments = departmentsResponse;
            
            // Fetch notifications
            console.log('Fetching notifications...');
            const notificationsResponse = await this.fetchAPI('/notifications');
            this.notifications = notificationsResponse;
            
            // If user is manager, fetch all users
            if (this.currentUser && this.currentUser.role === 'manager') {
                console.log('User is manager, fetching all users...');
                const usersResponse = await this.fetchAPI('/users');
                this.users = usersResponse;
            }
            
            console.log('All initial data fetched successfully');
        } catch (error) {
            console.error('Error fetching initial data:', error);
            throw error;
        }
    },

    // Show logged in state
    showLoggedInState: function() {
        document.getElementById('current-user').textContent = this.currentUser.username + 
            (this.currentUser.role === 'manager' ? ' (管理者)' : ' (スタッフ)');
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
    },
    
    // Check notifications
    checkNotifications: async function() {
        if (!this.currentUser) return;
        
        try {
            // Count unread notifications
            const unreadCount = this.notifications.filter(n => !n.isRead).length;
            
            // Update badge
            this.updateNotificationBadge(unreadCount);
        } catch (error) {
            console.error('Error checking notifications:', error);
        }
    },
    
    // Update notification badge
    updateNotificationBadge: function(count) {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        
        if (count && count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    },
    
    // Format date as YYYY-MM-DD
    formatDate: function(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    // Initialize user color map for consistent coloring across the app
    initUserColorMap: function() {
        try {
            // Initialize color map if it doesn't exist
            if (!this.userColorMap) {
                console.log('Initializing user color map');
                this.userColorMap = {};
                
                // Create a set of unique usernames from shifts
                const uniqueUsernames = new Set();
                
                // Add usernames from shifts
                if (this.shifts && Array.isArray(this.shifts)) {
                    for (let i = 0; i < this.shifts.length; i++) {
                        if (this.shifts[i] && this.shifts[i].username) {
                            uniqueUsernames.add(this.shifts[i].username);
                        }
                    }
                }
                
                // Add usernames from users array if available (for admin view)
                if (this.users && Array.isArray(this.users) && this.users.length > 0) {
                    for (let i = 0; i < this.users.length; i++) {
                        if (this.users[i] && this.users[i].username) {
                            uniqueUsernames.add(this.users[i].username);
                        }
                    }
                }
                
                // Convert set to array for further processing
                const uniqueUsers = Array.from(uniqueUsernames);
                
                // Generate distributed colors with greater hue separation
                const totalUsers = uniqueUsers.length;
                console.log(`Found ${totalUsers} unique users for color mapping`);
                
                // Sort usernames alphabetically for consistent assignment
                const sortedUsers = uniqueUsers.slice().sort();
                
                // Generate color values with more even distribution
                for (let i = 0; i < sortedUsers.length; i++) {
                    const username = sortedUsers[i];
                    
                    // Calculate hue value with wide distribution
                    // Use modulo to keep within 0-1 range
                    const hue = (i * (2.4 / Math.max(totalUsers, 1))) % 1;
                    
                    // Convert hue (0-1) to color index (0-10)
                    const colorIndex = Math.min(Math.floor(hue * 11), 10);
                    
                    // Assign to user map
                    this.userColorMap[username] = colorIndex;
                }
                
                console.log(`Enhanced color map created with wider hue distribution`);
            }
            
            return this.userColorMap || {};
        } catch (error) {
            // Fallback in case of error
            console.error('Error creating user color map:', error);
            return {};
        }
    },
    
    // Get user color class for a username
    getUserColorClass: function(username) {
        // Ensure color map is initialized
        const colorMap = this.initUserColorMap();
        // Color index is already restricted to 0-10 range in initUserColorMap
        return `user-${colorMap[username] || 0}`;
    },
    
    // Get status text helper
    getStatusText: function(status) {
        switch (status) {
            case 'pending': return '承認待ち';
            case 'approved': return '承認済み';
            case 'rejected': return '却下';
            default: return status;
        }
    },

    // Render the calendar
    renderCalendar: function() {
        if (!this.currentUser || !this.shifts) {
            console.error('Cannot render calendar: user not logged in or shifts not loaded');
            return;
        }
        
        console.log('Rendering calendar...');
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Update the month display
        const currentMonthElement = document.getElementById('current-month');
        if (currentMonthElement) {
            currentMonthElement.textContent = `${year}年${month + 1}月`;
        }
        
        // Get the first day of the month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const totalDays = lastDay.getDate();
        
        // Initialize user color map for consistent coloring
        this.initUserColorMap();
        
        // Filter shifts by department if selected
        let filteredShifts = this.shifts;
        if (this.selectedDepartment) {
            filteredShifts = this.shifts.filter(shift => shift.department === this.selectedDepartment);
        }
        
        // Filter shifts for the current month
        const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
        
        filteredShifts = filteredShifts.filter(shift => {
            return shift.date >= monthStart && shift.date <= monthEnd;
        });
        
        // Create the calendar grid
        let calendarHTML = `
            <table>
                <thead>
                    <tr>
                        <th>日</th>
                        <th>月</th>
                        <th>火</th>
                        <th>水</th>
                        <th>木</th>
                        <th>金</th>
                        <th>土</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Fill in the days
        let day = 1;
        
        for (let i = 0; i < 6; i++) {
            calendarHTML += '<tr>';
            
            for (let j = 0; j < 7; j++) {
                if ((i === 0 && j < firstDay.getDay()) || day > totalDays) {
                    calendarHTML += '<td></td>';
                } else {
                    const currentDate = new Date(year, month, day);
                    const dateString = this.formatDate(currentDate);
                    
                    // Get shifts for this day
                    const dayShifts = filteredShifts.filter(shift => shift.date === dateString);
                    
                    calendarHTML += `
                        <td class="day">
                            <div class="day-number">${day}</div>
                            <div class="shifts">
                    `;
                    
                    // Add shift entries
                    dayShifts.forEach(shift => {
                        const userColorClass = this.getUserColorClass(shift.username);
                        
                        calendarHTML += `
                            <div class="shift-entry ${userColorClass} ${shift.status}" 
                                 data-shift-id="${shift.id}" 
                                 onclick="ShiftApp.showShiftDetails('${shift.id}')">
                                <div><strong>${shift.startTime}-${shift.endTime}</strong></div>
                                <div>${shift.username}</div>
                            </div>
                        `;
                    });
                    
                    calendarHTML += `
                            </div>
                        </td>
                    `;
                    
                    day++;
                }
            }
            
            calendarHTML += '</tr>';
            
            if (day > totalDays) {
                break;
            }
        }
        
        calendarHTML += '</tbody></table>';
        
        // Update the calendar
        const calendarElement = document.getElementById('calendar');
        if (calendarElement) {
            calendarElement.innerHTML = calendarHTML;
        } else {
            console.error('Calendar element not found');
        }
    },
    
    // Show shift details
    showShiftDetails: function(shiftId) {
        if (!this.shifts) return;
        
        // Find the shift
        const shift = this.shifts.find(s => s.id.toString() === shiftId.toString());
        if (!shift) {
            console.error('Shift not found:', shiftId);
            return;
        }
        
        const detailsDiv = document.getElementById('shift-details');
        if (!detailsDiv) return;
        
        // Get user color for consistent display
        const userColorClass = this.getUserColorClass(shift.username);
        
        let detailsHTML = `
            <h3>シフト詳細</h3>
            <p><strong>日付:</strong> ${shift.date}</p>
            <p><strong>時間:</strong> ${shift.startTime} - ${shift.endTime}</p>
            <p class="user-info"><strong>担当者:</strong> 
                <span class="user-badge ${userColorClass}">${shift.username}</span>
            </p>
            <p><strong>部署:</strong> ${shift.department || '未設定'}</p>
            <p><strong>ステータス:</strong> <span class="status-${shift.status}">${this.getStatusText(shift.status)}</span></p>
        `;
        
        if (shift.notes) {
            detailsHTML += `<p><strong>備考:</strong> ${shift.notes}</p>`;
        }
        
        detailsDiv.innerHTML = detailsHTML;
        detailsDiv.classList.add('active');
    },
    
    // Filter shifts by department
    filterByDepartment: function() {
        const select = document.getElementById('department-filter');
        if (!select) return;
        
        this.selectedDepartment = select.value || null;
        this.renderCalendar();
    },
    
    // Populate shift templates dropdown
    populateShiftTemplates: function() {
        if (!this.currentUser) return;
        
        console.log('Populating shift templates...');
        const templateSelect = document.getElementById('apply-template');
        if (!templateSelect) return;
        
        // Clear previous options
        templateSelect.innerHTML = '<option value="">テンプレートを選択</option>';
        
        // Add department field with the user's department if available
        const departmentField = document.getElementById('shift-department');
        if (departmentField && this.currentUser.department) {
            departmentField.value = this.currentUser.department;
        }
        
        // Set the date field to be initially empty
        const dateField = document.getElementById('shift-date');
        if (dateField) {
            dateField.value = "";
        }
        
        // Add templates to dropdown
        if (this.shiftTemplates && this.shiftTemplates.length > 0) {
            this.shiftTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = `${template.name} (${template.startTime}-${template.endTime})`;
                templateSelect.appendChild(option);
            });
            
            // Add change event listener
            templateSelect.addEventListener('change', () => {
                this.applyShiftTemplate();
            });
        } else {
            console.log('No templates available');
        }
    },
    
    // Apply selected template to form
    applyShiftTemplate: function() {
        const templateSelect = document.getElementById('apply-template');
        if (!templateSelect) return;
        
        const templateId = templateSelect.value;
        if (!templateId) return;
        
        // Find selected template
        const template = this.shiftTemplates.find(t => t.id.toString() === templateId.toString());
        if (!template) {
            console.error('Template not found:', templateId);
            return;
        }
        
        // Apply template values
        const startInput = document.getElementById('shift-start');
        const endInput = document.getElementById('shift-end');
        
        if (startInput) startInput.value = template.startTime;
        if (endInput) endInput.value = template.endTime;
        
        console.log('Applied template:', template.name);
    },
    
    // Register a new shift
    registerShift: function() {
        if (!this.currentUser) {
            alert('ログインしてください');
            return;
        }
        
        console.log('Registering shift...');
        
        // Get form values
        const date = document.getElementById('shift-date').value;
        const startTime = document.getElementById('shift-start').value;
        const endTime = document.getElementById('shift-end').value;
        const repeat = document.getElementById('shift-repeat').value;
        const notes = document.getElementById('shift-notes').value;
        
        // Validate required fields
        if (!date || !startTime || !endTime) {
            alert('日付と時間を入力してください');
            return;
        }
        
        // Validate time
        if (startTime >= endTime) {
            alert('開始時間は終了時間より前にしてください');
            return;
        }
        
        // Create shift data
        const shiftData = {
            date,
            startTime,
            endTime,
            notes,
            repeatOption: repeat,
            department: this.currentUser.department || ''
        };
        
        // Send API request
        this.fetchAPI('/shifts', {
            method: 'POST',
            body: JSON.stringify(shiftData)
        })
        .then(response => {
            console.log('Shift registered successfully:', response);
            
            // Add new shift to shifts array
            if (Array.isArray(response)) {
                // Multiple shifts created (repeating)
                this.shifts = [...this.shifts, ...response];
            } else {
                // Single shift created
                this.shifts.push(response);
            }
            
            // Show success message
            alert('シフトが登録されました');
            
            // Return to shift list and update calendar
            this.showSection('shifts-section');
            this.renderCalendar();
        })
        .catch(error => {
            console.error('Error registering shift:', error);
            alert('シフト登録に失敗しました: ' + error.message);
        });
    },
    
    // Render users list
    renderUsersList: function() {
        if (!this.currentUser || this.currentUser.role !== 'manager') {
            const container = document.getElementById('users-list');
            if (container) {
                container.innerHTML = '<p>ユーザー管理機能は管理者のみが使用できます</p>';
            }
            return;
        }
        
        console.log('Rendering users list...');
        
        // Get container element
        const container = document.getElementById('users-list');
        if (!container) {
            console.error('Users list container not found');
            return;
        }
        
        // Check if we have users
        if (!this.users || this.users.length === 0) {
            container.innerHTML = '<p>ユーザーがありません</p>';
            return;
        }
        
        // Sort users by username
        const sortedUsers = [...this.users].sort((a, b) => a.username.localeCompare(b.username));
        
        // Create cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'user-cards-container';
        
        // Add filtering controls
        const filterControls = document.createElement('div');
        filterControls.className = 'user-filter-controls';
        filterControls.innerHTML = `
            <div class="filter-group">
                <label for="user-search">検索:</label>
                <div class="search-input-wrapper">
                    <input type="text" id="user-search" placeholder="ユーザー名で検索..." onkeyup="ShiftApp.filterUsers()">
                    <i class="fas fa-search search-icon"></i>
                </div>
            </div>
            <div class="filter-group">
                <label for="user-department-filter">部署:</label>
                <select id="user-department-filter" onchange="ShiftApp.filterUsers()">
                    <option value="">すべて</option>
                    ${this.departments.map(dept => `<option value="${dept.name}">${dept.name}</option>`).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label for="user-role-filter">役割:</label>
                <select id="user-role-filter" onchange="ShiftApp.filterUsers()">
                    <option value="">すべて</option>
                    <option value="staff">スタッフ</option>
                    <option value="manager">管理者</option>
                </select>
            </div>
        `;
        
        container.innerHTML = '';
        container.appendChild(filterControls);
        
        // Create cards for users
        sortedUsers.forEach(user => {
            // Get user color based on username
            const userColorClass = this.getUserColorClass(user.username);
            
            const card = document.createElement('div');
            card.className = `user-card ${userColorClass} ${user.role}`;
            card.dataset.username = user.username;
            card.dataset.department = user.department || '';
            card.dataset.role = user.role || 'staff';
            
            // Display admin badge if applicable
            const isAdmin = user.username === 'admin';
            const adminBadge = isAdmin ? '<span class="admin-badge">システム管理者</span>' : '';
            const roleBadge = `<span class="role-badge ${user.role}">${user.role === 'manager' ? '管理者' : 'スタッフ'}</span>`;
            
            card.innerHTML = `
                <div class="user-card-header">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-name">
                        <h3>${user.username}</h3>
                        <div class="user-badges">
                            ${roleBadge}
                            ${adminBadge}
                        </div>
                    </div>
                </div>
                <div class="user-card-body">
                    <div class="user-info">
                        <div class="info-item">
                            <span class="info-label"><i class="fas fa-envelope"></i></span>
                            <span class="info-value">${user.email || 'メール未設定'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label"><i class="fas fa-building"></i></span>
                            <span class="info-value">${user.department || '未所属'}</span>
                        </div>
                    </div>
                </div>
                <div class="user-card-footer">
                    <button class="btn-edit" onclick="ShiftApp.editUser('${user.id}')">
                        <i class="fas fa-edit"></i> 編集
                    </button>
                    ${!isAdmin ? `
                        <button class="btn-delete" onclick="ShiftApp.deleteUser('${user.id}')">
                            <i class="fas fa-trash-alt"></i> 削除
                        </button>
                    ` : ''}
                </div>
            `;
            
            cardsContainer.appendChild(card);
        });
        
        container.appendChild(cardsContainer);
        
        // Initialize forms
        this.setupUserForm();
    },
    
    // Set up the user form
    setupUserForm: function() {
        const form = document.getElementById('add-user-form');
        if (!form) return;
        
        // Reset form fields
        form.reset();
        
        // Clear edit state
        this._editingUserId = undefined;
        
        // Update form title
        const formTitle = document.querySelector('#users-section .add-user h3');
        if (formTitle) {
            formTitle.textContent = 'ユーザー追加';
        }
        
        // Update submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = '追加';
        }
        
        // Update form for add mode
        const passwordField = document.getElementById('new-password');
        if (passwordField) {
            passwordField.required = true;
            const passwordLabel = document.querySelector('label[for="new-password"]');
            if (passwordLabel) {
                passwordLabel.textContent = 'パスワード:';
            }
        }
    },
    
    // Filter users based on search and filters
    filterUsers: function() {
        // Get filter values
        const searchInput = document.getElementById('user-search');
        const departmentFilter = document.getElementById('user-department-filter');
        const roleFilter = document.getElementById('user-role-filter');
        
        if (!searchInput || !departmentFilter || !roleFilter) return;
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        const department = departmentFilter.value;
        const role = roleFilter.value;
        
        // Get all user cards
        const cards = document.querySelectorAll('.user-card');
        
        // Filter cards
        cards.forEach(card => {
            // Check if the card matches all filters
            let visible = true;
            
            // Username search
            const username = card.dataset.username.toLowerCase();
            if (searchTerm && !username.includes(searchTerm)) {
                visible = false;
            }
            
            // Department filter
            if (department && card.dataset.department !== department) {
                visible = false;
            }
            
            // Role filter
            if (role && card.dataset.role !== role) {
                visible = false;
            }
            
            // Show/hide card with animation
            if (visible) {
                card.style.display = '';
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 10);
            } else {
                card.style.opacity = '0';
                card.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            }
        });
    },
    
    // Add or update a user
    addUser: function(event) {
        event.preventDefault();
        
        if (!this.currentUser || this.currentUser.role !== 'manager') {
            alert('ユーザーを追加する権限がありません');
            return;
        }
        
        // Get form values
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const email = document.getElementById('new-email').value;
        const department = document.getElementById('user-department').value;
        const role = document.getElementById('user-role').value;
        
        // Validate required fields
        if (!username) {
            alert('ユーザー名を入力してください');
            return;
        }
        
        const isUpdating = !!this._editingUserId;
        
        // If updating, password can be empty (not changed)
        // If adding new user, password is required
        if (!isUpdating && !password) {
            alert('パスワードを入力してください');
            return;
        }
        
        // Create user data
        const userData = {
            username,
            password,
            email,
            department,
            role
        };
        
        // Remove password if empty (not changed)
        if (isUpdating && !password) {
            delete userData.password;
        }
        
        // Determine if this is an update or new user
        const url = isUpdating ? `/users/${this._editingUserId}` : '/users';
        const method = isUpdating ? 'PUT' : 'POST';
        
        // Send API request
        this.fetchAPI(url, {
            method,
            body: JSON.stringify(userData)
        })
        .then(response => {
            console.log('User saved successfully:', response);
            
            if (isUpdating) {
                // Update existing user in array
                this.users = this.users.map(u => 
                    u.id.toString() === this._editingUserId.toString() ? response : u
                );
            } else {
                // Add new user to array
                this.users.push(response);
            }
            
            // Reset form
            this.setupUserForm();
            
            // Show success message
            alert(isUpdating ? 'ユーザーが更新されました' : 'ユーザーが追加されました');
            
            // Update UI
            this.renderUsersList();
        })
        .catch(error => {
            console.error('Error saving user:', error);
            alert('ユーザー保存に失敗しました: ' + error.message);
        });
    },
    
    // Edit user
    editUser: function(userId) {
        if (!this.currentUser || this.currentUser.role !== 'manager' || !this.users) return;
        
        // Find the user
        const user = this.users.find(u => u.id.toString() === userId.toString());
        if (!user) {
            console.error('User not found:', userId);
            return;
        }
        
        // Set editing state
        this._editingUserId = userId;
        
        // Update form title
        const formTitle = document.querySelector('#users-section .add-user h3');
        if (formTitle) {
            formTitle.textContent = 'ユーザー編集';
        }
        
        // Populate form fields
        document.getElementById('new-username').value = user.username;
        document.getElementById('new-password').value = '';
        document.getElementById('new-email').value = user.email || '';
        document.getElementById('user-department').value = user.department || '';
        document.getElementById('user-role').value = user.role || 'staff';
        
        // Update password field
        const passwordField = document.getElementById('new-password');
        if (passwordField) {
            passwordField.required = false;
            const passwordLabel = document.querySelector('label[for="new-password"]');
            if (passwordLabel) {
                passwordLabel.textContent = 'パスワード (変更する場合のみ):';
            }
        }
        
        // Update submit button
        const submitBtn = document.querySelector('#add-user-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = '更新';
        }
        
        // Scroll to form
        const form = document.getElementById('add-user-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Delete user
    deleteUser: function(userId) {
        if (!this.currentUser || this.currentUser.role !== 'manager') {
            alert('ユーザーを削除する権限がありません');
            return;
        }
        
        // Find the user
        const user = this.users.find(u => u.id.toString() === userId.toString());
        if (!user) {
            console.error('User not found:', userId);
            return;
        }
        
        // Prevent deleting admin
        if (user.username === 'admin') {
            alert('システム管理者は削除できません');
            return;
        }
        
        // Confirm deletion
        if (!confirm(`ユーザー "${user.username}" を削除しますか？`)) {
            return;
        }
        
        console.log('Deleting user:', userId);
        
        // Send API request
        this.fetchAPI(`/users/${userId}`, { method: 'DELETE' })
            .then(response => {
                console.log('User deleted successfully:', response);
                
                // Remove from users array
                this.users = this.users.filter(u => u.id.toString() !== userId.toString());
                
                // Show success message
                alert('ユーザーが削除されました');
                
                // Update UI
                this.renderUsersList();
            })
            .catch(error => {
                console.error('Error deleting user:', error);
                alert('ユーザー削除に失敗しました: ' + error.message);
            });
    },
    
    // Render templates list
    renderTemplatesList: function() {
        if (!this.currentUser) return;
        
        console.log('Rendering templates list...');
        const container = document.getElementById('templates-list');
        if (!container) {
            console.error('Templates list container not found');
            return;
        }
        
        // Clear form fields
        const nameField = document.getElementById('template-name');
        const startField = document.getElementById('template-start');
        const endField = document.getElementById('template-end');
        if (nameField) nameField.value = '';
        if (startField) startField.value = '';
        if (endField) endField.value = '';
        
        // Check if we have templates
        if (!this.shiftTemplates || this.shiftTemplates.length === 0) {
            container.innerHTML = '<p>テンプレートがありません</p>';
            return;
        }
        
        // Sort templates by name
        const sortedTemplates = [...this.shiftTemplates].sort((a, b) => a.name.localeCompare(b.name));
        
        // Create HTML for templates table
        let html = `
            <table class="templates-table">
                <thead>
                    <tr>
                        <th>名前</th>
                        <th>開始時間</th>
                        <th>終了時間</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        sortedTemplates.forEach(template => {
            html += `
                <tr>
                    <td>${template.name}</td>
                    <td>${template.startTime}</td>
                    <td>${template.endTime}</td>
                    <td>
                        <button class="edit-btn" onclick="ShiftApp.editTemplate('${template.id}')">編集</button>
                        <button class="delete-btn" onclick="ShiftApp.deleteTemplate('${template.id}')">削除</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
    },
    
    // Edit template - populate form with template data
    editTemplate: function(templateId) {
        if (!this.shiftTemplates) return;
        
        const template = this.shiftTemplates.find(t => t.id.toString() === templateId.toString());
        if (!template) {
            console.error('Template not found:', templateId);
            return;
        }
        
        // Populate form fields
        const nameField = document.getElementById('template-name');
        const startField = document.getElementById('template-start');
        const endField = document.getElementById('template-end');
        
        if (nameField) nameField.value = template.name;
        if (startField) startField.value = template.startTime;
        if (endField) endField.value = template.endTime;
        
        // Store template ID for update
        this._editingTemplateId = templateId;
        
        // Scroll to form
        const form = document.getElementById('template-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Delete template
    deleteTemplate: function(templateId) {
        if (!this.currentUser || !this.shiftTemplates) return;
        
        // Confirm deletion
        if (!confirm('このテンプレートを削除しますか？')) return;
        
        console.log('Deleting template:', templateId);
        this.fetchAPI(`/templates/${templateId}`, { method: 'DELETE' })
            .then(() => {
                // Remove from local array
                this.shiftTemplates = this.shiftTemplates.filter(t => t.id.toString() !== templateId.toString());
                
                // Update UI
                this.renderTemplatesList();
                
                // Show success message
                alert('テンプレートが削除されました');
            })
            .catch(error => {
                console.error('Error deleting template:', error);
                alert('テンプレート削除に失敗しました: ' + error.message);
            });
    },
    
    // Save template
    saveTemplate: function() {
        if (!this.currentUser) return;
        
        // Get form values
        const name = document.getElementById('template-name').value;
        const startTime = document.getElementById('template-start').value;
        const endTime = document.getElementById('template-end').value;
        
        // Validate required fields
        if (!name || !startTime || !endTime) {
            alert('名前と時間を入力してください');
            return;
        }
        
        // Validate time
        if (startTime >= endTime) {
            alert('開始時間は終了時間より前にしてください');
            return;
        }
        
        // Create template data
        const templateData = {
            name,
            startTime,
            endTime
        };
        
        // Determine if this is an update or new template
        const isUpdate = this._editingTemplateId !== undefined;
        const url = isUpdate ? `/templates/${this._editingTemplateId}` : '/templates';
        const method = isUpdate ? 'PUT' : 'POST';
        
        // Send API request
        this.fetchAPI(url, {
            method,
            body: JSON.stringify(templateData)
        })
        .then(response => {
            console.log('Template saved successfully:', response);
            
            if (isUpdate) {
                // Update existing template in array
                this.shiftTemplates = this.shiftTemplates.map(t => 
                    t.id.toString() === this._editingTemplateId.toString() ? response : t
                );
            } else {
                // Add new template to array
                this.shiftTemplates.push(response);
            }
            
            // Clear form and editing state
            const nameField = document.getElementById('template-name');
            const startField = document.getElementById('template-start');
            const endField = document.getElementById('template-end');
            
            if (nameField) nameField.value = '';
            if (startField) startField.value = '';
            if (endField) endField.value = '';
            
            this._editingTemplateId = undefined;
            
            // Show success message
            alert(isUpdate ? 'テンプレートが更新されました' : 'テンプレートが作成されました');
            
            // Update UI
            this.renderTemplatesList();
        })
        .catch(error => {
            console.error('Error saving template:', error);
            alert('テンプレート保存に失敗しました: ' + error.message);
        });
    },
    
    // Render approvals list
    renderApprovalsList: function() {
        if (!this.currentUser) return;
        
        // Check if user has manager role
        if (this.currentUser.role !== 'manager') {
            const container = document.getElementById('approvals-list');
            if (container) {
                container.innerHTML = '<p>承認機能は管理者のみが使用できます</p>';
            }
            return;
        }
        
        console.log('Rendering approvals list...');
        
        // Get pending shifts
        const pendingShifts = this.shifts ? this.shifts.filter(shift => shift.status === 'pending') : [];
        
        // Get container element
        const container = document.getElementById('approvals-list');
        if (!container) {
            console.error('Approvals list container not found');
            return;
        }
        
        // Set up modern UI for approvals section
        const approvalsSectionContent = document.createElement('div');
        
        // Add filter controls
        const filtersDiv = document.createElement('div');
        filtersDiv.className = 'approvals-filters';
        filtersDiv.innerHTML = `
            <div class="filter-group">
                <label for="approvals-department">部署</label>
                <select id="approvals-department">
                    <option value="">すべての部署</option>
                    ${this.departments.map(dept => `<option value="${dept.name}">${dept.name}</option>`).join('')}
                </select>
            </div>
            
            <div class="filter-group">
                <label for="approvals-date-from">開始日</label>
                <input type="date" id="approvals-date-from">
            </div>
            
            <div class="filter-group">
                <label for="approvals-date-to">終了日</label>
                <input type="date" id="approvals-date-to">
            </div>
            
            <div class="filter-group">
                <label>&nbsp;</label>
                <button class="bulk-select-toggle" id="bulk-select-toggle">
                    <i class="fas fa-check-square"></i> 一括操作
                </button>
            </div>
        `;
        
        // Add bulk action buttons (initially hidden)
        const bulkActionsDiv = document.createElement('div');
        bulkActionsDiv.className = 'bulk-actions';
        bulkActionsDiv.style.display = 'none';
        bulkActionsDiv.innerHTML = `
            <button class="bulk-action-btn bulk-approve" id="bulk-approve">
                <i class="fas fa-check"></i> 一括承認
            </button>
            <button class="bulk-action-btn bulk-reject" id="bulk-reject">
                <i class="fas fa-times"></i> 一括却下
            </button>
        `;
        
        filtersDiv.appendChild(bulkActionsDiv);
        approvalsSectionContent.appendChild(filtersDiv);
        
        // Check if there are any pending shifts
        if (pendingShifts.length === 0) {
            // Empty state
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state fade-in';
            emptyState.innerHTML = `
                <i class="fas fa-clipboard-check"></i>
                <h3>承認待ちのシフトはありません</h3>
                <p>現在、承認が必要なシフトはありません。</p>
            `;
            approvalsSectionContent.appendChild(emptyState);
        } else {
            // Sort shifts by date and time
            const sortedShifts = [...pendingShifts].sort((a, b) => {
                if (a.date !== b.date) {
                    return a.date.localeCompare(b.date);
                }
                return a.startTime.localeCompare(b.startTime);
            });
            
            // Create card grid for approvals
            const approvalsGrid = document.createElement('div');
            approvalsGrid.className = 'approvals-grid';
            
            // Add shift cards
            sortedShifts.forEach(shift => {
                // Format date for display (YYYY-MM-DD → YYYY年MM月DD日)
                const displayDate = shift.date.split('-').join('年', '月') + '日';
                
                // Get user color using our helper method for consistency
                const userColorClass = this.getUserColorClass(shift.username);
                
                const card = document.createElement('div');
                card.className = `approval-card pending fade-in ${userColorClass}`;
                card.dataset.shiftId = shift.id;
                card.dataset.department = shift.department || '';
                card.dataset.date = shift.date;
                card.dataset.username = shift.username;
                
                // Add checkbox for bulk selection (initially hidden)
                const checkbox = document.createElement('div');
                checkbox.className = 'approval-checkbox';
                checkbox.innerHTML = `<input type="checkbox" name="shift-select" value="${shift.id}">`;
                card.appendChild(checkbox);
                
                // Card content
                card.innerHTML += `
                    <div class="card-header">
                        <span>${displayDate}</span>
                        <span class="status pending"><i class="fas fa-clock"></i> 承認待ち</span>
                    </div>
                    <div class="card-body">
                        <div class="approval-info">
                            <div class="info-item">
                                <span class="info-label">時間</span>
                                <span class="info-value">${shift.startTime} - ${shift.endTime}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">ユーザー</span>
                                <span class="info-value">${shift.username}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">部署</span>
                                <span class="info-value">${shift.department || '未設定'}</span>
                            </div>
                            ${shift.notes ? `
                                <div class="notes-preview">
                                    ${shift.notes}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn-approve" onclick="ShiftApp.approveShift('${shift.id}')">
                            <i class="fas fa-check"></i> 承認
                        </button>
                        <button class="btn-reject" onclick="ShiftApp.rejectShift('${shift.id}')">
                            <i class="fas fa-times"></i> 却下
                        </button>
                    </div>
                `;
                
                approvalsGrid.appendChild(card);
            });
            
            approvalsSectionContent.appendChild(approvalsGrid);
        }
        
        // Update container with new content
        container.innerHTML = '';
        container.appendChild(approvalsSectionContent);
        
        // Initialize date filters with current month range
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const fromDateInput = document.getElementById('approvals-date-from');
        const toDateInput = document.getElementById('approvals-date-to');
        
        if (fromDateInput) fromDateInput.value = this.formatDate(firstDay);
        if (toDateInput) toDateInput.value = this.formatDate(lastDay);
        
        // Set up event listeners for filtering
        const departmentFilter = document.getElementById('approvals-department');
        if (departmentFilter) {
            departmentFilter.addEventListener('change', () => this.filterApprovalsList());
        }
        
        if (fromDateInput) {
            fromDateInput.addEventListener('change', () => this.filterApprovalsList());
        }
        
        if (toDateInput) {
            toDateInput.addEventListener('change', () => this.filterApprovalsList());
        }
        
        // Set up bulk selection toggle
        const bulkSelectToggle = document.getElementById('bulk-select-toggle');
        if (bulkSelectToggle) {
            bulkSelectToggle.addEventListener('click', () => {
                this.toggleBulkSelect();
            });
        }
        
        // Set up bulk action buttons
        const bulkApproveBtn = document.getElementById('bulk-approve');
        if (bulkApproveBtn) {
            bulkApproveBtn.addEventListener('click', () => this.bulkApprove());
        }
        
        const bulkRejectBtn = document.getElementById('bulk-reject');
        if (bulkRejectBtn) {
            bulkRejectBtn.addEventListener('click', () => this.bulkReject());
        }
        
        // Listen for scroll to make the filters sticky
        window.addEventListener('scroll', () => {
            const filtersElement = document.querySelector('.approvals-filters');
            if (filtersElement) {
                const rect = filtersElement.getBoundingClientRect();
                if (rect.top <= 0) {
                    filtersElement.classList.add('sticky');
                } else {
                    filtersElement.classList.remove('sticky');
                }
            }
        });
    },
    
    // Filter approvals list based on filters
    filterApprovalsList: function() {
        const departmentFilter = document.getElementById('approvals-department');
        const dateFromFilter = document.getElementById('approvals-date-from');
        const dateToFilter = document.getElementById('approvals-date-to');
        
        if (!departmentFilter || !dateFromFilter || !dateToFilter) return;
        
        const department = departmentFilter.value;
        const dateFrom = dateFromFilter.value;
        const dateTo = dateToFilter.value;
        
        // Get all cards in the approvals grid
        const cards = document.querySelectorAll('.approval-card');
        
        cards.forEach(card => {
            let visible = true;
            
            // Filter by department
            if (department && card.dataset.department !== department) {
                visible = false;
            }
            
            // Filter by date range
            if (visible && dateFrom && dateTo) {
                const shiftDate = card.dataset.date;
                if (shiftDate < dateFrom || shiftDate > dateTo) {
                    visible = false;
                }
            }
            
            // Apply animation for smooth filtering experience
            if (visible) {
                card.style.display = '';
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 10);
            } else {
                card.style.opacity = '0';
                card.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            }
        });
    },
    
    // Toggle bulk selection mode
    toggleBulkSelect: function() {
        // Find the bulk select toggle button
        const bulkSelectToggle = document.getElementById('bulk-select-toggle');
        if (!bulkSelectToggle) return;
        
        // Toggle active class on button
        bulkSelectToggle.classList.toggle('active');
        
        // Get bulk actions container and card checkboxes
        const bulkActionsDiv = document.querySelector('.bulk-actions');
        const approvalCheckboxes = document.querySelectorAll('.approval-checkbox');
        const approvalsGrid = document.querySelector('.approvals-grid');
        
        if (bulkSelectToggle.classList.contains('active')) {
            // Entering bulk selection mode
            if (bulkActionsDiv) bulkActionsDiv.style.display = 'flex';
            
            // Show checkboxes
            approvalCheckboxes.forEach(checkbox => {
                checkbox.style.display = 'block';
            });
            
            // Add bulk selection class to grid for styling
            if (approvalsGrid) approvalsGrid.classList.add('bulk-selection-active');
            
            // Update button text
            bulkSelectToggle.innerHTML = '<i class="fas fa-times-circle"></i> 選択解除';
        } else {
            // Exiting bulk selection mode
            if (bulkActionsDiv) bulkActionsDiv.style.display = 'none';
            
            // Hide checkboxes
            approvalCheckboxes.forEach(checkbox => {
                checkbox.style.display = 'none';
                // Uncheck all checkboxes
                const input = checkbox.querySelector('input[type="checkbox"]');
                if (input) input.checked = false;
            });
            
            // Remove bulk selection class from grid
            if (approvalsGrid) approvalsGrid.classList.remove('bulk-selection-active');
            
            // Reset button text
            bulkSelectToggle.innerHTML = '<i class="fas fa-check-square"></i> 一括操作';
        }
    },
    
    // Toggle select all shifts
    toggleSelectAllShifts: function() {
        const selectAll = document.getElementById('select-all-shifts');
        if (!selectAll) return;
        
        const checkboxes = document.querySelectorAll('.shift-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
        });
    },
    
    // Bulk approve selected shifts
    bulkApprove: function() {
        const selectedShiftIds = this.getSelectedShiftIds();
        if (selectedShiftIds.length === 0) {
            alert('シフトを選択してください');
            return;
        }
        
        // Create array of promises for each approval
        const approvalPromises = selectedShiftIds.map(shiftId => {
            return this.fetchAPI(`/shifts/${shiftId}/approve`, { method: 'PUT' });
        });
        
        // Execute all approvals and handle results
        Promise.all(approvalPromises)
            .then(results => {
                console.log('Bulk approval completed:', results);
                
                // Update shifts in memory
                selectedShiftIds.forEach(shiftId => {
                    const shiftIndex = this.shifts.findIndex(s => s.id.toString() === shiftId.toString());
                    if (shiftIndex !== -1) {
                        this.shifts[shiftIndex].status = 'approved';
                    }
                });
                
                // Show success message
                alert('選択したシフトが承認されました');
                
                // Refresh approvals list
                this.renderApprovalsList();
            })
            .catch(error => {
                console.error('Bulk approval error:', error);
                alert('一括承認中にエラーが発生しました: ' + error.message);
            });
    },
    
    // Bulk reject selected shifts
    bulkReject: function() {
        const selectedShiftIds = this.getSelectedShiftIds();
        if (selectedShiftIds.length === 0) {
            alert('シフトを選択してください');
            return;
        }
        
        // Create array of promises for each rejection
        const rejectionPromises = selectedShiftIds.map(shiftId => {
            return this.fetchAPI(`/shifts/${shiftId}/reject`, { method: 'PUT' });
        });
        
        // Execute all rejections and handle results
        Promise.all(rejectionPromises)
            .then(results => {
                console.log('Bulk rejection completed:', results);
                
                // Update shifts in memory
                selectedShiftIds.forEach(shiftId => {
                    const shiftIndex = this.shifts.findIndex(s => s.id.toString() === shiftId.toString());
                    if (shiftIndex !== -1) {
                        this.shifts[shiftIndex].status = 'rejected';
                    }
                });
                
                // Show success message
                alert('選択したシフトが却下されました');
                
                // Refresh approvals list
                this.renderApprovalsList();
            })
            .catch(error => {
                console.error('Bulk rejection error:', error);
                alert('一括却下中にエラーが発生しました: ' + error.message);
            });
    },
    
    // Get selected shift IDs
    getSelectedShiftIds: function() {
        // For the new card-based layout, get checked checkboxes from approval cards
        const checkboxes = document.querySelectorAll('.approval-checkbox input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(checkbox => checkbox.value);
    },
    
    // Render notifications list
    renderNotificationsList: function() {
        if (!this.currentUser) return;
        
        console.log('Rendering notifications list...');
        
        // Get container element
        const container = document.getElementById('notifications-list');
        if (!container) {
            console.error('Notifications list container not found');
            return;
        }
        
        // Sort notifications by date (newest first)
        const sortedNotifications = this.notifications ? 
            [...this.notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : 
            [];
        
        // Create notifications header with mark all read button
        const header = document.createElement('div');
        header.className = 'notifications-header';
        
        if (sortedNotifications.length > 0) {
            const markAllBtn = document.createElement('button');
            markAllBtn.id = 'mark-all-read';
            markAllBtn.innerHTML = 'すべて既読にする';
            markAllBtn.addEventListener('click', () => this.markAllNotificationsAsRead());
            header.appendChild(markAllBtn);
        }
        
        // Create notifications list
        let listHTML = '<ul class="notifications-list">';
        
        if (sortedNotifications.length === 0) {
            listHTML += '<li class="no-notifications">通知はありません</li>';
        } else {
            sortedNotifications.forEach(notification => {
                // Format date for display
                const createdDate = new Date(notification.createdAt);
                const formattedDate = `${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}`;
                
                // Choose icon based on notification type
                let icon = 'fa-bell';
                if (notification.type.includes('approval')) {
                    icon = 'fa-clipboard-check';
                } else if (notification.type.includes('approved')) {
                    icon = 'fa-check-circle';
                } else if (notification.type.includes('rejected')) {
                    icon = 'fa-times-circle';
                } else if (notification.type.includes('deleted')) {
                    icon = 'fa-trash-alt';
                }
                
                // Create list item with read/unread styling
                listHTML += `
                    <li class="${notification.isRead ? 'read' : 'unread'}">
                        <div class="notification-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="notification-content">
                            <div class="notification-message">${notification.message}</div>
                            <div class="notification-date">${formattedDate}</div>
                        </div>
                        ${!notification.isRead ? 
                            `<button class="read-btn" onclick="ShiftApp.markNotificationAsRead('${notification.id}')">既読</button>` : 
                            ''}
                    </li>
                `;
            });
        }
        
        listHTML += '</ul>';
        
        // Update container
        container.innerHTML = '';
        container.appendChild(header);
        container.insertAdjacentHTML('beforeend', listHTML);
    },
    
    // Mark notification as read
    markNotificationAsRead: function(notificationId) {
        if (!this.currentUser) return;
        
        console.log('Marking notification as read:', notificationId);
        
        this.fetchAPI(`/notifications/${notificationId}/read`, { method: 'PUT' })
            .then(() => {
                // Update notification in memory
                const index = this.notifications.findIndex(n => n.id.toString() === notificationId.toString());
                if (index !== -1) {
                    this.notifications[index].isRead = true;
                }
                
                // Update UI
                this.renderNotificationsList();
                this.checkNotifications();
            })
            .catch(error => {
                console.error('Error marking notification as read:', error);
                alert('通知の既読化に失敗しました');
            });
    },
    
    // Mark all notifications as read
    markAllNotificationsAsRead: function() {
        if (!this.currentUser) return;
        
        console.log('Marking all notifications as read');
        
        this.fetchAPI('/notifications/read-all', { method: 'PUT' })
            .then(() => {
                // Update notifications in memory
                this.notifications.forEach(notification => {
                    notification.isRead = true;
                });
                
                // Update UI
                this.renderNotificationsList();
                this.checkNotifications();
                
                // Show success message
                alert('すべての通知を既読にしました');
            })
            .catch(error => {
                console.error('Error marking all notifications as read:', error);
                alert('通知の一括既読化に失敗しました');
            });
    },
    
    // Approve a shift
    approveShift: function(shiftId) {
        if (!this.currentUser || this.currentUser.role !== 'manager') {
            alert('シフトを承認する権限がありません');
            return;
        }
        
        console.log('Approving shift:', shiftId);
        
        this.fetchAPI(`/shifts/${shiftId}/approve`, { method: 'PUT' })
            .then(response => {
                console.log('Shift approved successfully:', response);
                
                // Update shift in memory
                const shiftIndex = this.shifts.findIndex(s => s.id.toString() === shiftId.toString());
                if (shiftIndex !== -1) {
                    this.shifts[shiftIndex].status = 'approved';
                }
                
                // Show success message
                alert('シフトが承認されました');
                
                // Refresh approvals list
                this.renderApprovalsList();
            })
            .catch(error => {
                console.error('Error approving shift:', error);
                alert('シフト承認に失敗しました: ' + error.message);
            });
    },
    
    // Reject a shift
    rejectShift: function(shiftId) {
        if (!this.currentUser || this.currentUser.role !== 'manager') {
            alert('シフトを却下する権限がありません');
            return;
        }
        
        console.log('Rejecting shift:', shiftId);
        
        this.fetchAPI(`/shifts/${shiftId}/reject`, { method: 'PUT' })
            .then(response => {
                console.log('Shift rejected successfully:', response);
                
                // Update shift in memory
                const shiftIndex = this.shifts.findIndex(s => s.id.toString() === shiftId.toString());
                if (shiftIndex !== -1) {
                    this.shifts[shiftIndex].status = 'rejected';
                }
                
                // Show success message
                alert('シフトが却下されました');
                
                // Refresh approvals list
                this.renderApprovalsList();
            })
            .catch(error => {
                console.error('Error rejecting shift:', error);
                alert('シフト却下に失敗しました: ' + error.message);
            });
    },
    
    // Setup reports section
    setupReportsSection: function() {
        if (!this.currentUser) return;
        
        console.log('Setting up reports section...');
        
        // Setup search form event listener
        const searchForm = document.getElementById('search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performSearch();
            });
        }
        
        // Initialize the reports section with statistics
        this.renderReportStatistics();
    },
    
    // Render report statistics
    renderReportStatistics: function() {
        if (!this.shifts || this.shifts.length === 0) return;
        
        const container = document.querySelector('#reports-section .export-section');
        if (!container) return;
        
        // Get current month's data
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const monthStart = this.formatDate(new Date(currentYear, currentMonth, 1));
        const monthEnd = this.formatDate(new Date(currentYear, currentMonth + 1, 0));
        
        // Filter shifts for current month
        const currentMonthShifts = this.shifts.filter(shift => 
            shift.date >= monthStart && shift.date <= monthEnd
        );
        
        // Count by status
        const approvedCount = currentMonthShifts.filter(s => s.status === 'approved').length;
        const pendingCount = currentMonthShifts.filter(s => s.status === 'pending').length;
        const rejectedCount = currentMonthShifts.filter(s => s.status === 'rejected').length;
        
        // Count by department if manager
        let departmentStats = '';
        if (this.currentUser.role === 'manager') {
            // Count shifts by department
            const deptCounts = {};
            currentMonthShifts.forEach(shift => {
                const dept = shift.department || '未所属';
                deptCounts[dept] = (deptCounts[dept] || 0) + 1;
            });
            
            // Generate department stats HTML
            departmentStats = '<div class="stats-section"><h4>部署別シフト数</h4><ul>';
            for (const dept in deptCounts) {
                departmentStats += `<li>${dept}: ${deptCounts[dept]}件</li>`;
            }
            departmentStats += '</ul></div>';
        }
        
        // Generate stats HTML
        const statsHTML = `
            <div class="stats-panel">
                <h3>今月のシフト統計</h3>
                <div class="stats-grid">
                    <div class="stats-card">
                        <div class="stats-number">${currentMonthShifts.length}</div>
                        <div class="stats-label">総シフト数</div>
                    </div>
                    <div class="stats-card approved">
                        <div class="stats-number">${approvedCount}</div>
                        <div class="stats-label">承認済み</div>
                    </div>
                    <div class="stats-card pending">
                        <div class="stats-number">${pendingCount}</div>
                        <div class="stats-label">承認待ち</div>
                    </div>
                    <div class="stats-card rejected">
                        <div class="stats-number">${rejectedCount}</div>
                        <div class="stats-label">却下</div>
                    </div>
                </div>
                ${departmentStats}
            </div>
        `;
        
        // Insert statistics at the top of the container
        container.insertAdjacentHTML('afterbegin', statsHTML);
    },
    
    // Perform search
    performSearch: function() {
        const searchType = document.getElementById('search-type').value;
        const searchTerm = document.getElementById('search-term').value;
        
        if (!searchTerm) {
            alert('検索語を入力してください');
            return;
        }
        
        console.log(`Performing search: type=${searchType}, term=${searchTerm}`);
        
        // API request
        this.fetchAPI(`/search?type=${searchType}&term=${encodeURIComponent(searchTerm)}`)
            .then(results => {
                // Cache results and render
                this.searchResults = results;
                this.renderSearchResults();
            })
            .catch(error => {
                console.error('Search error:', error);
                alert('検索に失敗しました: ' + error.message);
            });
    },
    
    // Render search results
    renderSearchResults: function() {
        const container = document.getElementById('search-results');
        if (!container) return;
        
        if (!this.searchResults || this.searchResults.length === 0) {
            container.innerHTML = '<p>検索結果はありません</p>';
            return;
        }
        
        // Sort results by date and time
        const sortedResults = [...this.searchResults].sort((a, b) => {
            if (a.date !== b.date) {
                return a.date.localeCompare(b.date);
            }
            return a.startTime.localeCompare(b.startTime);
        });
        
        // Create table for results
        let html = `
            <h3>検索結果 (${sortedResults.length}件)</h3>
            <table class="search-results-table">
                <thead>
                    <tr>
                        <th>日付</th>
                        <th>時間</th>
                        <th>ユーザー</th>
                        <th>部署</th>
                        <th>状態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Add rows for each shift
        sortedResults.forEach(shift => {
            // Get status text
            const statusText = this.getStatusText(shift.status);
            
            // Format date (YYYY-MM-DD → YYYY/MM/DD)
            const formattedDate = shift.date.replace(/-/g, '/');
            
            html += `
                <tr class="${shift.status}">
                    <td>${formattedDate}</td>
                    <td>${shift.startTime} - ${shift.endTime}</td>
                    <td>${shift.username}</td>
                    <td>${shift.department || '-'}</td>
                    <td><span class="status-${shift.status}">${statusText}</span></td>
                    <td>
                        <button onclick="ShiftApp.showShiftDetails('${shift.id}')">
                            詳細
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
            <div class="export-buttons">
                <button onclick="ShiftApp.exportSearchResults('csv')">CSV出力</button>
                <button onclick="ShiftApp.exportSearchResults('pdf')">PDF出力</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Show shift details section if it exists (for results)
        const shiftDetailsSection = document.getElementById('shift-details');
        if (shiftDetailsSection) {
            shiftDetailsSection.style.display = 'none';
            shiftDetailsSection.classList.remove('active');
        }
    },
    
    // Export search results
    exportSearchResults: function(format) {
        if (!this.searchResults || !this.searchResults.length) {
            alert('出力するデータがありません');
            return;
        }
        
        // Confirm export
        if (!confirm(`検索結果を${format.toUpperCase()}形式でエクスポートしますか？`)) {
            return;
        }
        
        // Redirect to export API endpoint
        const endpoint = format === 'csv' ? '/export/csv' : '/export/pdf';
        
        // Use window.open to trigger download
        window.open(`${API_BASE_URL}${endpoint}`, '_blank');
    }
};

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    ShiftApp.init();
});
