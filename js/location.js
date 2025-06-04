class LocationService {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.isTracking = false;
        this.lastKnownPosition = null;
    }

    async requestPermission() {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        return new Promise((resolve, reject) => {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                if (result.state === 'granted') {
                    resolve('granted');
                } else if (result.state === 'prompt') {
                    this.getCurrentPosition()
                        .then(() => resolve('granted'))
                        .catch(() => reject('denied'));
                } else {
                    reject('denied');
                }
            }).catch(() => {
                this.getCurrentPosition()
                    .then(() => resolve('granted'))
                    .catch(() => reject('denied'));
            });
        });
    }

    async getCurrentPosition(options = {}) {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported');
        }

        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000
        };

        const geoOptions = { ...defaultOptions, ...options };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Location request timed out'));
            }, geoOptions.timeout);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    this.currentPosition = position;
                    this.lastKnownPosition = position;
                    resolve(this.formatPosition(position));
                },
                (error) => {
                    clearTimeout(timeoutId);
                    console.error('Geolocation error:', error);
                    
                    if (this.lastKnownPosition) {
                        console.log('Using last known position');
                        resolve(this.formatPosition(this.lastKnownPosition));
                    } else {
                        reject(this.handleLocationError(error));
                    }
                },
                geoOptions
            );
        });
    }

    startTracking(callback, options = {}) {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported');
        }

        if (this.isTracking) {
            this.stopTracking();
        }

        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        };

        const geoOptions = { ...defaultOptions, ...options };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = position;
                this.lastKnownPosition = position;
                if (callback) {
                    callback(this.formatPosition(position));
                }
            },
            (error) => {
                console.error('Location tracking error:', error);
                if (callback) {
                    callback(null, this.handleLocationError(error));
                }
            },
            geoOptions
        );

        this.isTracking = true;
        console.log('Location tracking started');
    }

    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
            console.log('Location tracking stopped');
        }
    }

    formatPosition(position) {
        if (!position) return null;

        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
            formatted: this.formatCoordinates(position.coords.latitude, position.coords.longitude)
        };
    }

    formatCoordinates(lat, lng) {
        const latDirection = lat >= 0 ? 'N' : 'S';
        const lngDirection = lng >= 0 ? 'E' : 'W';
        
        const latDegrees = Math.abs(lat).toFixed(6);
        const lngDegrees = Math.abs(lng).toFixed(6);
        
        return `${latDegrees}°${latDirection}, ${lngDegrees}°${lngDirection}`;
    }

    handleLocationError(error) {
        let message = 'Unknown location error';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied by user';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out';
                break;
        }
        
        return new Error(message);
    }

    async reverseGeocode(lat, lng) {
        if (!lat || !lng) return null;

        try {
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            
            if (!response.ok) {
                throw new Error('Reverse geocoding failed');
            }
            
            const data = await response.json();
            
            return {
                address: data.locality || data.city || data.principalSubdivision || 'Unknown location',
                fullAddress: data.localityInfo?.administrative?.map(item => item.name).join(', ') || 'Unknown address',
                country: data.countryName,
                countryCode: data.countryCode
            };
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return {
                address: this.formatCoordinates(lat, lng),
                fullAddress: this.formatCoordinates(lat, lng),
                country: null,
                countryCode: null
            };
        }
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        if (!lat1 || !lng1 || !lat2 || !lng2) return null;

        const R = 6371;
        const dLat = this.degreesToRadians(lat2 - lat1);
        const dLng = this.degreesToRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return distance;
    }

    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    isLocationPermissionGranted() {
        return navigator.permissions
            ? navigator.permissions.query({ name: 'geolocation' })
                .then(result => result.state === 'granted')
            : Promise.resolve(false);
    }

    async getLocationWithFallback() {
        try {
            const position = await this.getCurrentPosition();
            return position;
        } catch (error) {
            console.warn('GPS location failed, using fallback:', error.message);
            
            if (this.lastKnownPosition) {
                return this.formatPosition(this.lastKnownPosition);
            }
            
            try {
                const ipLocation = await this.getIPLocation();
                return ipLocation;
            } catch (ipError) {
                console.error('IP location also failed:', ipError);
                return null;
            }
        }
    }

    async getIPLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) {
                throw new Error('IP location service unavailable');
            }
            
            const data = await response.json();
            
            if (data.latitude && data.longitude) {
                return {
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracy: 10000,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null,
                    timestamp: Date.now(),
                    formatted: this.formatCoordinates(data.latitude, data.longitude),
                    source: 'ip',
                    city: data.city,
                    region: data.region,
                    country: data.country_name
                };
            } else {
                throw new Error('Invalid IP location data');
            }
        } catch (error) {
            console.error('IP location error:', error);
            throw error;
        }
    }

    getLocationStatus() {
        return {
            isSupported: !!navigator.geolocation,
            isTracking: this.isTracking,
            hasCurrentPosition: !!this.currentPosition,
            hasLastKnown: !!this.lastKnownPosition
        };
    }
}

const locationService = new LocationService();

window.locationService = locationService;