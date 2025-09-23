// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyGGq5q-1zu61MqYxUNuYhZQRmkNDaeZeAI",
    authDomain: "acme-new-business-development.firebaseapp.com",
    databaseURL: "https://acme-new-business-development-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "acme-new-business-development",
    storageBucket: "acme-new-business-development.firebasestorage.app",
    messagingSenderId: "985026370170",
    appId: "1:985026370170:web:e5db330f3e57cd163839c3",
    measurementId: "G-5HCMRHd34Q8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Configuration
const CONFIG = {
    VERSION: '2.1.0',
    AUTO_SAVE_INTERVAL: 30000,
    DEFAULT_PROJECT_NAME: 'New Project',
    DEFAULT_START_DATE: '2025-01-01',
    DEFAULT_END_DATE: '2025-12-31',
    STORAGE_KEY: 'projectTimelineData'
};

// Sync Configuration
let SYNC_ENABLED = false;
let ROOM_ID = null;
let isLocalUpdate = false;

// State management
let projects = [];
let selectedProjectIds = new Set();
let currentEditingTask = null;
let viewMode = 'month';
let zoomLevel = 100;
let filterPhase = 'all';

const projectColors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#ff6b6b', '#ffd93d', '#6bcf7f', '#a78bfa', '#f59e0b'
];

// Firebase Sync Functions
function getRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    
    if (!roomId) {
        roomId = 'room_' + Math.random().toString(36).substr(2, 9);
        window.history.replaceState({}, '', `?room=${roomId}`);
    }
    
    return roomId;
}

function enableSync() {
    ROOM_ID = getRoomId();
    SYNC_ENABLED = true;
    
    // Update UI
    document.getElementById('syncStatus').textContent = 'Sync Mode ON';
    document.getElementById('syncStatus').className = 'sync-status online';
    document.getElementById('syncButton').textContent = '🔄 Sync Mode: ON';
    document.getElementById('syncButton').style.background = '#4CAF50';
    document.getElementById('shareButton').style.display = 'inline-block';
    document.getElementById('roomInfo').className = 'room-info active';
    document.getElementById('roomId').textContent = ROOM_ID;
    
    // Listen for changes from Firebase
    database.ref(`rooms/${ROOM_ID}/projects`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && !isLocalUpdate) {
            projects = data;
            renderProjectList();
            renderTimeline();
        }
    });
    
    database.ref(`rooms/${ROOM_ID}/selectedProjects`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && !isLocalUpdate) {
            selectedProjectIds = new Set(data);
            renderProjectList();
            renderTimeline();
        }
    });
    
    database.ref(`rooms/${ROOM_ID}/viewSettings`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && !isLocalUpdate) {
            viewMode = data.viewMode || 'month';
            zoomLevel = data.zoomLevel || 100;
            filterPhase = data.filterPhase || 'all';
            updateViewSettings();
        }
    });
    
    // Set presence
    const presenceRef = database.ref(`rooms/${ROOM_ID}/presence/${Date.now()}`);
    presenceRef.set(true);
    presenceRef.onDisconnect().remove();
    
    showNotification('🔄 Sync Mode Enabled - Room: ' + ROOM_ID);
}

function saveToFirebase() {
    if (!SYNC_ENABLED || !ROOM_ID) return;
    
    isLocalUpdate = true;
    
    const updates = {};
    updates[`rooms/${ROOM_ID}/projects`] = projects;
    updates[`rooms/${ROOM_ID}/selectedProjects`] = Array.from(selectedProjectIds);
    updates[`rooms/${ROOM_ID}/lastUpdate`] = new Date().toISOString();
    updates[`rooms/${ROOM_ID}/viewSettings`] = {
        viewMode: viewMode,
        zoomLevel: zoomLevel,
        filterPhase: filterPhase
    };
    
    database.ref().update(updates).then(() => {
        setTimeout(() => { isLocalUpdate = false; }, 100);
    });
}

function toggleSyncMode() {
    if (!SYNC_ENABLED) {
        enableSync();
        saveToFirebase();
    } else {
        if (confirm('Disable Sync Mode? (Data will remain in the room)')) {
            SYNC_ENABLED = false;
            if (ROOM_ID) {
                database.ref(`rooms/${ROOM_ID}`).off();
            }
            document.getElementById('syncStatus').textContent = 'Offline Mode';
            document.getElementById('syncStatus').className = 'sync-status offline';
            document.getElementById('syncButton').textContent = '🔄 Enable Sync Mode';
            document.getElementById('syncButton').style.background = '#ff9800';
            document.getElementById('shareButton').style.display = 'none';
            document.getElementById('roomInfo').className = 'room-info';
            showNotification('Sync Mode: OFF');
        }
    }
}

function shareLink() {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
        showNotification('📋 Link copied! Share with others to collaborate');
    });
}

function leaveRoom() {
    if (confirm('Leave this room and work offline?')) {
        window.location.href = window.location.pathname;
    }
}

// Check if joining existing room
function checkForExistingRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('room')) {
        // Auto-enable sync if room parameter exists
        setTimeout(() => {
            enableSync();
        }, 1000);
    }
}

// Initialize application
function initializeProjects() {
    // Try to load from localStorage first
    const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            if (data.projects && data.projects.length > 0) {
                projects = data.projects;
                if (data.selectedProjectIds) {
                    selectedProjectIds = new Set(data.selectedProjectIds);
                }
                if (data.viewSettings) {
                    viewMode = data.viewSettings.viewMode || 'month';
                    zoomLevel = data.viewSettings.zoomLevel || 100;
                    filterPhase = data.viewSettings.filterPhase || 'all';
                    updateViewSettings();
                }
            }
        } catch (e) {
            console.error('Failed to load saved data:', e);
        }
    }
    
    // Create default project if none exist
    if (projects.length === 0) {
        projects.push({
            id: Date.now(),
            name: CONFIG.DEFAULT_PROJECT_NAME,
            startDate: CONFIG.DEFAULT_START_DATE,
            endDate: CONFIG.DEFAULT_END_DATE,
            color: projectColors[0],
            tasks: []
        });
        selectedProjectIds.add(projects[0].id);
    }
    
    renderProjectList();
    renderTimeline();
    checkForExistingRoom();
}

function updateViewSettings() {
    document.getElementById('zoomLevel').textContent = zoomLevel + '%';
    document.getElementById('phaseFilter').value = filterPhase;
    document.getElementById('monthView').classList.toggle('active', viewMode === 'month');
    document.getElementById('weekView').classList.toggle('active', viewMode === 'week');
}

function renderProjectList() {
    const projectList = document.getElementById('projectList');
    projectList.innerHTML = '';
    
    projects.forEach((project, index) => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        if (selectedProjectIds.has(project.id)) {
            projectItem.classList.add('selected');
        }
        
        projectItem.innerHTML = `
            <input type="checkbox" 
                   class="project-checkbox" 
                   id="project-${project.id}"
                   ${selectedProjectIds.has(project.id) ? 'checked' : ''}
                   onchange="toggleProject(${project.id})">
            <div class="project-color" style="background: ${project.color}"></div>
            <label for="project-${project.id}" style="cursor: pointer; flex: 1;">
                ${project.name}
                <span style="font-size: 12px; color: #666;">(${project.tasks.length} tasks)</span>
            </label>
            <button onclick="editProjectName(${index})" style="padding: 5px 10px; font-size: 12px;">✏️</button>
            ${projects.length > 1 ? `<button onclick="deleteProject(${index})" style="padding: 5px 10px; font-size: 12px; background: #ff4444;">🗑️</button>` : ''}
        `;
        
        projectList.appendChild(projectItem);
    });
    
    updateProjectSelect();
}

function toggleProject(projectId) {
    if (selectedProjectIds.has(projectId)) {
        selectedProjectIds.delete(projectId);
    } else {
        selectedProjectIds.add(projectId);
    }
    renderProjectList();
    renderTimeline();
    updateStats();
    autoSaveToLocalStorage();
    saveToFirebase();
}

function selectAllProjects() {
    projects.forEach(project => selectedProjectIds.add(project.id));
    renderProjectList();
    renderTimeline();
    updateStats();
    saveToFirebase();
}

function deselectAllProjects() {
    selectedProjectIds.clear();
    renderProjectList();
    renderTimeline();
    updateStats();
    saveToFirebase();
}

function setViewMode(mode) {
    viewMode = mode;
    document.getElementById('monthView').classList.toggle('active', mode === 'month');
    document.getElementById('weekView').classList.toggle('active', mode === 'week');
    renderTimeline();
    autoSaveToLocalStorage();
    saveToFirebase();
}

function zoomIn() {
    if (zoomLevel < 200) {
        zoomLevel += 25;
        document.getElementById('zoomLevel').textContent = zoomLevel + '%';
        renderTimeline();
        saveToFirebase();
    }
}

function zoomOut() {
    if (zoomLevel > 50) {
        zoomLevel -= 25;
        document.getElementById('zoomLevel').textContent = zoomLevel + '%';
        renderTimeline();
        saveToFirebase();
    }
}

function applyFilter() {
    filterPhase = document.getElementById('phaseFilter').value;
    renderTimeline();
    saveToFirebase();
}

function updateProgressValue() {
    const value = document.getElementById('taskProgress').value;
    document.getElementById('progressValue').textContent = value + '%';
}

function addNewProject() {
    const projectName = prompt('Project Name:', `Project ${projects.length + 1}`);
    if (projectName) {
        const newProject = {
            id: Date.now(),
            name: projectName,
            startDate: CONFIG.DEFAULT_START_DATE,
            endDate: CONFIG.DEFAULT_END_DATE,
            color: projectColors[projects.length % projectColors.length],
            tasks: []
        };
        projects.push(newProject);
        selectedProjectIds.add(newProject.id);
        renderProjectList();
        renderTimeline();
        autoSaveToLocalStorage();
        saveToFirebase();
    }
}

function editProjectName(index) {
    const newName = prompt('Edit Project Name:', projects[index].name);
    if (newName) {
        projects[index].name = newName;
        renderProjectList();
        renderTimeline();
        autoSaveToLocalStorage();
        saveToFirebase();
    }
}

function deleteProject(index) {
    if (projects.length <= 1) {
        alert('At least one project must exist');
        return;
    }
    
    if (confirm(`Delete project "${projects[index].name}"?`)) {
        selectedProjectIds.delete(projects[index].id);
        projects.splice(index, 1);
        renderProjectList();
        renderTimeline();
        autoSaveToLocalStorage();
        saveToFirebase();
    }
}

function getDateRange() {
    let minDate = new Date('2100-01-01');
    let maxDate = new Date('2000-01-01');
    
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    if (selectedProjects.length === 0) {
        return { 
            start: new Date(CONFIG.DEFAULT_START_DATE), 
            end: new Date(CONFIG.DEFAULT_END_DATE) 
        };
    }
    
    selectedProjects.forEach(project => {
        project.tasks.forEach(task => {
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            if (taskStart < minDate) minDate = taskStart;
            if (taskEnd > maxDate) maxDate = taskEnd;
        });
    });
    
    if (minDate > maxDate) {
        selectedProjects.forEach(project => {
            const projectStart = new Date(project.startDate);
            const projectEnd = new Date(project.endDate);
            if (projectStart < minDate) minDate = projectStart;
            if (projectEnd > maxDate) maxDate = projectEnd;
        });
    }
    
    return { start: minDate, end: maxDate };
}

function renderCalendarHeader() {
    const header = document.getElementById('calendarHeader');
    header.innerHTML = '';
    
    const { start, end } = getDateRange();
    
    if (viewMode === 'week') {
        let currentDate = new Date(start);
        currentDate.setDate(currentDate.getDate() - currentDate.getDay());
        
        while (currentDate <= end) {
            const weekDiv = document.createElement('div');
            weekDiv.className = 'time-label';
            weekDiv.style.minWidth = (40 * zoomLevel / 100) + 'px';
            
            const weekStart = new Date(currentDate);
            const weekEnd = new Date(currentDate);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            weekDiv.textContent = `W${getWeekNumber(weekStart)}`;
            weekDiv.title = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
            header.appendChild(weekDiv);
            
            currentDate.setDate(currentDate.getDate() + 7);
        }
    } else {
        let currentDate = new Date(start);
        currentDate.setDate(1);
        
        while (currentDate <= end) {
            const monthDiv = document.createElement('div');
            monthDiv.className = 'time-label month';
            monthDiv.style.minWidth = (100 * zoomLevel / 100) + 'px';
            monthDiv.textContent = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            header.appendChild(monthDiv);
            
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    }
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    const { start: rangeStart, end: rangeEnd } = getDateRange();
    const totalDays = Math.floor((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) || 1;
    
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    
    selectedProjects.forEach(project => {
        const projectGroup = document.createElement('div');
        projectGroup.className = 'project-group';
        projectGroup.style.borderLeftColor = project.color;
        
        const projectHeader = document.createElement('div');
        projectHeader.className = 'project-group-header';
        projectHeader.innerHTML = `
            <div class="project-color" style="background: ${project.color}"></div>
            <span>${project.name}</span>
            <span style="font-size: 12px; color: #666;">(${project.tasks.length} tasks)</span>
        `;
        projectGroup.appendChild(projectHeader);
        
        const filteredTasks = filterPhase === 'all' 
            ? project.tasks 
            : project.tasks.filter(task => task.phase === filterPhase);
        
        filteredTasks.forEach(task => {
            const taskRow = document.createElement('div');
            taskRow.className = 'task-row';
            
            const taskName = document.createElement('div');
            taskName.className = 'task-name';
            taskName.innerHTML = `
                <div class="task-info">
                    <div>${task.name}</div>
                    <div class="task-progress-text">Progress: ${task.progress || 0}%</div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="editTask('${project.id}', '${task.id}')">✏️</button>
                    <button class="task-action-btn delete" onclick="deleteTask('${project.id}', '${task.id}')">🗑️</button>
                </div>
            `;
            taskRow.appendChild(taskName);
            
            const taskTimeline = document.createElement('div');
            taskTimeline.className = 'task-timeline';
            
            const gridCount = viewMode === 'week' ? 52 : 12;
            for (let i = 0; i <= gridCount; i++) {
                const gridLine = document.createElement('div');
                gridLine.className = 'grid-line';
                gridLine.style.left = `${(i * 100 / gridCount)}%`;
                taskTimeline.appendChild(gridLine);
            }
            
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            const startOffset = Math.floor((taskStart - rangeStart) / (1000 * 60 * 60 * 24));
            const duration = Math.floor((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;
            
            const taskBarContainer = document.createElement('div');
            taskBarContainer.className = 'task-bar-container';
            taskBarContainer.style.left = `${(startOffset / totalDays) * 100}%`;
            taskBarContainer.style.width = `${(duration / totalDays) * 100 * zoomLevel / 100}%`;
            
            const taskBar = document.createElement('div');
            taskBar.className = `task-bar ${task.phase}`;
            taskBar.style.width = `${task.progress || 0}%`;
            
            const progressLabel = document.createElement('div');
            progressLabel.className = 'task-bar-label';
            progressLabel.textContent = `${task.progress || 0}%`;
            
            const durationLabel = document.createElement('div');
            durationLabel.className = 'task-duration';
            durationLabel.textContent = `${duration} days`;
            
            taskBarContainer.appendChild(taskBar);
            taskBarContainer.appendChild(progressLabel);
            taskBarContainer.appendChild(durationLabel);
            taskBarContainer.title = `${task.name}: ${taskStart.toLocaleDateString()} - ${taskEnd.toLocaleDateString()} (${task.progress || 0}% complete)`;
            
            taskTimeline.appendChild(taskBarContainer);
            
            const today = new Date();
            if (today >= rangeStart && today <= rangeEnd) {
                const todayOffset = Math.floor((today - rangeStart) / (1000 * 60 * 60 * 24));
                const todayLine = document.createElement('div');
                todayLine.className = 'today-line';
                todayLine.style.left = `${(todayOffset / totalDays) * 100}%`;
                
                const todayMarker = document.createElement('div');
                todayMarker.className = 'today-marker';
                todayMarker.style.left = `${(todayOffset / totalDays) * 100}%`;
                todayMarker.textContent = 'Today';
                
                taskTimeline.appendChild(todayLine);
                taskTimeline.appendChild(todayMarker);
            }
            
            taskRow.appendChild(taskTimeline);
            projectGroup.appendChild(taskRow);
        });
        
        if (filteredTasks.length > 0 || filterPhase === 'all') {
            taskList.appendChild(projectGroup);
        }
    });
}

function renderTimeline() {
    renderCalendarHeader();
    renderTasks();
    updateStats();
}

function updateStats() {
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    const today = new Date();
    let totalTaskCount = 0;
    let completed = 0, inProgress = 0, overdue = 0;
    let totalProgress = 0;
    let taskCount = 0;
    
    selectedProjects.forEach(project => {
        project.tasks.forEach(task => {
            totalTaskCount++;
            taskCount++;
            const startDate = new Date(task.startDate);
            const endDate = new Date(task.endDate);
            const progress = task.progress || 0;
            totalProgress += progress;
            
            if (progress === 100) {
                completed++;
            } else if (endDate < today && progress < 100) {
                overdue++;
            } else if (startDate <= today && endDate >= today) {
                inProgress++;
            }
        });
    });
    
    const overallProgress = taskCount > 0 ? Math.round(totalProgress / taskCount) : 0;
    
    document.getElementById('selectedProjects').textContent = selectedProjects.length;
    document.getElementById('totalTasks').textContent = totalTaskCount;
    document.getElementById('overallProgress').textContent = overallProgress + '%';
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('inProgressTasks').textContent = inProgress;
    document.getElementById('overdueTasks').textContent = overdue;
}

function updateProjectSelect() {
    const select = document.getElementById('taskProject');
    select.innerHTML = '';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.appendChild(option);
    });
}

function addTask() {
    currentEditingTask = null;
    document.getElementById('taskForm').style.display = 'block';
    document.getElementById('taskNameInput').value = '';
    
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    document.getElementById('taskStart').value = today.toISOString().split('T')[0];
    document.getElementById('taskEnd').value = nextMonth.toISOString().split('T')[0];
    
    document.getElementById('taskPhase').value = 'phase1';
    document.getElementById('taskProgress').value = 0;
    document.getElementById('progressValue').textContent = '0%';
    updateProjectSelect();
}

function editTask(projectId, taskId) {
    const project = projects.find(p => p.id == projectId);
    const task = project.tasks.find(t => t.id == taskId);
    
    currentEditingTask = { projectId, taskId };
    
    document.getElementById('taskForm').style.display = 'block';
    document.getElementById('taskProject').value = projectId;
    document.getElementById('taskNameInput').value = task.name;
    document.getElementById('taskStart').value = task.startDate;
    document.getElementById('taskEnd').value = task.endDate;
    document.getElementById('taskPhase').value = task.phase;
    document.getElementById('taskProgress').value = task.progress || 0;
    document.getElementById('progressValue').textContent = (task.progress || 0) + '%';
    updateProjectSelect();
}

function deleteTask(projectId, taskId) {
    if (confirm('Delete this task?')) {
        const project = projects.find(p => p.id == projectId);
        project.tasks = project.tasks.filter(t => t.id != taskId);
        renderTimeline();
        autoSaveToLocalStorage();
        saveToFirebase();
    }
}

function saveTask() {
    const projectId = document.getElementById('taskProject').value;
    const task = {
        id: currentEditingTask ? currentEditingTask.taskId : Date.now().toString(),
        name: document.getElementById('taskNameInput').value,
        startDate: document.getElementById('taskStart').value,
        endDate: document.getElementById('taskEnd').value,
        phase: document.getElementById('taskPhase').value,
        progress: parseInt(document.getElementById('taskProgress').value)
    };
    
    if (!task.name || !task.startDate || !task.endDate) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (new Date(task.startDate) > new Date(task.endDate)) {
        alert('End date must be after start date');
        return;
    }
    
    const project = projects.find(p => p.id == projectId);
    
    if (currentEditingTask && currentEditingTask.projectId == projectId) {
        const index = project.tasks.findIndex(t => t.id == currentEditingTask.taskId);
        project.tasks[index] = task;
    } else if (currentEditingTask) {
        const oldProject = projects.find(p => p.id == currentEditingTask.projectId);
        oldProject.tasks = oldProject.tasks.filter(t => t.id != currentEditingTask.taskId);
        project.tasks.push(task);
    } else {
        project.tasks.push(task);
    }
    
    document.getElementById('taskForm').style.display = 'none';
    renderProjectList();
    renderTimeline();
    autoSaveToLocalStorage();
    saveToFirebase();
}

function cancelTask() {
    document.getElementById('taskForm').style.display = 'none';
}

function saveToFile() {
    const data = {
        projects: projects,
        selectedProjectIds: Array.from(selectedProjectIds),
        viewSettings: {
            viewMode: viewMode,
            zoomLevel: zoomLevel,
            filterPhase: filterPhase
        },
        saveDate: new Date().toISOString(),
        version: CONFIG.VERSION
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    a.download = `project_timeline_${dateStr}.json`;
    a.click();
    
    showNotification('✅ Data saved successfully');
}

function quickSave() {
    autoSaveToLocalStorage();
    saveToFile();
}

function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.projects) {
                projects = data.projects;
            }
            
            if (data.selectedProjectIds) {
                selectedProjectIds = new Set(data.selectedProjectIds);
            }
            
            if (data.viewSettings) {
                viewMode = data.viewSettings.viewMode || 'month';
                zoomLevel = data.viewSettings.zoomLevel || 100;
                filterPhase = data.viewSettings.filterPhase || 'all';
                updateViewSettings();
            }
            
            renderProjectList();
            renderTimeline();
            autoSaveToLocalStorage();
            saveToFirebase();
            
            showNotification(`✅ Loaded ${projects.length} project(s) successfully`);
            
        } catch (error) {
            alert('❌ Failed to load file: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: bold;
    `;
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function autoSaveToLocalStorage() {
    const data = {
        projects: projects,
        selectedProjectIds: Array.from(selectedProjectIds),
        viewSettings: {
            viewMode: viewMode,
            zoomLevel: zoomLevel,
            filterPhase: filterPhase
        },
        lastUpdate: new Date().toISOString()
    };
    
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
        updateAutoSaveIndicator();
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

function updateAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    if (indicator) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        indicator.textContent = `Auto-saved: ${timeStr}`;
    }
}

function exportSelectedProjects() {
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    if (selectedProjects.length === 0) {
        alert('Please select projects to export');
        return;
    }
    
    const data = {
        projects: selectedProjects,
        exportDate: new Date().toISOString(),
        version: CONFIG.VERSION
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected_projects_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function exportAllProjects() {
    const data = {
        projects: projects,
        exportDate: new Date().toISOString(),
        version: CONFIG.VERSION
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_projects_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function loadSampleProjects() {
    if (!confirm('Load sample projects? This will replace current data.')) {
        return;
    }
    
    projects = [
        {
            id: 1,
            name: 'Product Development',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            color: '#667eea',
            tasks: [
                {
                    id: '1-1',
                    name: "Market Research",
                    startDate: "2025-01-01",
                    endDate: "2025-02-15",
                    phase: "phase1",
                    progress: 100
                },
                {
                    id: '1-2',
                    name: "Prototype Development",
                    startDate: "2025-02-01",
                    endDate: "2025-04-30",
                    phase: "phase2",
                    progress: 75
                },
                {
                    id: '1-3',
                    name: "Testing & Optimization",
                    startDate: "2025-03-15",
                    endDate: "2025-06-15",
                    phase: "phase3",
                    progress: 45
                },
                {
                    id: '1-4',
                    name: "Production Setup",
                    startDate: "2025-06-01",
                    endDate: "2025-08-31",
                    phase: "phase4",
                    progress: 10
                },
                {
                    id: '1-5',
                    name: "Market Launch",
                    startDate: "2025-09-01",
                    endDate: "2025-10-31",
                    phase: "phase5",
                    progress: 0
                }
            ]
        },
        {
            id: 2,
            name: 'Software Project',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            color: '#f093fb',
            tasks: [
                {
                    id: '2-1',
                    name: "Requirements Analysis",
                    startDate: "2025-01-15",
                    endDate: "2025-02-28",
                    phase: "phase1",
                    progress: 90
                },
                {
                    id: '2-2',
                    name: "UI/UX Design",
                    startDate: "2025-02-01",
                    endDate: "2025-03-15",
                    phase: "phase2",
                    progress: 65
                },
                {
                    id: '2-3',
                    name: "Backend Development",
                    startDate: "2025-03-01",
                    endDate: "2025-05-31",
                    phase: "phase2",
                    progress: 35
                },
                {
                    id: '2-4',
                    name: "QA Testing",
                    startDate: "2025-05-01",
                    endDate: "2025-06-30",
                    phase: "phase3",
                    progress: 10
                },
                {
                    id: '2-5',
                    name: "Deployment",
                    startDate: "2025-07-01",
                    endDate: "2025-07-31",
                    phase: "phase5",
                    progress: 0
                }
            ]
        }
    ];
    
    selectedProjectIds.clear();
    projects.forEach(p => selectedProjectIds.add(p.id));
    renderProjectList();
    renderTimeline();
    autoSaveToLocalStorage();
    showNotification('✅ Sample projects loaded');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        quickSave();
    }
});

// Auto-save periodically
setInterval(() => {
    autoSaveToLocalStorage();
}, CONFIG.AUTO_SAVE_INTERVAL);

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeProjects();
});

// Warn before leaving if there are unsaved changes
window.addEventListener('beforeunload', function(e) {
    autoSaveToLocalStorage();
});
