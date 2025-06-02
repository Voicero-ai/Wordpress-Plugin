/**
 * VoiceroAI User Data Module
 * Loads early to fetch Shopify customer data before other scripts run
 * Stores user data in global variables for later use by other modules
 *
 * Functionality summary:
 * - Collects detailed customer information from Shopify
 * - Formats and sends this data to the external VoiceroAI API
 * - Stores and manages welcome back messages returned from the API
 * - Provides methods to retrieve and clear welcome back messages
 */

(function () {
  // Create global namespace for user data
  window.VoiceroUserData = {
    initialized: false,
    isLoading: true,
    isLoggedIn: false,
    customer: null,
    cart: null,
    errors: [],
    dataSent: false, // Flag to track if data has been sent

    /**
     * Initialize and fetch user data
     */
    init: function () {
      console.log("VoiceroUserData: Initializing user data collection");

      // Start loading data
      this.isLoading = true;

      // Initialize global flag to track if welcome back message has been displayed
      window.voiceroWelcomeBackDisplayed = false;

      // NEW: Check the direct customer status check performed in the Liquid template
      if (
        window.shopifyCustomerStatus &&
        window.shopifyCustomerStatus.isLoggedIn
      ) {
        console.log(
          "VoiceroUserData: Found direct customer status check with logged in status:",
          window.shopifyCustomerStatus.isLoggedIn
        );
        this.isLoggedIn = true;
        this.customer = this.customer || {};
        this.customer.logged_in = true;
        this.customer.direct_check = true;
      }

      // Check for existing welcome back message
      try {
        const storedMessage = localStorage.getItem("voiceroWelcomeBackMessage");
        if (storedMessage) {
          console.log(
            "VoiceroUserData: Found stored welcome back message:",
            storedMessage
          );

          // Check if message is older than 1 hour - if so, remove it
          const lastMessageTime = localStorage.getItem(
            "voiceroWelcomeBackMessageTime"
          );
          if (lastMessageTime) {
            const messageAge = Date.now() - parseInt(lastMessageTime, 10);
            if (messageAge > 60 * 60 * 1000) {
              // 1 hour in milliseconds
              console.log(
                "VoiceroUserData: Welcome back message is older than 1 hour, removing it"
              );
              localStorage.removeItem("voiceroWelcomeBackMessage");
              localStorage.removeItem("voiceroWelcomeBackMessageTime");
              // Don't set the global variable since we're removing the message
              return;
            }
          }

          window.voiceroWelcomeBackMessage = storedMessage;
        }
      } catch (e) {
        console.warn(
          "VoiceroUserData: Error checking for welcome back message",
          e
        );
      }

      // Set up promise for tracking completion
      this.initPromise = new Promise((resolve) => {
        // First try to get customer data
        this.fetchCustomerData()
          .then(() => {
            // Then try to get cart data
            return this.fetchCartData();
          })
          .catch((error) => {
            console.error("VoiceroUserData: Error fetching data", error);
            this.errors.push({
              time: new Date().toISOString(),
              message: error.message || "Unknown error fetching user data",
            });
          })
          .finally(() => {
            // Mark initialization as complete
            this.isLoading = false;
            this.initialized = true;
            console.log("VoiceroUserData: Initialization complete", {
              isLoggedIn: this.isLoggedIn,
              hasCustomerData: !!this.customer,
              hasCartData: !!this.cart,
              errors: this.errors.length,
            });

            // Log full customer data object for debugging
            if (this.customer) {
              console.log("VoiceroUserData: FULL CUSTOMER DATA", this.customer);
            }

            // Store data in localStorage for debugging if needed
            try {
              localStorage.setItem(
                "voiceroUserData",
                JSON.stringify({
                  timestamp: new Date().toISOString(),
                  isLoggedIn: this.isLoggedIn,
                  customer: this.customer,
                  cart: this.cart,
                })
              );
            } catch (e) {
              console.warn(
                "VoiceroUserData: Unable to store user data in localStorage",
                e
              );
            }

            // Send complete consolidated user data to our API
            // Always send data if we've determined the user is logged in, even if customer object is minimal
            if ((this.customer || this.isLoggedIn) && !this.dataSent) {
              // Create a comprehensive data object with both customer and cart
              const userData = {
                customer: this.customer || {
                  logged_in: this.isLoggedIn,
                  minimal: true,
                },
                cart: this.cart || null,
                isLoggedIn: this.isLoggedIn,
              };

              console.log(
                "VoiceroUserData: Sending consolidated data to API from init completion"
              );

              // Send to our API
              this.sendCustomerDataToApi(userData);
            } else if (this.dataSent) {
              console.log(
                "VoiceroUserData: Data already sent, not sending again from init completion"
              );
            }

            // Resolve the promise to signal completion
            resolve();
          });
      });

      return this.initPromise;
    },

    /**
     * Get a session token via various methods
     * @returns {Promise<string|null>} Promise that resolves with the session token or null
     */
    getSessionToken: async function () {
      console.log("VoiceroUserData: Attempting to get session token");

      // 1. Try using our App Bridge implementation if it exists
      if (
        window.shopifyAppBridge &&
        typeof window.shopifyAppBridge.getSessionToken === "function"
      ) {
        try {
          console.log(
            "VoiceroUserData: Using shopifyAppBridge.getSessionToken method"
          );
          return await window.shopifyAppBridge.getSessionToken();
        } catch (e) {
          console.warn("VoiceroUserData: Error with shopifyAppBridge token", e);
        }
      }

      // 2. Check if our override method has been set (by external code)
      if (typeof this.getSessionTokenOverride === "function") {
        try {
          console.log(
            "VoiceroUserData: Using overridden getSessionToken method"
          );
          return await this.getSessionTokenOverride();
        } catch (e) {
          console.warn(
            "VoiceroUserData: Error using overridden getSessionToken",
            e
          );
        }
      }

      // 3. Try Shopify checkout token
      if (
        window.Shopify &&
        window.Shopify.checkout &&
        window.Shopify.checkout.token
      ) {
        console.log("VoiceroUserData: Using Shopify checkout token");
        return window.Shopify.checkout.token;
      }

      // 4. Try to get customer token from meta tag
      const metaCustomerToken = document.querySelector(
        'meta[name="shopify-customer-token"]'
      );
      if (metaCustomerToken && metaCustomerToken.content) {
        console.log("VoiceroUserData: Using meta customer token");
        return metaCustomerToken.content;
      }

      // 5. Try customer access token
      if (
        window.Shopify &&
        window.Shopify.customer &&
        window.Shopify.customer.access_token
      ) {
        console.log("VoiceroUserData: Using Shopify customer access token");
        return window.Shopify.customer.access_token;
      }

      // 6. Try customer session from cookie
      try {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].trim();
          if (cookie.startsWith("_shopify_customer_session=")) {
            console.log("VoiceroUserData: Using customer session cookie");
            return cookie.substring("_shopify_customer_session=".length);
          }
        }
      } catch (e) {
        console.warn("VoiceroUserData: Error checking cookies for token", e);
      }

      // 7. Fall back to standard App Bridge if available
      if (
        window.shopify &&
        window.shopify.auth &&
        window.shopify.auth.getSessionToken
      ) {
        try {
          console.log("VoiceroUserData: Using standard App Bridge token");
          return await window.shopify.auth.getSessionToken();
        } catch (e) {
          console.warn("VoiceroUserData: Unable to get session token", e);
        }
      }

      console.log("VoiceroUserData: No token method available, returning null");
      return null;
    },

    /**
     * Fetch customer data from Shopify customer object or API
     * @returns {Promise} Promise that resolves when customer data is fetched
     */
    fetchCustomerData: function () {
      return new Promise(async (resolve) => {
        // 0. First check for detailed customer data injected by Liquid (most complete)
        if (window.__VoiceroCustomerData) {
          console.log(
            "VoiceroUserData: Found DETAILED customer data from Liquid injection"
          );

          // Show basic customer profile details
          console.log("VoiceroUserData: CUSTOMER PROFILE:", {
            name:
              window.__VoiceroCustomerData.first_name +
              " " +
              window.__VoiceroCustomerData.last_name,
            email: window.__VoiceroCustomerData.email,
            orders_count: window.__VoiceroCustomerData.orders_count,
            total_spent: `$${(
              parseFloat(window.__VoiceroCustomerData.total_spent || 0) / 100
            ).toFixed(2)}`,
            created_at: window.__VoiceroCustomerData.created_at,
          });

          // Show address information if available
          if (window.__VoiceroCustomerData.default_address) {
            console.log("VoiceroUserData: MAIN ADDRESS:", {
              name:
                window.__VoiceroCustomerData.default_address.first_name +
                " " +
                window.__VoiceroCustomerData.default_address.last_name,
              address: window.__VoiceroCustomerData.default_address.address1,
              city: window.__VoiceroCustomerData.default_address.city,
              province: window.__VoiceroCustomerData.default_address.province,
              country: window.__VoiceroCustomerData.default_address.country,
              zip: window.__VoiceroCustomerData.default_address.zip,
            });
          } else {
            console.log("VoiceroUserData: No default address found");
          }

          // Show recent orders if available
          if (
            window.__VoiceroCustomerData.recent_orders &&
            window.__VoiceroCustomerData.recent_orders.length > 0
          ) {
            console.log(
              "VoiceroUserData: RECENT ORDERS:",
              window.__VoiceroCustomerData.recent_orders.map((order) => ({
                number: order.order_number,
                date: order.created_at,
                status: order.fulfillment_status,
                total: `$${(parseFloat(order.total_price || 0) / 100).toFixed(
                  2
                )}`,
                tracking: order.has_tracking
                  ? `${order.tracking_company} #${order.tracking_number}`
                  : "None",
              }))
            );
          } else {
            console.log("VoiceroUserData: No recent orders found");
          }

          this.isLoggedIn = true;
          this.customer = window.__VoiceroCustomerData;

          // Add timestamp and logged_in flag
          this.customer.logged_in = true;
          this.customer.timestamp = new Date().toISOString();

          resolve();
          return;
        } else {
          console.log(
            "VoiceroUserData: NO detailed customer data found in window.__VoiceroCustomerData"
          );
          // Log what we actually have
          console.log("VoiceroUserData: Available global vars:", {
            hasCustomerId: !!window.__VoiceroCustomerId,
            hasCustomerData: !!window.__VoiceroCustomerData,
            hasShopify: !!window.Shopify,
            hasShopifyCustomer: !!(window.Shopify && window.Shopify.customer),
          });
        }

        // NEW: Check if VoiceroAuthHelper has already done login detection
        if (window.VoiceroAuthHelper && window.VoiceroAuthHelper.isLoggedIn) {
          console.log(
            "VoiceroUserData: Using login status from VoiceroAuthHelper"
          );
          this.isLoggedIn = true;
          this.customer = this.customer || {};
          this.customer.logged_in = true;
          this.customer.timestamp = new Date().toISOString();

          // If VoiceroAuthHelper has customer data, use it
          if (window.VoiceroAuthHelper.customer) {
            this.customer = {
              ...this.customer,
              ...window.VoiceroAuthHelper.customer,
            };
          }

          resolve();
          return;
        }

        // 1. Check for customer ID injected by Liquid (most reliable method)
        const injectedId = window.__VoiceroCustomerId;
        if (injectedId) {
          console.log(
            "VoiceroUserData: Found customer ID from Liquid injection:",
            injectedId
          );
          this.isLoggedIn = true;
          this.customer = {
            id: injectedId,
            // Adding additional basic info since we know customer is logged in
            logged_in: true,
            timestamp: new Date().toISOString(),
          };

          // We can stop here, but if we want more data, we can try to fetch it via API
          try {
            const moreData = await this.fetchCustomerDetails();
            if (moreData) {
              this.customer = { ...this.customer, ...moreData };
              console.log(
                "VoiceroUserData: Enhanced customer data with API details"
              );
            }
          } catch (error) {
            console.warn(
              "VoiceroUserData: Error fetching additional customer details",
              error
            );
          }

          resolve();
          return;
        }

        // 2. Try to get customer data from the window Shopify object
        if (window.Shopify && window.Shopify.customer) {
          this.customer = window.Shopify.customer;
          this.isLoggedIn = true;
          console.log(
            "VoiceroUserData: Found customer data in Shopify object",
            this.customer
          );
          resolve();
          return;
        }

        // 3. Check cookies for customer session indicators
        const cookies = document.cookie;
        if (
          cookies.includes("_shopify_customer_") ||
          cookies.includes("_secure_session_id")
        ) {
          console.log(
            "VoiceroUserData: Found customer session cookie, user is likely logged in"
          );
          this.isLoggedIn = true;
          this.customer = {
            logged_in: true,
            timestamp: new Date().toISOString(),
          };
          resolve();
          return;
        }

        // 4. Try to use Customer Account API (requires proper session token)
        const moreData = await this.fetchCustomerDetails().catch((error) => {
          console.log(
            "VoiceroUserData: Could not fetch customer details from API",
            error
          );
          return null;
        });

        if (moreData) {
          this.customer = moreData;
          this.isLoggedIn = true;
          console.log(
            "VoiceroUserData: Successfully fetched customer data from API"
          );
          resolve();
          return;
        }

        // 5. Check for login/logout links in the DOM
        const logoutLinks = document.querySelectorAll('a[href*="/logout"]');
        if (logoutLinks.length > 0) {
          console.log(
            "VoiceroUserData: Found logout links, user is likely logged in"
          );
          this.isLoggedIn = true;
          this.customer = { logged_in: true };
          resolve();
          return;
        }

        // 6. Check for account links that don't include login/register
        const accountLinks = document.querySelectorAll('a[href*="/account"]');
        const customerAccountLink = Array.from(accountLinks).find(
          (link) =>
            !link.href.includes("login") && !link.href.includes("register")
        );

        if (customerAccountLink) {
          console.log(
            "VoiceroUserData: Found account link that suggests user is logged in"
          );
          this.isLoggedIn = true;
          this.customer = { logged_in: true };
          resolve();
          return;
        }

        // 7. Check if there are customer-specific elements on the page
        const customerGreeting = document.querySelector(
          ".customer-greeting, .customer-name, .account-name"
        );
        if (customerGreeting) {
          console.log(
            "VoiceroUserData: Found customer greeting element, user is likely logged in"
          );
          this.isLoggedIn = true;
          this.customer = { logged_in: true };
          resolve();
          return;
        }

        // No customer data found, user is not logged in
        console.log("VoiceroUserData: No indicators of logged-in state found");
        this.isLoggedIn = false;
        resolve();
      });
    },

    /**
     * Fetch detailed customer information using the Customer Account API
     * @returns {Promise<Object|null>} Promise that resolves with customer data or null
     */
    fetchCustomerDetails: async function () {
      try {
        console.log(
          "VoiceroUserData: Attempting to fetch detailed customer data from API"
        );
        const token = await this.getSessionToken();

        if (!token) {
          console.log(
            "VoiceroUserData: No session token available for Customer Account API"
          );
          return null;
        }

        const shopDomain = window.location.hostname;
        const response = await fetch(
          `https://${shopDomain}/account/api/2025-04/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              query: `
                query getMyAccount {
                  customer { 
                    id 
                    firstName 
                    lastName 
                    email 
                    phone 
                    acceptsMarketing 
                    tags
                    defaultAddress { 
                      id 
                      address1 
                      city 
                      province 
                      zip 
                      country 
                    }
                    addresses(first:10) { 
                      edges { 
                        node { 
                          id 
                          address1 
                          city 
                          province
                          zip
                          country
                        } 
                      } 
                    }
                    orders(first:10) { 
                      edges { 
                        node { 
                          id 
                          orderNumber 
                          processedAt
                          fulfillmentStatus
                          financialStatus
                          totalPriceV2 { 
                            amount 
                            currencyCode 
                          }
                          lineItems(first: 5) {
                            edges {
                              node {
                                title
                                quantity
                              }
                            }
                          }
                          fulfillments(first: 3) {
                            trackingCompany
                            trackingNumbers
                            trackingUrls
                          }
                          shippingAddress {
                            address1
                            city
                            province
                            country
                            zip
                          }
                        } 
                      } 
                    }
                  }
                }
              `,
            }),
          }
        );

        if (!response.ok) {
          console.warn(
            "VoiceroUserData: Customer Account API request failed",
            response.status
          );
          return null;
        }

        const { data } = await response.json();
        if (data && data.customer) {
          console.log(
            "VoiceroUserData: Successfully fetched detailed customer data"
          );
          return data.customer;
        }

        return null;
      } catch (error) {
        console.warn("VoiceroUserData: Error fetching customer details", error);
        return null;
      }
    },

    /**
     * Fetch cart data from Shopify cart object or API
     * @returns {Promise} Promise that resolves when cart data is fetched
     */
    fetchCartData: function () {
      return new Promise((resolve) => {
        // Try to get cart data from the window Shopify object
        if (window.Shopify && window.Shopify.cart) {
          this.cart = window.Shopify.cart;
          console.log("VoiceroUserData: Found cart data in Shopify object");
          resolve();
          return;
        }

        // If not found in window object, try to fetch from /cart endpoint
        fetch("/cart.js", {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        })
          .then((response) => {
            if (!response.ok) {
              console.warn(
                "VoiceroUserData: Error fetching cart data",
                response.status
              );
              this.errors.push({
                time: new Date().toISOString(),
                message: `HTTP error ${response.status} fetching cart data`,
              });
              resolve(); // Resolve anyway to continue initialization
              return;
            }

            return response.json();
          })
          .then((data) => {
            if (data) {
              this.cart = data;
              console.log("VoiceroUserData: Fetched cart data successfully");
            }
            resolve();
          })
          .catch((error) => {
            console.error("VoiceroUserData: Error fetching cart data", error);
            this.errors.push({
              time: new Date().toISOString(),
              message: error.message || "Unknown error fetching cart data",
            });
            resolve(); // Resolve anyway to continue initialization
          });
      });
    },

    /**
     * Get all collected user data
     * @returns {Object} All collected user data
     */
    getUserData: function () {
      return {
        isLoggedIn: this.isLoggedIn,
        customer: this.customer,
        cart: this.cart,
      };
    },

    /**
     * Check if user data collection is complete
     * @returns {Boolean} True if initialization is complete
     */
    isInitialized: function () {
      return this.initialized;
    },

    /**
     * Get the welcome back message if one exists
     * @returns {String|null} The welcome back message or null if none exists
     */
    getWelcomeBackMessage: function () {
      // First check the global variable (for immediate access)
      if (window.voiceroWelcomeBackMessage) {
        console.log(
          "VoiceroUserData: Retrieved welcome back message from global variable:",
          window.voiceroWelcomeBackMessage
        );
        return window.voiceroWelcomeBackMessage;
      }

      // Fall back to localStorage
      try {
        const message = localStorage.getItem("voiceroWelcomeBackMessage");
        if (message) {
          console.log(
            "VoiceroUserData: Retrieved welcome back message from localStorage:",
            message
          );
          // Cache it in the global variable for faster access next time
          window.voiceroWelcomeBackMessage = message;
          return message;
        }
      } catch (e) {
        console.warn(
          "VoiceroUserData: Error accessing localStorage for welcome message",
          e
        );
      }

      console.log("VoiceroUserData: No welcome back message found");
      return null;
    },

    /**
     * Send customer data to our external API
     * @param {Object} customerData - The customer data to send
     */
    sendCustomerDataToApi: function (customerData) {
      try {
        // Check if we've already sent data to avoid duplicates
        if (this.dataSent) {
          console.log(
            "VoiceroUserData: Customer data already sent, skipping duplicate send"
          );
          return;
        }

        console.log("VoiceroUserData: Sending customer data to external API");

        // Mark data as sent to prevent duplicates
        this.dataSent = true;

        // Get the shop domain from config
        const shopDomain =
          window.voiceroConfig && window.voiceroConfig.shop
            ? window.voiceroConfig.shop
            : window.location.hostname;

        // Get access headers from config if available
        const headers =
          window.voiceroConfig &&
          typeof window.voiceroConfig.getAuthHeaders === "function"
            ? window.voiceroConfig.getAuthHeaders()
            : { Authorization: "Bearer anonymous" };

        // Get website ID from config or defaults
        const websiteId =
          window.voiceroConfig && window.voiceroConfig.websiteId
            ? window.voiceroConfig.websiteId
            : shopDomain; // Use shop domain as fallback website ID

        // Extract customer from userData
        const customer = customerData.customer || {};

        // Transform customer data to match the expected API format
        // The API expects firstName, lastName instead of first_name, last_name
        const transformedCustomer = {
          id: customer.id || "",
          firstName: customer.first_name || "",
          lastName: customer.last_name || "",
          email: customer.email || "",
          phone: customer.phone || "",
          acceptsMarketing: customer.accepts_marketing || false,
          tags: customer.tags || "",
          orders_count: customer.orders_count || 0,
          total_spent: customer.total_spent
            ? (parseFloat(customer.total_spent) / 100).toFixed(2)
            : "0.00",
        };

        // Add defaultAddress if available
        if (customer.default_address) {
          transformedCustomer.defaultAddress = {
            id: customer.default_address.id || "",
            firstName: customer.default_address.first_name || "",
            lastName: customer.default_address.last_name || "",
            address1: customer.default_address.address1 || "",
            city: customer.default_address.city || "",
            province: customer.default_address.province || "",
            zip: customer.default_address.zip || "",
            country: customer.default_address.country || "",
          };
        }

        // Add addresses in GraphQL format if available
        // Your API expects addresses as {edges: [{node: {}}]} format
        transformedCustomer.addresses = {
          edges: [],
        };

        // Add default address to the edges if available
        if (customer.default_address) {
          transformedCustomer.addresses.edges.push({
            node: {
              id: customer.default_address.id || "",
              firstName: customer.default_address.first_name || "",
              lastName: customer.default_address.last_name || "",
              address1: customer.default_address.address1 || "",
              city: customer.default_address.city || "",
              province: customer.default_address.province || "",
              zip: customer.default_address.zip || "",
              country: customer.default_address.country || "",
            },
          });
        }

        // Add orders if available
        if (customer.recent_orders && customer.recent_orders.length > 0) {
          transformedCustomer.orders = {
            edges: customer.recent_orders.map((order) => ({
              node: {
                id: order.order_number,
                orderNumber: order.order_number,
                processedAt: order.created_at,
                fulfillmentStatus: order.fulfillment_status || "",
                financialStatus: order.financial_status || "",
                totalPriceV2: {
                  amount: order.total_price
                    ? (parseFloat(order.total_price) / 100).toFixed(2)
                    : "0.00",
                  currencyCode: "USD", // Default currency
                },
                // Add line items structure (API expects this format with edges/node)
                lineItems: {
                  edges: [
                    {
                      node: {
                        title: `Order #${order.order_number}`,
                        quantity: 1,
                      },
                    },
                  ],
                },
                // Add fulfillments if tracking info is available
                fulfillments: order.has_tracking
                  ? [
                      {
                        trackingCompany: order.tracking_company || "",
                        trackingNumbers: [order.tracking_number || ""],
                        trackingUrls: [order.tracking_url || ""],
                      },
                    ]
                  : [],

                // Add shipping address (use customer default if order doesn't have one)
                shippingAddress: {
                  address1: customer.default_address
                    ? customer.default_address.address1
                    : "",
                  city: customer.default_address
                    ? customer.default_address.city
                    : "",
                  province: customer.default_address
                    ? customer.default_address.province
                    : "",
                  country: customer.default_address
                    ? customer.default_address.country
                    : "",
                  zip: customer.default_address
                    ? customer.default_address.zip
                    : "",
                },
              },
            })),
          };
        }

        // Add cart data
        const cart = customerData.cart || {};

        // Prepare the payload with shop and customer data
        const payload = {
          shop: shopDomain,
          websiteId: websiteId, // Include website ID in payload
          customer: transformedCustomer,
          cart: cart,
          source: "shopify-storefront",
          timestamp: new Date().toISOString(),
        };

        console.log("VoiceroUserData: Formatted payload for API:", payload);

        // Send the data to the external API
        fetch("http://localhost:3000/api/shopify/setCustomer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (!response.ok) {
              console.error(
                "VoiceroUserData: API response error:",
                response.status,
                response.statusText
              );
              throw new Error(`API response error: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            console.log(
              "VoiceroUserData: Successfully sent customer data to API",
              data
            );

            // Check if the API returned a welcome back message
            if (data && data.welcomeBackMessage) {
              console.log(
                "VoiceroUserData: Received welcome back message:",
                data.welcomeBackMessage
              );

              // Store the welcome back message in localStorage
              try {
                localStorage.setItem(
                  "voiceroWelcomeBackMessage",
                  data.welcomeBackMessage
                );

                // Also store the timestamp of when we received the message
                localStorage.setItem(
                  "voiceroWelcomeBackMessageTime",
                  Date.now().toString()
                );

                console.log(
                  "VoiceroUserData: Stored welcome back message in localStorage"
                );

                // Also store in global variable for immediate access
                window.voiceroWelcomeBackMessage = data.welcomeBackMessage;
              } catch (e) {
                console.warn(
                  "VoiceroUserData: Unable to store welcome back message",
                  e
                );
              }
            }
          })
          .catch((error) => {
            console.error(
              "VoiceroUserData: Error sending customer data to API",
              error
            );
            this.errors.push({
              time: new Date().toISOString(),
              message:
                error.message || "Unknown error sending customer data to API",
            });
          });
      } catch (error) {
        console.error(
          "VoiceroUserData: Exception sending customer data to API",
          error
        );
        this.errors.push({
          time: new Date().toISOString(),
          message: error.message || "Exception sending customer data to API",
        });
      }
    },

    /**
     * Clear the welcome back message after it's been displayed
     */
    clearWelcomeBackMessage: function () {
      console.log(
        "VoiceroUserData: Clearing welcome back message, current value:",
        window.voiceroWelcomeBackMessage
      );

      // Clear from global variable
      window.voiceroWelcomeBackMessage = null;

      // Reset the displayed flag
      window.voiceroWelcomeBackDisplayed = false;

      // Clear from localStorage
      try {
        localStorage.removeItem("voiceroWelcomeBackMessage");
        localStorage.removeItem("voiceroWelcomeBackMessageTime");
        console.log(
          "VoiceroUserData: Cleared welcome back message from localStorage"
        );
      } catch (e) {
        console.warn("VoiceroUserData: Error clearing welcome back message", e);
      }
    },
  };

  // Initialize immediately
  window.VoiceroUserData.init();
})();
