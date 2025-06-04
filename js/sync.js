class SyncService {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.apiEndpoint = '/api/attendance';
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            console.log('Connection restored');
            this.isOnline = true;
            this.updateConnectionStatus();
            this.scheduleSync();
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
            this.isOnline = false;
            this.updateConnectionStatus();
        });

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SYNC_COMPLETE') {
                    console.log('Background sync completed');
                    this.onSyncComplete();
                }
            });
        }
    }

    updateConnectionStatus() {
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        
        if (statusDot && statusText) {
            if (this.isOnline) {
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Online';
            } else {
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Offline';
            }
        }

        if (window.app) {
            window.app.emit('connection-changed', this.isOnline);
        }
    }

    async scheduleSync() {
        if (!this.isOnline || this.syncInProgress) {
            return;
        }

        try {
            if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-attendance');
                console.log('Background sync scheduled');
            } else {
                await this.syncNow();
            }
        } catch (error) {
            console.error('Failed to schedule sync:', error);
            setTimeout(() => this.scheduleSync(), 30000);
        }
    }

    async syncNow() {
        if (this.syncInProgress) {
            console.log('Sync already in progress');
            return;
        }

        if (!this.isOnline) {
            console.log('Cannot sync while offline');
            return;
        }

        this.syncInProgress = true;
        console.log('Starting manual sync...');

        try {
            const unsyncedRecords = await attendanceDB.getUnsyncedRecords();
            console.log(`Found ${unsyncedRecords.length} unsynced records`);

            if (unsyncedRecords.length === 0) {
                console.log('No records to sync');
                return;
            }

            for (const record of unsyncedRecords) {
                await this.syncRecord(record);
            }

            console.log('Manual sync completed successfully');
            this.showNotification('Sync completed successfully', 'success');
            
        } catch (error) {
            console.error('Manual sync failed:', error);
            this.showNotification('Sync failed. Will retry automatically.', 'error');
        } finally {
            this.syncInProgress = false;
        }
    }

    async syncRecord(record, attempt = 1) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: record.type,
                    timestamp: record.timestamp,
                    date: record.date,
                    location: record.location
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Record synced successfully:', record.id);

            await attendanceDB.markRecordSynced(record.id);
            return result;

        } catch (error) {
            console.error(`Sync attempt ${attempt} failed for record ${record.id}:`, error);

            if (attempt < this.retryAttempts) {
                console.log(`Retrying sync for record ${record.id} in ${this.retryDelay}ms`);
                await this.delay(this.retryDelay * attempt);
                return this.syncRecord(record, attempt + 1);
            } else {
                console.error(`Failed to sync record ${record.id} after ${this.retryAttempts} attempts`);
                throw error;
            }
        }
    }

    async uploadRecord(record) {
        if (!this.isOnline) {
            console.log('Offline: Record will be synced when connection is restored');
            return { success: true, offline: true };
        }

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(record)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Record uploaded successfully');
                return { success: true, data: result };
            } else {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                console.log('Network error: Record will be synced when connection is restored');
                return { success: true, offline: true };
            }
            
            throw error;
        }
    }

    async downloadRecords() {
        if (!this.isOnline) {
            console.log('Cannot download records while offline');
            return [];
        }

        try {
            const response = await fetch(`${this.apiEndpoint}?since=${this.getLastSyncTime()}`);
            
            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            const records = await response.json();
            console.log(`Downloaded ${records.length} records from server`);

            for (const record of records) {
                await this.mergeRecord(record);
            }

            this.setLastSyncTime(Date.now());
            return records;

        } catch (error) {
            console.error('Failed to download records:', error);
            throw error;
        }
    }

    async mergeRecord(serverRecord) {
        try {
            const existingRecords = await attendanceDB.getAttendanceRecords({
                date: serverRecord.date
            });

            const exists = existingRecords.some(record => 
                record.timestamp === serverRecord.timestamp &&
                record.type === serverRecord.type
            );

            if (!exists) {
                await attendanceDB.addAttendanceRecord({
                    ...serverRecord,
                    synced: true
                });
                console.log('Merged record from server:', serverRecord.id);
            }
        } catch (error) {
            console.error('Failed to merge record:', error);
        }
    }

    getLastSyncTime() {
        return localStorage.getItem('lastSyncTime') || '0';
    }

    setLastSyncTime(timestamp) {
        localStorage.setItem('lastSyncTime', timestamp.toString());
    }

    async performFullSync() {
        if (!this.isOnline) {
            throw new Error('Cannot perform full sync while offline');
        }

        this.syncInProgress = true;
        
        try {
            console.log('Starting full sync...');
            
            await this.downloadRecords();
            
            const unsyncedRecords = await attendanceDB.getUnsyncedRecords();
            for (const record of unsyncedRecords) {
                await this.syncRecord(record);
            }
            
            console.log('Full sync completed');
            this.showNotification('Full sync completed', 'success');
            
        } catch (error) {
            console.error('Full sync failed:', error);
            this.showNotification('Full sync failed', 'error');
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    async checkServerConnection() {
        if (!this.isOnline) {
            return false;
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/health`, {
                method: 'HEAD',
                cache: 'no-cache'
            });
            return response.ok;
        } catch (error) {
            console.error('Server connection check failed:', error);
            return false;
        }
    }

    onSyncComplete() {
        if (window.app) {
            window.app.emit('sync-complete');
        }
        
        this.showNotification('Data synchronized', 'success');
    }

    showNotification(message, type = 'info') {
        if (window.app && window.app.showNotification) {
            window.app.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            syncInProgress: this.syncInProgress,
            lastSyncTime: this.getLastSyncTime(),
            canSync: this.isOnline && !this.syncInProgress
        };
    }

    async getUnsyncedCount() {
        try {
            const unsyncedRecords = await attendanceDB.getUnsyncedRecords();
            return unsyncedRecords.length;
        } catch (error) {
            console.error('Failed to get unsynced count:', error);
            return 0;
        }
    }

    destroy() {
        window.removeEventListener('online', this.updateConnectionStatus);
        window.removeEventListener('offline', this.updateConnectionStatus);
    }
}

const syncService = new SyncService();

window.syncService = syncService;