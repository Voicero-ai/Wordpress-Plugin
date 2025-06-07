/**
 * VoiceroAI User Data Module
 * Loads early to fetch WooCommerce customer data before other scripts run
 * Stores user data in global variables for later use by other modules
 *
 * Functionality summary:
 * - Collects detailed customer information from WooCommerce
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
                "VoiceroUserData: Sending consolidated data via WordPress proxy from init completion"
              );

              // Send to our API
              this.sendCustomerDataToApi(userData);
            } else if (this.dataSent) {
              console.log(
                "VoiceroUserData: Data already sent via WordPress proxy, not sending again from init completion"
              );
            }

            // Resolve the promise to signal completion
            resolve();
          });
      });

      return this.initPromise;
    },

    /**
     * Fetch customer data from WordPress using AJAX
     * @returns {Promise} Promise that resolves when customer data is fetched
     */
    fetchCustomerData: function () {
      return new Promise((resolve) => {
        console.log(
          "VoiceroUserData: Attempting to fetch customer data from WordPress"
        );

        // Get AJAX configuration
        const ajaxUrl =
          typeof voiceroConfig !== "undefined"
            ? voiceroConfig.ajaxUrl
            : "/wp-admin/admin-ajax.php";
        const nonce =
          typeof voiceroConfig !== "undefined" ? voiceroConfig.nonce : "";

        // First check if we're already logged in
        // This can be determined by looking for elements that only appear for logged-in users
        const accountLinks = document.querySelectorAll(
          ".woocommerce-MyAccount-navigation, .woocommerce-account"
        );
        const logoutLinks = document.querySelectorAll('a[href*="logout"]');

        if (accountLinks.length > 0 || logoutLinks.length > 0) {
          console.log(
            "VoiceroUserData: User appears to be logged in based on DOM elements"
          );
          this.isLoggedIn = true;

          // Create basic customer object
          this.customer = {
            logged_in: true,
            timestamp: new Date().toISOString(),
          };

          // Try to get detailed info via AJAX
          const formData = new FormData();
          formData.append("action", "voicero_get_customer_data");
          formData.append("nonce", nonce);

          fetch(ajaxUrl, {
            method: "POST",
            credentials: "same-origin",
            body: formData,
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }
              return response.json();
            })
            .then((response) => {
              if (response.success && response.data) {
                console.log(
                  "VoiceroUserData: Received customer data from WordPress:",
                  response.data
                );
                this.customer = {
                  ...this.customer,
                  ...response.data,
                };
                this.isLoggedIn = true;
              } else {
                console.log(
                  "VoiceroUserData: Customer data request successful but no data returned"
                );
              }
              resolve();
            })
            .catch((error) => {
              console.error(
                "VoiceroUserData: Error fetching customer data from WordPress",
                error
              );
              // Still resolve, we'll just use the basic customer object
              resolve();
            });
        } else {
          console.log("VoiceroUserData: User appears to be logged out");
          this.isLoggedIn = false;
          resolve();
        }
      });
    },

    /**
     * Fetch cart data from WooCommerce using AJAX
     * @returns {Promise} Promise that resolves when cart data is fetched
     */
    fetchCartData: function () {
      return new Promise((resolve) => {
        console.log(
          "VoiceroUserData: Attempting to fetch cart data from WooCommerce"
        );

        // Get AJAX configuration
        const ajaxUrl =
          typeof voiceroConfig !== "undefined"
            ? voiceroConfig.ajaxUrl
            : "/wp-admin/admin-ajax.php";
        const nonce =
          typeof voiceroConfig !== "undefined" ? voiceroConfig.nonce : "";

        // Try to get cart data via AJAX
        const formData = new FormData();
        formData.append("action", "voicero_get_cart_data");
        formData.append("nonce", nonce);

        fetch(ajaxUrl, {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then((response) => {
            if (response.success && response.data) {
              console.log(
                "VoiceroUserData: Received cart data from WordPress:",
                response.data
              );
              this.cart = response.data;
            } else {
              console.log(
                "VoiceroUserData: Cart data request successful but no data returned"
              );
            }
            resolve();
          })
          .catch((error) => {
            console.error(
              "VoiceroUserData: Error fetching cart data from WordPress",
              error
            );
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

        console.log(
          "VoiceroUserData: Sending customer data via WordPress proxy"
        );

        // Mark data as sent to prevent duplicates
        this.dataSent = true;

        // Get the site URL from config
        const siteUrl =
          window.voiceroConfig && window.voiceroConfig.siteUrl
            ? window.voiceroConfig.siteUrl
            : window.location.origin;

        // We now use the WordPress AJAX proxy which handles authentication
        // No need to check for access keys or API URLs on the client side

        // Extract customer from userData
        const customer = customerData.customer || {};

        // Format customer data for the API - matching expected Shopify format
        const formattedCustomer = {
          id: customer.id || "",
          firstName: customer.first_name || "",
          lastName: customer.last_name || "",
          email: customer.email || "",
          phone: customer.billing_phone || "",
          acceptsMarketing: false,
          ordersCount: customer.orders_count || 0,
          totalSpent: customer.total_spent || "0.00",
          loggedIn: customer.logged_in || false,
          tags: [],
        };

        // Add billing address if available (as defaultAddress to match API expectations)
        if (customer.billing) {
          formattedCustomer.defaultAddress = {
            id: "billing_" + customer.id,
            firstName: customer.billing.first_name || "",
            lastName: customer.billing.last_name || "",
            address1: customer.billing.address_1 || "",
            city: customer.billing.city || "",
            province: customer.billing.state || "",
            zip: customer.billing.postcode || "",
            country: customer.billing.country || "",
          };
        }

        // Add shipping address to addresses array if available
        if (customer.shipping) {
          formattedCustomer.addresses = {
            edges: [
              {
                node: {
                  id: "shipping_" + customer.id,
                  firstName: customer.shipping.first_name || "",
                  lastName: customer.shipping.last_name || "",
                  address1: customer.shipping.address_1 || "",
                  city: customer.shipping.city || "",
                  province: customer.shipping.state || "",
                  zip: customer.shipping.postcode || "",
                  country: customer.shipping.country || "",
                },
              },
            ],
          };
        }

        // Add recent orders if available - in the format the API expects
        if (customer.recent_orders && customer.recent_orders.length > 0) {
          formattedCustomer.orders = {
            edges: customer.recent_orders.map((order) => ({
              node: {
                id: order.id.toString(),
                orderNumber: order.number.toString(),
                processedAt: order.date_created,
                fulfillmentStatus: order.status,
                financialStatus: order.status,
                totalPriceV2: {
                  amount: order.total,
                  currencyCode: order.currency,
                },
                lineItems: {
                  edges: order.line_items
                    ? order.line_items.map((item) => ({
                        node: {
                          title: item.name,
                          quantity: item.quantity,
                        },
                      }))
                    : [],
                },
              },
            })),
          };
        }

        // Prepare the payload to match the API expectations
        const payload = {
          customer: formattedCustomer,
          cart: customerData.cart || null,
          source: "woocommerce",
          timestamp: new Date().toISOString(),
        };

        console.log("VoiceroUserData: Formatted payload for API:", payload);

        // Get AJAX configuration
        const ajaxUrl =
          typeof voiceroConfig !== "undefined"
            ? voiceroConfig.ajaxUrl
            : "/wp-admin/admin-ajax.php";

        // Get nonce from config
        const nonce =
          typeof voiceroConfig !== "undefined" ? voiceroConfig.nonce : "";

        // Debug log nonce value to help troubleshoot
        console.log(
          "VoiceroUserData: Using nonce value:",
          nonce ? "Valid nonce found" : "No nonce available"
        );

        // Send the data to WordPress instead of directly to external API
        // This allows us to use the server-side access key which is more secure
        const formData = new FormData();
        formData.append("action", "voicero_set_customer_data");
        formData.append("nonce", nonce);
        formData.append("payload", JSON.stringify(payload));

        console.log(
          "VoiceroUserData: Sending customer data via WordPress proxy"
        );

        fetch(ajaxUrl, {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        })
          .then((response) => {
            if (!response.ok) {
              console.error(
                "VoiceroUserData: AJAX response error:",
                response.status,
                response.statusText
              );
              throw new Error(`AJAX response error: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            // Check for WordPress AJAX error response
            if (data.success === false) {
              console.error(
                "VoiceroUserData: WordPress AJAX error:",
                data.data?.message || "Unknown error"
              );
              throw new Error(data.data?.message || "WordPress AJAX error");
            }
            return data.data; // WordPress wraps responses in a data property
          })
          .then((data) => {
            console.log(
              "VoiceroUserData: Successfully sent customer data via WordPress proxy",
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
              "VoiceroUserData: Error sending customer data via WordPress proxy",
              error
            );
            this.errors.push({
              time: new Date().toISOString(),
              message:
                error.message ||
                "Unknown error sending customer data via WordPress proxy",
            });
          });
      } catch (error) {
        console.error(
          "VoiceroUserData: Exception sending customer data via WordPress proxy",
          error
        );
        this.errors.push({
          time: new Date().toISOString(),
          message:
            error.message ||
            "Exception sending customer data via WordPress proxy",
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
