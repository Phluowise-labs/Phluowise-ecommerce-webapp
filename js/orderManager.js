class OrderManager {
    constructor() {
        this.config = window.appwriteConfig;
        this.databases = window.databases;
        this.ID = window.ID;
        this.Query = window.Query;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    // Retry helper function
    async retryOperation(operation, retries = 0) {
        try {
            return await operation();
        } catch (error) {
            console.error(`❌ Operation failed (attempt ${retries + 1}/${this.maxRetries}):`, error.message);
            
            if (retries < this.maxRetries - 1) {
                console.log(`🔄 Retrying in ${this.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.retryOperation(operation, retries + 1);
            }
            
            throw error;
        }
    }

    // Create a new order
    async createOrder(orderData) {
        try {
            console.log('🔍 OrderManager.createOrder - orderData.total:', orderData.total);
            console.log('🔍 OrderManager.createOrder - orderData:', orderData);
            
            const order = {
                // Required customer field
                customer_id: orderData.customer_id || orderData.buyerId,
                
                // Order details
                buyerId: orderData.customer_id || orderData.buyerId,
                branchId: orderData.branchId,
                orderId: this.ID.unique(),
                deliveryTime: orderData.deliveryTime,
                deliveryDate: orderData.deliveryDate,
                orderComment: orderData.orderComment || '',
                deliveryAddress: orderData.deliveryAddress,
                orderStatus: 'pending',
                paymentMethod: orderData.paymentMethod,
                transactionId: orderData.transactionId || '',
                deliveryName: orderData.deliveryName,
                deliveryOrgType: orderData.deliveryOrgType || '',
                total: Number(orderData.total || 0) // Add total amount
            };
            
            console.log('🔍 Final order object total:', order.total);

            const result = await this.databases.createDocument(
                this.config.DATABASE_ID,
                this.config.ORDERS_TABLE,
                this.ID.unique(),
                order
            );

            console.log('✅ Order created:', result.$id);
            console.log('✅ Order total in result:', result.total);
            return result;
        } catch (error) {
            console.error('❌ Error creating order:', error);
            throw error;
        }
    }

    // Create purchase recipient information
    async createPurchaseRecipientInfo(orderId, recipientData) {
        try {
            console.log('🔍 Creating purchase recipient info...');
            console.log('🔍 Order ID:', orderId);
            console.log('🔍 Recipient data:', recipientData);
            console.log('🔍 Table:', this.config.PURCHASE_RECIPIENT_TABLE);
            console.log('🔍 Database:', this.config.DATABASE_ID);
            
            const recipientInfo = {
                order_id: orderId,
                purchase_recipient_type: recipientData.purchase_recipient_type || 'you',
                recipient_name: recipientData.recipient_name || '',
                recipient_phone: recipientData.recipient_phone || '',
                recipient_email: recipientData.recipient_email || '',
                recipient_address: recipientData.recipient_address || '',
                recipient_type: recipientData.recipient_type || '',
                business_name: recipientData.business_name || '',
                business_type: recipientData.business_type || '',
                self_pickup: recipientData.self_pickup || false,
                self_delivery_address: recipientData.self_delivery_address || ''
            };

            console.log('🔍 Final recipient info object:', recipientInfo);

            const result = await this.databases.createDocument(
                this.config.DATABASE_ID,
                this.config.PURCHASE_RECIPIENT_TABLE,
                this.ID.unique(),
                recipientInfo
            );

            console.log('✅ Purchase recipient info created:', result.$id);
            return result;
        } catch (error) {
            console.error('❌ Error creating purchase recipient info:', error);
            console.error('❌ Error details:', error.message);
            throw error;
        }
    }

    // Create order items for a specific order
    async createOrderItems(orderId, items, orderData) {
        try {
            const createdItems = [];
            
            for (const item of items) {
                const orderItem = {
                    orderItemId: this.ID.unique(),
                    orderId: orderId,
                    branchId: orderData.branchId || item.branchId,
                    productId: item.productId || item.id,
                    productName: item.name || item.productName,
                    productImage: item.image || item.productImage || '',
                    productType: item.type || item.productType || '',
                    productPrice: Number(item.price || item.productPrice || 0),
                    productQty: Number(item.quantity || 1),
                    returnStatus: 'none',
                    returnQty: 0,
                    returnComment: ''
                };

                const result = await this.databases.createDocument(
                    this.config.DATABASE_ID,
                    this.config.ORDER_ITEMS_TABLE,
                    this.ID.unique(),
                    orderItem
                );

                createdItems.push(result);
            }

            console.log(`✅ Created ${createdItems.length} order items`);
            return createdItems;
        } catch (error) {
            console.error('❌ Error creating order items:', error);
            throw error;
        }
    }

    // Get order by ID
    async getOrder(orderId) {
        try {
            const order = await this.databases.getDocument(
                this.config.DATABASE_ID,
                this.config.ORDERS_TABLE,
                orderId
            );

            // Get order items
            const orderItems = await this.getOrderItems(orderId);

            return { ...order, items: orderItems };
        } catch (error) {
            console.error('❌ Error fetching order:', error);
            throw error;
        }
    }

    // Get order items for an order
    async getOrderItems(orderId) {
        try {
            const items = await this.databases.listDocuments(
                this.config.DATABASE_ID,
                this.config.ORDER_ITEMS_TABLE,
                [this.Query.equal('orderId', orderId)]
            );

            return items.documents;
        } catch (error) {
            console.error('❌ Error fetching order items:', error);
            throw error;
        }
    }

    // Get orders for a customer
    async getCustomerOrders(customerId) {
        try {
            const orders = await this.databases.listDocuments(
                this.config.DATABASE_ID,
                this.config.ORDERS_TABLE,
                [this.Query.equal('customer_id', customerId)]
            );

            return orders.documents;
        } catch (error) {
            console.error('❌ Error fetching customer orders:', error);
            throw error;
        }
    }

    // Update order status
    async updateOrderStatus(orderId, status) {
        try {
            const result = await this.databases.updateDocument(
                this.config.DATABASE_ID,
                this.config.ORDERS_TABLE,
                orderId,
                { orderStatus: status }
            );

            console.log(`✅ Order ${orderId} status updated to: ${status}`);
            return result;
        } catch (error) {
            console.error('❌ Error updating order status:', error);
            throw error;
        }
    }

    // Update order with transaction ID
    async updateOrderTransaction(orderId, transactionId) {
        try {
            const result = await this.databases.updateDocument(
                this.config.DATABASE_ID,
                this.config.ORDERS_TABLE,
                orderId,
                { transactionId: transactionId }
            );

            console.log(`✅ Order ${orderId} transaction ID updated`);
            return result;
        } catch (error) {
            console.error('❌ Error updating transaction ID:', error);
            throw error;
        }
    }

    // Delete order (and its items)
    async deleteOrder(orderId) {
        try {
            // First delete all order items
            const items = await this.getOrderItems(orderId);
            for (const item of items) {
                await this.databases.deleteDocument(
                    this.config.DATABASE_ID,
                    this.config.ORDER_ITEMS_TABLE,
                    item.$id
                );
            }

            // Then delete the order
            await this.databases.deleteDocument(
                this.config.DATABASE_ID,
                this.config.ORDERS_TABLE,
                orderId
            );

            console.log(`✅ Order ${orderId} and its items deleted`);
            return true;
        } catch (error) {
            console.error('❌ Error deleting order:', error);
            throw error;
        }
    }

    // Validate date/time against working days
    validateDateTimeWithWorkingDays(selectedDate, selectedTime, workingDays) {
        // Handle both array and object formats for workingDays
        let workingDaysArray = [];
        
        if (Array.isArray(workingDays)) {
            workingDaysArray = workingDays;
        } else if (typeof workingDays === 'object' && workingDays !== null) {
            // Convert object format to array format
            workingDaysArray = Object.keys(workingDays).map(day => ({
                day: day.charAt(0).toUpperCase() + day.slice(1), // Capitalize first letter
                time: `${workingDays[day].open}-${workingDays[day].close}`
            }));
        }

        if (workingDaysArray.length === 0) {
            return { valid: true, message: 'No working days restrictions' };
        }

        const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
        const workingDay = workingDaysArray.find(day => day.day.toLowerCase() === dayOfWeek.toLowerCase());

        if (!workingDay) {
            return { valid: false, message: `Not a working day. ${dayOfWeek} is not available.` };
        }

        // Parse working hours (e.g., "8:00 AM - 6:00 PM")
        const timeRange = workingDay.time;
        const [openTime, closeTime] = timeRange.split(' - ').map(t => t.trim());

        // Simple time validation (can be enhanced)
        if (selectedTime && openTime && closeTime) {
            // This is basic validation - you might want to improve time comparison
            return { valid: true, message: `Working hours: ${timeRange}` };
        }

        return { valid: true, message: `Working day confirmed: ${dayOfWeek}` };
    }

    // Complete order creation with validation
    async createCompleteOrder(orderData, cartItems, workingDays) {
        try {
            // Validate date/time
            const validation = this.validateDateTimeWithWorkingDays(
                orderData.deliveryDate,
                orderData.deliveryTime,
                workingDays
            );

            if (!validation.valid) {
                throw new Error(validation.message);
            }

            // Create order
            const order = await this.createOrder(orderData);

            // Create order items
            await this.createOrderItems(order.$id, cartItems, orderData);

            console.log('✅ Complete order created successfully');
            return order;
        } catch (error) {
            console.error('❌ Error creating complete order:', error);
            throw error;
        }
    }

    // Get orders by customer ID
    async getOrdersByCustomer(customerId) {
        const operation = async () => {
            const result = await this.databases.listDocuments(
                this.config.DATABASE_ID,
                this.config.ORDERS_TABLE,
                [
                    Query.equal('customer_id', customerId),
                    Query.orderDesc('$createdAt')
                ]
            );

            console.log('✅ Orders retrieved for customer:', result.documents);
            return result.documents;
        };

        try {
            return await this.retryOperation(operation);
        } catch (error) {
            console.error('❌ Error getting orders after retries:', error);
            return [];
        }
    }

    // Get order items for an order
    async getOrderItems(orderId) {
        const operation = async () => {
            const result = await this.databases.listDocuments(
                this.config.DATABASE_ID,
                this.config.ORDER_ITEMS_TABLE,
                [
                    Query.equal('orderId', orderId)
                ]
            );

            return result.documents;
        };

        try {
            return await this.retryOperation(operation);
        } catch (error) {
            console.error('❌ Error getting order items after retries:', error);
            return [];
        }
    }

    // Get purchase recipient info for an order
    async getPurchaseRecipientInfo(orderId) {
        const operation = async () => {
            console.log('🔍 Getting purchase recipient info for order:', orderId);
            console.log('🔍 Table:', this.config.PURCHASE_RECIPIENT_TABLE);
            console.log('🔍 Database:', this.config.DATABASE_ID);
            
            const result = await this.databases.listDocuments(
                this.config.DATABASE_ID,
                this.config.PURCHASE_RECIPIENT_TABLE,
                [
                    Query.equal('order_id', orderId)
                ]
            );

            console.log('🔍 Purchase recipient query result:', result);
            console.log('🔍 Found recipient info:', result.documents);

            return result.documents.length > 0 ? result.documents[0] : null;
        };

        try {
            return await this.retryOperation(operation);
        } catch (error) {
            // If it's a permission error, just return null and continue
            if (error.message.includes('not authorized') || error.message.includes('401')) {
                console.log('⚠️ No permission to read purchase recipient info, skipping...');
                return null;
            }
            console.error('❌ Error getting purchase recipient info after retries:', error);
            console.error('❌ Error details:', error.message);
            return null;
        }
    }
}

// Make OrderManager globally available
window.OrderManager = OrderManager;
