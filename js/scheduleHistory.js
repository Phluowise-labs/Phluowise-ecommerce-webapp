// Schedule History Manager
class ScheduleHistoryManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.currentUserId = null;
        this.scheduleHistory = [];
        this.isLoading = false;
        this.currentPage = 0;
        this.hasMore = true;
    }

    // Set the current user ID
    setUserId(userId) {
        this.currentUserId = userId;
    }

    // Fetch schedule history from the API
    async fetchScheduleHistory(limit = 50, offset = 0) {
        if (!this.currentUserId) {
            throw new Error('User ID not set');
        }

        if (this.isLoading) {
            return;
        }

        this.isLoading = true;

        try {
            const response = await fetch(`${this.baseUrl}/api/schedule-history?userId=${this.currentUserId}&limit=${limit}&offset=${offset}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                if (offset === 0) {
                    this.scheduleHistory = data.scheduleHistory;
                } else {
                    this.scheduleHistory = [...this.scheduleHistory, ...data.scheduleHistory];
                }
                
                this.hasMore = data.hasMore;
                this.currentPage = Math.floor(offset / limit);
                
                return {
                    scheduleHistory: data.scheduleHistory,
                    total: data.total,
                    hasMore: data.hasMore
                };
            } else {
                throw new Error(data.error || 'Failed to fetch schedule history');
            }
        } catch (error) {
            console.error('Error fetching schedule history:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    // Load more schedule history
    async loadMore() {
        if (!this.hasMore || this.isLoading) {
            return;
        }

        const nextOffset = (this.currentPage + 1) * 50;
        return await this.fetchScheduleHistory(50, nextOffset);
    }

    // Get schedule history by status
    getScheduleByStatus(status) {
        return this.scheduleHistory.filter(item => item.orderStatus === status);
    }

    // Get schedule history by date range
    getScheduleByDateRange(startDate, endDate) {
        return this.scheduleHistory.filter(item => {
            const itemDate = new Date(item.createdAt);
            return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
        });
    }

    // Get upcoming schedules
    getUpcomingSchedules() {
        const now = new Date();
        return this.scheduleHistory.filter(item => {
            if (item.scheduledDate) {
                const scheduledDate = new Date(item.scheduledDate);
                return scheduledDate >= now && item.orderStatus !== 'completed' && item.orderStatus !== 'cancelled';
            }
            return false;
        });
    }

    // Get past schedules
    getPastSchedules() {
        const now = new Date();
        return this.scheduleHistory.filter(item => {
            if (item.scheduledDate) {
                const scheduledDate = new Date(item.scheduledDate);
                return scheduledDate < now || item.orderStatus === 'completed';
            }
            return false;
        });
    }

    // Format schedule data for display
    formatScheduleForDisplay(schedule) {
        return {
            ...schedule,
            formattedDate: this.formatDate(schedule.scheduledDate || schedule.createdAt),
            formattedTime: schedule.scheduledTime || 'Not specified',
            statusColor: this.getStatusColor(schedule.orderStatus),
            statusText: this.getStatusText(schedule.orderStatus),
            formattedTotal: this.formatCurrency(schedule.total)
        };
    }

    // Format date
    formatDate(dateString) {
        if (!dateString) return 'Not specified';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Format currency
    formatCurrency(amount) {
        if (!amount) return 'GH₵ 0.00';
        return `GH₵ ${parseFloat(amount).toFixed(2)}`;
    }

    // Get status color
    getStatusColor(status) {
        const colors = {
            'pending': '#FFA500',
            'confirmed': '#3B74FF',
            'preparing': '#9333EA',
            'ready': '#10B981',
            'delivered': '#059669',
            'completed': '#059669',
            'cancelled': '#EF4444'
        };
        return colors[status] || '#6B7280';
    }

    // Get status text
    getStatusText(status) {
        const statusTexts = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'preparing': 'Preparing',
            'ready': 'Ready',
            'delivered': 'Delivered',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        };
        return statusTexts[status] || status;
    }

    // Refresh schedule history
    async refresh() {
        this.currentPage = 0;
        this.hasMore = true;
        return await this.fetchScheduleHistory(50, 0);
    }

    // Get all schedule history
    getAllScheduleHistory() {
        return this.scheduleHistory;
    }

    // Get schedule by ID
    getScheduleById(orderId) {
        return this.scheduleHistory.find(item => item.orderId === orderId);
    }
}

// Create global instance
window.scheduleHistoryManager = new ScheduleHistoryManager();

// Helper function to initialize and fetch schedule history
async function initializeScheduleHistory(userId) {
    try {
        window.scheduleHistoryManager.setUserId(userId);
        const result = await window.scheduleHistoryManager.fetchScheduleHistory();
        console.log('Schedule history loaded:', result);
        return result;
    } catch (error) {
        console.error('Failed to initialize schedule history:', error);
        throw error;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScheduleHistoryManager, initializeScheduleHistory };
}
