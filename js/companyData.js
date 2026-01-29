// Company Data Management Module
// Handles fetching and processing company data from Appwrite database

class CompanyDataManager {
    constructor() {
        this.companies = [];
        this.branches = [];
        this.workingDays = [];
        this.products = [];
        this.socialMedia = [];
        this.verifications = [];
        this.ratings = [];
        this.isLoading = false;
        this.lastFetchTime = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    // Fetch all companies and their branches from database
    async fetchCompanyData() {
        if (this.isLoading) return this.companies;
        
        // Check cache
        if (this.lastFetchTime && (Date.now() - this.lastFetchTime < this.cacheTimeout)) {
            console.log('📦 Using cached company data');
            return this.companies;
        }

        this.isLoading = true;
        
        try {
            console.log('🔄 Fetching company data from database...');
            
            // Fetch companies, branches, working days, products, social media, verification and ratings in parallel
            const [companiesResponse, branchesResponse, workingDaysResponse, productsResponse, socialMediaResponse, verificationResponse, ratingsResponse] = await Promise.all([
                this.fetchCompanies(),
                this.fetchBranches(),
                this.fetchWorkingDays(),
                this.fetchProducts(),
                this.fetchSocialMedia(),
                this.fetchVerifications(),
                this.fetchRatings()
            ]);

            this.companies = companiesResponse;
            this.branches = branchesResponse;
            this.workingDays = workingDaysResponse;
            this.products = productsResponse;
            this.socialMedia = socialMediaResponse;
            this.verifications = verificationResponse;
            this.ratings = ratingsResponse;
            this.lastFetchTime = Date.now();

            // Process and merge data
            const mergedData = this.mergeCompanyAndBranchData();
            
            console.log(`✅ Successfully loaded ${mergedData.length} companies with branches, working days, products, social media, and ratings`);
            return mergedData;

        } catch (error) {
            console.error('❌ Error fetching company data:', error);
            // Return fallback data if database fails
            return this.getFallbackData();
        } finally {
            this.isLoading = false;
        }
    }

    // Fetch companies from company_tb table
    async fetchCompanies() {
        try {
            // Check if Appwrite is available
            if (!window.databases || !window.appwriteConfig) {
                console.error('❌ Appwrite not available - checking if SDK loaded');
                console.log('window.databases:', window.databases);
                console.log('window.appwriteConfig:', window.appwriteConfig);
                console.log('window.Appwrite:', window.Appwrite);
                return [];
            }

            const response = await window.databases.listDocuments(
                window.appwriteConfig.DATABASE_ID,
                'company_tb',
                [
                    window.Query.orderDesc('$createdAt')
                ]
            );
            
            console.log(`📋 Found ${response.documents.length} companies`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error fetching companies:', error);
            return [];
        }
    }

    // Fetch branches from branches table
    async fetchBranches() {
        try {
            // Check if Appwrite is available
            if (!window.databases || !window.appwriteConfig) {
                console.error('❌ Appwrite not available for branches - checking if SDK loaded');
                console.log('window.databases:', window.databases);
                console.log('window.appwriteConfig:', window.appwriteConfig);
                console.log('window.Appwrite:', window.Appwrite);
                return [];
            }

            const response = await window.databases.listDocuments(
                window.appwriteConfig.DATABASE_ID,
                'branches',
                [
                    window.Query.equal('is_active', true),
                    window.Query.equal('disabled', false),
                    window.Query.orderDesc('$createdAt')
                ]
            );
            
            console.log('📍 Found', response.documents.length, 'active branches');
            return response.documents;
        } catch (error) {
            console.error('❌ Error fetching branches:', error);
            return [];
        }
    }

    // Fetch working days from working_days table
    async fetchWorkingDays() {
        try {
            const response = await window.databases.listDocuments(
                window.appwriteConfig.DATABASE_ID,
                window.appwriteConfig.WORKING_DAYS_TABLE
            );
            return response.documents;
        } catch (error) {
            console.error('❌ Error fetching working days:', error);
            return [];
        }
    }

    // Fetch products from database
    async fetchProducts() {
        try {
            const response = await window.databases.listDocuments(
                window.appwriteConfig.DATABASE_ID,
                window.appwriteConfig.PRODUCTS_TABLE
            );
            console.log('📦 Raw product data from database:');
            response.documents.forEach((doc, index) => {
                const productName = doc.name || doc.product_name || doc.productName || 'Unknown Product';
                console.log(`📦 Product #${index + 1}: ${productName} - Image: ${doc.product_image || doc.image || 'None'}`);
            });
            return response.documents;
        } catch (error) {
            console.error('❌ Error fetching products:', error);
            return [];
        }
    }

    // Merge company and branch data
    mergeCompanyAndBranchData() {
        const mergedData = [];

        this.branches.forEach(branch => {
            // Find the corresponding company
            const company = this.companies.find(c => c.company_id === branch.company_id);
            
            if (company) {
                // Get working days for this branch
                const branchWorkingDays = this.workingDays.filter(wd => 
                    wd.branch_id === branch.branch_id || wd.company_id === branch.company_id
                );

                // Get products for this branch/company
                const branchProducts = this.products.filter(product => 
                    product.branch_id === branch.branch_id || product.company_id === branch.company_id
                );

                // Get social media for this branch/company
                const branchSocialMedia = this.socialMedia.filter(sm => 
                    sm.branch_id === branch.branch_id || sm.company_id === branch.company_id
                );

                // Get verification status for this company
                const verification = this.verifications.find(v => {
                    // Try all possible field names for company ID
                    const companyId = v.company_id || v.companyId || v.companyID || v.company;
                    return companyId === branch.company_id;
                });
                const verificationStatus = verification ? 
                    (verification.status || verification.verification_status || verification.verificationStatus) : 
                    null;
                const isVerified = verificationStatus === 'verified';
                
                console.log(`🔍 Checking verification for company ${branch.company_id}:`);
                console.log('- Found verification:', verification);
                console.log('- Verification status:', verificationStatus || 'N/A');
                console.log('- isVerified:', isVerified);
                console.log('- Branch name:', branch.branch_name);
                
                // Debug: Show all verification records for troubleshooting
                if (this.verifications.length > 0) {
                    console.log('🔍 All verification records:');
                    this.verifications.forEach((v, i) => {
                        const companyId = v.company_id || v.companyId || v.companyID;
                        const status = v.status || v.verification_status || v.verificationStatus;
                        console.log(`  ${i + 1}. company_id: ${companyId}, status: ${status}, $id: ${v.$id}`);
                    });
                }

                // Create merged company object with branch info
                const mergedCompany = {
                    id: branch.$id, // Use branch document ID as main ID
                    branch_id: branch.branch_id,
                    company_id: branch.company_id,
                    name: company.name,
                    branch_name: branch.branch_name || company.name,
                    email: branch.email,
                    phone_number: branch.phone_number,
                    location: branch.location || 'Location not specified',
                    description: branch.description,
                    website: branch.website,
                    is_online: branch.is_online || false,
                    is_active: branch.is_active || false,
                    profile_image: branch.profile_image,
                    header_image: branch.header_image,
                    branch_type: branch.branch_type,
                    is_verified: isVerified, // Add verification status
                    coordinates: this.generateCoordinates(branch.location),
                    working_days: branchWorkingDays, // Add working days
                    products: branchProducts.map(product => ({
                        ...product,
                        name: product.name || product.product_name || product.productName || 'Unknown Product',
                        price: product.price || product.product_price || product.productPrice || 0,
                        type: product.type || product.product_type || product.productType || 'product',
                        minQuantity: product.minQuantity || product.min_quantity || 1,
                        rating: this.getProductRating(product),
                        image: this.getProductImageUrl(product.product_image || product.image)
                    })),
                    social_media: branchSocialMedia, // Add social media links
                    // Additional fields for compatibility
                    time: this.generateTimeText(),
                    distance: null
                };
                
                mergedData.push(mergedCompany);
            }
        });

        return mergedData;
    }

    // Generate mock coordinates for location (in real app, use geocoding API)
    generateCoordinates(location) {
        const locationCoords = {
            'Accra, Ghana': { lat: 5.6037, lng: -0.1870 },
            'Tema, Ghana': { lat: 5.6699, lng: -0.0166 },
            'Kumasi, Ghana': { lat: 6.6885, lng: -1.6244 },
            'Takoradi, Ghana': { lat: 4.8845, lng: -1.7554 },
            'Cape Coast, Ghana': { lat: 5.1036, lng: -1.2466 },
            'Ho, Ghana': { lat: 6.6000, lng: 0.4700 }
        };
        
        return locationCoords[location] || { 
            lat: 5.6037 + (Math.random() - 0.5) * 2, 
            lng: -0.1870 + (Math.random() - 0.5) * 2 
        };
    }

    // Generate time text based on random distance
    generateTimeText() {
        const times = ['10 minutes away', '15 minutes away', '20 minutes away', '25 minutes away', '30 minutes away'];
        return times[Math.floor(Math.random() * times.length)];
    }

    // Get fallback data when database fails
    getFallbackData() {
        console.log('🔄 Using fallback company data');
        return []; // Return empty array to show professional empty state instead of fallback data
    }

    // Refresh company data
    async refreshCompanyData() {
        this.lastFetchTime = null; // Invalidate cache
        return await this.fetchCompanyData();
    }

    // Get company by ID
    getCompanyById(companyId) {
        return this.companies.find(c => c.$id === companyId);
    }

    // Get branch by ID
    getBranchById(branchId) {
        return this.branches.find(b => b.$id === branchId);
    }

    // Search companies
    searchCompanies(query) {
        const searchTerm = query.toLowerCase();
        return this.companies.filter(company => 
            company.name.toLowerCase().includes(searchTerm) ||
            company.email.toLowerCase().includes(searchTerm)
        );
    }

    // Get online companies only
    getOnlineCompanies() {
        return this.mergeCompanyAndBranchData().filter(company => company.is_online);
    }

    // Get active companies only
    getActiveCompanies() {
        return this.mergeCompanyAndBranchData().filter(company => company.is_active);
    }

    // Get working days for a specific branch
    getWorkingDaysForBranch(branchId) {
        return this.workingDays.filter(wd => 
            wd.branch_id === branchId || wd.company_id === branchId
        );
    }

    // Get working days for a specific company
    getWorkingDaysForCompany(companyId) {
        return this.workingDays.filter(wd => wd.company_id === companyId);
    }

    // Get products for a specific branch
    getProductsForBranch(branchId) {
        return this.products.filter(product => 
            product.branch_id === branchId || product.company_id === branchId
        );
    }

    // Fetch social media from social_media table
    async fetchSocialMedia() {
        try {
            const response = await window.databases.listDocuments(
                window.appwriteConfig.DATABASE_ID,
                window.appwriteConfig.SOCIAL_MEDIA_TABLE
            );
            console.log(`📱 Found ${response.documents.length} social media links`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error fetching social media:', error);
            return [];
        }
    }

    // Fetch verification data from company_verification table
    async fetchVerifications() {
        try {
            const response = await window.databases.listDocuments(
                window.appwriteConfig.DATABASE_ID,
                window.appwriteConfig.COMPANY_VERIFICATION_TABLE
            );
            console.log(`✅ Found ${response.documents.length} verification records:`);
            response.documents.forEach((doc, index) => {
                // Log all available fields to understand the structure
                console.log(`📋 Verification #${index + 1}:`, {
                    $id: doc.$id,
                    allFields: Object.keys(doc),
                    fieldValues: {
                        company_id: doc.company_id,
                        companyId: doc.companyId,
                        companyID: doc.companyID,
                        status: doc.status,
                        verification_status: doc.verification_status,
                        verificationStatus: doc.verificationStatus
                    }
                });
            });
            return response.documents;
        } catch (error) {
            console.error('❌ Error fetching verification data:', error);
            return [];
        }
    }

    // Fetch ratings from ratings table
    async fetchRatings() {
        try {
            const response = await window.databases.listDocuments(
                window.appwriteConfig.DATABASE_ID,
                window.appwriteConfig.RATINGS_TABLE
            );
            console.log(`⭐ Found ${response.documents.length} rating records`);
            return response.documents;
        } catch (error) {
            console.error('❌ Error fetching ratings:', error);
            return [];
        }
    }

    // Get rating for a product based on product tags
    getProductRating(product) {
        // Get product tags from various possible field names
        const productTags = product.tags || product.product_tags || product.tag || [];
        
        if (!productTags || productTags.length === 0) {
            return 0; // Return 0 if no tags
        }

        // Find ratings that match any of the product tags
        const matchingRatings = this.ratings.filter(rating => {
            const ratingTags = rating.tags || rating.product_tags || rating.tag || [];
            if (!ratingTags || ratingTags.length === 0) return false;
            
            // Check if any product tag matches any rating tag
            return productTags.some(productTag => 
                ratingTags.some(ratingTag => 
                    productTag.toLowerCase() === ratingTag.toLowerCase()
                )
            );
        });

        if (matchingRatings.length === 0) {
            return 0; // Return 0 if no matching ratings
        }

        // Calculate average rating from all matching ratings
        const totalStars = matchingRatings.reduce((sum, rating) => {
            const stars = parseFloat(rating.stars || rating.rating || rating.star || 0);
            return sum + stars;
        }, 0);

        const averageRating = totalStars / matchingRatings.length;
        
        // Round to 1 decimal place and ensure it's between 0 and 5
        return Math.round(Math.max(0, Math.min(5, averageRating)) * 10) / 10;
    }

    // Get products for a specific company
    getProductsForCompany(companyId) {
        return this.products.filter(product => product.company_id === companyId);
    }

    // Get social media for a specific branch
    getSocialMediaForBranch(branchId) {
        return this.socialMedia.filter(sm => 
            sm.branch_id === branchId || sm.company_id === branchId
        );
    }

    // Get social media for a specific company
    getSocialMediaForCompany(companyId) {
        return this.socialMedia.filter(sm => sm.company_id === companyId);
    }

    // Convert product image path to full Appwrite URL
    getProductImageUrl(imagePath) {
        if (!imagePath) return '';
        
        // If it's already a full URL, return as-is
        if (imagePath.startsWith('http')) {
            return imagePath;
        }
        
        // Convert relative path to full Appwrite URL
        const { PROJECT_ID, DATABASE_ID, BUCKETS } = window.appwriteConfig;
        if (BUCKETS && BUCKETS.PRODUCTS) {
            return `https://nyc.cloud.appwrite.io/v1/storage/buckets/${BUCKETS.PRODUCTS}/files/${imagePath}/view?project=${PROJECT_ID}`;
        }
        
        // Fallback if bucket config not available
        return `https://nyc.cloud.appwrite.io/v1/storage/buckets/68b1c57b001542be7fbe/files/${imagePath}/view?project=${PROJECT_ID}`;
    }
}

// Create global instance
try {
    window.companyDataManager = new CompanyDataManager();
    console.log('✅ CompanyDataManager initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize CompanyDataManager:', error);
    // Create a fallback instance with basic functionality
    window.companyDataManager = {
        fetchCompanyData: async function() {
            console.log('🔄 Using fallback fetchCompanyData');
            return this.getFallbackData();
        },
        getFallbackData: function() {
            console.log('🔄 Using fallback company data - returning empty array for professional empty state');
            return []; // Return empty array to show professional empty state instead of fallback data
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompanyDataManager;
}
