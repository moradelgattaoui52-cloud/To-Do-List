/**
 * ═══════════════════════════════════════════════════════════════
 * TASKBOARD — script.js
 * Features: Add / Delete / Complete tasks, LocalStorage,
 *           Dark/Light mode, Filters, Drag & Drop, Counter
 * ═══════════════════════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────────────────────
   1. State & Storage helpers
   ───────────────────────────────────────────────────────────── */

/** Load tasks from LocalStorage (returns array of task objects) */
function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem('taskboard_tasks')) || [];
  } catch {
    return [];
  }
}

/** Persist tasks array to LocalStorage */
function saveTasks(tasks) {
  localStorage.setItem('taskboard_tasks', JSON.stringify(tasks));
}

/** Load saved theme preference ('light' | 'dark') */
function loadTheme() {
  return localStorage.getItem('taskboard_theme') || 'light';
}

/** Persist theme preference */
function saveTheme(theme) {
  localStorage.setItem('taskboard_theme', theme);
}

/** Generate a simple unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ─────────────────────────────────────────────────────────────
   2. App Initialisation
   ───────────────────────────────────────────────────────────── */

/** Master tasks array (source of truth) */
let tasks = loadTasks();

/** Active filter: 'all' | 'active' | 'completed' */
let currentFilter = 'all';

/** Drag-and-drop state */
let draggedItem  = null;   // the <li> element being dragged
let draggedIndex = null;   // its index in the tasks array

// DOM references
const taskInput     = document.getElementById('taskInput');
const addBtn        = document.getElementById('addBtn');
const taskList      = document.getElementById('taskList');
const taskCounter   = document.getElementById('taskCounter');
const emptyState    = document.getElementById('emptyState');
const clearBtn      = document.getElementById('clearCompleted');
const themeToggle   = document.getElementById('themeToggle');
const filterTabs    = document.querySelectorAll('.filter-tab');
const dateLine      = document.getElementById('dateLine');

/** Kick everything off */
function init() {
  applyTheme(loadTheme());
  setDateLine();
  renderAll();
  bindEvents();
}

/* ─────────────────────────────────────────────────────────────
   3. Render
   ───────────────────────────────────────────────────────────── */

/** Full re-render: list + counter + empty state */
function renderAll() {
  renderList();
  updateCounter();
}

/** Build the visible task list according to the current filter */
function renderList() {
  // Determine which tasks to show
  const visible = tasks.filter(task => {
    if (currentFilter === 'active')    return !task.completed;
    if (currentFilter === 'completed') return  task.completed;
    return true; // 'all'
  });

  // Clear current list
  taskList.innerHTML = '';

  // Show / hide empty state
  if (visible.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  // Render each visible task
  visible.forEach(task => {
    const li = createTaskElement(task);
    taskList.appendChild(li);
  });
}

/**
 * Create a single <li> task element.
 * @param {Object} task - { id, text, completed }
 * @returns {HTMLLIElement}
 */
function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task-item' + (task.completed ? ' completed' : '');
  li.setAttribute('role', 'listitem');
  li.dataset.id = task.id;
  li.draggable = true;

  // ── Drag handle (decorative dots) ──────────────────────────
  li.innerHTML = `
    <!-- Drag handle -->
    <div class="drag-handle" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>

    <!-- Checkbox (visually custom) -->
    <label class="task-checkbox-wrap" title="${task.completed ? 'Mark as active' : 'Mark as complete'}">
      <input
        type="checkbox"
        class="task-checkbox"
        aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}"
        ${task.completed ? 'checked' : ''}
      />
      <span class="checkbox-visual" aria-hidden="true"></span>
    </label>

    <!-- Task text -->
    <span class="task-text">${escapeHtml(task.text)}</span>

    <!-- Delete button -->
    <button class="btn-delete" aria-label="Delete task: ${escapeHtml(task.text)}" title="Delete">
      ×
    </button>
  `;

  // Checkbox toggle
  const checkbox = li.querySelector('.task-checkbox');
  checkbox.addEventListener('change', () => toggleTask(task.id));

  // Delete
  const deleteBtn = li.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', () => removeTask(li, task.id));

  // Drag events
  li.addEventListener('dragstart', onDragStart);
  li.addEventListener('dragend',   onDragEnd);
  li.addEventListener('dragover',  onDragOver);
  li.addEventListener('dragleave', onDragLeave);
  li.addEventListener('drop',      onDrop);

  return li;
}

/** Update the "N tasks remaining" counter */
function updateCounter() {
  const remaining = tasks.filter(t => !t.completed).length;
  taskCounter.textContent = `${remaining} task${remaining !== 1 ? 's' : ''} remaining`;
}

/* ─────────────────────────────────────────────────────────────
   4. Task CRUD operations
   ───────────────────────────────────────────────────────────── */

/** Add a new task from the input field */
function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    // Shake the input to signal "empty"
    taskInput.classList.add('shake');
    taskInput.addEventListener('animationend', () => taskInput.classList.remove('shake'), { once: true });
    return;
  }

  const newTask = { id: uid(), text, completed: false };
  tasks.push(newTask);
  saveTasks(tasks);

  taskInput.value = '';
  taskInput.focus();

  renderAll();
}

/** Toggle the completed state of a task by id */
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks(tasks);
  renderAll();
}

/**
 * Remove a task with exit animation, then update state.
 * @param {HTMLLIElement} li - the list element
 * @param {string} id - task id
 */
function removeTask(li, id) {
  // Play exit animation, then remove from DOM & state
  li.classList.add('removing');
  li.addEventListener('animationend', () => {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(tasks);
    renderAll();
  }, { once: true });
}

/** Remove all completed tasks */
function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  saveTasks(tasks);
  renderAll();
}

/* ─────────────────────────────────────────────────────────────
   5. Theme
   ───────────────────────────────────────────────────────────── */

/** Apply a theme by setting the data-theme attribute on <html> */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  saveTheme(theme);
}

/** Toggle between 'light' and 'dark' */
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ─────────────────────────────────────────────────────────────
   6. Filters
   ───────────────────────────────────────────────────────────── */

/**
 * Switch the active filter and re-render.
 * @param {string} filter - 'all' | 'active' | 'completed'
 */
function setFilter(filter) {
  currentFilter = filter;

  // Update tab ARIA + class states
  filterTabs.forEach(tab => {
    const isActive = tab.dataset.filter === filter;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  renderList();
}

/* ─────────────────────────────────────────────────────────────
   7. Drag & Drop (HTML5 API)
   ───────────────────────────────────────────────────────────── */

function onDragStart(e) {
  draggedItem = this;
  draggedIndex = getTaskIndexById(this.dataset.id);
  // Delay to allow the browser to snapshot the element before fading
  setTimeout(() => this.classList.add('dragging'), 0);
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  this.classList.remove('dragging');
  // Clean up any remaining drag-over highlights
  taskList.querySelectorAll('.task-item').forEach(li => li.classList.remove('drag-over'));
  draggedItem  = null;
  draggedIndex = null;
}

function onDragOver(e) {
  e.preventDefault(); // Required to allow drop
  e.dataTransfer.dropEffect = 'move';
  if (this !== draggedItem) {
    this.classList.add('drag-over');
  }
}

function onDragLeave() {
  this.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  if (!draggedItem || this === draggedItem) return;

  const targetId    = this.dataset.id;
  const targetIndex = getTaskIndexById(targetId);

  // Reorder the tasks array (accounts for filtered view too)
  if (draggedIndex !== null && targetIndex !== -1) {
    const [removed] = tasks.splice(draggedIndex, 1);
    tasks.splice(targetIndex, 0, removed);
    saveTasks(tasks);
    renderAll();
  }
}

/** Find the index of a task in the master array by its id */
function getTaskIndexById(id) {
  return tasks.findIndex(t => t.id === id);
}

/* ─────────────────────────────────────────────────────────────
   8. Utilities
   ───────────────────────────────────────────────────────────── */

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/** Write a human-friendly date into the subtitle line */
function setDateLine() {
  const now = new Date();
  dateLine.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

/* ─────────────────────────────────────────────────────────────
   9. Event Binding
   ───────────────────────────────────────────────────────────── */

function bindEvents() {
  // Add task via button click
  addBtn.addEventListener('click', addTask);

  // Add task via Enter key
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });

  // Clear completed
  clearBtn.addEventListener('click', clearCompleted);
}

/* ─────────────────────────────────────────────────────────────
   10. Extra: shake animation (injected via JS for self-containment)
   ───────────────────────────────────────────────────────────── */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(6px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }
  .task-input.shake {
    animation: shake 0.35s ease;
    border-color: var(--accent) !important;
  }
`;
document.head.appendChild(shakeStyle);

/* ─────────────────────────────────────────────────────────────
   Run!
   ───────────────────────────────────────────────────────────── */
init();