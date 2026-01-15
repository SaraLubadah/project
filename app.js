document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let tasks = [];
    const STORAGE_KEY = 'student_checklist_tasks';

    // --- DOM Elements ---
    const taskForm = document.getElementById('task-form');
    const subjectInput = document.getElementById('subject');
    const descInput = document.getElementById('description');
    const dueDateInput = document.getElementById('dueDate');
    const priorityInput = document.getElementById('priority');
    const tasksContainer = document.getElementById('tasks-container');
    const reminderSection = document.getElementById('reminder-section');
    const clearCompletedBtn = document.getElementById('clear-completed');

    // --- Initialization ---
    init();

    function init() {
        loadTasks();
        renderTasks();
        checkReminders();
        
        // Set default date to today
        dueDateInput.valueAsDate = new Date();
    }

    // --- Event Listeners ---
    taskForm.addEventListener('submit', handleAddTask);
    clearCompletedBtn.addEventListener('click', handleClearCompleted);

    // --- Core Functions ---

    function loadTasks() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                tasks = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse tasks', e);
                tasks = [];
            }
        }
    }

    function saveTasks() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        checkReminders(); // Re-check reminders on update
    }

    function handleAddTask(e) {
        e.preventDefault();

        const newTask = {
            id: Date.now().toString(),
            subject: subjectInput.value.trim(),
            description: descInput.value.trim(),
            dueDate: dueDateInput.value,
            priority: priorityInput.value,
            completed: false,
            createdAt: new Date().toISOString()
        };

        tasks.push(newTask);
        saveTasks();
        renderTasks();
        
        // Reset form but keep subject for convenience (often add multiple tasks for same subject)
        const currentSubject = subjectInput.value;
        taskForm.reset();
        subjectInput.value = currentSubject;
        dueDateInput.valueAsDate = new Date();
        priorityInput.value = 'Medium';
    }

    function toggleTaskComplete(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        }
    }

    function deleteTask(id) {
        if(confirm('Are you sure you want to delete this task?')) {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderTasks();
        }
    }

    function handleClearCompleted() {
        if(confirm('Remove all completed tasks?')) {
            tasks = tasks.filter(t => !t.completed);
            saveTasks();
            renderTasks();
        }
    }

    // --- Rendering Logic ---

    function renderTasks() {
        tasksContainer.innerHTML = '';

        if (tasks.length === 0) {
            tasksContainer.innerHTML = `
                <div class="empty-state">
                    <p>No tasks yet. Add one above to get started!</p>
                </div>`;
            return;
        }

        // Group by Subject
        const grouped = tasks.reduce((acc, task) => {
            acc[task.subject] = acc[task.subject] || [];
            acc[task.subject].push(task);
            return acc;
        }, {});

        // Sort subjects alphabetically
        const sortedSubjects = Object.keys(grouped).sort();

        sortedSubjects.forEach(subject => {
            const subjectGroup = document.createElement('div');
            subjectGroup.className = 'subject-group';
            
            // Sort tasks: Due date asc, then Priority (High > Med > Low)
            const sortedTasks = grouped[subject].sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? 1 : -1; // Completed last
                
                const dateA = new Date(a.dueDate);
                const dateB = new Date(b.dueDate);
                if (dateA - dateB !== 0) return dateA - dateB;

                const priorityMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
                return priorityMap[b.priority] - priorityMap[a.priority];
            });

            const taskListHtml = sortedTasks.map(task => createTaskCardHtml(task)).join('');

            subjectGroup.innerHTML = `
                <div class="subject-header">
                    <h3>${escapeHtml(subject)}</h3>
                    <span style="font-size:0.8rem; opacity:0.7">(${sortedTasks.length})</span>
                </div>
                <div class="task-list">
                    ${taskListHtml}
                </div>
            `;

            tasksContainer.appendChild(subjectGroup);
        });

        // Re-attach event listeners for dynamic elements
        attachTaskListeners();
    }

    function createTaskCardHtml(task) {
        const isOverdue = isTaskOverdue(task.dueDate) && !task.completed;
        const formattedDate = new Date(task.dueDate).toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric'
        });

        return `
            <div class="task-card ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="checkbox-wrapper" role="button" aria-label="Toggle completion">
                    <div class="custom-checkbox"></div>
                </div>
                <div class="task-content">
                    <div class="task-desc">${escapeHtml(task.description)}</div>
                    <div class="task-meta">
                        <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
                        <div class="due-date ${isOverdue ? 'overdue' : ''}">
                            <span>📅 ${formattedDate}</span>
                            ${isOverdue ? '<span>(Overdue)</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="icon-btn delete" aria-label="Delete task">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }

    function attachTaskListeners() {
        document.querySelectorAll('.task-card').forEach(card => {
            const id = card.dataset.id;
            
            // Toggle completion on checkbox or text click (excluding specific buttons)
            card.querySelector('.checkbox-wrapper').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleTaskComplete(id);
            });
            
            card.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTask(id);
            });
        });
    }

    // --- Reminders System ---

    function checkReminders() {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const overdueTasks = tasks.filter(t => !t.completed && t.dueDate < todayStr);
        const dueTodayTasks = tasks.filter(t => !t.completed && t.dueDate === todayStr);

        reminderSection.innerHTML = '';
        reminderSection.classList.remove('hidden');

        if (overdueTasks.length > 0) {
            const banner = document.createElement('div');
            banner.className = 'reminder-banner';
            banner.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>You have <strong>${overdueTasks.length} overdue</strong> task(s)! Catch up now!</span>
            `;
            reminderSection.appendChild(banner);
        }

        if (dueTodayTasks.length > 0) {
            const banner = document.createElement('div');
            banner.className = 'reminder-banner info'; // Different style for 'info'
            banner.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span><strong>${dueTodayTasks.length} task(s)</strong> due today. Stay focused!</span>
            `;
            reminderSection.appendChild(banner);
        }

        if (overdueTasks.length === 0 && dueTodayTasks.length === 0) {
            reminderSection.classList.add('hidden');
        }
    }

    // --- Utilities ---
    
    function isTaskOverdue(dateStr) {
        const today = new Date().toISOString().split('T')[0];
        return dateStr < today;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
