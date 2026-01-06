/**
 * Web2App Cache Manager
 * Handles localStorage caching and database synchronization for offline functionality
 */

class CacheManager {
    constructor() {
        this.CACHE_PREFIX = 'phluowise_';
        this.CACHE_VERSION = '1.0';
        this.SYNC_QUEUE_KEY = this.CACHE_PREFIX + 'sync_queue';
        this.OFFLINE_FLAG_KEY = this.CACHE_PREFIX + 'offline_mode';
        this.LAST_SYNC_KEY = this.CACHE_PREFIX + 'last_sync';
        
        // Cache expiration times (in milliseconds)
        this.EXPIRY_TIMES = {
            user_profile: 24 * 60 * 60 * 1000, // 24 hours
            company_data: 60 * 60 * 1000,      // 1 hour
            orders: 7 * 24 * 60 * 60 * 1000,   // 7 days
            products: 60 * 60 * 1000,          // 1 hour
            reviews: 24 * 60 * 60 * 1000       // 24 hours
        };
        
        this.init();
    }

    init() {
        // Monitor online/offline status
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
        
        // Check current status
        this.isOnline = navigator.onLine;
        console.log('📱 Cache Manager initialized - Online:', this.isOnline);
        
        // Start sync process if coming back online
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }

    /**
     * Get cache key with prefix and version
     */
    getCacheKey(type, identifier = '') {
        return `${this.CACHE_PREFIX}${type}_${identifier}_${this.CACHE_VERSION}`;
    }

    /**
     * Store data in localStorage with expiration
     */
    setCache(type, data, identifier = '', customExpiry = null) {
        try {
            const key = this.getCacheKey(type, identifier);
            const expiry = customExpiry || this.EXPIRY_TIMES[type] || (24 * 60 * 60 * 1000);
            
            const cacheItem = {
                data: data,
                timestamp: Date.now(),
                expiry: Date.now() + expiry,
                version: this.CACHE_VERSION
            };
            
            localStorage.setItem(key, JSON.stringify(cacheItem));
            console.log(`💾 Cached ${type} data:`, { key, size: JSON.stringify(data).length });
            
            return true;
        } catch (error) {
            console.error('❌ Error setting cache:', error);
            return false;
        }
    }

    /**
     * Get data from localStorage, checking expiration
     */
    getCache(type, identifier = '') {
        try {
            const key = this.getCacheKey(type, identifier);
            const cached = localStorage.getItem(key);
            
            if (!cached) {
                console.log(`📦 No cached data found for ${type}`);
                return null;
            }
            
            const cacheItem = JSON.parse(cached);
            
            // Check if expired
            if (Date.now() > cacheItem.expiry) {
                console.log(`⏰ Cache expired for ${type}, removing...`);
                this.removeCache(type, identifier);
                return null;
            }
            
            console.log(`📦 Retrieved cached ${type} data:`, { 
                key, 
                age: Date.now() - cacheItem.timestamp,
                remaining: cacheItem.expiry - Date.now()
            });
            
            return cacheItem.data;
        } catch (error) {
            console.error('❌ Error getting cache:', error);
            return null;
        }
    }

    /**
     * Remove specific cache item
     */
    removeCache(type, identifier = '') {
        try {
            const key = this.getCacheKey(type, identifier);
            localStorage.removeItem(key);
            console.log(`🗑️ Removed cache: ${key}`);
            return true;
        } catch (error) {
            console.error('❌ Error removing cache:', error);
            return false;
        }
    }

    /**
     * Clear all cache data
     */
    clearAllCache() {
        try {
            const keys = Object.keys(localStorage);
            let removed = 0;
            
            keys.forEach(key => {
                if (key.startsWith(this.CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                    removed++;
                }
            });
            
            console.log(`🗑️ Cleared ${removed} cache items`);
            return removed;
        } catch (error) {
            console.error('❌ Error clearing cache:', error);
            return 0;
        }
    }

    /**
     * Add item to sync queue with enhanced metadata
     */
    addToSyncQueue(action, data, priority = 'normal') {
        try {
            const queue = this.getSyncQueue();
            const syncItem = {
                id: this.generateId(),
                action: action,
                data: data,
                timestamp: Date.now(),
                priority: priority,
                retries: 0,
                nextRetry: Date.now() // Immediate retry
            };
            
            queue.push(syncItem);
            
            // Sort by priority (high first)
            queue.sort((a, b) => {
                const priorities = { high: 3, normal: 2, low: 1 };
                return priorities[b.priority] - priorities[a.priority];
            });
            
            localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
            console.log(`📋 Added to sync queue: ${action}`, syncItem);
            
            // Try to process immediately if online
            if (this.isOnline) {
                setTimeout(() => this.processSyncQueue(), 100);
            }
            
            return syncItem.id;
        } catch (error) {
            console.error('❌ Error adding to sync queue:', error);
            return null;
        }
    }

    /**
     * Get sync queue with retry filtering
     */
    getSyncQueue() {
        try {
            const queue = localStorage.getItem(this.SYNC_QUEUE_KEY);
            if (!queue) return [];
            
            const parsedQueue = JSON.parse(queue);
            
            // Filter out items that are not ready for retry
            const now = Date.now();
            return parsedQueue.filter(item => !item.nextRetry || item.nextRetry <= now);
        } catch (error) {
            console.error('❌ Error getting sync queue:', error);
            return [];
        }
    }

    /**
     * Process sync queue when online with enhanced error handling
     */
    async processSyncQueue() {
        if (!this.isOnline) {
            console.log('📴 Offline, skipping sync queue processing');
            return;
        }
        
        const queue = this.getSyncQueue();
        if (queue.length === 0) {
            console.log('📋 Sync queue is empty');
            return;
        }
        
        console.log(`🔄 Processing ${queue.length} items in sync queue...`);
        
        const processed = [];
        const failed = [];
        
        // Process items by priority
        const sortedQueue = [...queue].sort((a, b) => {
            const priorities = { high: 3, normal: 2, low: 1 };
            return priorities[b.priority] - priorities[a.priority];
        });
        
        for (const item of sortedQueue) {
            try {
                await this.processSyncItem(item);
                processed.push(item.id);
                console.log(`✅ Synced item: ${item.action} (ID: ${item.id})`);
            } catch (error) {
                console.error(`❌ Failed to sync item ${item.id}:`, error);
                
                // Increment retries and move to failed if too many attempts
                item.retries = (item.retries || 0) + 1;
                if (item.retries >= 3) {
                    console.log(`🚫 Item ${item.id} failed after 3 retries - removing from queue`);
                    failed.push(item);
                } else {
                    // Keep in queue for retry with exponential backoff
                    item.nextRetry = Date.now() + (Math.pow(2, item.retries) * 1000); // 2s, 4s, 8s
                    failed.push(item);
                }
            }
        }
        
        // Update queue (remove processed, keep failed for retry)
        const newQueue = failed.filter(item => item.retries < 3);
        localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(newQueue));
        
        console.log(`📊 Sync completed: ${processed.length} processed, ${newQueue.length} remaining for retry`);
        
        // Update last sync timestamp
        localStorage.setItem(this.LAST_SYNC_KEY, Date.now().toString());
        
        // Show notification if items were processed
        if (processed.length > 0) {
            this.showSyncNotification(processed.length);
        }
    }

    /**
     * Show sync completion notification
     */
    showSyncNotification(count) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
        notification.innerHTML = `
            <div class="flex items-center space-x-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>${count} item${count > 1 ? 's' : ''} synced successfully</span>
            </div>
        `;
        notification.style.transform = 'translateX(200%)';
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.transform = 'translateX(200%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    /**
     * Process individual sync item
     */
    async processSyncItem(item) {
        switch (item.action) {
            case 'save_order':
                return await this.syncOrder(item.data);
            case 'save_review':
                return await this.syncReview(item.data);
            case 'update_profile':
                return await this.syncProfile(item.data);
            default:
                console.warn(`⚠️ Unknown sync action: ${item.action}`);
                return false;
        }
    }

    /**
     * Sync order to database
     */
    async syncOrder(orderData) {
        if (!window.OrderManager) {
            throw new Error('OrderManager not available');
        }
        
        const orderManager = new window.OrderManager();
        await orderManager.createOrder(orderData);
        
        // Also sync order items if present
        if (orderData.products && orderData.products.length > 0) {
            await orderManager.createOrderItems(orderData.orderId, orderData.products, orderData);
        }
        
        return true;
    }

    /**
     * Sync review to database
     */
    async syncReview(reviewData) {
        if (!window.databases) {
            throw new Error('Database not available');
        }
        
        const result = await window.databases.createDocument(
            window.appwriteConfig.DATABASE_ID,
            window.appwriteConfig.RATINGS_TABLE,
            window.ID.unique(),
            reviewData
        );
        
        return result;
    }

    /**
     * Sync user profile to database
     */
    async syncProfile(profileData) {
        if (!window.databases || !profileData.uid) {
            throw new Error('Database or user ID not available');
        }
        
        const result = await window.databases.updateDocument(
            window.appwriteConfig.DATABASE_ID,
            window.appwriteConfig.CUSTOMER_TABLE,
            profileData.uid,
            profileData
        );
        
        return result;
    }

    /**
     * Handle online/offline status changes
     */
    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        localStorage.setItem(this.OFFLINE_FLAG_KEY, (!isOnline).toString());
        
        console.log(`📱 Connection status changed: ${isOnline ? 'Online' : 'Offline'}`);
        
        if (isOnline) {
            // Process sync queue when coming back online
            setTimeout(() => this.processSyncQueue(), 1000);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith(this.CACHE_PREFIX));
            const stats = {
                totalItems: keys.length,
                totalSize: 0,
                items: {}
            };
            
            keys.forEach(key => {
                const item = localStorage.getItem(key);
                const size = item ? item.length : 0;
                stats.totalSize += size;
                
                // Extract type from key
                const parts = key.split('_');
                const type = parts[1] || 'unknown';
                
                if (!stats.items[type]) {
                    stats.items[type] = { count: 0, size: 0 };
                }
                
                stats.items[type].count++;
                stats.items[type].size += size;
            });
            
            return stats;
        } catch (error) {
            console.error('❌ Error getting cache stats:', error);
            return null;
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Check if app is in offline mode
     */
    isOffline() {
        return !this.isOnline || localStorage.getItem(this.OFFLINE_FLAG_KEY) === 'true';
    }

    /**
     * Get last sync timestamp
     */
    getLastSyncTime() {
        const timestamp = localStorage.getItem(this.LAST_SYNC_KEY);
        return timestamp ? parseInt(timestamp) : null;
    }
}

// Initialize cache manager globally
window.CacheManager = CacheManager;
window.cacheManager = new CacheManager();

console.log('📱 Cache Manager loaded and initialized');
