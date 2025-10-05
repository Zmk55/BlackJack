// BlackJack Web Application
class BlackJackApp {
    constructor() {
        this.hosts = [];
        this.groups = [];
        this.tags = [];
        this.tabs = [];
        this.activeTab = 'main';
        this.currentHost = null;
        this.currentGroup = null;
        this.selectedGroup = null;
        this.sidebarCollapsed = false;
        this.integrations = {
            tailscale: false
        };
        this.encryptionKey = this.generateEncryptionKey();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.loadIntegrations();
        this.renderTreeView();
        this.renderHosts();
        this.setupSearch();
        this.setupSSHValidation();
    }

    setupEventListeners() {
        // Add host form
        document.getElementById('add-host-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addHost();
        });

        // Add group form
        document.getElementById('add-group-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addGroup();
        });

        // Clear selection when clicking outside tree (but not on buttons or tree items)
        document.addEventListener('click', (e) => {
            // Only clear if clicking on the main content area, not on sidebar or modals
            if (e.target.closest('#main-content') && 
                !e.target.closest('.tree-view') && 
                !e.target.closest('.sidebar-actions') && 
                !e.target.closest('.modal') &&
                !e.target.closest('.btn') &&
                !e.target.closest('.tree-item')) {
                this.selectedGroup = null;
                this.renderTreeView();
            }
        });

        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tab')) {
                const tab = e.target.closest('.tab');
                const tabId = tab.dataset.tab;
                this.switchTab(tabId);
            }
        });
    }

    loadData() {
        // Load hosts from localStorage or use sample data
        const savedHosts = localStorage.getItem('blackjack-hosts');
        if (savedHosts) {
            this.hosts = JSON.parse(savedHosts);
        } else {
            // Sample data
            this.hosts = [
                { id: '1', name: 'Adguard.local', address: '192.168.1.57', user: 'tim', port: 22, groupId: 'group-1', tags: [
                    { name: 'production', color: 'green' },
                    { name: 'dns', color: 'blue' }
                ]},
                { id: '2', name: 'Web Server', address: '192.168.1.100', user: 'admin', port: 22, groupId: 'group-2', tags: [
                    { name: 'production', color: 'green' },
                    { name: 'web', color: 'purple' }
                ]},
                { id: '3', name: 'Database', address: '192.168.1.101', user: 'root', port: 22, groupId: 'group-2', tags: [
                    { name: 'production', color: 'green' },
                    { name: 'database', color: 'orange' }
                ]}
            ];
            this.saveHosts();
        }

        // Load groups
        const savedGroups = localStorage.getItem('blackjack-groups');
        if (savedGroups) {
            this.groups = JSON.parse(savedGroups);
        } else {
            // Sample groups
            this.groups = [
                { id: 'group-1', name: 'Physical Servers', parentId: null, description: 'Main physical servers', expanded: true },
                { id: 'group-2', name: 'VMs', parentId: null, description: 'Virtual machines', expanded: true },
                { id: 'group-3', name: 'Development', parentId: 'group-2', description: 'Dev environment VMs', expanded: false },
                { id: 'group-4', name: 'Production', parentId: 'group-2', description: 'Production VMs', expanded: false }
            ];
            this.saveGroups();
        }

        // Load tags
        const savedTags = localStorage.getItem('blackjack-tags');
        if (savedTags) {
            this.tags = JSON.parse(savedTags);
        } else {
            // Sample tags
            this.tags = ['production', 'development', 'staging', 'dns', 'web', 'database', 'monitoring'];
            this.saveTags();
        }
    }

    saveHosts() {
        localStorage.setItem('blackjack-hosts', JSON.stringify(this.hosts));
    }

    saveGroups() {
        localStorage.setItem('blackjack-groups', JSON.stringify(this.groups));
    }

    saveTags() {
        localStorage.setItem('blackjack-tags', JSON.stringify(this.tags));
    }

    renderTreeView() {
        const treeView = document.getElementById('tree-view');
        if (!treeView) return;

        // Get root groups (no parent)
        const rootGroups = this.groups.filter(group => !group.parentId);
        
        treeView.innerHTML = `
            <div class="tree-item" onclick="app.showAllHosts()" data-type="all">
                <span class="tree-item-icon">⚡</span>
                <span class="tree-item-content">
                    <span class="tree-item-name">All Hosts</span>
                </span>
            </div>
            ${this.renderGroupTree(rootGroups)}
        `;
    }

    renderGroupTree(groups, level = 0) {
        return groups.map(group => {
            const children = this.groups.filter(g => g.parentId === group.id);
            const groupHosts = this.hosts.filter(host => host.groupId === group.id);
            const hasChildren = children.length > 0;
            const isSelected = this.selectedGroup === group.id;
            
            return `
                <div class="tree-item ${hasChildren ? 'has-children' : ''} ${group.expanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}" 
                     data-group-id="${group.id}">
                    <div class="tree-item-header">
                        <span class="tree-item-expand" onclick="app.toggleGroupExpansion('${group.id}')">${hasChildren ? (group.expanded ? '▼' : '▶') : ''}</span>
                        <span class="tree-item-content" onclick="app.selectGroup('${group.id}')">
                            <span class="tree-item-name">
                                ${group.name}${groupHosts.length > 0 ? ` (${groupHosts.length})` : ''}
                                <div class="tree-item-actions">
                                    <button class="btn btn-edit" onclick="event.stopPropagation(); app.editGroup('${group.id}')" title="Edit Group">✏️</button>
                                    <button class="btn btn-danger" onclick="event.stopPropagation(); app.deleteGroup('${group.id}')" title="Delete Group">🗑️</button>
                                </div>
                            </span>
                        </span>
                    </div>
                </div>
                <div class="tree-children ${group.expanded ? '' : 'collapsed'}">
                    ${this.renderGroupTree(children, level + 1)}
                </div>
            `;
        }).join('');
    }

    renderHosts() {
        const hostTableBody = document.getElementById('host-table-body');
        const filterInfo = document.getElementById('filter-info');
        
        // Filter hosts based on current group
        let filteredHosts = this.hosts;
        if (this.currentGroup) {
            filteredHosts = this.hosts.filter(host => host.groupId === this.currentGroup);
        }

        // Apply search filter
        const searchQuery = document.getElementById('search-input').value.toLowerCase();
        if (searchQuery) {
            filteredHosts = filteredHosts.filter(host => this.matchesSearch(host, searchQuery));
        }

        // Update filter info
        if (filterInfo) {
            if (searchQuery) {
                filterInfo.textContent = `Search results for "${searchQuery}" (${filteredHosts.length})`;
            } else if (this.currentGroup) {
                const group = this.groups.find(g => g.id === this.currentGroup);
                filterInfo.textContent = `Showing hosts in "${group ? group.name : 'Unknown'}" (${filteredHosts.length})`;
            } else {
                filterInfo.textContent = `Showing all hosts (${filteredHosts.length})`;
            }
        }

        // Render main table
        hostTableBody.innerHTML = filteredHosts.map(host => `
            <tr>
                <td>
                    <div class="host-name-cell">
                        <div class="host-name">${host.name}</div>
                        ${this.getHostDisplayTags(host).length > 0 ? `
                            <div class="host-tags-inline">
                                ${this.getHostDisplayTags(host).map(tag => `
                                    <span class="host-tag-inline tag-${tag.color || 'gray'}">${tag.icon ? tag.icon + ' ' : ''}${tag.name}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td>${host.address}</td>
                <td>${host.user}</td>
                <td>${host.port}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="app.connectToHost('${host.id}')">Connect</button>
                        <button class="btn btn-edit" onclick="app.editHost('${host.id}')" title="Edit Host">
                            <span class="icon">✏️</span>
                        </button>
                        <button class="btn btn-clone" onclick="app.cloneHost('${host.id}')" title="Clone Host">
                            <span class="icon">📋</span>
                        </button>
                        <button class="btn btn-danger" onclick="app.deleteHost('${host.id}')" title="Delete Host">
                            <span class="icon">🗑️</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    selectHost(hostId) {
        // Remove active class from all hosts
        document.querySelectorAll('.host-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to selected host
        document.querySelector(`[data-host-id="${hostId}"]`).classList.add('active');
        
        this.currentHost = this.hosts.find(h => h.id === hostId);
    }

    connectToHost(hostId) {
        this.currentHost = this.hosts.find(h => h.id === hostId);
        this.showConnectionModal();
    }

    connectToHostTailscale(hostId) {
        const host = this.hosts.find(h => h.id === hostId);
        if (!host || !host.tailscaleIp) {
            alert('No Tailscale IP configured for this host');
            return;
        }
        
        // Close the connection modal first
        this.closeModal('connection-modal');
        
        // Create a modified host object for Tailscale connection
        const tailscaleHost = {
            ...host,
            address: host.tailscaleIp, // Use Tailscale IP instead of regular IP
            name: host.name + ' (Tailscale)' // Update name to indicate Tailscale connection
        };
        
        // Create SSH tab with the modified host
        this.createSSHTab(tailscaleHost);
    }

    showConnectionModal() {
        // Update connection options based on host capabilities
        this.updateConnectionOptions();
        document.getElementById('connection-modal').style.display = 'block';
    }

    updateConnectionOptions() {
        const connectionOptions = document.querySelector('#connection-modal .connection-options');
        if (!connectionOptions || !this.currentHost) return;

        // Clear existing options
        connectionOptions.innerHTML = '';

        // Add standard SSH options
        connectionOptions.innerHTML = `
            <button class="btn btn-primary" onclick="connectSSH()">SSH Shell</button>
            <button class="btn btn-primary" onclick="connectSSHCommand()">SSH Command</button>
        `;

        // Add Tailscale option if host has Tailscale IP
        if (this.currentHost.tailscaleIp) {
            const tailscaleButton = document.createElement('button');
            tailscaleButton.className = 'btn btn-secondary';
            tailscaleButton.textContent = 'Connect via Tailscale';
            tailscaleButton.onclick = () => this.connectToHostTailscale(this.currentHost.id);
            connectionOptions.appendChild(tailscaleButton);
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showAddHost() {
        console.log('showAddHost called, selectedGroup:', this.selectedGroup);
        
        // Populate group dropdown
        this.populateGroupDropdown();
        
        // Set selected group if one is selected
        if (this.selectedGroup) {
            document.getElementById('host-group').value = this.selectedGroup;
            console.log('Setting host group to selected group:', this.selectedGroup);
        }
        
        // Show/hide Tailscale IP field based on integration status
        this.updateTailscaleFields();
        
        // Setup tag management
        this.setupTagManagement();
        
        // Add automatic Tailscale tag if IP is present
        this.updateTailscaleTag();
        this.renderTagList();
        
        // Populate tag history
        this.populateTagHistory();
        
        // Reset form and button text (but preserve the group selection)
        const form = document.getElementById('add-host-form');
        const hostGroupSelect = document.getElementById('host-group');
        const currentGroupValue = hostGroupSelect.value; // Save the group value
        form.reset();
        hostGroupSelect.value = currentGroupValue; // Restore the group value
        form.dataset.editing = '';
        document.getElementById('host-submit-btn').textContent = 'Add Host';
        
        // Reset modal title
        const modal = document.getElementById('add-host-modal');
        const title = modal.querySelector('h3');
        title.textContent = 'Add New Host';
        
        document.getElementById('add-host-modal').style.display = 'block';
    }

    getGroupPath(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return '';
        
        if (!group.parentId) {
            return group.name;
        }
        
        const parentPath = this.getGroupPath(group.parentId);
        return `${parentPath} / ${group.name}`;
    }

    populateGroupDropdown() {
        const groupSelect = document.getElementById('host-group');
        groupSelect.innerHTML = '<option value="">No Group</option>';
        
        // Sort groups by hierarchy (parents first, then children)
        const sortedGroups = [...this.groups].sort((a, b) => {
            const pathA = this.getGroupPath(a.id);
            const pathB = this.getGroupPath(b.id);
            return pathA.localeCompare(pathB);
        });
        
        sortedGroups.forEach(group => {
            const path = this.getGroupPath(group.id);
            groupSelect.innerHTML += `<option value="${group.id}">${path}</option>`;
        });
    }

    setupTagManagement() {
        this.currentTags = [];
        this.selectedColor = 'red';
        
        // Populate tag history
        this.populateTagHistory();
        
        // Setup color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
                this.selectedColor = e.target.dataset.color;
            });
        });
        
        // Setup add tag button
        document.getElementById('add-tag-btn').addEventListener('click', () => {
            this.addTag();
        });
        
        // Setup enter key for tag input
        document.getElementById('tag-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag();
            }
        });

        // Setup focus/blur for dropdown
        document.getElementById('tag-name-input').addEventListener('focus', () => {
            this.showTagDropdown();
        });

        document.getElementById('tag-name-input').addEventListener('blur', (e) => {
            // Delay hiding to allow clicking on dropdown items
            setTimeout(() => {
                this.hideTagDropdown();
            }, 200);
        });

        // Setup Tailscale IP field listener
        document.getElementById('host-tailscale-ip').addEventListener('input', () => {
            this.updateTailscaleTag();
            this.renderTagList();
        });
        
        this.renderTagList();
    }

    populateTagHistory() {
        const tagDropdown = document.getElementById('tag-dropdown');
        if (!tagDropdown) {
            console.log('Tag dropdown element not found');
            return;
        }
        
        // Get all unique tag names from existing tags
        const allTags = this.tags || [];
        console.log('All tags:', allTags);
        
        const uniqueTagNames = [...new Set(allTags.map(tag => tag.name).filter(name => name && name.trim() !== ''))];
        console.log('Unique tag names:', uniqueTagNames);
        
        // Clear existing options
        tagDropdown.innerHTML = '';
        
        // Add some test options if no tags exist
        if (uniqueTagNames.length === 0) {
            const testTags = ['DNS', 'Web', 'Database', 'API', 'Production', 'Development', 'Testing'];
            testTags.forEach(tagName => {
                const item = document.createElement('div');
                item.className = 'tag-dropdown-item';
                item.textContent = tagName;
                item.onclick = () => this.selectTagFromHistory(tagName);
                tagDropdown.appendChild(item);
            });
            console.log('Added test tag options');
        } else {
            // Add options for each unique tag name
            uniqueTagNames.forEach(tagName => {
                if (tagName && tagName.trim() !== '') {
                    const item = document.createElement('div');
                    item.className = 'tag-dropdown-item';
                    item.textContent = tagName;
                    item.onclick = () => this.selectTagFromHistory(tagName);
                    tagDropdown.appendChild(item);
                }
            });
        }
        
        console.log('Tag history populated with', tagDropdown.children.length, 'options');
    }

    selectTagFromHistory(tagName) {
        document.getElementById('tag-name-input').value = tagName;
        this.hideTagDropdown();
    }

    showTagDropdown() {
        const dropdown = document.getElementById('tag-dropdown');
        const input = document.getElementById('tag-name-input');
        if (dropdown && input) {
            console.log('Showing tag dropdown');
            
            // Get input position for fixed positioning
            const rect = input.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 4) + 'px';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.width = rect.width + 'px';
            
            dropdown.classList.add('show');
            console.log('Dropdown classes:', dropdown.className);
            console.log('Dropdown position:', dropdown.style.top, dropdown.style.left);
        } else {
            console.log('Tag dropdown or input element not found');
        }
    }

    hideTagDropdown() {
        const dropdown = document.getElementById('tag-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    clearTagHistory() {
        if (confirm('Are you sure you want to clear all tag history? This action cannot be undone.')) {
            // Clear all tags from storage
            this.tags = [];
            this.saveTags();
            
            // Clear current tags in form if editing
            this.currentTags = [];
            this.renderTagList();
            
            // Clear tag history dropdown
            this.populateTagHistory();
            
            alert('Tag history has been cleared successfully!');
        }
    }

    updateTailscaleTag() {
        const tailscaleIp = document.getElementById('host-tailscale-ip').value.trim();
        const hasTailscaleTag = this.currentTags.some(tag => tag.name === 'Tailscale' && tag.isAuto);
        
        if (tailscaleIp && !hasTailscaleTag) {
            // Add automatic Tailscale tag
            this.currentTags.push({
                name: 'Tailscale',
                color: 'blue',
                isAuto: true,
                icon: '🔗'
            });
        } else if (!tailscaleIp && hasTailscaleTag) {
            // Remove automatic Tailscale tag
            this.currentTags = this.currentTags.filter(tag => !(tag.name === 'Tailscale' && tag.isAuto));
        }
    }

    getHostDisplayTags(host) {
        const displayTags = [...(host.tags || [])];
        
        // Add automatic Tailscale tag if host has Tailscale IP
        if (host.tailscaleIp && host.tailscaleIp.trim()) {
            const hasTailscaleTag = displayTags.some(tag => tag.name === 'Tailscale' && tag.isAuto);
            if (!hasTailscaleTag) {
                displayTags.push({
                    name: 'Tailscale',
                    color: 'blue',
                    isAuto: true,
                    icon: '🔗'
                });
            }
        }
        
        return displayTags;
    }

    addTag() {
        const tagName = document.getElementById('tag-name-input').value.trim();
        if (!tagName) return;
        
        // Check if tag already exists
        if (this.currentTags.some(tag => tag.name === tagName)) {
            alert('Tag already exists!');
            return;
        }
        
        this.currentTags.push({
            name: tagName,
            color: this.selectedColor
        });
        
        document.getElementById('tag-name-input').value = '';
        this.renderTagList();
    }

    removeTag(tagName) {
        const tag = this.currentTags.find(t => t.name === tagName);
        if (tag && tag.isAuto) {
            alert('This tag is automatically managed and cannot be removed manually.');
            return;
        }
        this.currentTags = this.currentTags.filter(tag => tag.name !== tagName);
        this.renderTagList();
    }

    renderTagList() {
        const tagList = document.getElementById('tag-list');
        tagList.innerHTML = this.currentTags.map(tag => `
            <div class="tag-item tag-${tag.color}" onclick="app.editTag('${tag.name}')">
                ${tag.icon ? tag.icon + ' ' : ''}${tag.name}
                ${!tag.isAuto ? `<button class="tag-remove" onclick="event.stopPropagation(); app.removeTag('${tag.name}')" title="Remove tag">×</button>` : ''}
            </div>
        `).join('');
    }

    editTag(tagName) {
        const newName = prompt('Edit tag name:', tagName);
        if (newName && newName !== tagName) {
            const tag = this.currentTags.find(t => t.name === tagName);
            if (tag) {
                tag.name = newName;
                this.renderTagList();
            }
        }
    }

    addHost() {
        const name = document.getElementById('host-name').value;
        const address = document.getElementById('host-address').value;
        const user = document.getElementById('host-user').value;
        const port = parseInt(document.getElementById('host-port').value);
        const groupId = document.getElementById('host-group').value || null;
        const tags = this.currentTags || [];
        const tailscaleIp = document.getElementById('host-tailscale-ip').value || null;
        const password = document.getElementById('host-password').value;

        const form = document.getElementById('add-host-form');
        const isEditing = form.dataset.editing;

        if (isEditing) {
            // Edit existing host
            const hostIndex = this.hosts.findIndex(h => h.id === isEditing);
            if (hostIndex !== -1) {
                this.hosts[hostIndex] = {
                    id: isEditing,
                    name,
                    address,
                    user,
                    port,
                    groupId,
                    tags,
                    tailscaleIp
                };
            }
        } else {
            // Add new host
            const newHost = {
                id: Date.now().toString(),
                name,
                address,
                user,
                port,
                groupId,
                tags,
                tailscaleIp,
                password: password ? this.encryptPassword(password) : null
            };
            this.hosts.push(newHost);
        }

        this.saveHosts();
        this.renderTreeView();
        this.renderHosts();
        this.closeModal('add-host-modal');
        
        // Reset form and clear editing state
        document.getElementById('add-host-form').reset();
        form.dataset.editing = '';
        
        // Reset modal title and button text
        const modal = document.getElementById('add-host-modal');
        const title = modal.querySelector('h3');
        title.textContent = 'Add New Host';
        document.getElementById('host-submit-btn').textContent = 'Add Host';
    }

    parseTagsWithColors(tagsInput) {
        if (!tagsInput.trim()) return [];
        
        const tagNames = tagsInput.split(',').map(t => t.trim()).filter(t => t);
        return tagNames.map(tagName => ({
            name: tagName,
            color: this.getTagColor(tagName)
        }));
    }

    getTagColor(tagName) {
        // Simple color assignment based on tag name
        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'gray'];
        const hash = tagName.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    }

    connectSSH() {
        if (!this.currentHost) return;
        
        // Create new SSH tab
        this.createSSHTab(this.currentHost);
        this.closeModal('connection-modal');
    }

    connectSSHCommand() {
        if (!this.currentHost) return;
        
        const command = prompt('Enter SSH command:');
        if (command) {
            // Execute SSH command
            this.executeSSHCommand(this.currentHost, command);
        }
        this.closeModal('connection-modal');
    }

    createSSHTab(host) {
        const tabId = `ssh-${host.id}-${Date.now()}`;
        const tabTitle = `SSH: ${host.name}`;
        
        // Create tab element
        const tab = document.createElement('div');
        tab.className = 'tab draggable';
        tab.dataset.tab = tabId;
        tab.draggable = true;
        tab.innerHTML = `
            <span class="tab-title">${tabTitle}</span>
            <button class="tab-close" onclick="app.closeTab('${tabId}')">×</button>
        `;
        
        // Add drag event listeners
        tab.addEventListener('dragstart', (e) => this.handleDragStart(e));
        tab.addEventListener('dragover', (e) => this.handleDragOver(e));
        tab.addEventListener('drop', (e) => this.handleDrop(e));
        tab.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        // Insert before new tab button
        const newTabBtn = document.querySelector('.new-tab-btn');
        newTabBtn.parentNode.insertBefore(tab, newTabBtn);
        
        // Create tab content with xterm.js terminal
        const tabContent = document.createElement('div');
        tabContent.id = `${tabId}-content`;
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `
            <div class="ssh-terminal" id="terminal-${tabId}">
                <div id="xterm-${tabId}" class="xterm-terminal"></div>
            </div>
        `;
        
        document.querySelector('.content-area').appendChild(tabContent);
        
        // Switch to new tab
        this.switchTab(tabId);
        
        // Store tab info
        this.tabs.push({
            id: tabId,
            title: tabTitle,
            type: 'ssh',
            host: host
        });
        
        // Initialize xterm.js terminal with real SSH connection
        this.initializeSSHTerminal(tabId, host);
    }

    initializeSSHTerminal(tabId, host) {
        // Initialize xterm.js terminal
        const terminal = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#000000',
                foreground: '#00ff00',
                cursor: '#00ff00'
            },
            fontSize: 14,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        });

        // Add fit addon
        const fitAddon = new FitAddon.FitAddon();
        terminal.loadAddon(fitAddon);

        // Add web links addon
        const webLinksAddon = new WebLinksAddon.WebLinksAddon();
        terminal.loadAddon(webLinksAddon);

        // Open terminal in the container
        const terminalElement = document.getElementById(`xterm-${tabId}`);
        terminal.open(terminalElement);
        fitAddon.fit();

        // Connect to WebSocket for SSH
        this.connectSSHWebSocket(tabId, host, terminal);

        // Handle window resize
        window.addEventListener('resize', () => {
            fitAddon.fit();
        });

        // Store terminal reference
        this.terminals = this.terminals || {};
        this.terminals[tabId] = { terminal, fitAddon, webLinksAddon };
    }

    connectSSHWebSocket(tabId, host, terminal) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/ssh`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            
            // Only use stored password if it exists, otherwise rely on SSH keys
            const storedPassword = host.password ? this.decryptPassword(host.password) : '';
            const sshRequest = {
                host: host.address,
                port: host.port || 22,
                username: host.user,
                password: storedPassword, // Will be empty string if no password stored
                keyPath: host.keyPath || ''
            };
            
            ws.send(JSON.stringify({
                type: 'connect',
                data: JSON.stringify(sshRequest)
            }));
        };
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'connected':
                    terminal.write('SSH connection established\r\n');
                    break;
                case 'output':
                    terminal.write(message.data);
                    break;
                case 'error':
                    terminal.write(`\r\nError: ${message.data}\r\n`);
                    
                    // Only prompt for password if no stored password exists and authentication failed
                    if ((message.data.includes('authentication failed') || message.data.includes('unable to authenticate')) && !host.password) {
                        const password = prompt(`SSH key authentication failed. Enter password for ${host.user}@${host.address}:`);
                        if (password) {
                            // Send password authentication request
                            ws.send(JSON.stringify({
                                type: 'connect',
                                data: JSON.stringify({
                                    host: host.address,
                                    port: host.port || 22,
                                    username: host.user,
                                    password: password,
                                    keyPath: ''
                                })
                            }));
                        } else {
                            terminal.write('\r\nSSH connection cancelled\r\n');
                        }
                    } else if (host.password && (message.data.includes('authentication failed') || message.data.includes('unable to authenticate'))) {
                        terminal.write('\r\nSSH connection failed. Please check your stored password or SSH key configuration.\r\n');
                    }
                    break;
                case 'session_closed':
                    terminal.write(`\r\n${message.data}\r\n`);
                    // Close the tab after a short delay
                    setTimeout(() => {
                        this.closeTab(tabId);
                    }, 1000);
                    break;
            }
        };
        
        ws.onclose = () => {
            terminal.write('\r\nSSH connection closed\r\n');
        };
        
        ws.onerror = (error) => {
            terminal.write(`\r\nWebSocket error: ${error}\r\n`);
        };
        
        // Handle terminal input
        terminal.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'input',
                    data: data
                }));
            }
        });
        
        // Store WebSocket reference
        this.websockets = this.websockets || {};
        this.websockets[tabId] = ws;
    }

    hasSSHKeys() {
        // Check if host has a keyPath specified
        if (this.currentHost && this.currentHost.keyPath) {
            return true;
        }
        
        // For now, assume SSH agent or default keys are available
        // The backend will try SSH agent and common key locations
        return true;
    }

    // Simple encryption/decryption for passwords (in production, use proper encryption)
    generateEncryptionKey() {
        // Generate a simple key based on browser fingerprint
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('BlackJack Encryption Key', 2, 2);
        return canvas.toDataURL().slice(-16);
    }

    encryptPassword(password) {
        if (!password) return '';
        // Simple XOR encryption (not secure for production)
        let encrypted = '';
        for (let i = 0; i < password.length; i++) {
            encrypted += String.fromCharCode(
                password.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
            );
        }
        return btoa(encrypted);
    }

    decryptPassword(encryptedPassword) {
        if (!encryptedPassword) return '';
        try {
            const decoded = atob(encryptedPassword);
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                decrypted += String.fromCharCode(
                    decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
                );
            }
            return decrypted;
        } catch (e) {
            return '';
        }
    }

    switchTab(tabId) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Add active class to selected tab
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        
        // Handle different tab types
        if (tabId === 'main') {
            // Main tab - show the normal layout
            const mainTab = document.getElementById('main-tab');
            if (mainTab) {
                mainTab.classList.add('active');
            }
        } else {
            // SSH tab - show only terminal
            const content = document.getElementById(`${tabId}-content`);
            if (content) {
                content.classList.add('active');
            }
        }
        
        this.activeTab = tabId;
    }

    closeTab(tabId) {
        // Don't allow closing the main tab
        if (tabId === 'main') {
            return;
        }
        
        // Clean up WebSocket connection
        if (this.websockets && this.websockets[tabId]) {
            this.websockets[tabId].close();
            delete this.websockets[tabId];
        }
        
        // Clean up terminal
        if (this.terminals && this.terminals[tabId]) {
            this.terminals[tabId].terminal.dispose();
            delete this.terminals[tabId];
        }
        
        // Remove tab element
        const tabElement = document.querySelector(`[data-tab="${tabId}"]`);
        if (tabElement) {
            tabElement.remove();
        }
        
        // Remove tab content
        const content = document.getElementById(`${tabId}-content`);
        if (content) {
            content.remove();
        }
        
        // Remove from tabs array
        this.tabs = this.tabs.filter(tab => tab.id !== tabId);
        
        // Switch to main tab if we closed the active tab
        if (this.activeTab === tabId) {
            this.switchTab('main');
        }
    }

    createNewTab() {
        // Show quick host selection menu
        this.showQuickHostMenu();
    }

    executeSSHCommand(host, command) {
        // This would integrate with your Go backend
        console.log(`Executing SSH command: ${command} on ${host.name}`);
        // For now, just show an alert
        alert(`SSH Command: ${command}\nHost: ${host.name}\n\nThis would execute the command via your Go backend.`);
    }


    exportHosts() {
        // Check if any hosts have passwords
        const hasPasswords = this.hosts.some(host => host.password);
        
        if (hasPasswords) {
            const confirmed = confirm(
                '⚠️ WARNING: Your configuration contains stored passwords!\n\n' +
                'Passwords will be exported in encrypted form, but the encryption key is browser-specific.\n' +
                'This file should be kept in a secure location and only imported on trusted devices.\n\n' +
                'Do you want to continue with the export?'
            );
            if (!confirmed) return;
        }
        
        // Create JSON export
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            hosts: this.hosts,
            groups: this.groups,
            tags: this.tags,
            integrations: this.integrations,
            hasPasswords: hasPasswords
        };
        
        // Create and download file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `blackjack-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert(`Exported ${this.hosts.length} hosts successfully!`);
    }

    importHosts() {
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    if (!importData.hosts || !Array.isArray(importData.hosts)) {
                        alert('Invalid file format. Please select a valid BlackJack export file.');
                        return;
                    }
                    
                    // Validate the import data
                    if (!this.validateImportData(importData)) {
                        return;
                    }
                    
                    // Check if current config is not empty
                    const hasExistingData = this.hosts.length > 0 || this.groups.length > 0 || this.tags.length > 0;
                    
                    if (hasExistingData) {
                        // Show merge/overwrite options
                        const choice = this.showImportOptions(importData);
                        if (choice === 'cancel') return;
                        
                        if (choice === 'overwrite') {
                            this.performOverwrite(importData);
                        } else if (choice === 'merge') {
                            this.performMerge(importData);
                        }
                    } else {
                        // No existing data, just import everything
                        this.performOverwrite(importData);
                    }
                    
                    this.saveHosts();
                    this.saveGroups();
                    this.saveTags();
                    this.renderHosts();
                    this.renderTreeView();
                    
                } catch (error) {
                    alert('Error reading file. Please make sure it\'s a valid JSON file.');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    validateImportData(importData) {
        // Check if it's a valid BlackJack config file
        if (!importData.hosts || !Array.isArray(importData.hosts)) {
            alert('Invalid file format. Please select a valid BlackJack export file.');
            return false;
        }
        
        // Validate hosts structure
        for (const host of importData.hosts) {
            if (!host.name || !host.address || !host.user) {
                alert('Invalid host data found. Some hosts are missing required fields (name, address, user).');
                return false;
            }
        }
        
        // Validate groups if present
        if (importData.groups && !Array.isArray(importData.groups)) {
            alert('Invalid groups data in import file.');
            return false;
        }
        
        // Validate tags if present
        if (importData.tags && !Array.isArray(importData.tags)) {
            alert('Invalid tags data in import file.');
            return false;
        }
        
        return true;
    }

    showImportOptions(importData) {
        const hostCount = importData.hosts ? importData.hosts.length : 0;
        const groupCount = importData.groups ? importData.groups.length : 0;
        const tagCount = importData.tags ? importData.tags.length : 0;
        
        const message = `Import Configuration\n\n` +
            `Found: ${hostCount} hosts, ${groupCount} groups, ${tagCount} tags\n\n` +
            `Current: ${this.hosts.length} hosts, ${this.groups.length} groups, ${this.tags.length} tags\n\n` +
            `What would you like to do?\n\n` +
            `• MERGE: Add new items to existing data\n` +
            `• OVERWRITE: Replace all data with imported data\n` +
            `• CANCEL: Don't import anything`;
        
        const choice = prompt(message + '\n\nEnter: merge, overwrite, or cancel');
        
        if (!choice) return 'cancel';
        
        const normalizedChoice = choice.toLowerCase().trim();
        if (['merge', 'overwrite', 'cancel'].includes(normalizedChoice)) {
            return normalizedChoice;
        }
        
        alert('Invalid choice. Please enter: merge, overwrite, or cancel');
        return this.showImportOptions(importData);
    }

    performOverwrite(importData) {
        this.hosts = importData.hosts || [];
        this.groups = importData.groups || [];
        this.tags = importData.tags || [];
        this.integrations = importData.integrations || { tailscale: false };
        
        alert(`Configuration overwritten successfully!\n\n` +
              `Imported: ${this.hosts.length} hosts, ${this.groups.length} groups, ${this.tags.length} tags`);
    }

    performMerge(importData) {
        let addedHosts = 0;
        let addedGroups = 0;
        let addedTags = 0;
        
        // Merge hosts (avoid duplicates by name)
        if (importData.hosts) {
            for (const host of importData.hosts) {
                if (!this.hosts.find(h => h.name === host.name)) {
                    this.hosts.push(host);
                    addedHosts++;
                }
            }
        }
        
        // Merge groups (avoid duplicates by name)
        if (importData.groups) {
            for (const group of importData.groups) {
                if (!this.groups.find(g => g.name === group.name)) {
                    this.groups.push(group);
                    addedGroups++;
                }
            }
        }
        
        // Merge tags (avoid duplicates by name)
        if (importData.tags) {
            for (const tag of importData.tags) {
                if (!this.tags.find(t => t.name === tag.name)) {
                    this.tags.push(tag);
                    addedTags++;
                }
            }
        }
        
        // Merge integrations
        if (importData.integrations) {
            this.integrations = { ...this.integrations, ...importData.integrations };
        }
        
        alert(`Configuration merged successfully!\n\n` +
              `Added: ${addedHosts} hosts, ${addedGroups} groups, ${addedTags} tags\n` +
              `Total: ${this.hosts.length} hosts, ${this.groups.length} groups, ${this.tags.length} tags`);
    }

    showQuickHostMenu() {
        // Create quick host selection modal
        const modal = document.createElement('div');
        modal.id = 'quick-host-modal';
        modal.className = 'modal';
        modal.style.display = 'block';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Quick Connect</h3>
                    <button class="close" onclick="app.closeQuickHostMenu()">×</button>
                </div>
                <div class="modal-body">
                    <div class="quick-host-list">
                        ${this.hosts.map(host => `
                            <div class="quick-host-item" onclick="app.quickConnect('${host.id}')">
                                <div class="host-info">
                                    <div class="host-name">${host.name}</div>
                                    <div class="host-details">${host.user}@${host.address}:${host.port}</div>
                                </div>
                                <div class="host-actions">
                                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); app.quickConnectSSH('${host.id}')">SSH</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="quick-host-actions">
                        <button class="btn btn-secondary" onclick="app.closeQuickHostMenu()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.showAddHost(); app.closeQuickHostMenu()">Add New Host</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    closeQuickHostMenu() {
        const modal = document.getElementById('quick-host-modal');
        if (modal) {
            modal.remove();
        }
    }

    quickConnect(hostId) {
        // Quick connect to SSH shell
        this.quickConnectSSH(hostId);
    }

    quickConnectSSH(hostId) {
        const host = this.hosts.find(h => h.id === hostId);
        if (!host) return;
        
        this.closeQuickHostMenu();
        this.createSSHTab(host);
    }

    editHost(hostId) {
        const host = this.hosts.find(h => h.id === hostId);
        if (!host) return;

        // Populate group dropdown first
        this.populateGroupDropdown();

        // Pre-fill the form with existing data
        document.getElementById('host-name').value = host.name;
        document.getElementById('host-address').value = host.address;
        document.getElementById('host-user').value = host.user;
        document.getElementById('host-port').value = host.port;
        document.getElementById('host-password').value = host.password ? this.decryptPassword(host.password) : '';
        
        // Debug group selection
        console.log('Editing host:', host);
        console.log('Host groupId:', host.groupId);
        console.log('Available groups:', this.groups);
        
        document.getElementById('host-group').value = host.groupId || '';
        document.getElementById('host-tailscale-ip').value = host.tailscaleIp || '';
        
        // Show/hide Tailscale IP field based on integration status
        this.updateTailscaleFields();
        
        // Setup tag management with existing tags
        this.setupTagManagement();
        this.currentTags = host.tags ? [...host.tags] : [];
        
        // Add automatic Tailscale tag if IP is present
        this.updateTailscaleTag();
        this.renderTagList();

        // Change form title and submit behavior
        const modal = document.getElementById('add-host-modal');
        const title = modal.querySelector('h3');
        const form = document.getElementById('add-host-form');
        
        title.textContent = 'Edit Host';
        form.dataset.editing = hostId;
        document.getElementById('host-submit-btn').textContent = 'Save';
        
        document.getElementById('add-host-modal').style.display = 'block';
    }

    deleteHost(hostId) {
        const host = this.hosts.find(h => h.id === hostId);
        if (!host) return;

        // Safety prompt
        const confirmed = confirm(
            `Are you sure you want to delete "${host.name}"?\n\n` +
            `This will permanently remove:\n` +
            `• Name: ${host.name}\n` +
            `• Address: ${host.address}\n` +
            `• User: ${host.user}\n\n` +
            `This action cannot be undone.`
        );

        if (confirmed) {
            // Remove from hosts array
            this.hosts = this.hosts.filter(h => h.id !== hostId);
            this.saveHosts();
            this.renderHosts();
            
            // Show confirmation
            alert(`Host "${host.name}" has been deleted.`);
        }
    }

    cloneHost(hostId) {
        const host = this.hosts.find(h => h.id === hostId);
        if (!host) return;

        // Create cloned host with -copy suffix
        const clonedHost = {
            id: Date.now().toString(),
            name: `${host.name}-copy`,
            address: host.address,
            user: host.user,
            port: host.port
        };

        // Add to hosts array
        this.hosts.push(clonedHost);
        this.saveHosts();
        this.renderHosts();

        // Pre-fill the form with cloned data for editing
        document.getElementById('host-name').value = clonedHost.name;
        document.getElementById('host-address').value = clonedHost.address;
        document.getElementById('host-user').value = clonedHost.user;
        document.getElementById('host-port').value = clonedHost.port;

        // Change form title and submit behavior
        const modal = document.getElementById('add-host-modal');
        const title = modal.querySelector('h3');
        const form = document.getElementById('add-host-form');
        
        title.textContent = 'Edit Cloned Host';
        form.dataset.editing = clonedHost.id;
        
        this.showAddHost();
    }

    // Drag and drop handlers
    handleDragStart(e) {
        this.draggedTab = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const tabsContainer = e.target.closest('.tabs');
        const afterElement = this.getDragAfterElement(tabsContainer, e.clientX);
        
        if (afterElement == null) {
            // Insert at the end, but before the new tab button
            const newTabBtn = tabsContainer.querySelector('.new-tab-btn');
            tabsContainer.insertBefore(this.draggedTab, newTabBtn);
        } else {
            tabsContainer.insertBefore(this.draggedTab, afterElement);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        return false;
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTab = null;
    }

    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.tab.draggable:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Group management functions
    toggleGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            // If clicking on a group (not just expanding), filter hosts
            this.selectGroup(groupId);
            
            // Toggle expansion
            group.expanded = !group.expanded;
            this.saveGroups();
            this.renderTreeView();
        }
    }

    showAllHosts() {
        this.currentGroup = null;
        this.selectedGroup = null;
        this.renderHosts();
        this.updateTreeSelection();
        this.renderTreeView();
        
        // Update the filter info
        const filterInfo = document.getElementById('filter-info');
        if (filterInfo) {
            filterInfo.textContent = `Showing all hosts (${this.hosts.length})`;
        }
    }

    selectGroup(groupId) {
        this.currentGroup = groupId;
        this.selectedGroup = groupId;
        this.renderHosts();
        this.renderTreeView();
        
        // Update the filter info
        const filterInfo = document.getElementById('filter-info');
        if (filterInfo) {
            const group = this.groups.find(g => g.id === groupId);
            const groupHosts = this.hosts.filter(host => host.groupId === groupId);
            filterInfo.textContent = `Showing hosts in "${group ? group.name : 'Unknown'}" (${groupHosts.length})`;
        }
    }

    toggleGroupExpansion(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.expanded = !group.expanded;
            this.saveGroups();
            this.renderTreeView();
        }
    }

    updateTreeSelection() {
        // Remove active class from all tree items
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to current selection
        if (this.currentGroup) {
            const groupItem = document.querySelector(`[data-group-id="${this.currentGroup}"]`);
            if (groupItem) groupItem.classList.add('active');
        } else {
            const allItem = document.querySelector('[data-type="all"]');
            if (allItem) allItem.classList.add('active');
        }
    }

    showAddGroup() {
        console.log('showAddGroup called, selectedGroup:', this.selectedGroup);
        
        // Populate parent group dropdown
        const parentSelect = document.getElementById('parent-group');
        parentSelect.innerHTML = '<option value="">None (Root Group)</option>';
        
        // Sort groups by hierarchy (parents first, then children)
        const sortedGroups = [...this.groups].sort((a, b) => {
            const pathA = this.getGroupPath(a.id);
            const pathB = this.getGroupPath(b.id);
            return pathA.localeCompare(pathB);
        });
        
        sortedGroups.forEach(group => {
            const path = this.getGroupPath(group.id);
            parentSelect.innerHTML += `<option value="${group.id}">${path}</option>`;
        });

        // Set selected group as parent if one is selected
        if (this.selectedGroup) {
            console.log('Setting parent group to selected group:', this.selectedGroup);
            parentSelect.value = this.selectedGroup;
            console.log('Parent select value after setting:', parentSelect.value);
        } else {
            console.log('No selected group, keeping default');
        }

        // Reset form and button text (but preserve the parent group selection)
        const form = document.getElementById('add-group-form');
        const currentParentValue = parentSelect.value; // Save the parent value
        form.reset();
        parentSelect.value = currentParentValue; // Restore the parent value
        form.dataset.editing = '';
        document.getElementById('group-submit-btn').textContent = 'Add Group';
        
        // Reset modal title
        const modal = document.getElementById('add-group-modal');
        const title = modal.querySelector('h3');
        title.textContent = 'Add New Group';

        document.getElementById('add-group-modal').style.display = 'block';
    }

    addGroup() {
        const name = document.getElementById('group-name').value;
        const parentId = document.getElementById('parent-group').value || null;
        const description = document.getElementById('group-description').value;

        const form = document.getElementById('add-group-form');
        const isEditing = form.dataset.editing;

        if (isEditing) {
            // Edit existing group
            const groupIndex = this.groups.findIndex(g => g.id === isEditing);
            if (groupIndex !== -1) {
                this.groups[groupIndex] = {
                    ...this.groups[groupIndex],
                    name,
                    parentId,
                    description
                };
            }
        } else {
            // Add new group
            const newGroup = {
                id: `group-${Date.now()}`,
                name,
                parentId,
                description,
                expanded: false
            };
            this.groups.push(newGroup);
        }

        this.saveGroups();
        this.renderTreeView();
        this.closeModal('add-group-modal');

        // Reset form and clear editing state
        document.getElementById('add-group-form').reset();
        form.dataset.editing = '';
        
        // Reset modal title and button text
        const modal = document.getElementById('add-group-modal');
        const title = modal.querySelector('h3');
        title.textContent = 'Add New Group';
        document.getElementById('group-submit-btn').textContent = 'Add Group';
    }

    editGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        // Pre-fill form
        document.getElementById('group-name').value = group.name;
        document.getElementById('group-description').value = group.description || '';
        
        // Populate parent group dropdown
        const parentSelect = document.getElementById('parent-group');
        parentSelect.innerHTML = '<option value="">None (Root Group)</option>';
        this.groups.forEach(g => {
            if (g.id !== groupId) { // Don't allow self as parent
                parentSelect.innerHTML += `<option value="${g.id}">${g.name}</option>`;
            }
        });
        parentSelect.value = group.parentId || '';

        // Set editing state
        const form = document.getElementById('add-group-form');
        form.dataset.editing = groupId;

        // Change title and button text
        const modal = document.getElementById('add-group-modal');
        const title = modal.querySelector('h3');
        title.textContent = 'Edit Group';
        
        // Change button text to "Save"
        document.getElementById('group-submit-btn').textContent = 'Save';

        // Show the modal
        document.getElementById('add-group-modal').style.display = 'block';
    }

    deleteGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        // Check if group has children or hosts
        const hasChildren = this.groups.some(g => g.parentId === groupId);
        const hasHosts = this.hosts.some(h => h.groupId === groupId);

        if (hasChildren || hasHosts) {
            alert(`Cannot delete "${group.name}" because it contains ${hasChildren ? 'subgroups' : ''}${hasChildren && hasHosts ? ' and ' : ''}${hasHosts ? 'hosts' : ''}.`);
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete the group "${group.name}"?`);
        if (confirmed) {
            this.groups = this.groups.filter(g => g.id !== groupId);
            this.saveGroups();
            this.renderTreeView();
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        this.sidebarCollapsed = !this.sidebarCollapsed;
        
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }

    setupSearch() {
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('clear-search-btn');
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.length > 0) {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
            this.renderHosts();
        });
        
        // Clear search when clicking clear button
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            this.renderHosts();
        });
    }

    setupSSHValidation() {
        // Add event listener for SSH key test button
        const sshTestBtn = document.getElementById('ssh-key-test-btn');
        
        if (sshTestBtn) {
            sshTestBtn.addEventListener('click', () => {
                this.startSSHValidation();
            });
        }
    }

    startSSHValidation() {
        const address = document.getElementById('host-address').value;
        const user = document.getElementById('host-user').value;
        const port = document.getElementById('host-port').value || 22;
        
        if (!address || !user) {
            this.showValidationStatus('Please fill in host address and user before testing SSH keys.', 'error');
            return;
        }
        
        const btn = document.getElementById('ssh-key-test-btn');
        if (btn) {
            btn.disabled = true;
            btn.className = 'ssh-key-btn testing';
            btn.querySelector('.btn-text').textContent = 'Testing...';
            btn.querySelector('.btn-icon').textContent = '⏳';
        }
        
        this.showValidationStatus('Testing SSH key authentication...', 'testing');
        
        // Test SSH connection in background
        this.testSSHConnection(address, user, port);
    }

    async testSSHConnection(address, user, port) {
        try {
            // Create a test WebSocket connection
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/ssh`;
            
            const ws = new WebSocket(wsUrl);
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Connection timeout'));
                }, 10000); // 10 second timeout
                
                ws.onopen = () => {
                    // Send SSH connection request with no password
                    const sshRequest = {
                        host: address,
                        port: parseInt(port),
                        username: user,
                        password: '', // No password, rely on SSH keys
                        keyPath: ''
                    };
                    
                    ws.send(JSON.stringify({
                        type: 'connect',
                        data: JSON.stringify(sshRequest)
                    }));
                };
                
                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'connected') {
                        clearTimeout(timeout);
                        ws.close();
                        this.updateButtonState('success', 'Enabled', '✅');
                        this.showValidationStatus('✅ SSH key authentication successful! Password field will be disabled.', 'success');
                        this.disablePasswordField();
                        resolve(true);
                    } else if (message.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        this.updateButtonState('error', 'Failed', '❌');
                        if (message.data.includes('authentication failed') || message.data.includes('unable to authenticate')) {
                            this.showValidationStatus('❌ SSH key authentication failed. The host may not have your public key in authorized_keys, or SSH keys are not properly configured.', 'error');
                        } else {
                            this.showValidationStatus(`❌ Connection failed: ${message.data}`, 'error');
                        }
                        resolve(false);
                    }
                };
                
                ws.onerror = (error) => {
                    clearTimeout(timeout);
                    ws.close();
                    this.updateButtonState('error', 'Failed', '❌');
                    this.showValidationStatus('❌ Connection error. Please check host address and network connectivity.', 'error');
                    reject(error);
                };
                
                ws.onclose = () => {
                    clearTimeout(timeout);
                };
            });
        } catch (error) {
            this.updateButtonState('error', 'Failed', '❌');
            this.showValidationStatus(`❌ Validation error: ${error.message}`, 'error');
        }
    }

    showValidationStatus(message, type) {
        const statusDiv = document.getElementById('ssh-validation-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `validation-status ${type}`;
            statusDiv.style.display = 'block';
        }
    }

    hideValidationStatus() {
        const statusDiv = document.getElementById('ssh-validation-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }

    disablePasswordField() {
        const passwordField = document.getElementById('host-password');
        if (passwordField) {
            passwordField.disabled = true;
            passwordField.placeholder = 'SSH keys will be used for authentication';
            passwordField.value = '';
        }
    }

    enablePasswordField() {
        const passwordField = document.getElementById('host-password');
        if (passwordField) {
            passwordField.disabled = false;
            passwordField.placeholder = 'Leave empty to use SSH keys';
        }
    }

    updateButtonState(state, text, icon) {
        const btn = document.getElementById('ssh-key-test-btn');
        if (btn) {
            btn.disabled = (state === 'success');
            btn.className = `ssh-key-btn ${state}`;
            btn.querySelector('.btn-text').textContent = text;
            btn.querySelector('.btn-icon').textContent = icon;
        }
    }

    matchesSearch(host, query) {
        // Search in hostname
        if (host.name.toLowerCase().includes(query)) {
            return true;
        }
        
        // Search in address
        if (host.address.toLowerCase().includes(query)) {
            return true;
        }
        
        // Search in user
        if (host.user.toLowerCase().includes(query)) {
            return true;
        }
        
        // Search in group name
        if (host.groupId) {
            const group = this.groups.find(g => g.id === host.groupId);
            if (group && group.name.toLowerCase().includes(query)) {
                return true;
            }
        }
        
        // Search in tags (including automatic tags)
        const displayTags = this.getHostDisplayTags(host);
        if (displayTags.length > 0) {
            return displayTags.some(tag => tag.name.toLowerCase().includes(query));
        }
        
        return false;
    }

    showSettings() {
        document.getElementById('settings-modal').style.display = 'block';
    }

    showIntegrations() {
        // Close settings modal and open integrations modal
        document.getElementById('settings-modal').style.display = 'none';
        document.getElementById('integrations-modal').style.display = 'block';
        
        // Update integration status display
        this.updateIntegrationStatus();
    }

    updateIntegrationStatus() {
        const statusBadge = document.getElementById('tailscale-status');
        const enableBtn = document.getElementById('tailscale-enable-btn');
        const disableBtn = document.getElementById('tailscale-disable-btn');
        
        if (this.integrations.tailscale) {
            statusBadge.textContent = 'Enabled';
            statusBadge.className = 'status-badge enabled';
            enableBtn.disabled = true;
            disableBtn.disabled = false;
        } else {
            statusBadge.textContent = 'Disabled';
            statusBadge.className = 'status-badge disabled';
            enableBtn.disabled = false;
            disableBtn.disabled = true;
        }
    }

    toggleTailscale(enabled) {
        this.integrations.tailscale = enabled;
        this.updateIntegrationStatus();
    }

    saveIntegrations() {
        // Save integration settings to localStorage
        localStorage.setItem('blackjack_integrations', JSON.stringify(this.integrations));
        
        // Show success message
        alert('Integration settings saved successfully!');
        
        // Close modal
        document.getElementById('integrations-modal').style.display = 'none';
    }

    loadIntegrations() {
        const saved = localStorage.getItem('blackjack_integrations');
        if (saved) {
            this.integrations = JSON.parse(saved);
        }
    }

    updateTailscaleFields() {
        const tailscaleGroup = document.getElementById('tailscale-ip-group');
        if (tailscaleGroup) {
            if (this.integrations.tailscale) {
                tailscaleGroup.style.display = 'block';
            } else {
                tailscaleGroup.style.display = 'none';
            }
        }
    }
}

// Initialize the application
const app = new BlackJackApp();

// Global functions for HTML onclick handlers
function closeModal(modalId) {
    app.closeModal(modalId);
}

function showAddHost() {
    app.showAddHost();
}

function connectSSH() {
    app.connectSSH();
}

function connectSSHCommand() {
    app.connectSSHCommand();
}

function createSSHTab() {
    app.createSSHTab(app.currentHost);
}

function createNewTab() {
    app.createNewTab();
}


function closeTab(tabId) {
    app.closeTab(tabId);
}

function editHost(hostId) {
    app.editHost(hostId);
}

function deleteHost(hostId) {
    app.deleteHost(hostId);
}

function cloneHost(hostId) {
    app.cloneHost(hostId);
}

function closeQuickHostMenu() {
    app.closeQuickHostMenu();
}

function showAddGroup() {
    app.showAddGroup();
}

function showAllHosts() {
    app.showAllHosts();
}

function toggleSidebar() {
    app.toggleSidebar();
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('clear-search-btn').style.display = 'none';
    app.renderHosts();
}

function showSettings() {
    app.showSettings();
}

function showIntegrations() {
    app.showIntegrations();
}

function toggleTailscale(enabled) {
    app.toggleTailscale(enabled);
}

function saveIntegrations() {
    app.saveIntegrations();
}

function clearTagHistory() {
    app.clearTagHistory();
}
