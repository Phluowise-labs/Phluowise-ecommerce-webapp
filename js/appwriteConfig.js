// Wait for Appwrite to be available
if (typeof Appwrite === 'undefined') {
    console.error('Appwrite SDK not loaded!');
} else {
    const { ID, Query, Client } = Appwrite;

    const client = new Client()
        .setEndpoint('https://nyc.cloud.appwrite.io/v1')
        .setProject('68b17582003582da69c8');

    const account = new Appwrite.Account(client);
    const databases = new Appwrite.Databases(client);

    const appwriteConfig = {
        DATABASE_ID: '68b1b7590035346a3be9',
        CUSTOMER_TABLE: 'customer_tb',
        COMPANY_TABLE: 'company_tb',
        BRANCHES_TABLE: 'branches',
        WORKING_DAYS_TABLE: 'working_days',
        PRODUCTS_TABLE: 'product',
        SOCIAL_MEDIA_TABLE: 'social_media',
        RATINGS_TABLE: 'ratings',
        STORAGE_BUCKET_ID: '68b1c57b001542be7fbe',
        PROJECT_ID: '68b17582003582da69c8',
        client,
        account,
        databases,
        ID,
        Query
    };

    // Make variables globally accessible
    window.appwriteConfig = appwriteConfig;
    window.account = account;
    window.databases = databases;
    window.ID = ID;
    window.Query = Query;
    window.client = client;
}
