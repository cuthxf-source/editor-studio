// Sample projects data
let projects = [
    {
        name: "项目A",
        producer: "张三",
        contact: "123456789",
        stage: "Acopy",
        payStatus: "未收款",
        deliverables: [
            { type: "宣传片", count: 2, spec: "4K" }
        ],
        version: 1,
        modifications: []
    },
    {
        name: "项目B",
        producer: "李四",
        contact: "987654321",
        stage: "Bcopy",
        payStatus: "已收定金",
        deliverables: [
            { type: "正片", count: 1, spec: "1080p" },
            { type: "花絮", count: 1, spec: "1080p" }
        ],
        version: 2,
        modifications: [
            { stage: "Bcopy", version: 1, desc: "初次修改内容" }
        ]
    },
    {
        name: "项目C",
        producer: "王五",
        contact: "wangwu@example.com",
        stage: "Final",
        payStatus: "已收全款",
        deliverables: [
            { type: "宣传片", count: 1, spec: "4K" }
        ],
        version: 3,
        modifications: [
            { stage: "Final", version: 2, desc: "调整色彩" },
            { stage: "Final", version: 3, desc: "添加字幕" }
        ]
    }
];

// Render Recent Projects list on home
function renderRecentProjects() {
    const container = document.getElementById('recent-projects');
    if (!container) return;
    // Last 5 projects (or fewer if less data)
    let recentCount = Math.min(projects.length, 5);
    let recentProjects = projects.slice(-recentCount);
    let html = '<ul class="recent-projects">';
    recentProjects.forEach(proj => {
        // Estimate completion percentage based on stage
        let percent = 0;
        if (proj.stage === "完成") {
            percent = 100;
        } else if (proj.stage === "Final") {
            percent = 80;
        } else if (proj.stage === "Bcopy") {
            percent = 50;
        } else if (proj.stage === "Acopy") {
            percent = 20;
        } 
        html += `
            <li class="recent-project-item">
                <span class="proj-name">${proj.name}</span>
                <div class="progress">
                    <div class="progress-bar" style="width:${percent}%"></div>
                    <span class="progress-label">${percent}%</span>
                </div>
                <span class="version-badge">当前版本 ${proj.version}</span>
            </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// Render Project List table based on filters and search
function renderProjectList() {
    const tbody = document.getElementById('project-tbody');
    if (!tbody) return;
    const searchVal = document.getElementById('project-search').value.trim().toLowerCase();
    const stageFilter = document.getElementById('filter-stage').value;
    const payFilter = document.getElementById('filter-pay').value;
    let filtered = projects.filter(proj => {
        // Stage filter (ignore if "全部阶段")
        if (stageFilter && stageFilter !== "全部阶段") {
            if (proj.stage !== stageFilter) return false;
        }
        // Pay status filter (ignore if "全部款项")
        if (payFilter && payFilter !== "全部款项") {
            if (proj.payStatus !== payFilter) return false;
        }
        // Search filter (project name, producer, or contact)
        if (searchVal) {
            let target = (proj.name + proj.producer + proj.contact).toLowerCase();
            if (!target.includes(searchVal)) return false;
        }
        return true;
    });
    // Build table rows
    let rowsHtml = "";
    filtered.forEach((proj, index) => {
        // Combine deliverables into multi-line string
        let deliverablesText = proj.deliverables.map(d => `${d.type} ${d.spec} ×${d.count}`).join('<br>');
        rowsHtml += `<tr>
            <td>${proj.name}</td>
            <td>${proj.producer}</td>
            <td>${proj.contact}</td>
            <td>${proj.stage}</td>
            <td>${proj.payStatus}</td>
            <td>${deliverablesText}</td>
            <td><a href="#" class="edit-link" data-index="${index}">编辑</a></td>
        </tr>`;
    });
    tbody.innerHTML = rowsHtml;
}

// Update dashboard stats (completed, incomplete counts and total amount)
function updateStats() {
    let completed = projects.filter(p => p.stage === "完成").length;
    let incomplete = projects.filter(p => p.stage !== "完成").length;
    document.getElementById('completed-count').innerText = completed;
    document.getElementById('incomplete-count').innerText = incomplete;
    // Calculate total amount (e.g., assume full payment =10000, deposit=5000 for demo)
    let totalAmount = 0;
    projects.forEach(p => {
        if (p.payStatus === "已收全款") {
            totalAmount += 10000;
        } else if (p.payStatus === "已收定金") {
            totalAmount += 5000;
        }
    });
    document.getElementById('finance-amount').innerText = '¥' + totalAmount;
    document.getElementById('total-finance').innerText = '¥' + totalAmount;
}

// Show a specific section and hide others
function showSection(sectionId) {
    document.querySelectorAll('section').forEach(sec => {
        sec.style.display = (sec.id === sectionId ? 'block' : 'none');
    });
}

// Navigation click events
document.querySelectorAll('.nav li').forEach(item => {
    item.addEventListener('click', () => {
        // Switch section
        document.querySelectorAll('.nav li').forEach(li => li.classList.remove('active'));
        item.classList.add('active');
        let target = item.getAttribute('data-section');
        showSection(target);
        // Refresh content when switching sections
        if (target === 'home') {
            updateStats();
            renderRecentProjects();
        } else if (target === 'projects') {
            renderProjectList();
        }
    });
});

// Search and filter events
document.getElementById('project-search').addEventListener('input', renderProjectList);
document.getElementById('filter-stage').addEventListener('change', renderProjectList);
document.getElementById('filter-pay').addEventListener('change', renderProjectList);

// Delegate click events on project table (for modification edit links)
document.getElementById('project-table').addEventListener('click', function(e) {
    if (e.target.classList.contains('edit-link')) {
        e.preventDefault();
        let idx = parseInt(e.target.getAttribute('data-index'));
        openEditModal(idx);
    }
});

// Open the Edit Modification modal for a given project
function openEditModal(projIndex) {
    let proj = projects[projIndex];
    if (!proj) return;
    // Fill stage and version info
    document.getElementById('mod-stage').innerText = proj.stage;
    document.getElementById('mod-version').innerText = proj.version;
    // Reset input
    document.getElementById('mod-desc').value = "";
    // Populate modification history list
    let historyList = document.getElementById('mod-history-list');
    historyList.innerHTML = "";
    proj.modifications.forEach(mod => {
        let li = document.createElement('li');
        li.textContent = `阶段: ${mod.stage}, 版本: ${mod.version} - ${mod.desc}`;
        historyList.appendChild(li);
    });
    // Show modal
    document.getElementById('edit-mod-modal').style.display = 'block';
    // Store current project index for save use
    document.getElementById('edit-mod-modal').setAttribute('data-project-index', projIndex);
}

// Close modification modal
function closeEditModal() {
    document.getElementById('edit-mod-modal').style.display = 'none';
}

// Save new modification
document.getElementById('btn-save-mod').addEventListener('click', () => {
    let modal = document.getElementById('edit-mod-modal');
    let projIndex = parseInt(modal.getAttribute('data-project-index'));
    let proj = projects[projIndex];
    let desc = document.getElementById('mod-desc').value.trim();
    if (proj && desc) {
        // Increment version and add to history
        proj.version += 1;
        proj.modifications.push({ stage: proj.stage, version: proj.version, desc: desc });
        // Update displays
        renderRecentProjects();
        renderProjectList();
    }
    closeEditModal();
});
document.getElementById('btn-cancel-mod').addEventListener('click', () => {
    closeEditModal();
});

// Add new film type-spec combo line in New Project modal
document.getElementById('film-spec-list').addEventListener('click', function(e) {
    if (e.target.classList.contains('add-combo')) {
        // Clone a new input line for film spec
        let list = document.getElementById('film-spec-list');
        let newItem = document.createElement('div');
        newItem.className = 'film-spec-item';
        newItem.innerHTML = `
            <label>类型:</label>
            <select class="film-type-select">
                <option value="">选择类型</option>
                <option>宣传片</option>
                <option>正片</option>
                <option>花絮</option>
            </select>
            <label>条数:</label>
            <input type="number" class="film-count-input" value="1" min="1" style="width:50px;">
            <label>分辨率:</label>
            <select class="film-res-select">
                <option value="">选择分辨率</option>
                <option>1080p</option>
                <option>4K</option>
            </select>
            <button type="button" class="add-combo">+</button>
        `;
        list.appendChild(newItem);
    }
});

// New Project modal events
document.getElementById('btn-new').addEventListener('click', () => {
    document.getElementById('new-project-modal').style.display = 'block';
});
document.getElementById('btn-cancel-project').addEventListener('click', () => {
    document.getElementById('new-project-modal').style.display = 'none';
});
document.getElementById('btn-save-project').addEventListener('click', () => {
    // Gather new project data
    const name = document.getElementById('new-project-name').value.trim();
    const producer = document.getElementById('new-project-producer').value.trim();
    const contact = document.getElementById('new-project-contact').value.trim();
    if (!name) {
        alert("项目名称不能为空");
        return;
    }
    // Collect deliverables from each line
    let newDeliverables = [];
    document.querySelectorAll('#film-spec-list .film-spec-item').forEach(item => {
        let type = item.querySelector('.film-type-select').value;
        let count = parseInt(item.querySelector('.film-count-input').value) || 1;
        let spec = item.querySelector('.film-res-select').value;
        if (type && spec) {
            newDeliverables.push({ type, count, spec });
        }
    });
    if (newDeliverables.length === 0) {
        alert("请至少添加一个影片类型和规格");
        return;
    }
    // Create new project
    let newProj = {
        name: name,
        producer: producer || "-",
        contact: contact || "-",
        stage: "Acopy",
        payStatus: "未收款",
        deliverables: newDeliverables,
        version: 1,
        modifications: []
    };
    projects.push(newProj);
    // Close modal and refresh data
    document.getElementById('new-project-modal').style.display = 'none';
    renderProjectList();
    updateStats();
    renderRecentProjects();
});

// Export CSV functionality
document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (!projects.length) return;
    let csvContent = "项目名称,制片人,联系方式,阶段,款项状态,影片类型与规格,当前版本\n";
    projects.forEach(proj => {
        let deliverablesStr = proj.deliverables.map(d => `${d.type}${d.spec}x${d.count}`).join("|");
        csvContent += `${proj.name},${proj.producer},${proj.contact},${proj.stage},${proj.payStatus},${deliverablesStr},${proj.version}\n`;
    });
    // Download CSV
    let blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'projects.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Initial rendering on page load
updateStats();
renderRecentProjects();
