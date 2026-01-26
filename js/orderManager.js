class OrderManager {
  constructor() {
    // Validate Appwrite configuration is available
    if (!window.appwriteConfig) {
      throw new Error(
        "Appwrite configuration not initialized. Make sure appwriteConfig.js is loaded before OrderManager."
      );
    }
    if (!window.databases) {
      throw new Error("Appwrite Databases SDK not initialized.");
    }
    if (!window.ID) {
      throw new Error("Appwrite ID SDK not initialized.");
    }
    if (!window.Query) {
      throw new Error("Appwrite Query SDK not initialized.");
    }

    this.config = window.appwriteConfig;
    this.databases = window.databases;
    this.ID = window.ID;
    this.Query = window.Query;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second

    // Log successful initialization
    console.log("✅ OrderManager initialized successfully");
    console.log("📝 Database ID:", this.config.DATABASE_ID);
    console.log("📝 Orders Table:", this.config.ORDERS_TABLE);
  }

  // Retry helper function
  async retryOperation(operation, retries = 0) {
    try {
      return await operation();
    } catch (error) {
      console.error(
        `❌ Operation failed (attempt ${retries + 1}/${this.maxRetries}):`,
        error.message
      );

      if (retries < this.maxRetries - 1) {
        console.log(`🔄 Retrying in ${this.retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.retryOperation(operation, retries + 1);
      }

      throw error;
    }
  }

  // Create a new order
  async createOrder(orderData) {
    try {
      console.log(
        "🔍 OrderManager.createOrder - orderData.total:",
        orderData.total
      );
      console.log("🔍 OrderManager.createOrder - orderData:", orderData);

      // Generate unique ID with fallback method (max 20 chars)
      let uniqueOrderId;
      try {
        uniqueOrderId = this.ID.unique();
        console.log("🔍 Generated unique orderId via Appwrite:", uniqueOrderId);

        // If ID.unique() returns "unique()", use fallback method
        if (uniqueOrderId === "unique()") {
          throw new Error("Appwrite ID.unique() not working properly");
        }
      } catch (error) {
        console.log("🔍 Using fallback ID generation method");
        // Generate shorter ID: timestamp (last 8 digits) + random (6 chars) = max 14 chars
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substr(2, 6);
        uniqueOrderId = timestamp + random;
        console.log("🔍 Generated fallback orderId:", uniqueOrderId);
        console.log("🔍 Fallback orderId length:", uniqueOrderId.length);
      }

      const order = {
        // Required orderId field - use the generated ID
        orderId: uniqueOrderId,

        // Required customer field
        customer_id: orderData.customer_id || orderData.buyerId,

        // Order details
        buyerId: orderData.customer_id || orderData.buyerId,
        branch_id: orderData.branch_id || orderData.branchId,
        deliveryTime: orderData.deliveryTime,
        deliveryDate: orderData.deliveryDate,
        orderComment: orderData.orderComment || "",
        deliveryAddress: orderData.deliveryAddress,
        orderStatus: "pending",
        paymentMethod: orderData.paymentMethod,
        transactionId: orderData.transactionId || "",
        deliveryName: orderData.deliveryName,
        deliveryOrgType: orderData.deliveryOrgType || "",
        total: String(Number(orderData.total || 0).toFixed(2)), // Convert to string with 2 decimals
      };

      console.log("🔍 Final order object total:", order.total);
      console.log("🔍 Final order object with orderId:", order.orderId);

      const result = await this.databases.createDocument(
        this.config.DATABASE_ID,
        this.config.ORDERS_TABLE,
        uniqueOrderId,
        order
      );

      console.log("✅ Order created:", result.$id);
      console.log("✅ Order total in result:", result.total);
      return result;
    } catch (error) {
      console.error("❌ Error creating order:", error);
      throw error;
    }
  }

  // Create purchase recipient information
  async createPurchaseRecipientInfo(orderId, recipientData) {
    try {
      console.log("🔍 Creating purchase recipient info...");
      console.log("🔍 Order ID:", orderId);
      console.log("🔍 Recipient data:", recipientData);
      console.log("🔍 Table:", this.config.PURCHASE_RECIPIENT_TABLE);
      console.log("🔍 Database:", this.config.DATABASE_ID);

      const recipientInfo = {
        order_id: orderId,
        purchase_recipient_type: recipientData.purchase_recipient_type || "you",
        recipient_name: recipientData.recipient_name || "",
        recipient_phone: recipientData.recipient_phone || "",
        recipient_email:
          recipientData.recipient_email &&
          recipientData.recipient_email.trim() !== ""
            ? recipientData.recipient_email
            : null,
        recipient_address: recipientData.recipient_address || "",
        recipient_type: recipientData.recipient_type || "",
        business_name: recipientData.business_name || "",
        business_type: recipientData.business_type || "",
        self_pickup: recipientData.self_pickup || false,
        self_delivery_address: recipientData.self_delivery_address || "",
      };

      console.log("🔍 Final recipient info object:", recipientInfo);

      const result = await this.databases.createDocument(
        this.config.DATABASE_ID,
        this.config.PURCHASE_RECIPIENT_TABLE,
        this.ID.unique(),
        recipientInfo
      );

      console.log("✅ Purchase recipient info created:", result.$id);
      return result;
    } catch (error) {
      console.error("❌ Error creating purchase recipient info:", error);
      console.error("❌ Error details:", error.message);
      throw error;
    }
  }

  // Create order items for a specific order
  async createOrderItems(orderId, items, orderData) {
    try {
      const createdItems = [];

      for (const item of items) {
        console.log("🔍 Processing item for orderItem:", item);
        console.log("🔍 Item type:", item.type);
        console.log("🔍 Item productType:", item.productType);
        console.log("🔍 Item name:", item.name);
        console.log("🔍 Item productName:", item.productName);

        // Generate unique ID using timestamp and random number as fallback (max 20 chars)
        let uniqueOrderItemId;
        try {
          uniqueOrderItemId = this.ID.unique();
          console.log(
            "🔍 Generated unique orderItemId via Appwrite:",
            uniqueOrderItemId
          );

          // If ID.unique() returns "unique()", use fallback method
          if (uniqueOrderItemId === "unique()") {
            throw new Error("Appwrite ID.unique() not working properly");
          }
        } catch (error) {
          console.log("🔍 Using fallback ID generation method");
          // Generate shorter ID: timestamp (last 8 digits) + random (6 chars) = max 14 chars
          const timestamp = Date.now().toString().slice(-8);
          const random = Math.random().toString(36).substr(2, 6);
          uniqueOrderItemId = timestamp + random;
          console.log("🔍 Generated fallback orderItemId:", uniqueOrderItemId);
          console.log(
            "🔍 Fallback orderItemId length:",
            uniqueOrderItemId.length
          );
        }

        // Get product name with better fallbacks to handle undefined
        let productName =
          item.name ||
          item.productName ||
          item.product_name ||
          item.type ||
          "Unknown Product";

        // Handle case where name might be undefined or empty
        if (
          !productName ||
          productName === "undefined" ||
          productName.trim() === ""
        ) {
          productName = item.type || "Service Product";
        }

        console.log("🔍 Final product name to use:", productName);
        console.log("🔍 Item details for debugging:", JSON.stringify(item));

        const orderItem = {
          orderItemId: uniqueOrderItemId,
          orderId: orderId,
          branchId:
            orderData.branch_id ||
            orderData.branchId ||
            item.branch_id ||
            item.branchId,
          productId: String(item.productId || item.id || "").substring(0, 20),
          productName: productName,
          productImage: (item.image || item.productImage || "").startsWith(
            "http"
          )
            ? item.image || item.productImage
            : "",
          productType: item.type || item.productType || "default",
          productPrice: Number(item.price || item.productPrice || 0),
          productQty: Number(item.quantity || 1),
          returnStatus: "none",
          returnQty: 0,
          returnComment: "",
        };

        console.log("🔍 Final orderItem productType:", orderItem.productType);
        console.log("🔍 Final orderItem productName:", orderItem.productName);

        const result = await this.databases.createDocument(
          this.config.DATABASE_ID,
          this.config.ORDER_ITEMS_TABLE,
          uniqueOrderItemId,
          orderItem
        );

        createdItems.push(result);
      }

      console.log(`✅ Created ${createdItems.length} order items`);
      return createdItems;
    } catch (error) {
      console.error("❌ Error creating order items:", error);
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
      console.error("❌ Error fetching order:", error);
      throw error;
    }
  }

  // Get order items for an order
  async getOrderItems(orderId) {
    try {
      const items = await this.databases.listDocuments(
        this.config.DATABASE_ID,
        this.config.ORDER_ITEMS_TABLE,
        [this.Query.equal("orderId", orderId)]
      );

      return items.documents;
    } catch (error) {
      console.error("❌ Error fetching order items:", error);
      throw error;
    }
  }

  // Get orders for a customer
  async getCustomerOrders(customerId) {
    try {
      const orders = await this.databases.listDocuments(
        this.config.DATABASE_ID,
        this.config.ORDERS_TABLE,
        [this.Query.equal("customer_id", customerId)]
      );

      return orders.documents;
    } catch (error) {
      console.error("❌ Error fetching customer orders:", error);
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
      console.error("❌ Error updating order status:", error);
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
      console.error("❌ Error updating transaction ID:", error);
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
      console.error("❌ Error deleting order:", error);
      throw error;
    }
  }

  // Validate date/time against working days
  validateDateTimeWithWorkingDays(selectedDate, selectedTime, workingDays) {
    // Handle both array and object formats for workingDays
    let workingDaysArray = [];

    if (Array.isArray(workingDays)) {
      workingDaysArray = workingDays;
    } else if (typeof workingDays === "object" && workingDays !== null) {
      // Convert object format to array format
      workingDaysArray = Object.keys(workingDays).map((day) => ({
        day: day.charAt(0).toUpperCase() + day.slice(1), // Capitalize first letter
        time: `${workingDays[day].open}-${workingDays[day].close}`,
      }));
    }

    if (workingDaysArray.length === 0) {
      return { valid: true, message: "No working days restrictions" };
    }

    const dayOfWeek = new Date(selectedDate).toLocaleDateString("en-US", {
      weekday: "long",
    });
    const workingDay = workingDaysArray.find(
      (day) => day.day.toLowerCase() === dayOfWeek.toLowerCase()
    );

    if (!workingDay) {
      return {
        valid: false,
        message: `Not a working day. ${dayOfWeek} is not available.`,
      };
    }

    // Parse working hours (e.g., "8:00 AM - 6:00 PM")
    const timeRange = workingDay.time;
    const [openTime, closeTime] = timeRange.split(" - ").map((t) => t.trim());

    // Simple time validation (can be enhanced)
    if (selectedTime && openTime && closeTime) {
      // This is basic validation - you might want to improve time comparison
      return { valid: true, message: `Working hours: ${timeRange}` };
    }

    return { valid: true, message: `Working day confirmed: ${dayOfWeek}` };
  }

  // Get saved recipients for a user
  async getSavedRecipients(userId) {
    try {
      console.log("🔍 Fetching saved recipients for user:", userId);

      // Get favorite recipients (saved with order_id = favorite_<userId>)
      const favoriteResult = await this.databases.listDocuments(
        this.config.DATABASE_ID,
        this.config.PURCHASE_RECIPIENT_TABLE,
        [this.Query.equal("order_id", `favorite_${userId}`)]
      );

      console.log(
        "🔍 Found favorite recipients:",
        favoriteResult.documents.length
      );

      // Transform favorite recipients
      const favoriteRecipients = favoriteResult.documents.map((doc) => ({
        id: doc.$id,
        name: doc.recipient_name,
        phone: doc.recipient_phone,
        email: doc.recipient_email,
        address: doc.recipient_address,
        type: doc.recipient_type,
        businessName: doc.business_name,
        businessType: doc.business_type,
        createdAt: doc.$createdAt,
        isFavorite: true,
      }));

      // Also get recipients from previous orders
      try {
        const ordersResult = await this.databases.listDocuments(
          this.config.DATABASE_ID,
          this.config.ORDERS_TABLE,
          [this.Query.equal("customer_id", userId)]
        );

        console.log("🔍 Found orders:", ordersResult.documents.length);

        if (ordersResult.documents.length > 0) {
          // Get all unique recipient info from these orders
          const recipientPromises = ordersResult.documents.map(
            async (order) => {
              try {
                const recipientResult = await this.databases.listDocuments(
                  this.config.DATABASE_ID,
                  this.config.PURCHASE_RECIPIENT_TABLE,
                  [this.Query.equal("order_id", order.$id)]
                );

                if (recipientResult.documents.length > 0) {
                  const recipient = recipientResult.documents[0];
                  return {
                    id: recipient.$id,
                    name: recipient.recipient_name,
                    phone: recipient.recipient_phone,
                    email: recipient.recipient_email,
                    address: recipient.recipient_address,
                    type: recipient.recipient_type,
                    businessName: recipient.business_name,
                    businessType: recipient.business_type,
                    createdAt: recipient.$createdAt,
                    orderId: order.$id,
                    isFavorite: false,
                  };
                }
                return null;
              } catch (error) {
                console.error(
                  "❌ Error fetching recipient for order:",
                  order.$id,
                  error
                );
                return null;
              }
            }
          );

          const orderRecipients = await Promise.all(recipientPromises);
          const filteredOrderRecipients = orderRecipients.filter(
            (r) => r !== null && r.name
          );

          // Remove duplicates (same name, phone, email)
          const uniqueOrderRecipients = filteredOrderRecipients.reduce(
            (acc, recipient) => {
              const key = `${recipient.name}-${recipient.phone}-${recipient.email}`;
              if (!acc.has(key)) {
                acc.set(key, recipient);
              }
              return acc;
            },
            new Map()
          );

          // Combine favorites and order recipients
          const allRecipients = [
            ...favoriteRecipients,
            ...Array.from(uniqueOrderRecipients.values()),
          ];

          // Final deduplication
          const finalRecipients = allRecipients.reduce((acc, recipient) => {
            const key = `${recipient.name}-${recipient.phone}-${recipient.email}`;
            if (!acc.has(key)) {
              acc.set(key, recipient);
            }
            return acc;
          }, new Map());

          console.log(
            "🔍 Final recipients found:",
            Array.from(finalRecipients.values())
          );
          return Array.from(finalRecipients.values());
        }
      } catch (orderError) {
        console.error("❌ Error fetching order recipients:", orderError);
        // Return just favorites if order fetch fails
        return favoriteRecipients;
      }

      return favoriteRecipients;
    } catch (error) {
      console.error("❌ Error getting saved recipients:", error);
      return [];
    }
  }

  // Save recipient to database as favorite
  async saveRecipient(userId, recipientData) {
    try {
      console.log("🔍 Saving recipient for user:", userId);
      console.log("🔍 Recipient data:", recipientData);

      // Create a favorite recipient entry (not tied to an order)
      const document = {
        // Use order_id field to store the user ID for favorite recipients
        order_id: `favorite_${userId}`,
        purchase_recipient_type: recipientData.type,
        recipient_name: recipientData.name,
        recipient_phone: recipientData.phone,
        recipient_email: recipientData.email,
        recipient_address: recipientData.address,
        recipient_type: recipientData.type,
        business_name: recipientData.businessName || "",
        business_type: recipientData.businessType || "",
        self_pickup: recipientData.type === "you",
        self_delivery_address:
          recipientData.type === "you" ? recipientData.address : "",
      };

      const result = await this.databases.createDocument(
        this.config.DATABASE_ID,
        this.config.PURCHASE_RECIPIENT_TABLE,
        this.ID.unique(),
        document
      );

      console.log("✅ Recipient saved:", result.$id);
      return result;
    } catch (error) {
      console.error("❌ Error saving recipient:", error);
      throw error;
    }
  }

  // Delete saved recipient
  async deleteRecipient(recipientId) {
    try {
      console.log("🔍 Deleting recipient:", recipientId);

      await this.databases.deleteDocument(
        this.config.DATABASE_ID,
        this.config.PURCHASE_RECIPIENT_TABLE,
        recipientId
      );

      console.log("✅ Recipient deleted");
      return true;
    } catch (error) {
      console.error("❌ Error deleting recipient:", error);
      throw error;
    }
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

      console.log("✅ Complete order created successfully");
      return order;
    } catch (error) {
      console.error("❌ Error creating complete order:", error);
      throw error;
    }
  }

  // Get orders by customer ID
  async getOrdersByCustomer(customerId) {
    const operation = async () => {
      const result = await this.databases.listDocuments(
        this.config.DATABASE_ID,
        this.config.ORDERS_TABLE,
        [Query.equal("customer_id", customerId), Query.orderDesc("$createdAt")]
      );

      console.log("✅ Orders retrieved for customer:", result.documents);
      return result.documents;
    };

    try {
      return await this.retryOperation(operation);
    } catch (error) {
      console.error("❌ Error getting orders after retries:", error);
      return [];
    }
  }

  // Get order items for an order
  async getOrderItems(orderId) {
    const operation = async () => {
      const result = await this.databases.listDocuments(
        this.config.DATABASE_ID,
        this.config.ORDER_ITEMS_TABLE,
        [Query.equal("orderId", orderId)]
      );

      return result.documents;
    };

    try {
      return await this.retryOperation(operation);
    } catch (error) {
      console.error("❌ Error getting order items after retries:", error);
      return [];
    }
  }

  // Get purchase recipient info for an order
  async getPurchaseRecipientInfo(orderId) {
    const operation = async () => {
      console.log("🔍 Getting purchase recipient info for order:", orderId);
      console.log("🔍 Table:", this.config.PURCHASE_RECIPIENT_TABLE);
      console.log("🔍 Database:", this.config.DATABASE_ID);

      const result = await this.databases.listDocuments(
        this.config.DATABASE_ID,
        this.config.PURCHASE_RECIPIENT_TABLE,
        [Query.equal("order_id", orderId)]
      );

      console.log("🔍 Purchase recipient query result:", result);
      console.log("🔍 Found recipient info:", result.documents);

      return result.documents.length > 0 ? result.documents[0] : null;
    };

    try {
      return await this.retryOperation(operation);
    } catch (error) {
      // If it's a permission error, just return null and continue
      if (
        error.message.includes("not authorized") ||
        error.message.includes("401")
      ) {
        console.log(
          "⚠️ No permission to read purchase recipient info, skipping..."
        );
        return null;
      }
      console.error(
        "❌ Error getting purchase recipient info after retries:",
        error
      );
      console.error("❌ Error details:", error.message);
      return null;
    }
  }
}

// Make OrderManager globally available
window.OrderManager = OrderManager;
