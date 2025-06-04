# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Progressive Web Application (PWA) for attendance tracking with GPS location recording, offline support, and automatic data synchronization. Built with vanilla HTML5, CSS3, JavaScript, Service Workers, and IndexedDB.

## Architecture

### Core Components
- **AttendanceApp** (`js/app.js`): Main application controller managing UI state, event handling, and user interactions
- **AttendanceDB** (`js/database.js`): IndexedDB wrapper providing data persistence, querying, and local storage management
- **LocationService** (`js/location.js`): GPS location tracking with fallback mechanisms and reverse geocoding
- **SyncService** (`js/sync.js`): Online/offline synchronization, background sync, and connection management

### Data Flow
1. User interactions trigger AttendanceApp methods
2. Location data captured via LocationService
3. Records stored locally through AttendanceDB
4. SyncService handles online/offline state and data synchronization
5. Service Worker (sw.js) manages caching and background operations

## Development Commands

### Local Development Server
```bash
# Primary method - Python 3
python3 -m http.server 8000

# Alternative - Node.js (if available)
npx serve .

# Alternative - PHP (if available)
php -S localhost:8000
```

### Testing PWA Features
- Access via `http://localhost:8000`
- Test offline: Use browser DevTools → Network tab → Offline checkbox
- Test installation: Look for PWA install prompt in browser
- Test service worker: Check Application tab in DevTools

### Browser Testing
- Chrome DevTools → Application tab for PWA features
- Network tab for offline testing
- Console for debugging IndexedDB operations
- Location simulation via DevTools → Sensors

## Key Features Implementation

### Attendance Tracking
- Check-in/out buttons in `index.html` trigger `handleCheckIn()`/`handleCheckOut()` in `app.js`
- GPS location captured via `getCurrentLocation()` method
- Data stored in IndexedDB `attendance` object store
- Real-time UI updates and statistics calculations

### Offline Support
- Service Worker (`sw.js`) caches static assets and provides offline API responses
- IndexedDB stores all data locally with sync flags
- Background sync queues failed requests for retry when online
- Connection status monitoring and user feedback

### Location Services
- GPS positioning with high accuracy settings
- IP-based fallback location service
- Reverse geocoding for human-readable addresses
- Permission handling and error management

### Data Synchronization
- Automatic sync when connection restored
- Manual sync triggers via SyncService
- Conflict resolution for overlapping records
- Retry logic for failed sync attempts

## File Structure

```
/
├── index.html           # Main PWA interface
├── styles.css          # Responsive styles with dark mode
├── manifest.json       # PWA configuration and metadata
├── sw.js              # Service worker for offline functionality
├── js/
│   ├── app.js         # Main application logic
│   ├── database.js    # IndexedDB data layer
│   ├── location.js    # GPS and location services
│   └── sync.js        # Synchronization management
└── README.md          # Project documentation
```

## Common Development Patterns

### Adding New Features
1. Update UI elements in `index.html`
2. Add styles to `styles.css` following existing CSS custom properties
3. Implement logic in appropriate service class (`js/` files)
4. Update AttendanceApp event handlers if needed
5. Test offline functionality and data persistence

### Database Operations
- Use `attendanceDB` global instance for all data operations
- Always handle async operations with try/catch
- Check IndexedDB browser support before operations
- Use transactions for complex multi-step operations

### Location Handling
- Request permissions early in app lifecycle
- Always provide fallback for location failures
- Cache last known position for offline scenarios
- Handle accuracy and timeout appropriately

### PWA Best Practices
- Update Service Worker version when making changes
- Test install/update scenarios
- Ensure offline functionality for core features
- Validate manifest.json configuration

## Debugging and Troubleshooting

### Common Issues
- **IndexedDB errors**: Check browser compatibility and quotas
- **Location permissions**: Test permission states and fallbacks
- **Service Worker caching**: Clear cache during development
- **Offline sync**: Verify network event handlers and background sync

### Debugging Tools
- Browser DevTools → Application tab for PWA inspection
- Console logging is extensive throughout codebase
- Network tab for sync operation monitoring
- IndexedDB inspection via DevTools

## Security Considerations

- Location data stored locally only by default
- HTTPS required for full PWA features and geolocation
- No hardcoded API keys or sensitive data
- User controls all data sharing and permissions