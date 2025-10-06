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
        this.sftpConnections = {};
        this.currentSFTPPaths = {};
        this.currentLocalPaths = {};
        this.localFileData = {};
        this.showHiddenFiles = { local: {}, remote: {} };
        this.sortStates = { local: {}, remote: {} };
        this.currentEditFile = {};
        this.hostServices = {}; // Store services for each host
        
        // Initialize persistence
        this.initializePersistence();
        this.selectedGroup = null;
        this.sidebarCollapsed = false;
        this.integrations = {
            tailscale: false
        };
        this.encryptionKey = this.generateEncryptionKey();
        
        // Initialize asynchronously
        this.init().catch(error => {
            console.error('Failed to initialize app:', error);
        });
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.loadIntegrations();
        this.renderTreeView();
        this.renderHosts();
        this.setupSearch();
        this.setupSSHValidation();
        this.setupSettingsModal();
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

    async loadData() {
        try {
            // Load hosts from encrypted storage
            const savedHosts = await this.loadEncryptedData('hosts');
            if (savedHosts && Array.isArray(savedHosts) && savedHosts.length > 0) {
                this.hosts = savedHosts;
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
                // Save sample data to encrypted storage
                await this.saveEncryptedData('hosts', this.hosts);
            }

            // Load groups from encrypted storage
            const savedGroups = await this.loadEncryptedData('groups');
            if (savedGroups && Array.isArray(savedGroups) && savedGroups.length > 0) {
                this.groups = savedGroups;
            } else {
                // Sample groups
                this.groups = [
                    { id: 'group-1', name: 'Physical Servers', parentId: null, description: 'Main physical servers', expanded: true },
                    { id: 'group-2', name: 'VMs', parentId: null, description: 'Virtual machines', expanded: true },
                    { id: 'group-3', name: 'Development', parentId: 'group-2', description: 'Dev environment VMs', expanded: false },
                    { id: 'group-4', name: 'Production', parentId: 'group-2', description: 'Production VMs', expanded: false }
                ];
                // Save sample data to encrypted storage
                await this.saveEncryptedData('groups', this.groups);
            }

            // Load tags from encrypted storage
            const savedTags = await this.loadEncryptedData('tags');
            if (savedTags && Array.isArray(savedTags) && savedTags.length > 0) {
                this.tags = savedTags;
            } else {
                // Sample tags
                this.tags = ['production', 'development', 'staging', 'dns', 'web', 'database', 'monitoring'];
                // Save sample data to encrypted storage
                await this.saveEncryptedData('tags', this.tags);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            // Fallback to localStorage if encrypted storage fails
            this.loadDataFromLocalStorage();
        }
    }

    loadDataFromLocalStorage() {
        console.warn('Loading data from localStorage fallback');
        
        // Load hosts from localStorage
        const savedHosts = localStorage.getItem('blackjack-hosts');
        if (savedHosts) {
            this.hosts = JSON.parse(savedHosts);
        } else {
            this.hosts = [];
        }

        // Load groups from localStorage
        const savedGroups = localStorage.getItem('blackjack-groups');
        if (savedGroups) {
            this.groups = JSON.parse(savedGroups);
        } else {
            this.groups = [];
        }

        // Load tags from localStorage
        const savedTags = localStorage.getItem('blackjack-tags');
        if (savedTags) {
            this.tags = JSON.parse(savedTags);
        } else {
            this.tags = [];
        }
    }

    async saveHosts() {
        try {
            await this.saveEncryptedData('hosts', this.hosts);
        } catch (error) {
            console.error('Failed to save hosts to encrypted storage:', error);
            // Fallback to localStorage
            localStorage.setItem('blackjack-hosts', JSON.stringify(this.hosts));
        }
    }

    async saveGroups() {
        try {
            await this.saveEncryptedData('groups', this.groups);
        } catch (error) {
            console.error('Failed to save groups to encrypted storage:', error);
            // Fallback to localStorage
            localStorage.setItem('blackjack-groups', JSON.stringify(this.groups));
        }
    }

    async saveTags() {
        try {
            await this.saveEncryptedData('tags', this.tags);
        } catch (error) {
            console.error('Failed to save tags to encrypted storage:', error);
            // Fallback to localStorage
            localStorage.setItem('blackjack-tags', JSON.stringify(this.tags));
        }
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

        // Render modern host cards
        const hostGrid = document.getElementById('host-grid');
        hostGrid.innerHTML = filteredHosts.map(host => this.renderHostCard(host)).join('');
        
        // Update selection state
        this.updateSelectionState();
    }

    renderHostCard(host) {
        const tags = this.getHostDisplayTags(host);
        const services = this.hostServices[host.id] || [];
        const urlServices = services.filter(service => service.type === 'web' || service.url.startsWith('http'));
        
        return `
            <div class="host-card" data-host-id="${host.id}" oncontextmenu="app.showHostContextMenu(event, '${host.id}')">
                <div class="host-card-header">
                    <div class="host-card-title">
                        <h3 class="host-name">${host.name}</h3>
                        <div class="host-address">${host.address}</div>
                    </div>
                    <input type="checkbox" class="host-card-checkbox" onchange="app.toggleHostSelection('${host.id}')">
                </div>
                
                ${tags.length > 0 ? `
                    <div class="host-tags">
                        ${tags.map(tag => `
                            <span class="host-tag tag-${tag.color || 'gray'}">
                                ${tag.icon ? tag.icon + ' ' : ''}${tag.name}
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="host-details">
                    <div class="host-detail">
                        <div class="host-detail-label">User</div>
                        <div class="host-detail-value">${host.user}</div>
                    </div>
                    <div class="host-detail">
                        <div class="host-detail-label">Port</div>
                        <div class="host-detail-value">${host.port}</div>
                    </div>
                </div>
                
                <div class="host-status">
                    <div class="status-indicator"></div>
                    <span>Online</span>
                </div>
            </div>
        `;
    }

    // Selection Management
    selectedHosts = new Set();

    toggleHostSelection(hostId) {
        if (this.selectedHosts.has(hostId)) {
            this.selectedHosts.delete(hostId);
        } else {
            this.selectedHosts.add(hostId);
        }
        
        // Update card visual state
        const card = document.querySelector(`[data-host-id="${hostId}"]`);
        if (card) {
            card.classList.toggle('selected', this.selectedHosts.has(hostId));
        }
        
        this.updateSelectionState();
    }

    updateSelectionState() {
        const toolbar = document.getElementById('action-toolbar');
        const selectedCount = document.getElementById('selected-count');
        const connectBtn = document.getElementById('connect-btn');
        const editBtn = document.getElementById('edit-btn');
        const cloneBtn = document.getElementById('clone-btn');
        const deleteBtn = document.getElementById('delete-btn');
        
        const count = this.selectedHosts.size;
        
        if (count > 0) {
            toolbar.style.display = 'flex';
            selectedCount.textContent = `${count} host${count > 1 ? 's' : ''} selected`;
            
            // Enable/disable buttons based on selection
            connectBtn.disabled = count === 0;
            editBtn.disabled = count !== 1;
            cloneBtn.disabled = count !== 1;
            deleteBtn.disabled = count === 0;
        } else {
            toolbar.style.display = 'none';
        }
    }

    // Action Methods
    connectSelectedHosts() {
        this.selectedHosts.forEach(hostId => {
            this.connectToHost(hostId);
        });
    }

    editSelectedHost() {
        if (this.selectedHosts.size === 1) {
            const hostId = Array.from(this.selectedHosts)[0];
            this.editHost(hostId);
        }
    }

    cloneSelectedHost() {
        if (this.selectedHosts.size === 1) {
            const hostId = Array.from(this.selectedHosts)[0];
            this.cloneHost(hostId);
        }
    }

    deleteSelectedHosts() {
        if (this.selectedHosts.size > 0) {
            const hostNames = Array.from(this.selectedHosts).map(id => {
                const host = this.hosts.find(h => h.id === id);
                return host ? host.name : 'Unknown';
            }).join(', ');
            
            if (confirm(`Are you sure you want to delete ${hostNames}?`)) {
                this.selectedHosts.forEach(hostId => {
                    this.deleteHost(hostId);
                });
                this.selectedHosts.clear();
                this.updateSelectionState();
            }
        }
    }

    // Authentication functions
    async logout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                // Redirect to login page
                window.location.href = '/login.html';
            } else {
                console.error('Logout failed');
                // Force redirect anyway
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect anyway
            window.location.href = '/login.html';
        }
    }

    // Backup & Restore Functions
    async exportFullDatabase() {
        try {
            const response = await fetch('/api/backup/export-full', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Export failed: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `blackjack-backup-${new Date().toISOString().split('T')[0]}.enc`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showNotification('✅ Full database exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification(`❌ Export failed: ${error.message}`, 'error');
        }
    }

    showImportDatabaseModal() {
        console.log('Opening import database modal...');
        const modal = document.getElementById('import-database-modal');
        if (modal) {
            modal.style.display = 'block';
            this.resetImportDatabaseModal();
            this.setupDatabaseFileInput();
        } else {
            console.error('Import database modal not found!');
        }
    }

    closeImportDatabaseModal() {
        const modal = document.getElementById('import-database-modal');
        if (modal) {
            modal.style.display = 'none';
            this.resetImportDatabaseModal();
        }
    }

    resetImportDatabaseModal() {
        // Hide all sections except file selection
        document.getElementById('comparison-section').style.display = 'none';
        document.getElementById('duplicate-analysis').style.display = 'none';
        document.getElementById('import-options').style.display = 'none';
        
        // Clear file input
        const fileInput = document.getElementById('database-file-input');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Disable import button
        const importBtn = document.getElementById('execute-import-btn');
        if (importBtn) {
            importBtn.disabled = true;
        }
        
        // Reset import data
        this.importData = null;
    }

    setupDatabaseFileInput() {
        const fileInput = document.getElementById('database-file-input');
        const uploadArea = document.getElementById('database-file-upload');
        
        if (!fileInput || !uploadArea) return;

        // File input change handler
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleDatabaseFileUpload(file);
            }
        });

        // Drag and drop handlers
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.enc')) {
                this.handleDatabaseFileUpload(file);
            }
        });
    }

    async handleDatabaseFileUpload(file) {
        try {
            console.log('Processing database file:', file.name);
            
            // Read and parse the file
            const content = await this.readFileAsText(file);
            const importData = JSON.parse(content);
            
            // Store import data
            this.importData = importData;
            
            // Show comparison
            this.showDataComparison(importData);
            
            // Analyze duplicates
            this.analyzeDuplicates(importData);
            
            // Show import options
            this.showImportOptions();
            
            // Enable import button
            document.getElementById('execute-import-btn').disabled = false;
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showNotification(`❌ Error reading file: ${error.message}`, 'error');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    showDataComparison(importData) {
        // Update current data counts
        document.getElementById('current-hosts').textContent = this.hosts.length;
        document.getElementById('current-groups').textContent = this.groups.length;
        document.getElementById('current-tags').textContent = this.tags.length;
        document.getElementById('current-hosts-count').textContent = `${this.hosts.length} hosts`;

        // Update import data counts
        const importHosts = importData.hosts || [];
        const importGroups = importData.groups || [];
        const importTags = importData.tags || [];
        
        document.getElementById('import-hosts').textContent = importHosts.length;
        document.getElementById('import-groups').textContent = importGroups.length;
        document.getElementById('import-tags').textContent = importTags.length;
        document.getElementById('import-hosts-count').textContent = `${importHosts.length} hosts`;

        // Show comparison section
        document.getElementById('comparison-section').style.display = 'block';
    }

    analyzeDuplicates(importData) {
        const importHosts = importData.hosts || [];
        const duplicateSummary = document.getElementById('duplicate-summary');
        
        let exactDuplicates = 0;
        let similarDuplicates = 0;
        let newHosts = 0;
        
        const duplicateItems = [];
        
        importHosts.forEach(importHost => {
            const existingHost = this.hosts.find(h => 
                h.name === importHost.name && h.address === importHost.address
            );
            
            if (existingHost) {
                // Check if it's an exact duplicate
                const isExact = this.isExactDuplicate(existingHost, importHost);
                if (isExact) {
                    exactDuplicates++;
                    duplicateItems.push({
                        name: importHost.name,
                        details: `${importHost.address}:${importHost.port}`,
                        status: 'exact',
                        statusText: 'Exact Match'
                    });
                } else {
                    similarDuplicates++;
                    duplicateItems.push({
                        name: importHost.name,
                        details: `${importHost.address}:${importHost.port}`,
                        status: 'similar',
                        statusText: 'Similar (Different Settings)'
                    });
                }
            } else {
                newHosts++;
                duplicateItems.push({
                    name: importHost.name,
                    details: `${importHost.address}:${importHost.port}`,
                    status: 'new',
                    statusText: 'New Host'
                });
            }
        });
        
        // Render duplicate summary
        duplicateSummary.innerHTML = `
            <div class="duplicate-stats">
                <div class="stat-item">
                    <span class="stat-label">Exact Matches:</span>
                    <span class="stat-value exact">${exactDuplicates}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Similar (Different Settings):</span>
                    <span class="stat-value similar">${similarDuplicates}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">New Hosts:</span>
                    <span class="stat-value new">${newHosts}</span>
                </div>
            </div>
            <div class="duplicate-list">
                ${duplicateItems.map(item => `
                    <div class="duplicate-item">
                        <div class="duplicate-info">
                            <div class="duplicate-name">${item.name}</div>
                            <div class="duplicate-details">${item.details}</div>
                        </div>
                        <span class="duplicate-status ${item.status}">${item.statusText}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Show duplicate analysis section
        document.getElementById('duplicate-analysis').style.display = 'block';
    }

    isExactDuplicate(host1, host2) {
        // Compare key properties to determine if hosts are identical
        const props = ['name', 'address', 'port', 'username', 'groupId'];
        return props.every(prop => host1[prop] === host2[prop]);
    }

    showImportOptions() {
        // Setup option card click handlers
        const optionCards = document.querySelectorAll('.option-card');
        optionCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remove selected class from all cards
                optionCards.forEach(c => c.classList.remove('selected'));
                // Add selected class to clicked card
                card.classList.add('selected');
                // Check the radio button
                const radio = card.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                }
            });
        });
        
        // Show import options section
        document.getElementById('import-options').style.display = 'block';
    }

    async executeDatabaseImport() {
        if (!this.importData) {
            this.showNotification('❌ No import data available', 'error');
            return;
        }

        const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
        
        try {
            // Create a temporary file for the import
            const blob = new Blob([JSON.stringify(this.importData)], { type: 'application/json' });
            const file = new File([blob], 'import.enc', { type: 'application/json' });
            
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/backup/import-full', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Import failed: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                this.showNotification('✅ Database imported successfully! Reloading...', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                throw new Error(result.error || 'Import failed');
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showNotification(`❌ Import failed: ${error.message}`, 'error');
        }
    }

    showHostExportModal() {
        console.log('Opening host export modal...');
        const modal = document.getElementById('export-hosts-modal');
        if (modal) {
            modal.style.display = 'block';
            this.populateExportHostList();
        } else {
            console.error('Export hosts modal not found!');
        }
    }

    closeExportHostsModal() {
        const modal = document.getElementById('export-hosts-modal');
        if (modal) {
            modal.style.display = 'none';
            this.resetExportHostsModal();
        }
    }

    resetExportHostsModal() {
        // Clear the host list
        const hostList = document.getElementById('export-host-list');
        if (hostList) {
            hostList.innerHTML = '';
        }
        
        // Reset count
        const countElement = document.getElementById('export-count');
        if (countElement) {
            countElement.textContent = '0 hosts selected';
        }
        
        // Disable export button
        const exportBtn = document.getElementById('export-selected-btn');
        if (exportBtn) {
            exportBtn.disabled = true;
        }
    }

    populateExportHostList() {
        const hostList = document.getElementById('export-host-list');
        if (!hostList) return;

        hostList.innerHTML = '';

        this.hosts.forEach(host => {
            const hostItem = document.createElement('div');
            hostItem.className = 'export-host-item';
            hostItem.innerHTML = `
                <input type="checkbox" id="export-host-${host.id}" onchange="app.toggleExportHostSelection('${host.id}')">
                <div class="export-host-item-info">
                    <div class="export-host-item-name">${host.name || 'Unnamed Host'}</div>
                    <div class="export-host-item-details">${host.address || 'No Address'}:${host.port || '22'} • ${host.username || 'No Username'}</div>
                    ${host.tags && Array.isArray(host.tags) && host.tags.length > 0 ? `
                        <div class="export-host-item-tags">
                            ${host.tags.map(tag => `<span class="export-host-item-tag">${typeof tag === 'string' ? tag : tag.name || 'Unknown Tag'}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            hostList.appendChild(hostItem);
        });
    }

    toggleExportHostSelection(hostId) {
        const checkbox = document.getElementById(`export-host-${hostId}`);
        if (!checkbox) return;

        const isSelected = checkbox.checked;
        this.updateExportSelectionCount();
    }

    selectAllExportHosts() {
        const checkboxes = document.querySelectorAll('#export-host-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateExportSelectionCount();
    }

    deselectAllExportHosts() {
        const checkboxes = document.querySelectorAll('#export-host-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateExportSelectionCount();
    }

    updateExportSelectionCount() {
        const checkboxes = document.querySelectorAll('#export-host-list input[type="checkbox"]:checked');
        const count = checkboxes.length;
        
        const countElement = document.getElementById('export-count');
        if (countElement) {
            countElement.textContent = `${count} host${count !== 1 ? 's' : ''} selected`;
        }
        
        const exportBtn = document.getElementById('export-selected-btn');
        if (exportBtn) {
            exportBtn.disabled = count === 0;
        }
    }

    executeHostExport() {
        const checkboxes = document.querySelectorAll('#export-host-list input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least one host to export.');
            return;
        }

        const selectedHostIds = Array.from(checkboxes).map(cb => cb.id.replace('export-host-', ''));
        const hostsToExport = selectedHostIds.map(hostId => {
            return this.hosts.find(h => h.id === hostId);
        }).filter(host => host);

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            exportType: 'individual',
            hosts: hostsToExport
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blackjack-hosts-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Close the modal
        this.closeExportHostsModal();
        
        // Show success message
        this.showNotification(`✅ Exported ${hostsToExport.length} host${hostsToExport.length !== 1 ? 's' : ''} successfully!`, 'success');
    }

    importHosts() {
        this.closeModal('settings-modal');
        this.showImportHostsModal();
    }

    showImportHostsModal() {
        const modal = document.getElementById('import-hosts-modal');
        modal.style.display = 'block';
        
        // Reset modal state
        this.resetImportHostsModal();
        
        // Setup file input
        this.setupHostFileInput();
    }

    closeImportHostsModal() {
        const modal = document.getElementById('import-hosts-modal');
        modal.style.display = 'none';
        this.resetImportHostsModal();
    }

    resetImportHostsModal() {
        // Hide all sections except file upload
        document.getElementById('host-preview-section').style.display = 'none';
        document.getElementById('host-group-assignment').style.display = 'none';
        document.getElementById('host-conflict-resolution').style.display = 'none';
        document.getElementById('import-hosts-btn').disabled = true;
        
        // Clear file input
        const fileInput = document.getElementById('host-file-input');
        fileInput.value = '';
        
        // Reset form
        document.getElementById('default-group-select').value = '';
        document.querySelector('input[name="host-conflict-mode"][value="skip"]').checked = true;
        
        // Clear preview
        document.getElementById('host-preview-list').innerHTML = '';
        document.getElementById('host-count').textContent = '0';
    }

    setupHostFileInput() {
        const fileInput = document.getElementById('host-file-input');
        const uploadArea = document.getElementById('host-file-upload');
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleHostFileUpload(file);
            }
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleHostFileUpload(file);
            }
        });
    }

    async handleHostFileUpload(file) {
        try {
            const text = await file.text();
            let importData;
            
            try {
                importData = JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid JSON file');
            }
            
            if (!importData.hosts || !Array.isArray(importData.hosts)) {
                throw new Error('Invalid backup file format');
            }
            
            this.importHostsData = importData;
            this.showHostImportPreview(importData.hosts);
            
        } catch (error) {
            console.error('File upload error:', error);
            this.showNotification(`❌ Error reading file: ${error.message}`, 'error');
        }
    }

    showHostImportPreview(hosts) {
        // Populate group dropdown
        this.populateImportGroupDropdown();
        
        // Show preview
        document.getElementById('host-preview-section').style.display = 'block';
        document.getElementById('host-group-assignment').style.display = 'block';
        document.getElementById('host-conflict-resolution').style.display = 'block';
        
        // Update count
        document.getElementById('host-count').textContent = hosts.length;
        
        // Create preview items
        const previewList = document.getElementById('host-preview-list');
        previewList.innerHTML = '';
        
        hosts.forEach((host, index) => {
            const existingHost = this.hosts.find(h => h.name === host.name && h.address === host.address);
            const status = existingHost ? 'existing' : 'new';
            const statusText = existingHost ? 'Existing' : 'New';
            
            const item = document.createElement('div');
            item.className = 'import-preview-item';
            item.innerHTML = `
                <input type="checkbox" id="host-${index}" checked>
                <div class="import-preview-item-info">
                    <div class="import-preview-item-name">${host.name}</div>
                    <div class="import-preview-item-details">${host.address}:${host.port} (${host.user})</div>
                </div>
                <span class="import-preview-item-status ${status}">${statusText}</span>
            `;
            previewList.appendChild(item);
        });
        
        // Enable import button
        document.getElementById('import-hosts-btn').disabled = false;
    }

    populateImportGroupDropdown() {
        const select = document.getElementById('default-group-select');
        const currentOptions = select.querySelectorAll('option:not([value=""]):not([value="root"])');
        currentOptions.forEach(option => option.remove());
        
        // Add current groups
        this.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            select.appendChild(option);
        });
    }

    selectAllHosts() {
        const checkboxes = document.querySelectorAll('#host-preview-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = true);
    }

    deselectAllHosts() {
        const checkboxes = document.querySelectorAll('#host-preview-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = false);
    }

    async executeHostImport() {
        const checkboxes = document.querySelectorAll('#host-preview-list input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            this.showNotification('⚠️ Please select at least one host to import', 'warning');
            return;
        }
        
        const selectedHosts = Array.from(checkboxes).map(checkbox => {
            const index = parseInt(checkbox.id.split('-')[1]);
            return this.importHostsData.hosts[index];
        });
        
        const defaultGroup = document.getElementById('default-group-select').value;
        const conflictMode = document.querySelector('input[name="host-conflict-mode"]:checked').value;
        
        try {
            const response = await fetch('/api/backup/import-hosts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hosts: selectedHosts,
                    defaultGroup: defaultGroup,
                    conflictMode: conflictMode
                })
            });
            
            if (!response.ok) {
                throw new Error(`Import failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            if (result.success) {
                this.showNotification(`✅ Successfully imported ${result.imported} hosts!`, 'success');
                this.closeImportHostsModal();
                
                // Reload data
                await this.loadData();
                this.renderHosts();
                this.renderTreeView();
            } else {
                throw new Error(result.error || 'Import failed');
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showNotification(`❌ Import failed: ${error.message}`, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: '#ffffff',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '400px',
            wordWrap: 'break-word',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });
        
        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Modern Settings Modal Functions
    setupSettingsModal() {
        console.log('Setting up modern settings modal...');
        
        // Setup navigation
        const navItems = document.querySelectorAll('.settings-nav-item');
        console.log(`Found ${navItems.length} navigation items`);
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.getAttribute('data-section');
                console.log(`Switching to section: ${section}`);
                this.switchSettingsSection(section);
            });
        });

        // Setup theme selector
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.getAttribute('data-theme');
                this.selectTheme(theme);
            });
        });

        // Setup toggle switches
        const toggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.handleToggleChange(e.target);
            });
        });

        // Setup modern inputs
        const inputs = document.querySelectorAll('.modern-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleInputChange(e.target);
            });
        });
    }

    switchSettingsSection(sectionName) {
        // Update navigation
        const navItems = document.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-section') === sectionName) {
                item.classList.add('active');
            }
        });

        // Update content sections
        const sections = document.querySelectorAll('.settings-section');
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === `settings-${sectionName}`) {
                section.classList.add('active');
            }
        });
    }

    selectTheme(theme) {
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-theme') === theme) {
                option.classList.add('active');
            }
        });

        // Apply theme (placeholder for future implementation)
        console.log(`Theme changed to: ${theme}`);
        this.showNotification(`Theme changed to ${theme}`, 'success');
    }

    handleToggleChange(toggle) {
        const setting = toggle.id;
        const value = toggle.checked;
        
        console.log(`Setting ${setting} changed to: ${value}`);
        this.showNotification(`${setting} ${value ? 'enabled' : 'disabled'}`, 'success');
    }

    handleInputChange(input) {
        const setting = input.id || input.name;
        const value = input.value;
        
        console.log(`Setting ${setting} changed to: ${value}`);
    }

    saveSettings() {
        // Collect all settings
        const settings = {
            theme: document.querySelector('.theme-option.active')?.getAttribute('data-theme') || 'dark',
            autoSave: document.getElementById('auto-save')?.checked || false,
            sessionTimeout: document.querySelector('.modern-input')?.value || 30,
            requirePassword: document.getElementById('require-password')?.checked || false
        };

        // Save settings (placeholder for future implementation)
        console.log('Saving settings:', settings);
        this.showNotification('Settings saved successfully!', 'success');
        
        // Close modal after a short delay
        setTimeout(() => {
            this.closeModal('settings-modal');
        }, 1000);
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
            <button class="btn btn-primary" onclick="connectSFTP()">SFTP Browser</button>
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
        
        // Reset SSH key button when closing add-host modal
        if (modalId === 'add-host-modal') {
            this.resetSSHKeyButton();
        }
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
        
        // Reset SSH key button to initial state
        this.resetSSHKeyButton();
        form.dataset.editing = '';
        document.getElementById('host-submit-btn').textContent = 'Add Host';
        
        // Reset modal title
        const modal = document.getElementById('add-host-modal');
        const title = modal.querySelector('h3');
        title.textContent = 'Add New Host';
        
        // Hide Services button for new hosts
        const servicesBtn = document.getElementById('host-services-btn');
        if (servicesBtn) {
            servicesBtn.style.display = 'none';
        }
        
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

    connectSFTP() {
        if (!this.currentHost) return;
        
        // Create new SFTP tab
        this.createSFTPTab(this.currentHost);
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

    createSFTPTab(host) {
        const tabId = `sftp-${host.id}-${Date.now()}`;
        const tabTitle = `SFTP: ${host.name}`;
        
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
        
        // Create tab content with SFTP browser
        const tabContent = document.createElement('div');
        tabContent.id = `${tabId}-content`;
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `
            <div class="sftp-browser" id="sftp-${tabId}">
                        <div class="sftp-toolbar">
                            <button class="btn btn-primary" onclick="app.sftpRefresh('${tabId}')">Refresh Remote</button>
                            <button class="btn btn-primary" onclick="app.sftpRefreshLocal('${tabId}')">Refresh Local</button>
                            <button class="btn btn-secondary" onclick="app.sftpUpload('${tabId}')">Upload Selected</button>
                            <button class="btn btn-secondary" onclick="app.sftpDownload('${tabId}')">Download Selected</button>
                            <button class="btn btn-success" onclick="app.createNewFile('${tabId}')">New File</button>
                            <button class="btn btn-danger" onclick="app.deleteSelectedFiles('${tabId}')">Delete Selected</button>
                        </div>
                <div class="sftp-dual-pane">
                        <div class="sftp-pane sftp-local-pane">
                            <div class="sftp-pane-header">
                                <h4>Local Files</h4>
                                <div class="sftp-header-controls">
                                    <label class="sftp-toggle">
                                        <input type="checkbox" id="sftp-local-hidden-${tabId}" onchange="app.toggleHiddenFiles('${tabId}', 'local', this.checked)" />
                                        Show Hidden
                                    </label>
                                </div>
                                <div class="sftp-path" id="sftp-local-path-${tabId}">/home/tim</div>
                            </div>
                        <div class="sftp-files" id="sftp-local-files-${tabId}">
                            <div class="sftp-loading">Loading local files...</div>
                        </div>
                    </div>
                        <div class="sftp-pane sftp-remote-pane">
                            <div class="sftp-pane-header">
                                <h4>Remote Files (${host.name})</h4>
                                <div class="sftp-header-controls">
                                    <label class="sftp-toggle">
                                        <input type="checkbox" id="sftp-remote-hidden-${tabId}" onchange="app.toggleHiddenFiles('${tabId}', 'remote', this.checked)" />
                                        Show Hidden
                                    </label>
                                </div>
                                <div class="sftp-path" id="sftp-remote-path-${tabId}">/</div>
                            </div>
                        <div class="sftp-files" id="sftp-remote-files-${tabId}">
                            <div class="sftp-loading">Connecting to SFTP server...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelector('.content-area').appendChild(tabContent);
        
        // Switch to new tab
        this.switchTab(tabId);
        
        // Store tab info
        this.tabs.push({
            id: tabId,
            title: tabTitle,
            type: 'sftp',
            host: host
        });
        
        // Initialize both local and remote file browsers
        this.initializeLocalFileBrowser(tabId);
        this.initializeSFTPConnection(tabId, host);
    }

    initializeLocalFileBrowser(tabId) {
        console.log('Initializing local file browser for tab:', tabId);
        
        // Use actual user's home directory
        this.currentLocalPaths[tabId] = '/home/tim';
        
        // Load local files
        this.loadLocalFiles(tabId);
    }

    loadLocalFiles(tabId) {
        const currentPath = this.currentLocalPaths[tabId] || '/home/tim';
        const pathDisplay = document.getElementById(`sftp-local-path-${tabId}`);
        
        if (pathDisplay) {
            pathDisplay.textContent = currentPath;
        }
        
        // Show loading state
        const filesContainer = document.getElementById(`sftp-local-files-${tabId}`);
        if (filesContainer) {
            filesContainer.innerHTML = '<div class="sftp-loading">Loading local files...</div>';
        }
        
        // Request local files from backend
        this.requestLocalFiles(tabId, currentPath);
    }
    
    async requestLocalFiles(tabId, path) {
        try {
            const showHidden = this.showHiddenFiles.local[tabId] || false;
            console.log('Requesting local files for path:', path, 'showHidden:', showHidden);
            
            const response = await fetch('/api/local-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: path, showHidden: showHidden })
            });
            
            console.log('Response status:', response.status);
            
            if (response.ok) {
                const files = await response.json();
                console.log('Received files:', files);
                this.displayLocalFiles(tabId, files);
            } else {
                const errorText = await response.text();
                console.error('API error:', response.status, errorText);
                throw new Error(`Failed to load local files: ${response.status} ${errorText}`);
            }
        } catch (error) {
            console.error('Error loading local files:', error);
            // Show error message
            const filesContainer = document.getElementById(`sftp-local-files-${tabId}`);
            if (filesContainer) {
                filesContainer.innerHTML = `<div class="sftp-error">Unable to load local files: ${error.message}</div>`;
            }
        }
    }

    displayLocalFiles(tabId, files) {
        const filesContainer = document.getElementById(`sftp-local-files-${tabId}`);
        const currentPath = this.currentLocalPaths[tabId] || '/home/tim';
        
        // Update clickable path
        this.updateClickablePath(tabId, 'local', currentPath);
        
        let html = '<div class="sftp-file-list">';
        
        // Add header row
        html += `
            <div class="sftp-file-header">
                <div class="sftp-header-checkbox">
                    <input type="checkbox" class="sftp-select-all" onchange="app.sftpSelectAllLocal('${tabId}', this)" />
                </div>
                <div class="sftp-header-icon"></div>
                <div class="sftp-header-name sftp-header-name" onclick="app.sftpSortLocal('${tabId}', 'name')">
                    Name <span class="sort-indicator">↕</span>
                </div>
                <div class="sftp-header-size sftp-header-size" onclick="app.sftpSortLocal('${tabId}', 'size')">
                    Size <span class="sort-indicator">↕</span>
                </div>
                <div class="sftp-header-date sftp-header-date" onclick="app.sftpSortLocal('${tabId}', 'date')">
                    Modified <span class="sort-indicator">↕</span>
                </div>
            </div>
        `;
        
        // Add parent directory link if not at root
        if (currentPath !== '/home/tim' && currentPath !== '/') {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/home/tim';
            html += `
                <div class="sftp-file-item sftp-directory" data-path="${parentPath}" data-is-dir="true" data-pane="local">
                    <div class="sftp-checkbox-placeholder"></div>
                    <span class="sftp-file-icon">📁</span>
                    <span class="sftp-file-name">..</span>
                    <span class="sftp-file-size"></span>
                    <span class="sftp-file-date"></span>
                </div>
            `;
        }
        
        // Add files and directories
        files.forEach(file => {
            // For directories, the path should be the directory name for navigation
            // For files, the path should be the full path
            const filePath = file.isDir ? file.name : (currentPath === '/home/tim' ? `/home/tim/${file.name}` : `${currentPath}/${file.name}`);
            const isDirectory = file.isDir;
            const icon = isDirectory ? '📁' : '📄';
            const size = isDirectory ? '' : this.formatFileSize(file.size);
            const date = new Date(file.modTime * 1000).toLocaleDateString();
            
                    html += `
                        <div class="sftp-file-item ${isDirectory ? 'sftp-directory' : 'sftp-file'}" 
                             data-path="${filePath}" 
                             data-is-dir="${isDirectory}"
                             data-pane="local"
                             draggable="true"
                             ondblclick="${!isDirectory ? `app.editFile('${tabId}', '${filePath}', false)` : ''}">
                            ${!isDirectory ? `<input type="checkbox" class="sftp-file-checkbox" data-path="${filePath}" />` : '<div class="sftp-checkbox-placeholder"></div>'}
                            <span class="sftp-file-icon">${icon}</span>
                            <span class="sftp-file-name">${file.name}</span>
                            <span class="sftp-file-size">${size}</span>
                            <span class="sftp-file-date">${date}</span>
                        </div>
                    `;
        });
        
        html += '</div>';
        filesContainer.innerHTML = html;
        
        // Add event listeners
        this.attachLocalFileEventListeners(tabId);
    }

    initializeSFTPConnection(tabId, host) {
        console.log('Initializing SFTP connection for tab:', tabId, 'host:', host);
        
        // Create WebSocket connection for SFTP
        const ws = new WebSocket('ws://localhost:8082/ws/sftp');
        this.sftpConnections[tabId] = ws;
        
        ws.onopen = () => {
            console.log('SFTP WebSocket connected');
            // Send connection request
            const connectData = {
                host: host.address,
                port: host.port || 22,
                username: host.user,
                password: host.password,
                keyPath: host.keyPath || ''
            };
            console.log('Sending SFTP connection request:', connectData);
            ws.send(JSON.stringify({
                type: 'connect',
                data: JSON.stringify(connectData)
            }));
        };
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleSFTPMessage(tabId, message);
        };
        
        ws.onclose = (event) => {
            console.log('SFTP WebSocket disconnected:', event.code, event.reason);
            delete this.sftpConnections[tabId];
            this.updateSFTPContent(tabId, '<div class="sftp-error">SFTP connection lost. Please refresh the page.</div>');
        };
        
        ws.onerror = (error) => {
            console.error('SFTP WebSocket error:', error);
            this.updateSFTPContent(tabId, '<div class="sftp-error">SFTP connection failed. Make sure the server is running on port 8082.</div>');
        };
    }

    handleSFTPMessage(tabId, message) {
        console.log('SFTP message received:', message.type, message.data);
        
        switch (message.type) {
            case 'connected':
                console.log('SFTP connected, loading root directory');
                this.updateSFTPContent(tabId, '<div class="sftp-loading">Connected! Loading directory...</div>');
                // Load root directory
                this.sftpListDirectory(tabId, '/');
                break;
                
            case 'file_list':
                this.displayFileList(tabId, JSON.parse(message.data));
                break;
                
                    case 'file_content':
                        // Check if this is for editing or downloading
                        if (this.currentEditFile && this.currentEditFile[tabId]) {
                            // This is for editing
                            this.openFileEditor(tabId, this.currentEditFile[tabId], message.data, true);
                            delete this.currentEditFile[tabId];
                        } else {
                            // This is for downloading
                            const currentPath = this.currentSFTPPaths[tabId] || '/';
                            const filename = currentPath.split('/').pop() || 'downloaded_file';
                            this.downloadFile(message.data, filename);
                            // Refresh directory after download
                            setTimeout(() => this.sftpListDirectory(tabId, currentPath), 1000);
                        }
                        break;
                
                    case 'upload_success':
                        this.updateSFTPContent(tabId, '<div class="sftp-success">File uploaded successfully!</div>');
                        // Refresh directory
                        setTimeout(() => this.sftpListDirectory(tabId, this.currentSFTPPaths[tabId] || '/'), 1000);
                        break;
                        
                    case 'create_success':
                        this.updateSFTPContent(tabId, '<div class="sftp-success">File created successfully!</div>');
                        // Refresh directory
                        setTimeout(() => this.sftpListDirectory(tabId, this.currentSFTPPaths[tabId] || '/'), 1000);
                        break;
                        
                    case 'delete_success':
                        this.updateSFTPContent(tabId, '<div class="sftp-success">Files deleted successfully!</div>');
                        // Refresh directory
                        setTimeout(() => this.sftpListDirectory(tabId, this.currentSFTPPaths[tabId] || '/'), 1000);
                        break;
                        
                    case 'write_success':
                        this.updateSFTPContent(tabId, '<div class="sftp-success">File saved successfully!</div>');
                        // Refresh directory
                        setTimeout(() => this.sftpListDirectory(tabId, this.currentSFTPPaths[tabId] || '/'), 1000);
                        break;
                
            case 'error':
                this.updateSFTPContent(tabId, `<div class="sftp-error">Error: ${message.data}</div>`);
                break;
        }
    }

    updateSFTPContent(tabId, content) {
        const filesContainer = document.getElementById(`sftp-remote-files-${tabId}`);
        if (filesContainer) {
            filesContainer.innerHTML = content;
        }
    }

    displayFileList(tabId, files) {
        const filesContainer = document.getElementById(`sftp-remote-files-${tabId}`);
        const currentPath = this.currentSFTPPaths[tabId] || '/';
        
        // Update clickable path
        this.updateClickablePath(tabId, 'remote', currentPath);
        
        let html = '<div class="sftp-file-list">';
        
        // Add header row
        html += `
            <div class="sftp-file-header">
                <div class="sftp-header-checkbox">
                    <input type="checkbox" class="sftp-select-all" onchange="app.sftpSelectAll('${tabId}', this)" />
                </div>
                <div class="sftp-header-icon"></div>
                <div class="sftp-header-name sftp-header-name" onclick="app.sftpSort('${tabId}', 'name')">
                    Name <span class="sort-indicator">↕</span>
                </div>
                <div class="sftp-header-size sftp-header-size" onclick="app.sftpSort('${tabId}', 'size')">
                    Size <span class="sort-indicator">↕</span>
                </div>
                <div class="sftp-header-date sftp-header-date" onclick="app.sftpSort('${tabId}', 'date')">
                    Modified <span class="sort-indicator">↕</span>
                </div>
            </div>
        `;
        
        // Add parent directory link if not at root
        if (currentPath !== '/') {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
            html += `
                <div class="sftp-file-item sftp-directory" data-path="${parentPath}" data-is-dir="true" data-pane="remote">
                    <div class="sftp-checkbox-placeholder"></div>
                    <span class="sftp-file-icon">📁</span>
                    <span class="sftp-file-name">..</span>
                    <span class="sftp-file-size"></span>
                    <span class="sftp-file-date"></span>
                </div>
            `;
        }
        
        // Add files and directories
        files.forEach(file => {
            const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
            const isDirectory = file.isDir;
            const icon = isDirectory ? '📁' : '📄';
            const size = isDirectory ? '' : this.formatFileSize(file.size);
            const date = new Date(file.modTime * 1000).toLocaleDateString();
            
                    html += `
                        <div class="sftp-file-item ${isDirectory ? 'sftp-directory' : 'sftp-file'}" 
                             data-path="${filePath}" 
                             data-is-dir="${isDirectory}"
                             data-pane="remote"
                             draggable="true"
                             ondblclick="${!isDirectory ? `app.editFile('${tabId}', '${filePath}', true)` : ''}">
                            ${!isDirectory ? `<input type="checkbox" class="sftp-file-checkbox" data-path="${filePath}" />` : '<div class="sftp-checkbox-placeholder"></div>'}
                            <span class="sftp-file-icon">${icon}</span>
                            <span class="sftp-file-name">${file.name}</span>
                            <span class="sftp-file-size">${size}</span>
                            <span class="sftp-file-date">${date}</span>
                        </div>
                    `;
        });
        
        html += '</div>';
        filesContainer.innerHTML = html;
        
        // Add event listeners after content is updated
        this.attachSFTPEventListeners(tabId);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    sftpListDirectory(tabId, path) {
        this.currentSFTPPaths[tabId] = path;
        const ws = this.sftpConnections[tabId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'list',
                data: path
            }));
        }
    }

    sftpDownloadFile(tabId, filePath) {
        const ws = this.sftpConnections[tabId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Show downloading status
            this.updateSFTPContent(tabId, `<div class="sftp-loading">Downloading ${filePath.split('/').pop()}...</div>`);
            
            ws.send(JSON.stringify({
                type: 'download',
                data: JSON.stringify({ path: filePath })
            }));
        } else {
            this.updateSFTPContent(tabId, '<div class="sftp-error">SFTP connection lost. Please refresh the page.</div>');
        }
    }

    downloadFile(base64Content, filename = 'downloaded_file') {
        // Create download link
        const link = document.createElement('a');
        link.href = 'data:application/octet-stream;base64,' + base64Content;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    sftpRefresh(tabId) {
        const currentPath = this.currentSFTPPaths[tabId] || '/';
        this.sftpListDirectory(tabId, currentPath);
    }

    sftpUpload(tabId) {
        // Create file input for upload
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Content = e.target.result.split(',')[1]; // Remove data:... prefix
                    const ws = this.sftpConnections[tabId];
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'upload',
                            data: JSON.stringify({
                                path: `/${file.name}`,
                                content: base64Content
                            })
                        }));
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    sftpSelectFile(tabId, filePath, element) {
        // Toggle file selection when clicking on a file
        const checkbox = element.querySelector('.sftp-file-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            this.sftpToggleFileSelection(tabId, filePath, checkbox);
        }
    }

    sftpToggleFileSelection(tabId, filePath, checkbox) {
        // Initialize selected files array if it doesn't exist
        if (!this.selectedSFTPFiles) {
            this.selectedSFTPFiles = {};
        }
        if (!this.selectedSFTPFiles[tabId]) {
            this.selectedSFTPFiles[tabId] = [];
        }

        if (checkbox.checked) {
            // Add file to selection if not already selected
            if (!this.selectedSFTPFiles[tabId].includes(filePath)) {
                this.selectedSFTPFiles[tabId].push(filePath);
            }
        } else {
            // Remove file from selection
            this.selectedSFTPFiles[tabId] = this.selectedSFTPFiles[tabId].filter(f => f !== filePath);
        }

        // Update UI to show selection count
        this.updateSFTPSelectionStatus(tabId);
    }

    updateSFTPSelectionStatus(tabId) {
        const selectedCount = this.selectedSFTPFiles[tabId] ? this.selectedSFTPFiles[tabId].length : 0;
        const downloadButton = document.querySelector(`#sftp-${tabId} .sftp-toolbar .btn-secondary`);
        if (downloadButton) {
            downloadButton.textContent = selectedCount > 0 ? `Download (${selectedCount})` : 'Download';
            downloadButton.disabled = selectedCount === 0;
        }
    }

    attachLocalFileEventListeners(tabId) {
        const fileList = document.querySelector(`#sftp-local-files-${tabId}`);
        if (!fileList) return;

        // Add click listeners to file items (but not checkboxes)
        fileList.addEventListener('click', (e) => {
            // Don't handle clicks on checkboxes - let them handle themselves
            if (e.target.classList.contains('sftp-file-checkbox')) {
                return;
            }
            
            const fileItem = e.target.closest('.sftp-file-item');
            if (!fileItem) return;

            const isDir = fileItem.dataset.isDir === 'true';
            const filePath = fileItem.dataset.path;

            if (isDir) {
                // Navigate to directory
                this.sftpListLocalDirectory(tabId, filePath);
            } else {
                // Toggle checkbox for files
                const checkbox = fileItem.querySelector('.sftp-file-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.sftpToggleLocalFileSelection(tabId, filePath, checkbox);
                }
            }
        });

        // Add change listeners to checkboxes
        fileList.addEventListener('change', (e) => {
            if (e.target.classList.contains('sftp-file-checkbox')) {
                const filePath = e.target.dataset.path;
                this.sftpToggleLocalFileSelection(tabId, filePath, e.target);
            }
        });

        // Add right-click context menu
        fileList.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const fileItem = e.target.closest('.sftp-file-item');
            if (fileItem) {
                this.showContextMenu(e, tabId, fileItem, 'local');
            } else {
                // Right-click on blank space
                this.showBlankSpaceContextMenu(e, tabId, 'local');
            }
        });

        // Add drag and drop listeners
        fileList.addEventListener('dragstart', (e) => {
            const fileItem = e.target.closest('.sftp-file-item');
            if (fileItem && fileItem.dataset.pane === 'local') {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: 'local-file',
                    path: fileItem.dataset.path,
                    name: fileItem.querySelector('.sftp-file-name').textContent,
                    isDir: fileItem.dataset.isDir === 'true'
                }));
                fileItem.classList.add('dragging');
            }
        });

        fileList.addEventListener('dragend', (e) => {
            const fileItem = e.target.closest('.sftp-file-item');
            if (fileItem) {
                fileItem.classList.remove('dragging');
            }
        });

        // Add drop listeners for local pane
        fileList.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileList.classList.add('drag-over');
        });

        fileList.addEventListener('dragleave', (e) => {
            fileList.classList.remove('drag-over');
        });

        fileList.addEventListener('drop', (e) => {
            e.preventDefault();
            fileList.classList.remove('drag-over');
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'remote-file') {
                    if (data.isDir) {
                        console.log('Cannot download directories yet');
                        const filesContainer = document.getElementById(`sftp-local-files-${tabId}`);
                        if (filesContainer) {
                            filesContainer.innerHTML = '<div class="sftp-info">Directory download not yet supported</div>';
                        }
                    } else {
                        this.downloadRemoteFileToLocal(tabId, data.path, data.name);
                    }
                }
            } catch (error) {
                console.error('Error handling drop:', error);
            }
        });
    }

    attachSFTPEventListeners(tabId) {
        const fileList = document.querySelector(`#sftp-remote-files-${tabId}`);
        if (!fileList) return;

        // Add click listeners to file items (but not checkboxes)
        fileList.addEventListener('click', (e) => {
            // Don't handle clicks on checkboxes - let them handle themselves
            if (e.target.classList.contains('sftp-file-checkbox')) {
                return;
            }
            
            const fileItem = e.target.closest('.sftp-file-item');
            if (!fileItem) return;

            const isDir = fileItem.dataset.isDir === 'true';
            const filePath = fileItem.dataset.path;

            if (isDir) {
                // Navigate to directory
                this.sftpListDirectory(tabId, filePath);
            } else {
                // Toggle checkbox for files
                const checkbox = fileItem.querySelector('.sftp-file-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.sftpToggleFileSelection(tabId, filePath, checkbox);
                }
            }
        });

        // Add change listeners to checkboxes
        fileList.addEventListener('change', (e) => {
            if (e.target.classList.contains('sftp-file-checkbox')) {
                const filePath = e.target.dataset.path;
                this.sftpToggleFileSelection(tabId, filePath, e.target);
            }
        });

        // Add right-click context menu
        fileList.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const fileItem = e.target.closest('.sftp-file-item');
            if (fileItem) {
                this.showContextMenu(e, tabId, fileItem, 'remote');
            } else {
                // Right-click on blank space
                this.showBlankSpaceContextMenu(e, tabId, 'remote');
            }
        });

                // Add drag and drop listeners for remote files
                fileList.addEventListener('dragstart', (e) => {
                    const fileItem = e.target.closest('.sftp-file-item');
                    if (fileItem && fileItem.dataset.pane === 'remote') {
                        e.dataTransfer.setData('text/plain', JSON.stringify({
                            type: 'remote-file',
                            path: fileItem.dataset.path,
                            name: fileItem.querySelector('.sftp-file-name').textContent,
                            isDir: fileItem.dataset.isDir === 'true'
                        }));
                        fileItem.classList.add('dragging');
                    }
                });

        fileList.addEventListener('dragend', (e) => {
            const fileItem = e.target.closest('.sftp-file-item');
            if (fileItem) {
                fileItem.classList.remove('dragging');
            }
        });

        // Add drop listeners for remote pane
        fileList.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileList.classList.add('drag-over');
        });

        fileList.addEventListener('dragleave', (e) => {
            fileList.classList.remove('drag-over');
        });

                fileList.addEventListener('drop', (e) => {
                    e.preventDefault();
                    fileList.classList.remove('drag-over');
                    
                    try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                        if (data.type === 'local-file') {
                            if (data.isDir) {
                                console.log('Cannot upload directories yet');
                                this.updateSFTPContent(tabId, '<div class="sftp-info">Directory upload not yet supported</div>');
                            } else {
                                this.uploadLocalFileToRemote(tabId, data.path, data.name);
                            }
                        }
                    } catch (error) {
                        console.error('Error handling drop:', error);
                    }
                });
    }

    sftpSelectAll(tabId, selectAllCheckbox) {
        const fileList = document.querySelector(`#sftp-remote-files-${tabId}`);
        if (!fileList) return;

        const checkboxes = fileList.querySelectorAll('.sftp-file-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            const filePath = checkbox.dataset.path;
            this.sftpToggleFileSelection(tabId, filePath, checkbox);
        });
    }

    sftpListLocalDirectory(tabId, path) {
        const currentPath = this.currentLocalPaths[tabId] || '/home/tim';
        console.log('Current path:', currentPath, 'Navigating to:', path);
        
        // Handle directory navigation
        if (path === '..') {
            // Go up one directory
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            // Allow going up to root directory, but default to /home/tim if we go too far
            if (parentPath === '' || parentPath === '/home') {
                this.currentLocalPaths[tabId] = '/home/tim';
            } else {
                this.currentLocalPaths[tabId] = parentPath || '/';
            }
        } else if (path.startsWith('/')) {
            // Absolute path
            this.currentLocalPaths[tabId] = path;
        } else {
            // Relative path - append to current path
            // Ensure we don't double-add the path
            let newPath;
            if (currentPath.endsWith('/')) {
                newPath = `${currentPath}${path}`;
            } else {
                newPath = `${currentPath}/${path}`;
            }
            this.currentLocalPaths[tabId] = newPath;
        }
        
        console.log('New local directory path:', this.currentLocalPaths[tabId]);
        this.loadLocalFiles(tabId);
    }

    sftpSelectAllLocal(tabId, selectAllCheckbox) {
        const fileList = document.querySelector(`#sftp-local-files-${tabId}`);
        if (!fileList) return;

        const checkboxes = fileList.querySelectorAll('.sftp-file-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            const filePath = checkbox.dataset.path;
            this.sftpToggleLocalFileSelection(tabId, filePath, checkbox);
        });
    }

    sftpToggleLocalFileSelection(tabId, filePath, checkbox) {
        // Initialize selected files array if it doesn't exist
        if (!this.selectedLocalFiles) {
            this.selectedLocalFiles = {};
        }
        if (!this.selectedLocalFiles[tabId]) {
            this.selectedLocalFiles[tabId] = [];
        }

        if (checkbox.checked) {
            // Add file to selection if not already selected
            if (!this.selectedLocalFiles[tabId].includes(filePath)) {
                this.selectedLocalFiles[tabId].push(filePath);
            }
        } else {
            // Remove file from selection
            this.selectedLocalFiles[tabId] = this.selectedLocalFiles[tabId].filter(f => f !== filePath);
        }

        // Update UI to show selection count
        this.updateLocalSelectionStatus(tabId);
    }

    updateLocalSelectionStatus(tabId) {
        const selectedCount = this.selectedLocalFiles[tabId] ? this.selectedLocalFiles[tabId].length : 0;
        const uploadButton = document.querySelector(`#sftp-${tabId} .sftp-toolbar .btn-secondary`);
        if (uploadButton) {
            uploadButton.textContent = selectedCount > 0 ? `Upload (${selectedCount})` : 'Upload Selected';
            uploadButton.disabled = selectedCount === 0;
        }
    }

    sftpSortLocal(tabId, sortBy) {
        console.log(`Sorting local files by ${sortBy} for tab ${tabId}`);
        
        // Get current sort state
        const currentSort = this.sortStates.local[tabId] || { field: null, direction: 'asc' };
        
        // Determine new sort direction
        let newDirection = 'asc';
        if (currentSort.field === sortBy && currentSort.direction === 'asc') {
            newDirection = 'desc';
        }
        
        // Update sort state
        this.sortStates.local[tabId] = { field: sortBy, direction: newDirection };
        
        // Get current files from the DOM and sort them
        this.sortCurrentFiles(tabId, 'local', sortBy, newDirection);
    }

    uploadLocalFileToRemote(tabId, localPath, fileName) {
        console.log(`Uploading ${localPath} to remote as ${fileName}`);
        // TODO: Implement actual file upload
        this.updateSFTPContent(tabId, `<div class="sftp-info">Uploading ${fileName} to remote server...</div>`);
    }

    downloadRemoteFileToLocal(tabId, remotePath, fileName) {
        console.log(`Downloading ${remotePath} to local as ${fileName}`);
        // Use the existing download functionality
        this.sftpDownloadFile(tabId, remotePath);
    }

    updateClickablePath(tabId, pane, currentPath) {
        const pathElement = document.getElementById(`sftp-${pane}-path-${tabId}`);
        if (!pathElement) return;

        // Split path into segments
        const segments = currentPath.split('/').filter(segment => segment !== '');
        let html = '';
        
        // Add root link
        html += `<span class="path-segment" onclick="app.navigateToPath('${tabId}', '${pane}', '/')">/</span>`;
        
        // Add each segment as a clickable link
        let currentSegmentPath = '';
        segments.forEach((segment, index) => {
            currentSegmentPath += '/' + segment;
            const isLast = index === segments.length - 1;
            const className = isLast ? 'path-segment path-segment-current' : 'path-segment';
            html += `<span class="${className}" onclick="app.navigateToPath('${tabId}', '${pane}', '${currentSegmentPath}')">${segment}</span>`;
        });
        
        pathElement.innerHTML = html;
    }

    navigateToPath(tabId, pane, path) {
        console.log(`Navigating to ${path} in ${pane} pane`);
        
        if (pane === 'local') {
            this.currentLocalPaths[tabId] = path;
            this.loadLocalFiles(tabId);
        } else if (pane === 'remote') {
            this.currentSFTPPaths[tabId] = path;
            this.sftpListDirectory(tabId, path);
        }
    }

    sortCurrentFiles(tabId, pane, sortBy, direction) {
        const filesContainer = document.getElementById(`sftp-${pane}-files-${tabId}`);
        if (!filesContainer) return;

        const fileList = filesContainer.querySelector('.sftp-file-list');
        if (!fileList) return;

        // Get all file items (excluding header)
        const fileItems = Array.from(fileList.querySelectorAll('.sftp-file-item')).filter(item => 
            !item.classList.contains('sftp-file-header')
        );

        // Sort the file items
        fileItems.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = a.querySelector('.sftp-file-name').textContent.toLowerCase();
                    bValue = b.querySelector('.sftp-file-name').textContent.toLowerCase();
                    break;
                case 'size':
                    aValue = this.parseFileSize(a.querySelector('.sftp-file-size').textContent);
                    bValue = this.parseFileSize(b.querySelector('.sftp-file-size').textContent);
                    break;
                case 'date':
                    aValue = new Date(a.querySelector('.sftp-file-date').textContent);
                    bValue = new Date(b.querySelector('.sftp-file-date').textContent);
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Re-append sorted items (preserving header)
        const header = fileList.querySelector('.sftp-file-header');
        fileItems.forEach(item => fileList.appendChild(item));

        // Update sort indicators
        this.updateSortIndicators(tabId, pane, sortBy, direction);
    }

    parseFileSize(sizeText) {
        if (!sizeText || sizeText === '') return 0;
        
        const units = { 'B': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024 };
        const match = sizeText.match(/^([\d.]+)\s*([A-Z]+)$/);
        
        if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2];
            return value * (units[unit] || 1);
        }
        
        return 0;
    }

    updateSortIndicators(tabId, pane, sortBy, direction) {
        const filesContainer = document.getElementById(`sftp-${pane}-files-${tabId}`);
        if (!filesContainer) return;

        // Reset all indicators
        const indicators = filesContainer.querySelectorAll('.sort-indicator');
        indicators.forEach(indicator => {
            indicator.textContent = '↕';
            indicator.style.color = '';
        });

        // Set active indicator
        const activeIndicator = filesContainer.querySelector(`.sftp-header-${sortBy} .sort-indicator`);
        if (activeIndicator) {
            activeIndicator.textContent = direction === 'asc' ? '↑' : '↓';
            activeIndicator.style.color = '#3b82f6';
        }
    }

    sftpRefreshLocal(tabId) {
        this.loadLocalFiles(tabId);
    }

    // File editor functions
    createNewFile(tabId) {
        // Determine which pane is active (local or remote)
        const activePane = this.getActivePane(tabId);
        this.showCreateFileModal(tabId, activePane);
    }

    showCreateFileModal(tabId, pane, targetDirectory = null) {
        // Use target directory if provided, otherwise use current path
        const currentPath = targetDirectory || (pane === 'local' ? (this.currentLocalPaths[tabId] || '/home/tim') : (this.currentSFTPPaths[tabId] || '/'));
        
        const modal = document.createElement('div');
        modal.className = 'create-file-modal';
        modal.id = `create-file-${tabId}`;
        modal.innerHTML = `
            <div class="create-file-content">
                <div class="create-file-header">
                    <h3 class="create-file-title">Create New File</h3>
                    <button class="create-file-close" onclick="app.closeCreateFileModal('${tabId}')">×</button>
                </div>
                <div class="create-file-info">
                    <p><span class="create-file-info-icon">🖥️</span><strong>Creating file on:</strong> ${pane === 'local' ? 'Local Machine' : 'Remote Machine'}</p>
                    <p><span class="create-file-info-icon">📁</span><strong>Target directory:</strong> ${currentPath}</p>
                </div>
                <div class="form-group">
                    <label for="filename-${tabId}">Filename</label>
                    <input type="text" id="filename-${tabId}" class="form-input" placeholder="Enter filename (e.g., example.txt)" autofocus />
                </div>
                <div class="create-file-actions">
                    <button class="create-file-btn create-file-btn-secondary" onclick="app.closeCreateFileModal('${tabId}')">Cancel</button>
                    <button class="create-file-btn create-file-btn-primary" onclick="app.createFileFromModal('${tabId}', '${pane}', '${currentPath}')">Create File</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus the input field and add Enter key support
        setTimeout(() => {
            const input = document.getElementById(`filename-${tabId}`);
            if (input) {
                input.focus();
                
                // Add Enter key support
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.createFileFromModal(tabId, pane, currentPath);
                    }
                });
            }
        }, 100);
    }

    closeCreateFileModal(tabId) {
        const modal = document.getElementById(`create-file-${tabId}`);
        if (modal) {
            modal.remove();
        }
    }

    createFileFromModal(tabId, pane, targetDirectory = null) {
        const input = document.getElementById(`filename-${tabId}`);
        const fileName = input.value.trim();
        
        if (!fileName) {
            alert('Please enter a filename');
            return;
        }
        
        // Close modal first
        this.closeCreateFileModal(tabId);
        
        // Create the file in the specified directory
        if (pane === 'local') {
            this.createLocalFileInDirectory(tabId, fileName, targetDirectory);
        } else {
            this.createRemoteFileInDirectory(tabId, fileName, targetDirectory);
        }
    }

    getActivePane(tabId) {
        // Check which pane was last interacted with
        const localPane = document.querySelector(`#sftp-local-files-${tabId}`);
        const remotePane = document.querySelector(`#sftp-remote-files-${tabId}`);
        
        // Check if remote pane has file content (indicating it's been used)
        if (remotePane && remotePane.innerHTML.includes('sftp-file-item') && !remotePane.innerHTML.includes('sftp-loading')) {
            return 'remote';
        }
        
        // Check if local pane has file content
        if (localPane && localPane.innerHTML.includes('sftp-file-item') && !localPane.innerHTML.includes('sftp-loading')) {
            return 'local';
        }
        
        // Default to local if both are empty or loading
        return 'local';
    }

    createLocalFile(tabId, fileName) {
        const currentPath = this.currentLocalPaths[tabId] || '/home/tim';
        const fullPath = currentPath === '/home/tim' ? `/home/tim/${fileName}` : `${currentPath}/${fileName}`;
        
        // Create empty file via backend
        this.createLocalFileViaAPI(fullPath, tabId);
    }

    createRemoteFile(tabId, fileName) {
        const currentPath = this.currentSFTPPaths[tabId] || '/';
        const fullPath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
        
        // Create empty file via SFTP
        this.createRemoteFileViaSFTP(tabId, fullPath);
    }

    createLocalFileInDirectory(tabId, fileName, targetDirectory) {
        const fullPath = targetDirectory === '/home/tim' ? `/home/tim/${fileName}` : `${targetDirectory}/${fileName}`;
        
        // Create empty file via backend
        this.createLocalFileViaAPI(fullPath, tabId);
    }

    createRemoteFileInDirectory(tabId, fileName, targetDirectory) {
        const fullPath = targetDirectory === '/' ? `/${fileName}` : `${targetDirectory}/${fileName}`;
        
        // Create empty file via SFTP
        this.createRemoteFileViaSFTP(tabId, fullPath);
    }

    async createLocalFileViaAPI(filePath, tabId) {
        try {
            const response = await fetch('/api/create-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: filePath, content: '' })
            });
            
            if (response.ok) {
                console.log('Local file created:', filePath);
                this.loadLocalFiles(tabId);
            } else {
                throw new Error('Failed to create local file');
            }
        } catch (error) {
            console.error('Error creating local file:', error);
            alert('Failed to create local file: ' + error.message);
        }
    }

    createRemoteFileViaSFTP(tabId, filePath) {
        const ws = this.sftpConnections[tabId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'create_file',
                data: JSON.stringify({ path: filePath, content: '' })
            }));
        } else {
            alert('SFTP connection not available');
        }
    }

    deleteSelectedFiles(tabId) {
        const activePane = this.getActivePane(tabId);
        if (activePane === 'local') {
            this.deleteSelectedLocalFiles(tabId);
        } else {
            this.deleteSelectedRemoteFiles(tabId);
        }
    }

    deleteSelectedLocalFiles(tabId) {
        const selectedFiles = this.selectedLocalFiles[tabId] || [];
        if (selectedFiles.length === 0) {
            alert('Please select files to delete');
            return;
        }
        
        if (confirm(`Delete ${selectedFiles.length} selected file(s)?`)) {
            this.deleteLocalFiles(tabId, selectedFiles);
        }
    }

    deleteSelectedRemoteFiles(tabId) {
        const selectedFiles = this.selectedSFTPFiles[tabId] || [];
        if (selectedFiles.length === 0) {
            alert('Please select files to delete');
            return;
        }
        
        if (confirm(`Delete ${selectedFiles.length} selected file(s)?`)) {
            this.deleteRemoteFiles(tabId, selectedFiles);
        }
    }

    async deleteLocalFiles(tabId, filePaths) {
        try {
            const response = await fetch('/api/delete-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paths: filePaths })
            });
            
            if (response.ok) {
                console.log('Local files deleted:', filePaths);
                this.loadLocalFiles(tabId);
                // Clear selection
                this.selectedLocalFiles[tabId] = [];
                this.updateLocalSelectionStatus(tabId);
            } else {
                throw new Error('Failed to delete local files');
            }
        } catch (error) {
            console.error('Error deleting local files:', error);
            alert('Failed to delete local files: ' + error.message);
        }
    }

    deleteRemoteFiles(tabId, filePaths) {
        const ws = this.sftpConnections[tabId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'delete_files',
                data: JSON.stringify({ paths: filePaths })
            }));
            // Clear selection
            this.selectedSFTPFiles[tabId] = [];
            this.updateSFTPSelectionStatus(tabId);
        } else {
            alert('SFTP connection not available');
        }
    }

    editFile(tabId, filePath, isRemote = false) {
        if (isRemote) {
            this.editRemoteFile(tabId, filePath);
        } else {
            this.editLocalFile(tabId, filePath);
        }
    }

    async editLocalFile(tabId, filePath) {
        try {
            const response = await fetch('/api/read-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: filePath })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.openFileEditor(tabId, filePath, data.content, false);
            } else {
                throw new Error('Failed to read local file');
            }
        } catch (error) {
            console.error('Error reading local file:', error);
            alert('Failed to read local file: ' + error.message);
        }
    }

    editRemoteFile(tabId, filePath) {
        const ws = this.sftpConnections[tabId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Store the file path for editing
            this.currentEditFile[tabId] = filePath;
            ws.send(JSON.stringify({
                type: 'read_file',
                data: JSON.stringify({ path: filePath })
            }));
        } else {
            alert('SFTP connection not available');
        }
    }

    openFileEditor(tabId, filePath, content, isRemote) {
        // Remove any existing editor
        this.closeFileEditor(tabId);
        
        const fileName = filePath.split('/').pop();
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const fileSize = new Blob([content]).size;
        const lineCount = content.split('\n').length;
        const charCount = content.length;
        
        // Determine file type icon
        const getFileIcon = (ext) => {
            const icons = {
                'js': '📄', 'ts': '📄', 'jsx': '⚛️', 'tsx': '⚛️',
                'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
                'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
                'json': '📋', 'xml': '📋', 'yaml': '📋', 'yml': '📋',
                'md': '📝', 'txt': '📄', 'log': '📊', 'sql': '🗄️',
                'sh': '🐚', 'bash': '🐚', 'zsh': '🐚', 'fish': '🐚',
                'go': '🐹', 'rs': '🦀', 'php': '🐘', 'rb': '💎',
                'swift': '🦉', 'kt': '🟣', 'scala': '🔴', 'r': '📊',
                'dockerfile': '🐳', 'docker': '🐳', 'yml': '📋'
            };
            return icons[ext] || '📄';
        };
        
        const modal = document.createElement('div');
        modal.className = 'file-editor-modal';
        modal.id = `editor-${tabId}`;
        modal.innerHTML = `
            <div class="file-editor-content">
                <div class="file-editor-header">
                    <div class="file-editor-title">
                        <span class="file-editor-title-icon">${getFileIcon(fileExtension)}</span>
                        <span>Edit File: ${fileName}</span>
                    </div>
                    <div class="file-editor-info">
                        <span>📁 ${filePath}</span>
                        <span>${isRemote ? '🌐 Remote' : '💻 Local'}</span>
                    </div>
                    <button class="file-editor-close" onclick="app.closeFileEditor('${tabId}')">×</button>
                </div>
                
                <div class="file-editor-toolbar">
                    <div class="file-editor-toolbar-left">
                        <button class="file-editor-btn file-editor-btn-primary" onclick="app.saveFile('${tabId}', '${filePath}', ${isRemote})">
                            💾 Save
                        </button>
                        <button class="file-editor-btn file-editor-btn-secondary" onclick="app.reloadFile('${tabId}', '${filePath}', ${isRemote})">
                            🔄 Reload
                        </button>
                        <button class="file-editor-btn file-editor-btn-secondary" onclick="app.formatCode('${tabId}', '${fileExtension}')">
                            ✨ Format
                        </button>
                        <button class="file-editor-btn file-editor-btn-secondary" onclick="app.findReplace('${tabId}')">
                            🔍 Find & Replace
                        </button>
                    </div>
                    <div class="file-editor-toolbar-right">
                        <div class="file-editor-status">
                            <div class="file-editor-status-item">
                                <span>📏</span>
                                <span id="line-count-${tabId}">${lineCount} lines</span>
                            </div>
                            <div class="file-editor-status-item">
                                <span>📝</span>
                                <span id="char-count-${tabId}">${charCount} chars</span>
                            </div>
                            <div class="file-editor-status-item">
                                <span>💾</span>
                                <span id="file-size-${tabId}">${this.formatFileSize(fileSize)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="file-editor-body">
                    <div class="file-editor-textarea-container">
                        <textarea 
                            id="file-content-${tabId}" 
                            class="file-editor-textarea" 
                            placeholder="Enter file content..."
                            spellcheck="false"
                        ></textarea>
                    </div>
                </div>
                
                <div class="file-editor-footer">
                    <div class="file-editor-actions">
                        <button class="file-editor-btn file-editor-btn-primary" onclick="app.saveFile('${tabId}', '${filePath}', ${isRemote})">
                            💾 Save File
                        </button>
                        <button class="file-editor-btn file-editor-btn-secondary" onclick="app.closeFileEditor('${tabId}')">
                            ❌ Cancel
                        </button>
                    </div>
                    <div class="file-editor-shortcuts">
                        <div class="file-editor-shortcut">
                            <span>Save:</span>
                            <span class="file-editor-shortcut-key">Ctrl+S</span>
                        </div>
                        <div class="file-editor-shortcut">
                            <span>Find:</span>
                            <span class="file-editor-shortcut-key">Ctrl+F</span>
                        </div>
                        <div class="file-editor-shortcut">
                            <span>Format:</span>
                            <span class="file-editor-shortcut-key">Ctrl+Shift+F</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Set content and add enhanced functionality
        setTimeout(() => {
            const textarea = document.getElementById(`file-content-${tabId}`);
            if (textarea) {
                textarea.value = content;
                
                // Enhanced keyboard shortcuts
                textarea.addEventListener('keydown', (e) => {
                    // Save shortcuts
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault();
                        this.saveFile(tabId, filePath, isRemote);
                    }
                    // Find shortcut
                    else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                        e.preventDefault();
                        this.findReplace(tabId);
                    }
                    // Format shortcut
                    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
                        e.preventDefault();
                        this.formatCode(tabId, fileExtension);
                    }
                    // Tab handling
                    else if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const value = textarea.value;
                        textarea.value = value.substring(0, start) + '    ' + value.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + 4;
                    }
                });
                
                // Auto-resize and update stats
                textarea.addEventListener('input', () => {
                    this.updateEditorStats(tabId);
                    this.autoResizeTextarea(textarea);
                });
                
                // Focus the textarea
                textarea.focus();
                this.autoResizeTextarea(textarea);
            }
        }, 100);
    }

    closeFileEditor(tabId) {
        const modal = document.getElementById(`editor-${tabId}`);
        if (modal) {
            modal.remove();
        }
    }

    updateEditorStats(tabId) {
        const textarea = document.getElementById(`file-content-${tabId}`);
        if (!textarea) return;
        
        const content = textarea.value;
        const lineCount = content.split('\n').length;
        const charCount = content.length;
        const fileSize = new Blob([content]).size;
        
        const lineCountEl = document.getElementById(`line-count-${tabId}`);
        const charCountEl = document.getElementById(`char-count-${tabId}`);
        const fileSizeEl = document.getElementById(`file-size-${tabId}`);
        
        if (lineCountEl) lineCountEl.textContent = `${lineCount} lines`;
        if (charCountEl) charCountEl.textContent = `${charCount} chars`;
        if (fileSizeEl) fileSizeEl.textContent = this.formatFileSize(fileSize);
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
    }

    reloadFile(tabId, filePath, isRemote) {
        if (isRemote) {
            this.editRemoteFile(tabId, filePath);
        } else {
            this.editLocalFile(tabId, filePath);
        }
    }

    formatCode(tabId, fileExtension) {
        const textarea = document.getElementById(`file-content-${tabId}`);
        if (!textarea) return;
        
        let content = textarea.value;
        
        // Basic formatting based on file type
        switch (fileExtension) {
            case 'json':
                try {
                    const parsed = JSON.parse(content);
                    content = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    alert('Invalid JSON format');
                    return;
                }
                break;
            case 'html':
                // Basic HTML formatting
                content = content
                    .replace(/></g, '>\n<')
                    .replace(/^\s+|\s+$/gm, '')
                    .split('\n')
                    .map(line => {
                        const depth = (line.match(/</g) || []).length - (line.match(/<\//g) || []).length;
                        return '  '.repeat(Math.max(0, depth)) + line.trim();
                    })
                    .join('\n');
                break;
            case 'css':
                // Basic CSS formatting
                content = content
                    .replace(/;/g, ';\n')
                    .replace(/\{/g, ' {\n')
                    .replace(/\}/g, '\n}\n')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .join('\n');
                break;
            case 'js':
            case 'ts':
                // Basic JavaScript formatting
                content = content
                    .replace(/;/g, ';\n')
                    .replace(/\{/g, ' {\n')
                    .replace(/\}/g, '\n}\n')
                    .replace(/,/g, ',\n')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .join('\n');
                break;
            default:
                // Generic formatting - just clean up whitespace
                content = content
                    .split('\n')
                    .map(line => line.trim())
                    .join('\n');
        }
        
        textarea.value = content;
        this.updateEditorStats(tabId);
    }

    findReplace(tabId) {
        const textarea = document.getElementById(`file-content-${tabId}`);
        if (!textarea) return;
        
        const findText = prompt('Find:', '');
        if (!findText) return;
        
        const replaceText = prompt('Replace with:', '');
        if (replaceText === null) return;
        
        const content = textarea.value;
        const newContent = content.replace(new RegExp(findText, 'g'), replaceText);
        
        if (newContent !== content) {
            textarea.value = newContent;
            this.updateEditorStats(tabId);
            alert(`Replaced ${(content.match(new RegExp(findText, 'g')) || []).length} occurrences`);
        } else {
            alert('No matches found');
        }
    }

    // Host Services Management
    openHostServices() {
        if (!this.currentHost) return;
        
        const modal = document.getElementById('host-services-modal');
        if (!modal) return;
        
        // Update modal info
        document.getElementById('host-services-name').textContent = this.currentHost.name;
        document.getElementById('host-services-address').textContent = this.currentHost.address;
        
        // Show modal
        modal.style.display = 'block';
        
        // Load services for this host
        this.loadHostServices();
    }

    closeHostServicesModal() {
        const modal = document.getElementById('host-services-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    loadHostServices() {
        if (!this.currentHost) return;
        
        const hostId = this.currentHost.id;
        const services = this.hostServices[hostId] || [];
        
        const servicesList = document.getElementById('host-services-list');
        const addServiceBtn = document.querySelector('.host-services-toolbar .host-services-btn-primary');
        
        if (!servicesList) return;
        
        if (services.length === 0) {
            // Hide the top Add Service button when no services exist
            if (addServiceBtn) {
                addServiceBtn.style.display = 'none';
            }
            
            servicesList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #a0aec0;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🌐</div>
                    <h3>No Services Configured</h3>
                    <p>Add services to quickly access websites and applications on this host.</p>
                    <button class="host-services-btn host-services-btn-primary" onclick="app.showAddServiceForm()">
                        ➕ Add Your First Service
                    </button>
                </div>
            `;
            return;
        }
        
        // Show the top Add Service button when services exist
        if (addServiceBtn) {
            addServiceBtn.style.display = 'inline-block';
        }
        
        servicesList.innerHTML = services.map(service => this.renderServiceItem(service)).join('');
    }

    renderServiceItem(service) {
        const getServiceIcon = (type) => {
            const icons = {
                'web': '🌐',
                'api': '⚡',
                'database': '🗄️',
                'ssh': '🔐',
                'ftp': '📁',
                'other': '🔧'
            };
            return icons[type] || icons.other;
        };
        
        const getServiceIconClass = (type) => {
            const classes = {
                'web': 'service-icon-web',
                'api': 'service-icon-api',
                'database': 'service-icon-db',
                'ssh': 'service-icon-ssh',
                'ftp': 'service-icon-ftp',
                'other': 'service-icon-other'
            };
            return classes[type] || classes.other;
        };
        
        const fullUrl = service.url.startsWith('http') ? service.url : `http://${service.url}`;
        
        return `
            <div class="host-service-item" onclick="app.openService('${service.id}')">
                <div class="host-service-header">
                    <div class="host-service-name">
                        <span class="host-service-icon ${getServiceIconClass(service.type)}">${getServiceIcon(service.type)}</span>
                        <span>${service.name}</span>
                    </div>
                    <div class="host-service-actions" onclick="event.stopPropagation()">
                        <button class="host-service-btn host-service-btn-primary" onclick="app.openService('${service.id}')">
                            🔗 Open
                        </button>
                        <button class="host-service-btn host-service-btn-secondary" onclick="app.showEditServiceForm('${service.id}')">
                            ✏️ Edit
                        </button>
                        <button class="host-service-btn host-service-btn-danger" onclick="app.deleteHostService('${service.id}')">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="host-service-details">
                    <div class="host-service-detail">
                        <div class="host-service-detail-label">URL</div>
                        <div class="host-service-detail-value">
                            <a href="${fullUrl}" target="_blank" class="host-service-url" onclick="event.stopPropagation()">
                                ${service.url}
                            </a>
                        </div>
                    </div>
                    <div class="host-service-detail">
                        <div class="host-service-detail-label">Type</div>
                        <div class="host-service-detail-value">${service.type}</div>
                    </div>
                    <div class="host-service-detail">
                        <div class="host-service-detail-label">Port</div>
                        <div class="host-service-detail-value">${service.port || 'Default'}</div>
                    </div>
                    <div class="host-service-detail">
                        <div class="host-service-detail-label">Description</div>
                        <div class="host-service-detail-value">${service.description || 'No description'}</div>
                    </div>
                </div>
            </div>
        `;
    }

    showAddServiceForm() {
        if (!this.currentHost) return;
        
        // Reset form
        document.getElementById('service-form').reset();
        document.getElementById('service-form-title').textContent = 'Add New Service';
        
        // Pre-fill host IP
        document.getElementById('service-host').value = this.currentHost.address;
        
        // Set default values
        document.getElementById('service-type').value = 'web';
        document.getElementById('service-protocol').value = 'http';
        
        // Clear editing state
        document.getElementById('service-form').dataset.editing = '';
        
        // Show modal
        document.getElementById('service-form-modal').style.display = 'block';
        
        // Update preview
        this.updateServicePreview();
        
        // Add event listeners for real-time preview
        this.attachServiceFormListeners();
    }

    showEditServiceForm(serviceId) {
        if (!this.currentHost) return;
        
        const hostId = this.currentHost.id;
        const service = this.hostServices[hostId]?.find(s => s.id === serviceId);
        if (!service) return;
        
        // Parse the service URL to extract components
        const urlParts = this.parseServiceUrl(service.url);
        
        // Populate form
        document.getElementById('service-name').value = service.name;
        document.getElementById('service-type').value = service.type;
        document.getElementById('service-host').value = urlParts.host;
        document.getElementById('service-port').value = urlParts.port || '';
        document.getElementById('service-path').value = urlParts.path || '';
        document.getElementById('service-protocol').value = urlParts.protocol;
        document.getElementById('service-description').value = service.description || '';
        
        // Set editing state
        document.getElementById('service-form').dataset.editing = serviceId;
        document.getElementById('service-form-title').textContent = 'Edit Service';
        
        // Show modal
        document.getElementById('service-form-modal').style.display = 'block';
        
        // Update preview
        this.updateServicePreview();
        
        // Add event listeners for real-time preview
        this.attachServiceFormListeners();
    }

    parseServiceUrl(url) {
        try {
            // Handle URLs that start with protocol
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const urlObj = new URL(url);
                return {
                    protocol: urlObj.protocol.replace(':', ''),
                    host: urlObj.hostname,
                    port: urlObj.port || '',
                    path: urlObj.pathname
                };
            }
            
            // Handle URLs without protocol (e.g., "host:port/path")
            const parts = url.split('/');
            const hostPort = parts[0];
            const path = parts.length > 1 ? '/' + parts.slice(1).join('/') : '';
            
            if (hostPort.includes(':')) {
                const [host, port] = hostPort.split(':');
                return {
                    protocol: 'http',
                    host: host,
                    port: port,
                    path: path
                };
            } else {
                return {
                    protocol: 'http',
                    host: hostPort,
                    port: '',
                    path: path
                };
            }
        } catch (error) {
            // Fallback for malformed URLs
            return {
                protocol: 'http',
                host: url,
                port: '',
                path: ''
            };
        }
    }

    attachServiceFormListeners() {
        const inputs = ['service-host', 'service-port', 'service-path', 'service-protocol'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.removeEventListener('input', this.updateServicePreview);
                element.addEventListener('input', () => this.updateServicePreview());
            }
        });
    }

    updateServicePreview() {
        const host = document.getElementById('service-host').value || '192.168.1.100';
        const port = document.getElementById('service-port').value;
        const path = document.getElementById('service-path').value || '';
        const protocol = document.getElementById('service-protocol').value || 'http';
        
        let url = `${protocol}://${host}`;
        if (port) {
            url += `:${port}`;
        }
        if (path) {
            url += path;
        }
        
        document.getElementById('service-preview-url').textContent = url;
    }

    closeServiceForm() {
        document.getElementById('service-form-modal').style.display = 'none';
    }

    saveService() {
        if (!this.currentHost) return;
        
        const name = document.getElementById('service-name').value.trim();
        const type = document.getElementById('service-type').value;
        const host = document.getElementById('service-host').value.trim();
        const port = document.getElementById('service-port').value.trim();
        const path = document.getElementById('service-path').value.trim();
        const protocol = document.getElementById('service-protocol').value;
        const description = document.getElementById('service-description').value.trim();
        
        if (!name || !type || !host) {
            alert('Please fill in all required fields (Name, Type, Host/IP)');
            return;
        }
        
        // Build URL
        let url = `${protocol}://${host}`;
        if (port) {
            url += `:${port}`;
        }
        if (path) {
            url += path;
        }
        
        const service = {
            id: Date.now().toString(),
            name: name,
            url: url,
            type: type,
            port: port || null,
            description: description || null
        };
        
        const hostId = this.currentHost.id;
        const form = document.getElementById('service-form');
        const isEditing = form.dataset.editing;
        
        if (isEditing) {
            // Edit existing service
            if (this.hostServices[hostId]) {
                const serviceIndex = this.hostServices[hostId].findIndex(s => s.id === isEditing);
                if (serviceIndex !== -1) {
                    service.id = isEditing; // Keep original ID
                    this.hostServices[hostId][serviceIndex] = service;
                }
            }
        } else {
            // Add new service
            if (!this.hostServices[hostId]) {
                this.hostServices[hostId] = [];
            }
            this.hostServices[hostId].push(service);
        }
        
        this.saveState();
        this.loadHostServices();
        this.closeServiceForm();
    }

    deleteHostService(serviceId) {
        if (!this.currentHost) return;
        
        if (!confirm('Are you sure you want to delete this service?')) return;
        
        const hostId = this.currentHost.id;
        if (this.hostServices[hostId]) {
            this.hostServices[hostId] = this.hostServices[hostId].filter(s => s.id !== serviceId);
            this.saveState();
            this.loadHostServices();
        }
    }

    openService(serviceId) {
        if (!this.currentHost) return;
        
        const hostId = this.currentHost.id;
        const service = this.hostServices[hostId]?.find(s => s.id === serviceId);
        if (!service) return;
        
        const fullUrl = service.url.startsWith('http') ? service.url : `http://${service.url}`;
        window.open(fullUrl, '_blank');
    }

    // Host Context Menu Functions
    showHostContextMenu(event, hostId) {
        event.preventDefault();
        
        const host = this.hosts.find(h => h.id === hostId);
        if (!host) return;
        
        // Remove any existing context menu
        this.hideHostContextMenu();
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'host-context-menu';
        contextMenu.id = 'host-context-menu';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        
        const services = this.hostServices[hostId] || [];
        
        // Build menu items
        const menuItems = [
            { 
                text: '🔗 Connect to Host', 
                action: () => this.connectToHost(hostId),
                separator: false
            },
            { 
                text: '✏️ Edit Host', 
                action: () => this.editHost(hostId),
                separator: false
            }
        ];
        
        // Add services if any exist (only URL-based services)
        const urlServices = services.filter(service => service.type === 'web' || service.url.startsWith('http'));
        if (urlServices.length > 0) {
            menuItems.push({ text: '', action: null, separator: true }); // Separator
            menuItems.push({ 
                text: '🌐 Quick Access', 
                action: null, 
                separator: false,
                submenu: urlServices.map(service => ({
                    text: `${this.getServiceIcon(service.type)} ${service.name}`,
                    action: () => this.openServiceFromContext(service.url),
                    separator: false
                }))
            });
        }
        
        // Add manage services option
        menuItems.push({ text: '', action: null, separator: true }); // Separator
        menuItems.push({ 
            text: '⚙️ Manage Services', 
            action: () => this.openHostServicesFromContext(hostId),
            separator: false
        });
        
        // Render menu items
        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'host-context-menu-separator';
                contextMenu.appendChild(separator);
            } else if (item.submenu) {
                // Create submenu for services
                const submenuItem = document.createElement('div');
                submenuItem.className = 'host-context-menu-item host-context-menu-submenu';
                submenuItem.innerHTML = `
                    <span>${item.text}</span>
                    <span class="host-context-menu-arrow">▶</span>
                `;
                
                const submenu = document.createElement('div');
                submenu.className = 'host-context-menu-submenu-items';
                item.submenu.forEach(subItem => {
                    const submenuSubItem = document.createElement('div');
                    submenuSubItem.className = 'host-context-menu-item host-context-menu-submenu-item';
                    submenuSubItem.textContent = subItem.text;
                    submenuSubItem.onclick = () => {
                        subItem.action();
                        this.hideHostContextMenu();
                    };
                    submenu.appendChild(submenuSubItem);
                });
                
                submenuItem.appendChild(submenu);
                contextMenu.appendChild(submenuItem);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'host-context-menu-item';
                menuItem.textContent = item.text;
                menuItem.onclick = () => {
                    item.action();
                    this.hideHostContextMenu();
                };
                contextMenu.appendChild(menuItem);
            }
        });
        
        document.body.appendChild(contextMenu);
        
        // Hide context menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.hideHostContextMenu.bind(this), { once: true });
        }, 100);
    }

    hideHostContextMenu() {
        const contextMenu = document.getElementById('host-context-menu');
        if (contextMenu) {
            contextMenu.remove();
        }
    }

    getServiceIcon(type) {
        const icons = {
            'web': '🌐',
            'api': '⚡',
            'database': '🗄️',
            'ssh': '🔐',
            'ftp': '📁',
            'other': '🔧'
        };
        return icons[type] || icons.other;
    }

    openServiceFromContext(url) {
        const fullUrl = url.startsWith('http') ? url : `http://${url}`;
        window.open(fullUrl, '_blank');
    }

    openHostServicesFromContext(hostId) {
        const host = this.hosts.find(h => h.id === hostId);
        if (!host) return;
        
        // Set current host and open services modal
        this.currentHost = host;
        this.openHostServices();
    }

    saveFile(tabId, filePath, isRemote) {
        const content = document.getElementById(`file-content-${tabId}`).value;
        
        if (isRemote) {
            this.saveRemoteFile(tabId, filePath, content);
        } else {
            this.saveLocalFile(tabId, filePath, content);
        }
    }

    async saveLocalFile(tabId, filePath, content) {
        try {
            const response = await fetch('/api/write-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: filePath, content: content })
            });
            
            if (response.ok) {
                console.log('Local file saved:', filePath);
                this.closeFileEditor(tabId);
                this.loadLocalFiles(tabId);
            } else {
                throw new Error('Failed to save local file');
            }
        } catch (error) {
            console.error('Error saving local file:', error);
            alert('Failed to save local file: ' + error.message);
        }
    }

    saveRemoteFile(tabId, filePath, content) {
        const ws = this.sftpConnections[tabId];
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'write_file',
                data: JSON.stringify({ path: filePath, content: content })
            }));
        } else {
            alert('SFTP connection not available');
        }
    }

    // Context menu functionality
    showContextMenu(event, tabId, fileItem, pane) {
        // Remove any existing context menu
        this.hideContextMenu();
        
        const isDir = fileItem.dataset.isDir === 'true';
        const filePath = fileItem.dataset.path;
        const fileName = fileItem.querySelector('.sftp-file-name').textContent;
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.id = 'context-menu';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        
        let menuItems = [];
        
        if (isDir) {
            menuItems = [
                { text: '📁 Open Folder', action: () => this.openFolder(tabId, filePath, pane) },
                { text: '📄 Create New File', action: () => this.createNewFileInDirectory(tabId, filePath, pane) },
                { text: '🔄 Refresh', action: () => this.refreshPane(tabId, pane) }
            ];
        } else {
            menuItems = [
                { text: '✏️ Edit File', action: () => this.editFile(tabId, filePath, pane === 'remote') },
                { text: '📥 Download', action: () => this.downloadFile(tabId, filePath, pane) },
                { text: '🗑️ Delete', action: () => this.deleteFile(tabId, filePath, pane) },
                { text: '📄 Create New File', action: () => this.createNewFileInDirectory(tabId, filePath, pane) },
                { text: '🔄 Refresh', action: () => this.refreshPane(tabId, pane) }
            ];
        }
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.text;
            menuItem.onclick = () => {
                item.action();
                this.hideContextMenu();
            };
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        // Hide context menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 100);
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
            contextMenu.remove();
        }
    }

    showBlankSpaceContextMenu(event, tabId, pane) {
        // Remove any existing context menu
        this.hideContextMenu();
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.id = 'context-menu';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        
        const menuItems = [
            { text: '📄 Create New File', action: () => this.createNewFileInCurrentDirectory(tabId, pane) },
            { text: '🔄 Refresh', action: () => this.refreshPane(tabId, pane) }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.text;
            menuItem.onclick = () => {
                item.action();
                this.hideContextMenu();
            };
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        // Hide context menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 100);
    }

    createNewFileInCurrentDirectory(tabId, pane) {
        // Get current directory path
        const currentPath = pane === 'local' ? (this.currentLocalPaths[tabId] || '/home/tim') : (this.currentSFTPPaths[tabId] || '/');
        
        // Show the create file modal with the current directory
        this.showCreateFileModal(tabId, pane, currentPath);
    }

    openFolder(tabId, filePath, pane) {
        if (pane === 'local') {
            this.sftpListLocalDirectory(tabId, filePath);
        } else {
            this.sftpListDirectory(tabId, filePath);
        }
    }

    downloadFile(tabId, filePath, pane) {
        if (pane === 'local') {
            // For local files, we need to read and download
            this.downloadLocalFile(tabId, filePath);
        } else {
            // For remote files, use existing download
            this.sftpDownloadFile(tabId, filePath);
        }
    }

    async downloadLocalFile(tabId, filePath) {
        try {
            const response = await fetch('/api/read-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: filePath })
            });
            
            if (response.ok) {
                const data = await response.json();
                const fileName = filePath.split('/').pop();
                this.downloadFile(data.content, fileName);
            } else {
                throw new Error('Failed to read local file');
            }
        } catch (error) {
            console.error('Error downloading local file:', error);
            alert('Failed to download local file: ' + error.message);
        }
    }

    deleteFile(tabId, filePath, pane) {
        if (confirm(`Delete "${filePath.split('/').pop()}"?`)) {
            if (pane === 'local') {
                this.deleteLocalFiles(tabId, [filePath]);
            } else {
                this.deleteRemoteFiles(tabId, [filePath]);
            }
        }
    }

    refreshPane(tabId, pane) {
        if (pane === 'local') {
            this.sftpRefreshLocal(tabId);
        } else {
            this.sftpRefresh(tabId);
        }
    }

    createNewFileInDirectory(tabId, filePath, pane) {
        // For files, get the parent directory
        let targetDirectory;
        if (pane === 'local') {
            // If it's a file, get parent directory; if it's a directory, use it directly
            targetDirectory = filePath;
            // Update the current path to the target directory
            this.currentLocalPaths[tabId] = targetDirectory;
        } else {
            // If it's a file, get parent directory; if it's a directory, use it directly
            targetDirectory = filePath;
            // Update the current path to the target directory
            this.currentSFTPPaths[tabId] = targetDirectory;
        }
        
        // Show the create file modal with the target directory
        this.showCreateFileModal(tabId, pane, targetDirectory);
    }

    // Persistence methods
    initializePersistence() {
        // Load saved state on startup
        this.loadSavedState();
        
        // Save state periodically
        setInterval(() => {
            this.saveState();
        }, 5000); // Save every 5 seconds
        
        // Save state before page unload
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }

    saveState() {
        const state = {
            hosts: this.hosts,
            groups: this.groups,
            tags: this.tags,
            tabs: this.tabs.filter(tab => tab.id !== 'main'), // Don't save main tab
            activeTab: this.activeTab,
            currentHost: this.currentHost,
            currentGroup: this.currentGroup,
            selectedGroup: this.selectedGroup,
            sidebarCollapsed: this.sidebarCollapsed,
            integrations: this.integrations,
            currentSFTPPaths: this.currentSFTPPaths,
            currentLocalPaths: this.currentLocalPaths,
            showHiddenFiles: this.showHiddenFiles,
            sortStates: this.sortStates,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('blackjack_state', JSON.stringify(state));
            console.log('State saved to localStorage');
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    loadSavedState() {
        try {
            const savedState = localStorage.getItem('blackjack_state');
            if (!savedState) return;
            
            const state = JSON.parse(savedState);
            
            // Check if state is not too old (24 hours)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            if (Date.now() - state.timestamp > maxAge) {
                console.log('Saved state is too old, ignoring');
                return;
            }
            
            // Restore application state
            this.hosts = state.hosts || [];
            this.groups = state.groups || [];
            this.tags = state.tags || [];
            this.currentHost = state.currentHost;
            this.currentGroup = state.currentGroup;
            this.selectedGroup = state.selectedGroup;
            this.sidebarCollapsed = state.sidebarCollapsed || false;
            this.integrations = state.integrations || { tailscale: false };
            this.currentSFTPPaths = state.currentSFTPPaths || {};
            this.currentLocalPaths = state.currentLocalPaths || {};
            this.showHiddenFiles = state.showHiddenFiles || { local: {}, remote: {} };
            this.sortStates = state.sortStates || { local: {}, remote: {} };
            
            // Restore UI
            this.renderHosts();
            this.renderGroups();
            this.renderTags();
            this.updateIntegrations();
            
            // Restore tabs (but not active connections)
            if (state.tabs && state.tabs.length > 0) {
                console.log('Restoring tabs:', state.tabs);
                this.restoreTabs(state.tabs);
            }
            
            // Restore active tab
            if (state.activeTab && state.activeTab !== 'main') {
                this.switchTab(state.activeTab);
            }
            
            console.log('State restored from localStorage');
        } catch (error) {
            console.error('Failed to load saved state:', error);
        }
    }

    restoreTabs(savedTabs) {
        // Clear existing tabs (except main)
        const existingTabs = document.querySelectorAll('.tab:not([data-tab="main"])');
        existingTabs.forEach(tab => tab.remove());
        
        const existingContent = document.querySelectorAll('.tab-content:not(#main-content)');
        existingContent.forEach(content => content.remove());
        
        // Reset tabs array
        this.tabs = [{ id: 'main', title: 'BlackJack', type: 'main' }];
        
        // Restore each saved tab
        savedTabs.forEach(tabData => {
            if (tabData.type === 'ssh') {
                this.restoreSSHTab(tabData);
            } else if (tabData.type === 'sftp') {
                this.restoreSFTPTab(tabData);
            }
        });
    }

    restoreSSHTab(tabData) {
        // Create tab element
        const tab = document.createElement('div');
        tab.className = 'tab draggable';
        tab.dataset.tab = tabData.id;
        tab.draggable = true;
        tab.innerHTML = `
            <span class="tab-title">${tabData.title}</span>
            <button class="tab-close" onclick="app.closeTab('${tabData.id}')">×</button>
        `;
        
        // Add drag listeners
        tab.addEventListener('dragstart', (e) => this.handleDragStart(e));
        tab.addEventListener('dragover', (e) => this.handleDragOver(e));
        tab.addEventListener('drop', (e) => this.handleDrop(e));
        tab.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        // Insert tab
        const newTabBtn = document.querySelector('.new-tab-btn');
        newTabBtn.parentNode.insertBefore(tab, newTabBtn);
        
        // Create tab content
        const tabContent = document.createElement('div');
        tabContent.id = `${tabData.id}-content`;
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `
            <div class="terminal-container">
                <div class="terminal" id="terminal-${tabData.id}"></div>
            </div>
        `;
        
        document.querySelector('.content-area').appendChild(tabContent);
        
        // Add to tabs array
        this.tabs.push(tabData);
        
        // Show placeholder message
        const terminal = document.getElementById(`terminal-${tabData.id}`);
        if (terminal) {
            terminal.innerHTML = `
                <div class="terminal-placeholder">
                    <h3>SSH Session Restored</h3>
                    <p>This SSH session was restored from a previous session.</p>
                    <p>Click "Connect" to establish a new connection.</p>
                    <button class="btn btn-primary" onclick="app.connectSSH()">Connect</button>
                </div>
            `;
        }
    }

    restoreSFTPTab(tabData) {
        // Create tab element
        const tab = document.createElement('div');
        tab.className = 'tab draggable';
        tab.dataset.tab = tabData.id;
        tab.draggable = true;
        tab.innerHTML = `
            <span class="tab-title">${tabData.title}</span>
            <button class="tab-close" onclick="app.closeTab('${tabData.id}')">×</button>
        `;
        
        // Add drag listeners
        tab.addEventListener('dragstart', (e) => this.handleDragStart(e));
        tab.addEventListener('dragover', (e) => this.handleDragOver(e));
        tab.addEventListener('drop', (e) => this.handleDrop(e));
        tab.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        // Insert tab
        const newTabBtn = document.querySelector('.new-tab-btn');
        newTabBtn.parentNode.insertBefore(tab, newTabBtn);
        
        // Create tab content
        const tabContent = document.createElement('div');
        tabContent.id = `${tabData.id}-content`;
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `
            <div class="sftp-browser" id="sftp-${tabData.id}">
                <div class="sftp-toolbar">
                    <button class="btn btn-primary" onclick="app.sftpRefresh('${tabData.id}')">Refresh Remote</button>
                    <button class="btn btn-primary" onclick="app.sftpRefreshLocal('${tabData.id}')">Refresh Local</button>
                    <button class="btn btn-secondary" onclick="app.sftpUpload('${tabData.id}')">Upload Selected</button>
                    <button class="btn btn-secondary" onclick="app.sftpDownload('${tabData.id}')">Download Selected</button>
                </div>
                <div class="sftp-dual-pane">
                    <div class="sftp-pane sftp-local-pane">
                        <div class="sftp-pane-header">
                            <h4>Local Files</h4>
                            <div class="sftp-header-controls">
                                <label class="sftp-toggle">
                                    <input type="checkbox" id="sftp-local-hidden-${tabData.id}" onchange="app.toggleHiddenFiles('${tabData.id}', 'local', this.checked)" />
                                    Show Hidden
                                </label>
                            </div>
                            <div class="sftp-path" id="sftp-local-path-${tabData.id}">/home/tim</div>
                        </div>
                        <div class="sftp-files" id="sftp-local-files-${tabData.id}">
                            <div class="sftp-placeholder">
                                <h3>SFTP Session Restored</h3>
                                <p>This SFTP session was restored from a previous session.</p>
                                <p>Click "Connect" to establish a new connection.</p>
                                <button class="btn btn-primary" onclick="app.connectSFTP()">Connect</button>
                            </div>
                        </div>
                    </div>
                    <div class="sftp-pane sftp-remote-pane">
                        <div class="sftp-pane-header">
                            <h4>Remote Files (${tabData.host?.name || 'Unknown'})</h4>
                            <div class="sftp-header-controls">
                                <label class="sftp-toggle">
                                    <input type="checkbox" id="sftp-remote-hidden-${tabData.id}" onchange="app.toggleHiddenFiles('${tabData.id}', 'remote', this.checked)" />
                                    Show Hidden
                                </label>
                            </div>
                            <div class="sftp-path" id="sftp-remote-path-${tabData.id}">/</div>
                        </div>
                        <div class="sftp-files" id="sftp-remote-files-${tabData.id}">
                            <div class="sftp-placeholder">
                                <h3>SFTP Session Restored</h3>
                                <p>This SFTP session was restored from a previous session.</p>
                                <p>Click "Connect" to establish a new connection.</p>
                                <button class="btn btn-primary" onclick="app.connectSFTP()">Connect</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelector('.content-area').appendChild(tabContent);
        
        // Add to tabs array
        this.tabs.push(tabData);
        
        // Restore paths and settings
        if (this.currentSFTPPaths[tabData.id]) {
            document.getElementById(`sftp-remote-path-${tabData.id}`).innerHTML = this.currentSFTPPaths[tabData.id];
        }
        if (this.currentLocalPaths[tabData.id]) {
            document.getElementById(`sftp-local-path-${tabData.id}`).innerHTML = this.currentLocalPaths[tabData.id];
        }
        if (this.showHiddenFiles.local[tabData.id]) {
            document.getElementById(`sftp-local-hidden-${tabData.id}`).checked = true;
        }
        if (this.showHiddenFiles.remote[tabData.id]) {
            document.getElementById(`sftp-remote-hidden-${tabData.id}`).checked = true;
        }
    }

    toggleHiddenFiles(tabId, pane, showHidden) {
        this.showHiddenFiles[pane][tabId] = showHidden;
        console.log(`Toggling hidden files for ${pane} pane:`, showHidden);
        
        if (pane === 'local') {
            this.loadLocalFiles(tabId);
        } else if (pane === 'remote') {
            const currentPath = this.currentSFTPPaths[tabId] || '/';
            this.sftpListDirectory(tabId, currentPath);
        }
    }

    sftpSort(tabId, sortBy) {
        console.log(`Sorting remote files by ${sortBy} for tab ${tabId}`);
        
        // Get current sort state
        const currentSort = this.sortStates.remote[tabId] || { field: null, direction: 'asc' };
        
        // Determine new sort direction
        let newDirection = 'asc';
        if (currentSort.field === sortBy && currentSort.direction === 'asc') {
            newDirection = 'desc';
        }
        
        // Update sort state
        this.sortStates.remote[tabId] = { field: sortBy, direction: newDirection };
        
        // Get current files from the DOM and sort them
        this.sortCurrentFiles(tabId, 'remote', sortBy, newDirection);
    }

    sftpDownload(tabId) {
        const selectedFiles = this.selectedSFTPFiles[tabId];
        if (!selectedFiles || selectedFiles.length === 0) {
            this.updateSFTPContent(tabId, '<div class="sftp-info">Please select files to download by checking the boxes</div>');
            return;
        }

        // Download each selected file
        selectedFiles.forEach((filePath, index) => {
            setTimeout(() => {
                this.sftpDownloadFile(tabId, filePath);
            }, index * 500); // Stagger downloads by 500ms
        });

        // Clear selection after download
        this.selectedSFTPFiles[tabId] = [];
        this.updateSFTPSelectionStatus(tabId);
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
                    
                    // Automatic fallback to password if SSH key authentication fails
                    if ((message.data.includes('authentication failed') || message.data.includes('unable to authenticate')) && host.password) {
                        terminal.write('\r\nSSH key authentication failed. Automatically trying password authentication...\r\n');
                        
                        // Send password authentication request
                        ws.send(JSON.stringify({
                            type: 'connect',
                            data: JSON.stringify({
                                host: host.address,
                                port: host.port || 22,
                                username: host.user,
                                password: host.password,
                                keyPath: ''
                            })
                        }));
                    } else if ((message.data.includes('authentication failed') || message.data.includes('unable to authenticate')) && !host.password) {
                        terminal.write('\r\nSSH key authentication failed and no password is stored. Please add a password to enable automatic fallback.\r\n');
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

    // Encrypted data storage methods
    async saveEncryptedData(type, data) {
        try {
            const response = await fetch('/api/data/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: type,
                    data: data
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to save ${type} data: ${response.statusText}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || `Failed to save ${type} data`);
            }

            console.log(`${type} data saved successfully`);
            return true;
        } catch (error) {
            console.error(`Error saving ${type} data:`, error);
            // Fallback to localStorage if encrypted storage fails
            this.fallbackToLocalStorage(type, data);
            return false;
        }
    }

    async loadEncryptedData(type) {
        try {
            const response = await fetch(`/api/data/load?type=${type}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load ${type} data: ${response.statusText}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || `Failed to load ${type} data`);
            }

            console.log(`${type} data loaded successfully`);
            return result.data;
        } catch (error) {
            console.error(`Error loading ${type} data:`, error);
            // Fallback to localStorage if encrypted storage fails
            return this.fallbackFromLocalStorage(type);
        }
    }

    fallbackToLocalStorage(type, data) {
        console.warn(`Falling back to localStorage for ${type} data`);
        try {
            localStorage.setItem(`blackjack-${type}`, JSON.stringify(data));
        } catch (error) {
            console.error(`Failed to save ${type} to localStorage:`, error);
        }
    }

    fallbackFromLocalStorage(type) {
        console.warn(`Loading ${type} data from localStorage fallback`);
        try {
            const saved = localStorage.getItem(`blackjack-${type}`);
            return saved ? JSON.parse(saved) : (type === 'hosts' ? [] : type === 'groups' ? [] : type === 'tags' ? [] : {});
        } catch (error) {
            console.error(`Failed to load ${type} from localStorage:`, error);
            return type === 'hosts' ? [] : type === 'groups' ? [] : type === 'tags' ? [] : {};
        }
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
        
        // Clean up SSH WebSocket connection
        if (this.websockets && this.websockets[tabId]) {
            console.log('Closing SSH WebSocket for tab:', tabId);
            // Send disconnect message before closing
            if (this.websockets[tabId].readyState === WebSocket.OPEN) {
                this.websockets[tabId].send(JSON.stringify({ type: 'disconnect' }));
            }
            this.websockets[tabId].close();
            delete this.websockets[tabId];
        }
        
        // Clean up SFTP WebSocket connection
        if (this.sftpConnections && this.sftpConnections[tabId]) {
            console.log('Closing SFTP WebSocket for tab:', tabId);
            // Send disconnect message before closing
            if (this.sftpConnections[tabId].readyState === WebSocket.OPEN) {
                this.sftpConnections[tabId].send(JSON.stringify({ type: 'disconnect' }));
            }
            this.sftpConnections[tabId].close();
            delete this.sftpConnections[tabId];
        }
        
        // Clean up terminal
        if (this.terminals && this.terminals[tabId]) {
            console.log('Disposing terminal for tab:', tabId);
            this.terminals[tabId].terminal.dispose();
            delete this.terminals[tabId];
        }
        
        // Clean up selected files arrays
        if (this.selectedSFTPFiles && this.selectedSFTPFiles[tabId]) {
            delete this.selectedSFTPFiles[tabId];
        }
        if (this.selectedLocalFiles && this.selectedLocalFiles[tabId]) {
            delete this.selectedLocalFiles[tabId];
        }
        
        // Clean up path tracking
        if (this.currentSFTPPaths && this.currentSFTPPaths[tabId]) {
            delete this.currentSFTPPaths[tabId];
        }
        if (this.currentLocalPaths && this.currentLocalPaths[tabId]) {
            delete this.currentLocalPaths[tabId];
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
        
        console.log('Tab closed and cleaned up:', tabId);
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
        
        // Show Services button for existing hosts
        const servicesBtn = document.getElementById('host-services-btn');
        if (servicesBtn) {
            servicesBtn.style.display = 'inline-block';
        }
        
        // Reset SSH key button to initial state
        this.resetSSHKeyButton();
        
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
                        this.updateButtonState('success', 'Disabled', '✅');
                        this.showValidationStatus('✅ SSH key authentication successful! Password field will be disabled. If SSH keys fail during connection, password will be used automatically.', 'success');
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

    resetSSHKeyButton() {
        const btn = document.getElementById('ssh-key-test-btn');
        if (btn) {
            btn.disabled = false;
            btn.className = 'ssh-key-btn';
            btn.querySelector('.btn-text').textContent = 'Test SSH Key';
            btn.querySelector('.btn-icon').textContent = '🔑';
        }
        this.hideValidationStatus();
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

// Global logout function
async function logout() {
    await app.logout();
}

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

function connectSFTP() {
    app.connectSFTP();
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
    console.log('Opening settings modal...');
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.display = 'block';
        console.log('Settings modal displayed');
        
        // Setup the modal if not already done
        if (window.app) {
            window.app.setupSettingsModal();
        }
    } else {
        console.error('Settings modal not found!');
    }
}

function saveSettings() {
    if (window.app) {
        window.app.saveSettings();
    }
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
