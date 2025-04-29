const VoiceroActionHandler = {
    config: {
        apiBase: '/api',
        endpoints: {
            login: '/auth/login',
            logout: '/auth/logout',
            subscription: '/subscriptions',
            trackOrder: '/orders/track',
            processReturn: '/orders/return',
            newsletter: '/newsletter/subscribe',
            accountReset: '/account/reset',
            scheduler: '/scheduler'
        },
        defaultHeaders: {
            'Content-Type': 'application/json'
        },
        userCredentials: null
    },

    init: function (userConfig = {}) {
        this.config = {
            ...this.config,
            ...userConfig,
            endpoints: {
                ...this.config.endpoints,
                ...(userConfig.endpoints || {})
            },
            defaultHeaders: {
                ...this.config.defaultHeaders,
                ...(userConfig.defaultHeaders || {})
            }
        };

        this.loadCredentials();
        return this;
    },

    saveCredentials: function (credentials) {
        try {
            this.config.userCredentials = credentials;
            localStorage.setItem('voiceroUserCredentials', JSON.stringify(credentials));
        } catch (e) {
            console.warn("Could not save credentials to localStorage:", e);
        }
    },

    loadCredentials: function () {
        try {
            const saved = localStorage.getItem('voiceroUserCredentials');
            if (saved) {
                this.config.userCredentials = JSON.parse(saved);
            }
        } catch (e) {
            console.warn("Could not load credentials from localStorage:", e);
        }
    },

    clearCredentials: function () {
        try {
            localStorage.removeItem('voiceroUserCredentials');
            this.config.userCredentials = null;
        } catch (e) {
            console.warn("Could not clear credentials:", e);
        }
    },

    handle: function (response) {
        if (!response || typeof response !== 'object') {
            console.warn('Invalid response object');
            return;
        }

        const { answer, action, action_context } = response;
        console.log("==>response", response)
        if (answer) {
            console.debug("AI Response:", { answer, action, action_context });
        }

        if (!action) {
            console.warn("No action specified");
            return;
        }

        let targets = [];
        if (Array.isArray(action_context)) {
            targets = action_context;
        } else if (action_context && typeof action_context === 'object') {
            targets = [action_context];
        }

        try {
            const handlerName = `handle${this.capitalizeFirstLetter(action)}`;
            if (typeof this[handlerName] !== 'function') {
                console.warn(`No handler for action: ${action}`);
                return;
            }

            if (targets.length > 0) {
                // If we have targets, call handler for each one
                targets.forEach(target => {
                    if (target && typeof target === 'object') {
                        console.log("==>target", target);
                        this[handlerName](target);
                    }
                });
            } else {
                // If no targets, just call the handler with no arguments
                console.log(`Calling ${handlerName} with no context`);
                this[handlerName]();
            }
        } catch (error) {
            console.error(`Error handling action ${action}:`, error);
        }
    },


    capitalizeFirstLetter: function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    escapeRegExp: function (string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    getApiUrl: function (endpointKey) {
        if (!this.config.endpoints[endpointKey]) {
            console.warn(`No endpoint configured for ${endpointKey}`);
            return null;
        }
        return `${this.config.apiBase}${this.config.endpoints[endpointKey]}`;
    },

    findElement: function ({ selector, exact_text, button_text, role, tagName, placeholder }) {
        if (selector) {
            const element = document.querySelector(selector);
            if (element) return element;
        }

        if (button_text) {
            const interactiveElements = document.querySelectorAll('button, a, input, [role="button"]');

            for (let el of interactiveElements) {
                if (el.textContent.trim().toLowerCase() === button_text.toLowerCase()) return el;
                if (el.tagName === 'INPUT' && el.value.trim().toLowerCase() === button_text.toLowerCase()) return el;
                if (el.getAttribute('aria-label')?.toLowerCase() === button_text.toLowerCase()) return el;
            }
        }

        if (placeholder) {
            const inputs = document.querySelectorAll('input, textarea');
            for (let el of inputs) {
                if (el.placeholder?.toLowerCase().includes(placeholder.toLowerCase())) return el;
            }
        }

        if (exact_text) {
            const elements = document.querySelectorAll(tagName || '*');
            for (let el of elements) {
                if (el.textContent.trim() === exact_text) return el;
            }
        }

        if (role) {
            const elements = document.querySelectorAll(`[role="${role}"]`);
            for (let el of elements) {
                if (!exact_text || el.textContent.trim() === exact_text) return el;
            }
        }

        return null;
    },

    findForm: function (formType) {
        const formSelectors = {
            login: 'form#loginform, form.login-form, form[action*="login"], form[action*="wp-login"]',
            tracking: 'form.track-order, form#track-order, form[action*="track"]',
            return: 'form.return-form, form#return-form, form[action*="return"]',
            newsletter: 'form.newsletter-form, form#newsletter, form[action*="subscribe"], form[action*="newsletter"]',
            checkout: 'form#checkout, form.woocommerce-checkout, form[action*="checkout"]',
            account: 'form#account-form, form.customer-form, form[action*="account"]',
            default: 'form'
        };

        return document.querySelector(formSelectors[formType] || formSelectors.default);
    },

    handleScroll: function (target) {
        const { exact_text, css_selector, offset = 0 } = target || {};

        if (exact_text) {
            const element = this.findElement({ exact_text });
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            console.warn(`Text not found: "${exact_text}"`, element);
            return;
        }

        if (css_selector) {
            const element = document.querySelector(css_selector);
            if (element) {
                const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({
                    top: elementPosition - offset,
                    behavior: 'smooth'
                });
                return;
            }
            console.warn(`Element not found with selector: ${css_selector}`);
            return;
        }

        console.warn("No selector or text provided for scroll", target);
    },

    handleClick: function (target) {
        const element = this.findElement({
            ...target,
            button_text: target.button_text || target.exact_text,
            tagName: 'button, a, input, [role="button"]'
        });

        if (element) {
            try {
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(clickEvent);
                return true;
            } catch (error) {
                console.error("Error clicking element:", error);
            }
        }

        console.warn("Click target not found:", target);
        return false;
    },

    handleFill_form: function (target) {
        const { form_id, form_type, input_fields } = target || {};

        if (!input_fields || !Array.isArray(input_fields)) {
            console.warn("No form fields provided");
            return;
        }

        let form = form_id ? document.getElementById(form_id) :
            form_type ? this.findForm(form_type) : null;

        if (!form && input_fields.length > 0) {
            const firstField = input_fields[0];
            const potentialInput = document.querySelector(
                `[name="${firstField.name}"], [placeholder*="${firstField.placeholder}"], [id="${firstField.id}"]`
            );
            if (potentialInput) form = potentialInput.closest('form');
        }

        input_fields.forEach(field => {
            const { name, value, placeholder, id } = field;
            if (!name && !placeholder && !id) {
                console.warn("Invalid field configuration - no identifier:", field);
                return;
            }

            const selector = [
                name && `[name="${name}"]`,
                placeholder && `[placeholder*="${placeholder}"]`,
                id && `#${id}`
            ].filter(Boolean).join(', ');

            const element = form
                ? form.querySelector(selector)
                : document.querySelector(selector);

            if (!element) {
                console.warn(`Form element not found:`, field);
                return;
            }

            if (element.tagName === 'SELECT') {
                element.value = value;
                element.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    element.checked = Boolean(value);
                } else {
                    element.value = value;
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        if (form && target.auto_submit !== false) {
            setTimeout(() => {
                form.dispatchEvent(new Event('submit', { bubbles: true }));
            }, 100);
        }
    },

    handleHighlight_text: function (target) {
        const { selector, exact_text, color = '#f9f900' } = target || {};

        if (selector) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.backgroundColor = color;
            });
            return;
        }

        if (exact_text) {
            const elements = document.querySelectorAll('p, span, div, li, td, h1, h2, h3, h4, h5, h6');
            elements.forEach(el => {
                if (el.textContent.includes(exact_text)) {
                    const html = el.innerHTML.replace(
                        new RegExp(this.escapeRegExp(exact_text), 'gi'),
                        match => `<span style="background-color: ${color}">${match}</span>`
                    );
                    el.innerHTML = html;
                }
            });
            return;
        }

        console.warn("No selector or text provided for highlight");
    },

    handleLogin: async function (target) {
        const { username, password, remember = true } = target || {};
        if (!username || !password) {
            // Try to use saved credentials if available
            if (this.config.userCredentials) {
                target = { ...this.config.userCredentials, remember };
            } else {
                console.warn("Username and password required for login");
                return;
            }
        } else {
            this.saveCredentials({ username, password });
        }

        const loginForm = this.findForm('login');
        if (loginForm) {
            const usernameField = loginForm.querySelector(
                'input[name="log"], input[name="username"], input[type="email"], input[placeholder*="email"], input[placeholder*="username"]'
            );
            const passwordField = loginForm.querySelector(
                'input[name="pwd"], input[name="password"], input[type="password"]'
            );
            const rememberField = loginForm.querySelector('input[name="rememberme"]');

            if (usernameField && passwordField) {
                usernameField.value = username;
                passwordField.value = password;
                if (rememberField) rememberField.checked = remember;

                usernameField.dispatchEvent(new Event('change', { bubbles: true }));
                passwordField.dispatchEvent(new Event('change', { bubbles: true }));

                loginForm.dispatchEvent(new Event('submit', { bubbles: true }));
                return;
            }
        }

        const loginUrl = this.getApiUrl('login');
        if (!loginUrl) return;

        try {
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders,
                body: JSON.stringify({ username, password, remember })
            });

            const data = await response.json();
            if (data.success) {
                console.log("Login successful");
                window.location.reload();
            } else {
                console.warn("Login failed:", data.message);
            }
        } catch (error) {
            console.error("Login error:", error);
        }
    },

    handleLogout: async function () {
        this.clearCredentials();

        const logoutLink = document.querySelector('a[href*="logout"], a[href*="wp-logout"]');
        if (logoutLink) {
            logoutLink.click();
            return;
        }

        const logoutUrl = this.getApiUrl('logout');
        if (!logoutUrl) return;

        try {
            const response = await fetch(logoutUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders
            });

            const data = await response.json();
            if (data.success) {
                console.log("Logout successful");
                window.location.reload();
            } else {
                console.warn("Logout failed:", data.message);
            }
        } catch (error) {
            console.error("Logout error:", error);
        }
    },


    handleNewsletter_signup: async function (target) {
        const { email, firstname, lastname, phone } = target || {};
        if (!email) {
            console.warn("Email required for newsletter signup");
            return;
        }

        const newsletterForm = this.findForm('newsletter');
        if (newsletterForm) {
            const emailField = newsletterForm.querySelector('input[type="email"], input[name="email"]');
            const firstNameField = newsletterForm.querySelector('input[name="firstname"], input[name="fname"]');
            const lastNameField = newsletterForm.querySelector('input[name="lastname"], input[name="lname"]');
            const phoneField = newsletterForm.querySelector('input[type="tel"], input[name="phone"]');

            if (emailField) emailField.value = email;
            if (firstNameField && firstname) firstNameField.value = firstname;
            if (lastNameField && lastname) lastNameField.value = lastname;
            if (phoneField && phone) phoneField.value = phone;

            newsletterForm.dispatchEvent(new Event('submit', { bubbles: true }));
            return;
        }

        const newsletterUrl = this.getApiUrl('newsletter');
        if (!newsletterUrl) return;

        try {
            const response = await fetch(newsletterUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders,
                body: JSON.stringify({ email, firstname, lastname, phone })
            });

            const data = await response.json();
            if (data.success && window.VoiceroText?.addMessage) {
                window.VoiceroText.addMessage('bot', "Thank you for subscribing to our newsletter!");
            } else if (!data.success) {
                console.warn("Newsletter signup failed:", data.message);
            }
        } catch (error) {
            console.error("Newsletter signup error:", error);
        }
    },

    handleAccount_reset: async function (target) {
        const { email } = target || {};
        if (!email) {
            console.warn("Email required for account reset");
            return;
        }

        const accountForm = this.findForm('account');
        if (accountForm) {
            const emailField = accountForm.querySelector('input[type="email"], input[name="email"]');
            if (emailField) {
                emailField.value = email;
                accountForm.dispatchEvent(new Event('submit', { bubbles: true }));
                return;
            }
        }

        const accountResetUrl = this.getApiUrl('accountReset');
        if (!accountResetUrl) return;

        try {
            const response = await fetch(accountResetUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders,
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (data.success && window.VoiceroText?.addMessage) {
                window.VoiceroText.addMessage('bot', "Password reset instructions have been sent to your email.");
            } else if (!data.success) {
                console.warn("Account reset failed:", data.message);
            }
        } catch (error) {
            console.error("Account reset error:", error);
        }
    },

    handleStart_subscription: function (target) {
        this.handleSubscriptionAction(target, 'start');
    },

    handleStop_subscription: function (target) {
        this.handleSubscriptionAction(target, 'stop');
    },

    handleSubscriptionAction: async function (target, action) {
        const { subscription_id, product_id, plan_id } = target || {};

        if (!subscription_id && !product_id && !plan_id) {
            console.warn("No subscription, product or plan ID provided");
            return;
        }

        const buttonSelector = action === 'start'
            ? `button[data-product-id="${product_id}"], button.subscribe-button`
            : `button[data-subscription-id="${subscription_id}"], button.cancel-subscription`;

        const button = document.querySelector(buttonSelector);
        if (button) {
            button.click();
            return;
        }

        const subscriptionUrl = this.getApiUrl('subscription');
        if (!subscriptionUrl) return;

        try {
            const response = await fetch(subscriptionUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders,
                body: JSON.stringify({ action, subscription_id, product_id, plan_id })
            });

            const data = await response.json();
            if (data.success) {
                console.log(`Subscription ${action} successful`);
                window.location.reload();
            } else {
                console.warn(`Subscription ${action} failed:`, data.message);
            }
        } catch (error) {
            console.error(`Subscription ${action} error:`, error);
        }
    },

    handlePurchase: async function (target) {
        // Enhanced purchase with better WooCommerce support
        const { product_id, quantity = 1, coupon } = target || {};
        if (!product_id) {
            console.warn("No product ID provided for purchase");
            return;
        }

        const addToCartButton = document.querySelector('button.single_add_to_cart_button, button.add_to_cart_button');
        if (addToCartButton) {
            const quantityInput = document.querySelector('input.qty, input[name="quantity"]');
            if (quantityInput) {
                quantityInput.value = quantity;
                quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            if (coupon) {
                const couponField = document.querySelector('input[name="coupon_code"]');
                if (couponField) {
                    couponField.value = coupon;
                    couponField.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            addToCartButton.click();

            // If this is a direct checkout button, we're done
            if (addToCartButton.classList.contains('checkout')) return;

            // Otherwise proceed to checkout
            setTimeout(() => {
                const checkoutButton = document.querySelector('a.checkout-button, button.checkout');
                if (checkoutButton) checkoutButton.click();
            }, 1000);
            return;
        }

        // Fallback to direct API approach
        try {
            await fetch(`/?add-to-cart=${product_id}&quantity=${quantity}`, { method: 'GET' });
            window.location.href = '/checkout';
        } catch (error) {
            console.error("Purchase error:", error);
        }
    },

    handleTrack_order: async function (target) {
        const { order_id, email } = target || {};
        if (!order_id || !email) {
            console.warn("Order ID and email required for tracking");
            return;
        }

        const trackingForm = this.findForm('tracking');
        if (trackingForm) {
            const orderIdField = trackingForm.querySelector('input[name="orderid"], input[name="order_id"]');
            const emailField = trackingForm.querySelector('input[name="email"]');

            if (orderIdField && emailField) {
                orderIdField.value = order_id;
                emailField.value = email;
                trackingForm.dispatchEvent(new Event('submit', { bubbles: true }));
                return;
            }
        }

        const trackOrderUrl = this.getApiUrl('trackOrder');
        if (!trackOrderUrl) return;

        try {
            const response = await fetch(trackOrderUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders,
                body: JSON.stringify({ order_id, email })
            });

            const data = await response.json();
            if (data.success && window.VoiceroText?.addMessage) {
                window.VoiceroText.addMessage('bot', `Your order #${order_id} is currently ${data.status}.`);
            } else if (!data.success) {
                console.warn("Order tracking failed:", data.message);
            }
        } catch (error) {
            console.error("Order tracking error:", error);
        }
    },

    handleProcess_return: async function (target) {
        // Enhanced return processing with better field detection
        const { order_id, email, reason, items = [] } = target || {};
        if (!order_id || !email) {
            // Try to use saved order info if available
            if (this.config.userCredentials?.lastOrder) {
                target = { ...this.config.userCredentials.lastOrder, ...target };
            } else {
                console.warn("Order ID and email required for return");
                return;
            }
        }

        const returnForm = this.findForm('return');
        if (returnForm) {
            const orderIdField = returnForm.querySelector('input[name="orderid"], input[name="order_id"]');
            const emailField = returnForm.querySelector('input[type="email"], input[name="email"]');
            const reasonField = returnForm.querySelector('select[name="reason"], textarea[name="reason"]');

            if (orderIdField && emailField) {
                orderIdField.value = order_id;
                emailField.value = email;
                if (reasonField) reasonField.value = reason;

                items.forEach(item => {
                    const itemCheckbox = returnForm.querySelector(
                        `input[name="return_items[]"][value="${item.id}"], 
                         input[name="return_items"][value="${item.id}"]`
                    );
                    if (itemCheckbox) itemCheckbox.checked = true;
                });

                returnForm.dispatchEvent(new Event('submit', { bubbles: true }));
                return;
            }
        }

        const processReturnUrl = this.getApiUrl('processReturn');
        if (!processReturnUrl) return;

        try {
            const response = await fetch(processReturnUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders,
                body: JSON.stringify({ order_id, email, reason, items })
            });

            const data = await response.json();
            if (data.success && window.VoiceroText?.addMessage) {
                window.VoiceroText.addMessage('bot', `Your return for order #${order_id} has been processed.`);
            } else if (!data.success) {
                console.warn("Return processing failed:", data.message);
            }
        } catch (error) {
            console.error("Return processing error:", error);
        }
    },

    handleScheduler: async function (target) {
        const { action, date, time, event } = target || {};
        if (!action) {
            console.warn("No action specified for scheduler");
            return;
        }

        const schedulerUrl = this.getApiUrl('scheduler');
        if (!schedulerUrl) return;

        try {
            const response = await fetch(schedulerUrl, {
                method: 'POST',
                headers: this.config.defaultHeaders,
                body: JSON.stringify({ action, date, time, event })
            });

            const data = await response.json();
            if (data.success && window.VoiceroText?.addMessage) {
                window.VoiceroText.addMessage('bot', `Scheduler: ${data.message}`);
            } else if (!data.success) {
                console.warn("Scheduler action failed:", data.message);
            }
        } catch (error) {
            console.error("Scheduler error:", error);
        }
    },

    handleRedirect: function(target) {
        let url;
        if (typeof target === 'string') {
            url = target;
        } else if (target && typeof target === 'object') {
            url = target.url;
        }
    
        if (!url) {
            console.warn("No URL provided for redirect");
            return;
        }
    
        try {
            let finalUrl = url;
            
            if (url.startsWith('/') && !url.startsWith('//')) {
                finalUrl = window.location.origin + url;
            }
            
            const urlObj = new URL(finalUrl);
            
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                console.warn("Unsupported URL protocol:", urlObj.protocol);
                return;
            }
            
            window.location.href = finalUrl;
        } catch (e) {
            console.warn("Invalid URL:", url, e);
            
            if (url.startsWith('/') && !url.startsWith('//')) {
                try {
                    const fallbackUrl = window.location.origin + url;
                    new URL(fallbackUrl); // Validate again
                    window.location.href = fallbackUrl;
                    return;
                } catch (fallbackError) {
                    console.warn("Fallback URL attempt failed:", fallbackUrl, fallbackError);
                }
            }
        }
    }
};

window.VoiceroActionHandler = window.VoiceroActionHandler || VoiceroActionHandler;