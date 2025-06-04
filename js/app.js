class AttendanceApp {
    constructor() {
        this.currentStatus = 'ready';
        this.checkInTime = null;
        this.eventListeners = {};
        
        this.init();
    }

    async init() {
        try {
            await attendanceDB.init();
            await this.loadCurrentStatus();
            this.setupEventListeners();
            this.updateUI();
            this.requestLocationPermission();
            this.schedulePeriodicUpdates();
            
            console.log('Attendance App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showNotification('Failed to initialize app', 'error');
        }
    }

    async loadCurrentStatus() {
        try {
            const lastRecord = await attendanceDB.getLastRecord();
            
            if (lastRecord) {
                const today = new Date().toISOString().split('T')[0];
                const recordDate = new Date(lastRecord.timestamp).toISOString().split('T')[0];
                
                if (recordDate === today) {
                    if (lastRecord.type === 'check-in') {
                        this.currentStatus = 'checked-in';
                        this.checkInTime = lastRecord.timestamp;
                    } else {
                        this.currentStatus = 'ready';
                        this.checkInTime = null;
                    }
                } else {
                    this.currentStatus = 'ready';
                    this.checkInTime = null;
                }
            }
        } catch (error) {
            console.error('Failed to load current status:', error);
        }
    }

    setupEventListeners() {
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        const viewAllBtn = document.getElementById('viewAllBtn');
        const closeModal = document.getElementById('closeModal');
        const filterBtn = document.getElementById('filterBtn');
        const closeNotification = document.getElementById('closeNotification');

        if (checkInBtn) {
            checkInBtn.addEventListener('click', () => this.handleCheckIn());
        }

        if (checkOutBtn) {
            checkOutBtn.addEventListener('click', () => this.handleCheckOut());
        }

        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => this.openHistoryModal());
        }

        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeHistoryModal());
        }

        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.filterHistory());
        }

        if (closeNotification) {
            closeNotification.addEventListener('click', () => this.hideNotification());
        }

        const modal = document.getElementById('historyModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeHistoryModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeHistoryModal();
                this.hideNotification();
            }
        });

        this.on('connection-changed', (isOnline) => {
            if (isOnline) {
                syncService.scheduleSync();
            }
        });

        this.on('sync-complete', () => {
            this.updateStats();
            this.loadRecentEntries();
        });
    }

    async handleCheckIn() {
        try {
            this.setButtonLoading('checkInBtn', true);
            
            const location = await this.getCurrentLocation();
            
            const record = {
                type: 'check-in',
                timestamp: Date.now(),
                location: location
            };

            const savedRecord = await attendanceDB.addAttendanceRecord(record);
            
            if (syncService.isOnline) {
                try {
                    await syncService.uploadRecord(savedRecord);
                    await attendanceDB.markRecordSynced(savedRecord.id);
                } catch (syncError) {
                    console.log('Will sync later:', syncError.message);
                }
            }

            this.currentStatus = 'checked-in';
            this.checkInTime = record.timestamp;
            
            this.updateUI();
            this.updateStats();
            this.loadRecentEntries();
            
            this.showNotification('Checked in successfully!', 'success');
            
        } catch (error) {
            console.error('Check-in failed:', error);
            this.showNotification('Check-in failed: ' + error.message, 'error');
        } finally {
            this.setButtonLoading('checkInBtn', false);
        }
    }

    async handleCheckOut() {
        try {
            this.setButtonLoading('checkOutBtn', true);
            
            const location = await this.getCurrentLocation();
            
            const record = {
                type: 'check-out',
                timestamp: Date.now(),
                location: location
            };

            const savedRecord = await attendanceDB.addAttendanceRecord(record);
            
            if (syncService.isOnline) {
                try {
                    await syncService.uploadRecord(savedRecord);
                    await attendanceDB.markRecordSynced(savedRecord.id);
                } catch (syncError) {
                    console.log('Will sync later:', syncError.message);
                }
            }

            this.currentStatus = 'ready';
            this.checkInTime = null;
            
            this.updateUI();
            this.updateStats();
            this.loadRecentEntries();
            
            this.showNotification('Checked out successfully!', 'success');
            
        } catch (error) {
            console.error('Check-out failed:', error);
            this.showNotification('Check-out failed: ' + error.message, 'error');
        } finally {
            this.setButtonLoading('checkOutBtn', false);
        }
    }

    async getCurrentLocation() {
        try {
            const position = await locationService.getLocationWithFallback();
            
            if (position) {
                const address = await locationService.reverseGeocode(
                    position.latitude, 
                    position.longitude
                );
                
                return {
                    latitude: position.latitude,
                    longitude: position.longitude,
                    accuracy: position.accuracy,
                    timestamp: position.timestamp,
                    address: address?.address || position.formatted,
                    fullAddress: address?.fullAddress || position.formatted,
                    source: position.source || 'gps'
                };
            }
            
            return null;
        } catch (error) {
            console.warn('Could not get location:', error.message);
            return null;
        }
    }

    updateUI() {
        this.updateStatusCard();
        this.updateActionButtons();
        this.updateStats();
        this.loadRecentEntries();
    }

    updateStatusCard() {
        const statusCard = document.getElementById('currentStatusCard');
        const statusTitle = document.getElementById('statusTitle');
        const statusTime = document.getElementById('statusTime');
        const statusLocation = document.getElementById('statusLocation');

        if (!statusCard || !statusTitle || !statusTime) return;

        if (this.currentStatus === 'checked-in') {
            statusCard.classList.add('checked-in');
            statusTitle.textContent = 'Currently Checked In';
            
            if (this.checkInTime) {
                const checkInDate = new Date(this.checkInTime);
                statusTime.textContent = `Since ${this.formatTime(checkInDate)}`;
                
                const duration = Date.now() - this.checkInTime;
                const hours = Math.floor(duration / (1000 * 60 * 60));
                const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours > 0) {
                    statusTime.textContent += ` (${hours}h ${minutes}m)`;
                } else {
                    statusTime.textContent += ` (${minutes}m)`;
                }
            }
        } else {
            statusCard.classList.remove('checked-in');
            statusTitle.textContent = 'Ready to Check In';
            statusTime.textContent = this.formatTime(new Date());
        }

        if (statusLocation) {
            statusLocation.textContent = '';
        }
    }

    updateActionButtons() {
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');

        if (checkInBtn && checkOutBtn) {
            if (this.currentStatus === 'checked-in') {
                checkInBtn.disabled = true;
                checkOutBtn.disabled = false;
            } else {
                checkInBtn.disabled = false;
                checkOutBtn.disabled = true;
            }
        }
    }

    async updateStats() {
        try {
            const todayRecords = await attendanceDB.getTodayRecords();
            const weekRecords = await attendanceDB.getWeekRecords();

            const todayMinutes = attendanceDB.calculateWorkingHours(todayRecords);
            const weekMinutes = attendanceDB.calculateWorkingHours(weekRecords);

            const todayHours = document.getElementById('todayHours');
            const weekHours = document.getElementById('weekHours');

            if (todayHours) {
                todayHours.textContent = attendanceDB.formatDuration(todayMinutes);
            }

            if (weekHours) {
                weekHours.textContent = attendanceDB.formatDuration(weekMinutes);
            }
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    async loadRecentEntries() {
        try {
            const records = await attendanceDB.getAttendanceRecords({ 
                limit: 5, 
                orderBy: 'desc' 
            });
            
            const container = document.getElementById('recentEntries');
            if (!container) return;

            if (records.length === 0) {
                container.innerHTML = '<p class="empty-state">No entries yet. Check in to get started!</p>';
                return;
            }

            container.innerHTML = records.map(record => this.createEntryElement(record)).join('');
        } catch (error) {
            console.error('Failed to load recent entries:', error);
        }
    }

    createEntryElement(record) {
        const date = new Date(record.timestamp);
        const timeStr = this.formatTime(date);
        const dateStr = this.formatDate(date);
        
        const locationStr = record.location?.address || 
                           (record.location ? record.location.formatted : '') ||
                           'Location unavailable';

        return `
            <div class="entry-item ${record.type}">
                <div class="entry-header">
                    <span class="entry-type ${record.type}">
                        ${record.type === 'check-in' ? '🟢 Check In' : '🔴 Check Out'}
                    </span>
                    <span class="entry-time">${timeStr}</span>
                </div>
                <div class="entry-location">${locationStr}</div>
                ${dateStr !== this.formatDate(new Date()) ? `<div class="entry-date">${dateStr}</div>` : ''}
            </div>
        `;
    }

    async openHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (!modal) return;

        modal.classList.add('show');
        
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        
        if (startDate && endDate) {
            const today = new Date();
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            startDate.value = weekAgo.toISOString().split('T')[0];
            endDate.value = today.toISOString().split('T')[0];
        }

        await this.loadAllEntries();
    }

    closeHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async filterHistory() {
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        
        await this.loadAllEntries(startDate, endDate);
    }

    async loadAllEntries(startDate = null, endDate = null) {
        try {
            const options = {};
            
            if (startDate && endDate) {
                options.startDate = startDate;
                options.endDate = endDate;
            }

            const records = await attendanceDB.getAttendanceRecords(options);
            const container = document.getElementById('allEntries');
            
            if (!container) return;

            if (records.length === 0) {
                container.innerHTML = '<p class="empty-state">No entries found for the selected period.</p>';
                return;
            }

            const sortedRecords = records.sort((a, b) => b.timestamp - a.timestamp);
            container.innerHTML = sortedRecords.map(record => this.createEntryElement(record)).join('');
            
        } catch (error) {
            console.error('Failed to load all entries:', error);
            const container = document.getElementById('allEntries');
            if (container) {
                container.innerHTML = '<p class="empty-state">Error loading entries.</p>';
            }
        }
    }

    async requestLocationPermission() {
        try {
            await locationService.requestPermission();
            console.log('Location permission granted');
        } catch (error) {
            console.warn('Location permission denied:', error);
            this.showNotification('Location access denied. Some features may be limited.', 'warning');
        }
    }

    schedulePeriodicUpdates() {
        setInterval(() => {
            if (this.currentStatus === 'checked-in') {
                this.updateStatusCard();
            }
            this.updateStats();
        }, 60000);

        setInterval(() => {
            syncService.scheduleSync();
        }, 300000);
    }

    setButtonLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="btn-icon">⏳</span> Processing...';
        } else {
            button.disabled = this.currentStatus === 'checked-in' ? buttonId === 'checkInBtn' : buttonId === 'checkOutBtn';
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const messageElement = document.getElementById('notificationMessage');
        
        if (!notification || !messageElement) {
            console.log(`${type.toUpperCase()}: ${message}`);
            return;
        }

        messageElement.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.classList.remove('show');
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    }

    formatDate(date) {
        return date.toLocaleDateString([], { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric'
        });
    }

    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }

    destroy() {
        syncService.destroy();
        locationService.stopTracking();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AttendanceApp();
});

if (window.location.search.includes('action=checkin')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (window.app && window.app.currentStatus === 'ready') {
                window.app.handleCheckIn();
            }
        }, 1000);
    });
}