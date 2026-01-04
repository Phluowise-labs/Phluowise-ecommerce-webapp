// Auth Functions with Mobile UI Feedback

async function signUp(fullName, email, phone, password, userType) {
    feedback.showLoading('Creating your account...');
    feedback.clearFieldErrors();
    
    try {
        // Validation
        if (!fullName || !email || !phone || !password) {
            throw new Error('All fields are required');
        }
        
        if (password.length < 8) {
            feedback.showFieldError('password', 'Password must be at least 8 characters long');
            throw new Error('Password must be at least 8 characters long');
        }
        
        if (!userType) {
            userType = 'individual'; // Default to individual if not specified
        }

        // Normalize email to lowercase for consistency
        const normalizedEmail = email.toLowerCase();

        // 0. Check if email already exists in customer_tb first
        let existingCustomer = { documents: [] };
        try {
            existingCustomer = await databases.listDocuments(
                appwriteConfig.DATABASE_ID,
                appwriteConfig.CUSTOMER_TABLE,
                [Query.equal('email', normalizedEmail)]
            );
        } catch (dbError) {
            // If we can't query the database, continue with sign-up
            // This might happen if user isn't fully authenticated yet
            console.log('Database query skipped during sign-up:', dbError.message);
        }
        
        if (existingCustomer.documents.length > 0) {
            feedback.showFieldError('email', 'Email already registered in our system');
            throw new Error('An account with this email already exists in our customer database. Please sign in instead.');
        }

        // Clean up any existing sessions first
        try {
            const sessions = await account.listSessions();
            for (const session of sessions.sessions) {
                await account.deleteSession(session.$id);
            }
        } catch (e) {
            // No sessions or error deleting sessions - continue
        }

        const uniqueId = ID.unique();

        try {
            // 1. Create Account in Appwrite
            await account.create(uniqueId, email, password, fullName);

            // 2. Create Session
            await account.createEmailPasswordSession(email, password);

            // 3. Create Database Entry in customer_tb
            await databases.createDocument(
                appwriteConfig.DATABASE_ID,
                appwriteConfig.CUSTOMER_TABLE,
                ID.unique(),
                {
                    full_name: fullName,
                    email: normalizedEmail, // Store email in lowercase for consistency
                    phone_number: phone,
                    user_type: userType,
                    uid: uniqueId
                }
            );

            feedback.hideLoading();
            feedback.success('Customer account created successfully!');
            
            // Delay redirect to show success message
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);

        } catch (appwriteError) {
            // Handle Appwrite-specific errors
            if (appwriteError.code === 409) {
                // Email exists in Appwrite but not in our customer_tb
                // This means they have an Appwrite account but no customer record
                feedback.showFieldError('email', 'Email already registered. Please sign in instead.');
                throw new Error('This email is already registered in our system. Please sign in to continue.');
            } else if (appwriteError.message && appwriteError.message.includes('session is active')) {
                // Session already exists, try to get current user and create customer record
                try {
                    const user = await account.get();
                    
                    // Cache user data for offline use
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    
                    const customerData = await databases.listDocuments(
                        appwriteConfig.DATABASE_ID,
                        appwriteConfig.CUSTOMER_TABLE,
                        [Query.equal('uid', user.$id)]
                    );

                    if (customerData.documents.length === 0) {
                        // Create customer record for existing Appwrite user
                        await databases.createDocument(
                            appwriteConfig.DATABASE_ID,
                            appwriteConfig.CUSTOMER_TABLE,
                            ID.unique(),
                            {
                                full_name: user.name,
                                email: normalizedEmail,
                                phone_number: phone,
                                user_type: userType,
                                uid: user.$id
                            }
                        );
                    }

                    feedback.hideLoading();
                    feedback.success('Account setup completed!');
                    
                    setTimeout(() => {
                        window.location.href = 'home.html';
                    }, 1500);
                    return; // Exit early, success
                } catch (sessionError) {
                    throw new Error('Account setup failed. Please try signing in instead.');
                }
            } else {
                throw appwriteError; // Re-throw other Appwrite errors
            }
        }

    } catch (error) {
        feedback.hideLoading();
        console.error("Customer Sign Up Error:", error);
        
        // Enhanced error messages for customers
        let errorMessage = '';
        if (error.message && error.message.includes('customer database')) {
            // This is our custom error from customer_tb check
            errorMessage = error.message;
        } else if (error.message && error.message.includes('already registered in our system')) {
            // This is our custom error from Appwrite check
            errorMessage = error.message;
        } else if (error.message && error.message.includes('Account setup failed')) {
            errorMessage = error.message;
        } else if (error.code === 409) {
            errorMessage = 'An account with this email already exists in Appwrite. Please sign in instead.';
            feedback.showFieldError('email', 'Email already registered');
        } else if (error.code === 400) {
            errorMessage = 'Invalid email format or password too weak.';
            if (email && !email.includes('@')) {
                feedback.showFieldError('email', 'Invalid email format');
            }
            if (password && password.length < 8) {
                feedback.showFieldError('password', 'Password too weak');
            }
        } else if (error.code === 429) {
            errorMessage = 'Too many requests. Please try again later.';
        } else {
            errorMessage = error.message;
        }
        
        feedback.error(errorMessage);
        
        // Shake the form for visual feedback
        const form = document.querySelector('form') || document.querySelector('.flex-1');
        if (form) feedback.shake(form);
    }
}

async function signIn(email, password) {
    feedback.showLoading('Signing you in...');
    feedback.clearFieldErrors();
    
    try {
        // Validation
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        // Normalize email to lowercase
        const normalizedEmail = email.toLowerCase();

        // Clean up any existing sessions first
        try {
            const sessions = await account.listSessions();
            for (const session of sessions.sessions) {
                await account.deleteSession(session.$id);
            }
        } catch (e) {
            // No sessions or error deleting sessions - continue
        }

        // Create new session
        await account.createEmailPasswordSession(email, password);

        // Get user info from Appwrite
        const user = await account.get();
        
        // Cache user data for offline use
        localStorage.setItem('currentUser', JSON.stringify(user));
        console.log('✅ User data cached');
        
        // Check if customer exists in our database
        const customerData = await databases.listDocuments(
            appwriteConfig.DATABASE_ID,
            appwriteConfig.CUSTOMER_TABLE,
            [Query.equal('uid', user.$id)]
        );

        if (customerData.documents.length === 0) {
            // Customer record not found, create one
            await databases.createDocument(
                appwriteConfig.DATABASE_ID,
                appwriteConfig.CUSTOMER_TABLE,
                ID.unique(),
                {
                    full_name: user.name,
                    email: normalizedEmail, // Store email in lowercase
                    phone_number: '',
                    user_type: 'individual',
                    uid: user.$id
                }
            );
            
            // Store the newly created customer data
            const newCustomerData = await databases.listDocuments(
                appwriteConfig.DATABASE_ID,
                appwriteConfig.CUSTOMER_TABLE,
                [Query.equal('uid', user.$id)]
            );
            
            // Store user session info
            localStorage.setItem('customerSession', JSON.stringify({
                userId: user.$id,
                email: normalizedEmail,
                name: user.name,
                customerId: newCustomerData.documents[0].$id
            }));
        } else {
            // Customer exists, store session info
            localStorage.setItem('customerSession', JSON.stringify({
                userId: user.$id,
                email: normalizedEmail,
                name: user.name,
                customerId: customerData.documents[0].$id
            }));
        }

        feedback.hideLoading();
        feedback.success('Welcome back!');
        
        // Delay redirect to show success message
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 1000);

    } catch (error) {
        feedback.hideLoading();
        console.error("Customer Sign In Error:", error);
        
        // Enhanced error messages for customers
        let errorMessage = '';
        if (error.code === 401) {
            errorMessage = 'Invalid email or password. Please check your credentials.';
            feedback.showFieldError('password', 'Invalid credentials');
        } else if (error.code === 404) {
            errorMessage = 'Account not found. Please sign up first.';
            feedback.showFieldError('email', 'Account not found');
        } else if (error.code === 429) {
            errorMessage = 'Too many failed attempts. Please try again later.';
        } else {
            errorMessage = error.message;
        }
        
        feedback.error(errorMessage);
        
        // Shake the form for visual feedback
        const form = document.querySelector('form') || document.querySelector('.flex-1');
        if (form) feedback.shake(form);
    }
}

async function signOut() {
    // Check if feedback is available, otherwise use fallback
    const hasFeedback = typeof feedback !== 'undefined';
    
    if (hasFeedback) {
        feedback.showLoading('Signing out...');
    }
    
    try {
        // Clear Appwrite session
        await account.deleteSession('current');
        
        // Clear local storage
        localStorage.removeItem('customerSession');
        
        if (hasFeedback) {
            feedback.hideLoading();
            feedback.info('You have been signed out');
        }
        
        // Redirect to signin
        setTimeout(() => {
            window.location.href = 'signin.html';
        }, hasFeedback ? 1000 : 0);
        
    } catch (error) {
        console.error("Customer Sign Out Error:", error);
        // Even if there's an error, clear local storage and redirect
        localStorage.removeItem('customerSession');
        
        if (hasFeedback) {
            feedback.hideLoading();
            feedback.info('You have been signed out');
            setTimeout(() => {
                window.location.href = 'signin.html';
            }, 1000);
        } else {
            // Immediate redirect if no feedback available
            window.location.href = 'signin.html';
        }
    }
}

async function checkSession() {
    try {
        const user = await account.get();
        
        // Cache user data for offline use
        localStorage.setItem('currentUser', JSON.stringify(user));
        console.log('✅ User data cached in checkSession');
        
        // Verify customer record exists
        const customerData = await databases.listDocuments(
            appwriteConfig.DATABASE_ID,
            appwriteConfig.CUSTOMER_TABLE,
            [Query.equal('uid', user.$id)]
        );
        
        if (customerData.documents.length === 0) {
            // Customer record missing, create one
            await databases.createDocument(
                appwriteConfig.DATABASE_ID,
                appwriteConfig.CUSTOMER_TABLE,
                ID.unique(),
                {
                    full_name: user.name,
                    email: user.email,
                    phone_number: '',
                    user_type: 'individual',
                    uid: user.$id
                }
            );
        }
        
        return user;
    } catch (error) {
        console.error("Check Customer Session Error:", error);
        return null;
    }
}

async function forgotPassword(email) {
    feedback.showLoading('Sending password reset...');
    feedback.clearFieldErrors();
    
    try {
        // Validation
        if (!email) {
            throw new Error('Email address is required');
        }
        
        // Check if customer exists in customer_tb first
        const customerData = await databases.listDocuments(
            appwriteConfig.DATABASE_ID,
            appwriteConfig.CUSTOMER_TABLE,
            [Query.equal('email', email.toLowerCase())]
        );
        
        if (customerData.documents.length === 0) {
            throw new Error('No customer account found with this email address in our system');
        }

        await account.createRecovery(
            email,
            'https://phluowise-website.pages.dev/reset-password'
        );
        
        feedback.hideLoading();
        feedback.success('Password reset email sent! Please check your inbox and spam folder.');
        
    } catch (error) {
        feedback.hideLoading();
        console.error("Customer Forgot Password Error:", error);
        
        let errorMessage = '';
        if (error.code === 404) {
            errorMessage = 'No customer account found with this email address in Appwrite.';
            feedback.showFieldError('email', 'Email not found');
        } else if (error.message && error.message.includes('customer system')) {
            // This is our custom error from the customer_tb check
            errorMessage = error.message;
            feedback.showFieldError('email', 'Email not found in our system');
        } else if (error.code === 429) {
            errorMessage = 'Too many requests. Please wait before trying again.';
        } else {
            errorMessage = error.message;
        }
        
        feedback.error(errorMessage);
        
        // Shake the form for visual feedback
        const form = document.querySelector('form') || document.querySelector('.flex-1');
        if (form) feedback.shake(form);
    }
}

async function resetPassword(userId, secret, password, confirmPassword) {
    feedback.showLoading('Resetting your password...');
    feedback.clearFieldErrors();
    
    try {
        // Validation
        if (!password || !confirmPassword) {
            throw new Error('Both password fields are required');
        }
        
        if (password.length < 8) {
            feedback.showFieldError('newPassword', 'Password must be at least 8 characters long');
            throw new Error('Password must be at least 8 characters long');
        }
        
        if (password !== confirmPassword) {
            feedback.showFieldError('confirmPassword', 'Passwords do not match');
            throw new Error('Passwords do not match');
        }

        await account.updateRecovery(userId, secret, password, password);
        
        feedback.hideLoading();
        feedback.success('Password reset successfully! You can now sign in with your new password.');
        
        // Delay redirect to show success message
        setTimeout(() => {
            window.location.href = 'signin.html';
        }, 2000);
        
    } catch (error) {
        feedback.hideLoading();
        console.error("Customer Reset Password Error:", error);
        
        let errorMessage = '';
        if (error.code === 401) {
            errorMessage = 'Invalid or expired reset link. Please request a new password reset.';
        } else if (error.code === 400) {
            errorMessage = 'Password is too weak or invalid format.';
        } else {
            errorMessage = error.message;
        }
        
        feedback.error(errorMessage);
        
        // Shake the form for visual feedback
        const form = document.querySelector('form') || document.querySelector('.flex-1');
        if (form) feedback.shake(form);
    }
}

// Helper function to validate customer session
async function validateCustomerSession() {
    try {
        const user = await account.get();
        
        // Cache user data for offline use
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        const customerData = await databases.listDocuments(
            appwriteConfig.DATABASE_ID,
            appwriteConfig.CUSTOMER_TABLE,
            [Query.equal('uid', user.$id)]
        );
        
        return customerData.documents.length > 0 ? customerData.documents[0] : null;
    } catch (error) {
        return null;
    }
}

// Helper function to get current customer info
function getCurrentCustomer() {
    try {
        const sessionData = localStorage.getItem('customerSession');
        return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
        return null;
    }
}

async function getUserProfile() {
    try {
        const user = await account.get();
        
        // Cache user data for offline use
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Get customer data from customer_tb
        const customerData = await databases.listDocuments(
            appwriteConfig.DATABASE_ID,
            appwriteConfig.CUSTOMER_TABLE,
            [Query.equal('uid', user.$id)]
        );

        if (customerData.documents.length > 0) {
            return {
                auth: user,
                profile: customerData.documents[0]
            };
        }
        
        // If no customer record exists, create one
        const newCustomer = await databases.createDocument(
            appwriteConfig.DATABASE_ID,
            appwriteConfig.CUSTOMER_TABLE,
            ID.unique(),
            {
                full_name: user.name,
                email: user.email,
                phone_number: '',
                user_type: 'individual',
                uid: user.$id
            }
        );
        
        return { auth: user, profile: newCustomer };
    } catch (error) {
        console.error("Get Customer Profile Error:", error);
        
        if (error.code === 401) {
            // Session expired, redirect to signin
            window.location.href = 'signin.html';
        }
        
        return null;
    }
}

async function updateProfile(profileData) {
    feedback.showLoading('Updating your profile...');
    feedback.clearFieldErrors();
    
    try {
        const user = await account.get();
        
        // Cache user data for offline use
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Validation
        if (!profileData.full_name) {
            feedback.showFieldError('fullName', 'Full name is required');
            throw new Error('Full name is required');
        }
        
        // Create clean data object with only allowed fields
        const cleanData = {
            full_name: profileData.full_name,
            email: profileData.email,
            phone_number: profileData.phone_number || '',
            user_type: profileData.user_type || 'individual',
            uid: user.$id
        };
        
        // Find existing customer record
        const existingCustomer = await databases.listDocuments(
            appwriteConfig.DATABASE_ID,
            appwriteConfig.CUSTOMER_TABLE,
            [Query.equal('uid', user.$id)]
        );

        if (existingCustomer.documents.length > 0) {
            // Update existing customer record
            await databases.updateDocument(
                appwriteConfig.DATABASE_ID,
                appwriteConfig.CUSTOMER_TABLE,
                existingCustomer.documents[0].$id,
                cleanData
            );
        } else {
            // Create new customer record if doesn't exist
            await databases.createDocument(
                appwriteConfig.DATABASE_ID,
                appwriteConfig.CUSTOMER_TABLE,
                ID.unique(),
                cleanData
            );
        }

        // Update local storage
        const sessionData = JSON.parse(localStorage.getItem('customerSession') || '{}');
        sessionData.name = profileData.full_name;
        localStorage.setItem('customerSession', JSON.stringify(sessionData));

        feedback.hideLoading();
        feedback.success('Customer profile updated successfully!');
        return true;
    } catch (error) {
        feedback.hideLoading();
        console.error("Update Customer Profile Error:", error);
        
        let errorMessage = '';
        if (error.code === 401) {
            errorMessage = 'Session expired. Please sign in again.';
            setTimeout(() => {
                window.location.href = 'signin.html';
            }, 2000);
        } else if (error.message && error.message.includes('Full name is required')) {
            errorMessage = error.message;
        } else {
            errorMessage = 'Failed to update profile. Please try again.';
        }
        
        feedback.error(errorMessage);
        
        // Shake the form for visual feedback
        const form = document.querySelector('form') || document.querySelector('.flex-1');
        if (form) feedback.shake(form);
        
        return false;
    }
}

// ... (rest of the code remains the same)
