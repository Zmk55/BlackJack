// BlackJack GUI Application
class BlackJackApp {
    constructor() {
        this.hosts = [];
        this.tabs = [];
        this.activeTab = 'main';
        this.currentHost = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadHosts();
        this.renderHosts();
    }

    setupEventListeners() {
        // Add host form
        document.getElementById('add-host-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addHost();
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

    async loadHosts() {
        try {
            const response = await fetch('/api/hosts');
            this.hosts = await response.json();
        } catch (error) {
            console.error('Failed to load hosts:', error);
            // Fallback to sample data
            this.hosts = [
                { id: '1', name: 'Adguard.local', address: '192.168.1.57', user: 'tim', port: 22 },
                { id: '2', name: 'Web Server', address: '192.168.1.100', user: 'admin', port: 22 },
                { id: '3', name: 'Database', address: '192.168.1.101', user: 'root', port: 22 }
            ];
        }
    }

    renderHosts() {
        const hostList = document.getElementById('host-list');
        const hostTableBody = document.getElementById('host-table-body');
        
        // Render sidebar host list
        hostList.innerHTML = this.hosts.map(host => `
            <div class="host-item" data-host-id="${host.id}" onclick="app.selectHost('${host.id}')">
                <span>${host.name}</span>
                <span class="host-status">●</span>
            </div>
        `).join('');

        // Render main table
        hostTableBody.innerHTML = this.hosts.map(host => `
            <tr>
                <td>${host.name}</td>
                <td>${host.address}</td>
                <td>${host.user}</td>
                <td>${host.port}</td>
                <td>
                    <button class="btn btn-primary" onclick="app.connectToHost('${host.id}')">Connect</button>
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

    showConnectionModal() {
        document.getElementById('connection-modal').style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showAddHost() {
        document.getElementById('add-host-modal').style.display = 'block';
    }

    addHost() {
        const name = document.getElementById('host-name').value;
        const address = document.getElementById('host-address').value;
        const user = document.getElementById('host-user').value;
        const port = parseInt(document.getElementById('host-port').value);

        const newHost = {
            id: Date.now().toString(),
            name,
            address,
            user,
            port
        };

        this.hosts.push(newHost);
        this.renderHosts();
        this.closeModal('add-host-modal');
        
        // Clear form
        document.getElementById('add-host-form').reset();
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
        tab.className = 'tab';
        tab.dataset.tab = tabId;
        tab.innerHTML = `
            <span class="tab-title">${tabTitle}</span>
            <button class="tab-close" onclick="app.closeTab('${tabId}')">×</button>
        `;
        
        // Insert before new tab button
        const newTabBtn = document.querySelector('.new-tab-btn');
        newTabBtn.parentNode.insertBefore(tab, newTabBtn);
        
        // Create tab content
        const tabContent = document.createElement('div');
        tabContent.id = `${tabId}-content`;
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `
            <div class="ssh-terminal" id="terminal-${tabId}">
                <div class="terminal-line">Connecting to ${host.user}@${host.address}:${host.port}...</div>
                <div class="terminal-line">SSH connection established</div>
                <div class="terminal-line">${host.user}@${host.name}:~$ <span class="terminal-cursor"> </span></div>
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
    }

    switchTab(tabId) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`${tabId}-content`).classList.add('active');
        
        this.activeTab = tabId;
    }

    closeTab(tabId) {
        // Remove tab element
        document.querySelector(`[data-tab="${tabId}"]`).remove();
        
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
        // For now, just show the connection modal
        this.showConnectionModal();
    }

    executeSSHCommand(host, command) {
        // This would integrate with your Go backend
        console.log(`Executing SSH command: ${command} on ${host.name}`);
        // For now, just show an alert
        alert(`SSH Command: ${command}\nHost: ${host.name}\n\nThis would execute the command via your Go backend.`);
    }

    showSettings() {
        alert('Settings - This would open the settings panel');
    }

    showSessions() {
        alert('Sessions - This would show active SSH sessions');
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

function showSettings() {
    app.showSettings();
}

function showSessions() {
    app.showSessions();
}

function closeTab(tabId) {
    app.closeTab(tabId);
}
