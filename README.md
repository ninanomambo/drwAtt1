# Attendance Tracker PWA

A Progressive Web Application for tracking work attendance with GPS location recording, offline support, and automatic synchronization.

## Features

- **📱 PWA Support**: Install as a native app on any device
- **📍 GPS Location Tracking**: Records precise location for check-ins and check-outs
- **🔄 Offline Support**: Works without internet connection, syncs when online
- **💾 Local Storage**: Uses IndexedDB for reliable local data storage
- **🔄 Auto-Sync**: Automatically synchronizes data when connection is restored
- **📊 Time Tracking**: Calculates daily and weekly working hours
- **📋 History View**: View and filter attendance records
- **📱 Mobile-First**: Responsive design optimized for mobile devices

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Storage**: IndexedDB for local data persistence
- **PWA**: Service Workers for offline functionality and caching
- **Location**: Geolocation API with fallback to IP-based location
- **Sync**: Background sync for reliable data synchronization

## Quick Start

1. **Serve the Application**:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js (if you have it)
   npx serve .
   
   # Using PHP (if you have it)
   php -S localhost:8000
   ```

2. **Access the App**:
   - Open your browser to `http://localhost:8000`
   - Grant location permissions when prompted
   - Start using the app to track attendance

3. **Install as PWA**:
   - On mobile: Use "Add to Home Screen" option
   - On desktop: Click the install icon in the address bar

## Usage

### Check In/Out
- Click "Check In" to record your arrival with current location
- Click "Check Out" to record your departure
- Location is automatically captured and stored

### View History
- Recent entries are displayed on the main screen
- Click "View All" to see complete attendance history
- Filter by date range to find specific records

### Offline Mode
- App works completely offline
- Data is stored locally and synced when online
- Connection status is displayed in the header

## Project Structure

```
attendance-tracker/
├── index.html          # Main application interface
├── styles.css          # Application styles with dark mode support
├── manifest.json       # PWA manifest configuration
├── sw.js              # Service worker for offline functionality
└── js/
    ├── app.js         # Main application logic and UI management
    ├── database.js    # IndexedDB wrapper for data storage
    ├── location.js    # Geolocation services and GPS handling
    └── sync.js        # Data synchronization and offline support
```

## Features Detail

### GPS Location Tracking
- High-accuracy GPS positioning
- Fallback to IP-based location if GPS unavailable
- Reverse geocoding to display human-readable addresses
- Location permissions handling

### Offline Functionality
- Complete offline operation
- Local data storage with IndexedDB
- Service worker caching for app resources
- Background sync when connection restored

### Data Management
- Automatic daily/weekly hour calculations
- Persistent local storage
- Data export capabilities
- Storage usage monitoring

### PWA Features
- App installation on any platform
- Standalone app experience
- Offline-first architecture
- Push notifications (ready for implementation)

## Browser Support

- **Modern Browsers**: Chrome 58+, Firefox 57+, Safari 11.1+, Edge 79+
- **Mobile**: iOS Safari 11.3+, Android Chrome 58+
- **Required APIs**: IndexedDB, Service Workers, Geolocation

## Development

The app is built with vanilla JavaScript and requires no build process. Simply serve the files from any HTTP server.

### Key Components

- **AttendanceApp**: Main application controller
- **AttendanceDB**: IndexedDB data layer
- **LocationService**: GPS and location handling
- **SyncService**: Online/offline sync management

## Security & Privacy

- Location data stored locally only
- No sensitive data transmitted without encryption
- User controls all data sharing
- HTTPS required for full PWA features

## License

This project is open source and available under the MIT License.