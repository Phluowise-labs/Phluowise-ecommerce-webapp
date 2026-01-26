// Wait for Appwrite to be available
if (typeof Appwrite === "undefined") {
  console.error("Appwrite SDK not loaded!");
} else {
  const { ID, Query, Client } = Appwrite;

  const client = new Client()
    .setEndpoint("https://nyc.cloud.appwrite.io/v1")
    .setProject("695f826500067c381616");

  console.log("✅ Appwrite Client initialized");
  console.log("📝 Endpoint:", "https://nyc.cloud.appwrite.io/v1");
  console.log("📝 Project ID:", "695f826500067c381616");

  const account = new Appwrite.Account(client);
  const databases = new Appwrite.Databases(client);

  const appwriteConfig = {
    DATABASE_ID: "68b1b7590035346a3be9",
    CUSTOMER_TABLE: "customer_tb",
    COMPANY_TABLE: "company_tb",
    BRANCHES_TABLE: "branches",
    WORKING_DAYS_TABLE: "working_days",
    PRODUCTS_TABLE: "product",
    SOCIAL_MEDIA_TABLE: "social_media",
    RATINGS_TABLE: "ratings",
    ORDERS_TABLE: "orders",
    ORDER_ITEMS_TABLE: "order_items",
    PURCHASE_RECIPIENT_TABLE: "purchase_recipient_info",
    COMPANY_VERIFICATION_TABLE: "company_verification",
    STORAGE_BUCKET_ID: "68b1c57b001542be7fbe",
    PROJECT_ID: "695f826500067c381616",
    BUCKETS: {
      PRODUCTS: "695fec72003b8ba4fb22",
    },
    client,
    account,
    databases,
    ID,
    Query,
  };

  // Make variables globally accessible
  window.appwriteConfig = appwriteConfig;
  window.account = account;
  window.databases = databases;
  window.ID = ID;
  window.Query = Query;
  window.client = client;

  console.log("✅ Appwrite configuration loaded successfully");
  console.log("✅ Database ID:", appwriteConfig.DATABASE_ID);
  console.log("✅ Orders Table:", appwriteConfig.ORDERS_TABLE);
  console.log("✅ All Appwrite globals set on window");
}
