class AttendanceDB {
    constructor() {
        this.dbName = 'AttendanceTracker';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('Database upgrade needed');

                if (!db.objectStoreNames.contains('attendance')) {
                    const attendanceStore = db.createObjectStore('attendance', {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    attendanceStore.createIndex('date', 'date', { unique: false });
                    attendanceStore.createIndex('type', 'type', { unique: false });
                    attendanceStore.createIndex('synced', 'synced', { unique: false });
                    attendanceStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('offlineRequests')) {
                    db.createObjectStore('offlineRequests', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', {
                        keyPath: 'key'
                    });
                }
            };
        });
    }

    async addAttendanceRecord(record) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attendance'], 'readwrite');
            const store = transaction.objectStore('attendance');

            const attendanceRecord = {
                type: record.type,
                timestamp: record.timestamp || Date.now(),
                date: record.date || new Date().toISOString().split('T')[0],
                location: record.location || null,
                synced: false,
                ...record
            };

            const request = store.add(attendanceRecord);

            request.onsuccess = () => {
                console.log('Attendance record added:', request.result);
                resolve({ ...attendanceRecord, id: request.result });
            };

            request.onerror = () => {
                console.error('Failed to add attendance record:', request.error);
                reject(request.error);
            };
        });
    }

    async getAttendanceRecords(options = {}) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attendance'], 'readonly');
            const store = transaction.objectStore('attendance');

            let request;

            if (options.startDate && options.endDate) {
                const index = store.index('date');
                const range = IDBKeyRange.bound(options.startDate, options.endDate);
                request = index.getAll(range);
            } else if (options.date) {
                const index = store.index('date');
                request = index.getAll(options.date);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => {
                let records = request.result;

                if (options.limit) {
                    records = records.slice(0, options.limit);
                }

                if (options.orderBy === 'desc') {
                    records.reverse();
                }

                resolve(records);
            };

            request.onerror = () => {
                console.error('Failed to get attendance records:', request.error);
                reject(request.error);
            };
        });
    }

    async getLastRecord() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attendance'], 'readonly');
            const store = transaction.objectStore('attendance');
            const index = store.index('timestamp');

            const request = index.openCursor(null, 'prev');

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    resolve(cursor.value);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('Failed to get last record:', request.error);
                reject(request.error);
            };
        });
    }

    async getTodayRecords() {
        const today = new Date().toISOString().split('T')[0];
        return this.getAttendanceRecords({ date: today });
    }

    async getWeekRecords() {
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));

        return this.getAttendanceRecords({
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: endOfWeek.toISOString().split('T')[0]
        });
    }

    async getUnsyncedRecords() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attendance'], 'readonly');
            const store = transaction.objectStore('attendance');
            const index = store.index('synced');

            const request = index.getAll(false);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to get unsynced records:', request.error);
                reject(request.error);
            };
        });
    }

    async markRecordSynced(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attendance'], 'readwrite');
            const store = transaction.objectStore('attendance');

            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (record) {
                    record.synced = true;
                    const updateRequest = store.put(record);

                    updateRequest.onsuccess = () => {
                        console.log('Record marked as synced:', id);
                        resolve(record);
                    };

                    updateRequest.onerror = () => {
                        console.error('Failed to mark record as synced:', updateRequest.error);
                        reject(updateRequest.error);
                    };
                } else {
                    reject(new Error('Record not found'));
                }
            };

            getRequest.onerror = () => {
                console.error('Failed to get record for sync update:', getRequest.error);
                reject(getRequest.error);
            };
        });
    }

    async deleteRecord(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attendance'], 'readwrite');
            const store = transaction.objectStore('attendance');

            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('Record deleted:', id);
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to delete record:', request.error);
                reject(request.error);
            };
        });
    }

    async clearAllData() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['attendance', 'offlineRequests'], 'readwrite');

            const attendanceStore = transaction.objectStore('attendance');
            const offlineStore = transaction.objectStore('offlineRequests');

            const clearAttendance = attendanceStore.clear();
            const clearOffline = offlineStore.clear();

            transaction.oncomplete = () => {
                console.log('All data cleared');
                resolve(true);
            };

            transaction.onerror = () => {
                console.error('Failed to clear data:', transaction.error);
                reject(transaction.error);
            };
        });
    }

    async getStorageUsage() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return null;
        }

        try {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage,
                available: estimate.quota,
                usedMB: Math.round(estimate.usage / 1024 / 1024 * 100) / 100,
                availableMB: Math.round(estimate.quota / 1024 / 1024 * 100) / 100
            };
        } catch (error) {
            console.error('Failed to get storage estimate:', error);
            return null;
        }
    }

    calculateWorkingHours(records) {
        if (!records || records.length === 0) return 0;

        const sortedRecords = records.sort((a, b) => a.timestamp - b.timestamp);
        let totalMinutes = 0;
        let checkInTime = null;

        for (const record of sortedRecords) {
            if (record.type === 'check-in') {
                checkInTime = record.timestamp;
            } else if (record.type === 'check-out' && checkInTime) {
                const sessionMinutes = (record.timestamp - checkInTime) / (1000 * 60);
                totalMinutes += sessionMinutes;
                checkInTime = null;
            }
        }

        return totalMinutes;
    }

    formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    }
}

const attendanceDB = new AttendanceDB();

window.attendanceDB = attendanceDB;