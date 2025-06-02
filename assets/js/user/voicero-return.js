/**
 * Voicero Return Handler
 * Handles returns, refunds, exchanges, and cancellations for Shopify orders
 */

const VoiceroReturnHandler = {
  config: {
    proxyUrl: "/apps/proxy",
    defaultHeaders: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    debug: true,
  },

  /**
   * Initialize the handler with custom configuration
   * @param {Object} userConfig - Custom configuration to override defaults
   * @returns {Object} - The handler instance for chaining
   */
  init: function (userConfig = {}) {
    this.config = {
      ...this.config,
      ...userConfig,
      defaultHeaders: {
        ...this.config.defaultHeaders,
        ...(userConfig.defaultHeaders || {}),
      },
    };

    if (this.config.debug) {
      console.log("VoiceroReturnHandler initialized with config:", this.config);
    }

    // Check for pending returns on init
    setTimeout(() => {
      this.suggestPendingReturn();
    }, 3000); // Wait 3 seconds to avoid interrupting initial page load

    return this;
  },

  /**
   * Handle a refund request - requires order number and email
   * @param {Object} context - The context object with order details
   * @returns {Promise} - A promise that resolves when the refund is processed
   */
  handleRefund: async function (context) {
    console.log("Processing refund request:", context);

    // Handle different parameter formats (support both email and order_email)
    const context_normalized = { ...context };
    if (!context_normalized.email && context_normalized.order_email) {
      context_normalized.email = context_normalized.order_email;
    }

    const { order_id, order_number, email } = context_normalized || {};

    // Check if we have the required information
    if (!order_id && !order_number) {
      this.notifyUser(
        "To process a refund, I need your order number. Please provide it.",
      );
      return;
    }

    if (!email) {
      this.notifyUser(
        "To verify your identity for the refund, I need the email address used when placing the order.",
      );
      return;
    }

    // Check if user is logged in
    const isLoggedIn = this.checkUserLoggedIn();
    if (!isLoggedIn) {
      this.notifyUser(
        "You need to be logged into your account to request a refund. Please log in first.",
      );
      return;
    }

    // Verify order belongs to user
    if (!(await this.verifyOrderOwnership(order_id || order_number, email))) {
      this.notifyUser(
        "I couldn't verify that this order belongs to your account. Please check the order number and email address.",
      );
      return;
    }

    this.notifyUser(
      "I'm processing your refund request. This may take a moment...",
    );

    // Try to process the refund through the proxy
    try {
      const response = await this.callProxy("refund", {
        order_id: order_id || order_number,
        email,
        refund_type: "full", // Default to full refund
        reason: context.reason || "Customer requested",
      });

      if (response.success) {
        this.notifyUser(
          `✅ Your refund for order #${order_id || order_number} has been processed successfully! You should receive a confirmation email shortly.`,
        );
      } else {
        this.notifyUser(
          `❌ I couldn't process your refund automatically: ${response.error || "Unknown error"}. Please contact customer support for assistance.`,
        );
      }
    } catch (error) {
      console.error("Refund processing error:", error);
      this.notifyUser(
        "There was a problem processing your refund request. Please contact customer support directly for assistance.",
      );
    }
  },

  /**
   * Handle an order cancellation request
   * @param {Object} context - The context object with order details
   * @returns {Promise} - A promise that resolves when the cancellation is processed
   */
  handleCancelOrder: async function (context) {
    console.log("Processing order cancellation request:", context);

    // Handle different parameter formats (support both email and order_email)
    const context_normalized = { ...context };
    if (!context_normalized.email && context_normalized.order_email) {
      context_normalized.email = context_normalized.order_email;
    }

    const { order_id, order_number, email } = context_normalized || {};

    // Check if we have the required information
    if (!order_id && !order_number) {
      this.notifyUser(
        "To cancel an order, I need your order number. Please provide it.",
      );
      return;
    }

    if (!email) {
      this.notifyUser(
        "To verify your identity for the cancellation, I need the email address used when placing the order.",
      );
      return;
    }

    // Check if user is logged in
    const isLoggedIn = this.checkUserLoggedIn();
    if (!isLoggedIn) {
      this.notifyUser(
        "You need to be logged into your account to cancel an order. Please log in first.",
      );
      return;
    }

    // Verify order belongs to user
    if (!(await this.verifyOrderOwnership(order_id || order_number, email))) {
      this.notifyUser(
        "I couldn't verify that this order belongs to your account. Please check the order number and email address.",
      );
      return;
    }

    this.notifyUser(
      "I'm processing your cancellation request. This may take a moment...",
    );

    // Try to process the cancellation through the proxy
    try {
      const response = await this.callProxy("cancel", {
        order_id: order_id || order_number,
        email,
        reason: context.reason || "CUSTOMER",
        notify_customer: true,
        refund: true,
        restock: true,
      });

      if (response.success) {
        this.notifyUser(
          `✅ Your order #${order_id || order_number} has been cancelled successfully! You should receive a confirmation email shortly.`,
        );
      } else {
        if (response.suggest_return) {
          // Order is fulfilled, suggest return instead
          const message = `${response.error || "This order has already been fulfilled and cannot be cancelled."} 
          
Would you like me to help you initiate a return request once you receive your order?`;

          this.notifyUser(message);

          // Save order details for later if available
          if (response.order_details) {
            try {
              localStorage.setItem(
                "pendingReturnOrder",
                JSON.stringify({
                  order_number: response.order_details.order_number,
                  email: email,
                  timestamp: new Date().toISOString(),
                }),
              );
            } catch (e) {
              console.error("Could not save pending return order details", e);
            }
          }
        } else if (response.suggest_contact) {
          // Not cancelable for other reasons
          this.notifyUser(
            `${response.error || "Unable to cancel this order."} Please contact customer support directly for assistance with this order.`,
          );
        } else {
          // Generic error
          this.notifyUser(
            `❌ I couldn't cancel your order automatically: ${response.error || "Unknown error"}. Please contact customer support for assistance.`,
          );
        }
      }
    } catch (error) {
      console.error("Order cancellation error:", error);
      this.notifyUser(
        "There was a problem cancelling your order. Please contact customer support directly for assistance.",
      );
    }
  },

  /**
   * Handle a return request
   * @param {Object} context - The context object with order details
   * @returns {Promise} - A promise that resolves when the return is processed
   */
  handleReturn: async function (context) {
    console.log("Processing return request:", context);

    // Handle different parameter formats (support both email and order_email)
    const context_normalized = { ...context };
    if (!context_normalized.email && context_normalized.order_email) {
      context_normalized.email = context_normalized.order_email;
    }

    const { order_id, order_number, email, items } = context_normalized || {};
    const orderIdentifier = order_id || order_number;

    console.log("🚨 Return request for order:", orderIdentifier);

    // Check if we have the required information
    if (!orderIdentifier) {
      this.notifyUser(
        "To process a return, I need your order number. Please provide it.",
      );
      return;
    }

    if (!email) {
      this.notifyUser(
        "To verify your identity for the return, I need the email address used when placing the order.",
      );
      return;
    }

    // DIRECT PROCESS PATH - Works for ANY order number
    console.log(`🔥 Direct processing return for order #${orderIdentifier}`);

    // IMPORTANT: Check if we already have a return reason (from AI)
    const hasReturnReason = context.reason || context.returnReason;
    console.log("Return reason check:", {
      reason: context.reason,
      returnReason: context.returnReason,
      hasReturnReason,
    });

    // If we have the return reason, directly process the return without fetching order details first
    if (hasReturnReason) {
      console.log(
        "Return reason provided, directly processing return without order_details call",
      );
      const returnReason = context.reason || context.returnReason;
      const returnReasonNote = context.returnReasonNote || "";

      this.notifyUser(
        `Processing your return for order #${orderIdentifier} with reason: ${returnReason}`,
      );

      try {
        // Call the proxy with action 'return' or 'return_order' directly
        const response = await this.callProxy("return", {
          order_id: orderIdentifier,
          email: email,
          reason: returnReason,
          returnReason: returnReason,
          returnReasonNote: returnReasonNote,
          items: context.items || [
            { lineItemId: "item1", quantity: 1, reason: returnReason },
          ],
        });

        console.log("Direct return response:", response);

        if (response.success) {
          this.notifyUser(
            `✅ Your return for order #${orderIdentifier} has been processed successfully! You will receive confirmation via email shortly.`,
          );
        } else {
          this.notifyUser(
            "❌ There was a problem with your return: " +
              (response.error || "Unknown error") +
              "\n\nPlease contact customer support for assistance.",
          );
        }
      } catch (error) {
        console.error("Direct return processing error:", error);
        this.notifyUser(
          "There was a problem processing your return. Please contact customer support.",
        );
      }
      return;
    }

    // Let's get the actual order items if possible
    try {
      // First try to fetch order details to show items
      // IMPORTANT: Pass along any existing reason/returnReason to the order_details call
      const orderDetailsRequest = {
        order_id: orderIdentifier,
        email: email,
      };

      // Include any return reason information in the request
      if (context.reason) orderDetailsRequest.reason = context.reason;
      if (context.returnReason)
        orderDetailsRequest.returnReason = context.returnReason;

      const orderDetailsResponse = await this.callProxy(
        "order_details",
        orderDetailsRequest,
      );

      console.log("Order details for item listing:", orderDetailsResponse);

      // Check if the server detected return info and wants us to process a return directly
      if (orderDetailsResponse.should_process_return) {
        console.log(
          "🚨 Server indicated we should process return directly based on order_details response",
        );
        // Extract reason from the order_details response
        const returnReason =
          orderDetailsResponse.reason || orderDetailsResponse.returnReason;

        if (returnReason) {
          console.log(
            "Processing return with reason from order_details response:",
            returnReason,
          );

          try {
            // Make a direct return call with the provided reason
            const response = await this.callProxy("return", {
              order_id: orderIdentifier,
              email: email,
              reason: returnReason,
              returnReason: returnReason,
              returnReasonNote: context.returnReasonNote || "",
            });

            console.log(
              "Direct return response from order_details flow:",
              response,
            );

            if (response.success) {
              this.notifyUser(
                `✅ Your return for order #${orderIdentifier} has been processed successfully! You will receive confirmation via email shortly.`,
              );
              return; // Exit early since we've completed the return
            } else {
              this.notifyUser(
                "❌ There was a problem with your return: " +
                  (response.error || "Unknown error") +
                  "\n\nPlease contact customer support for assistance.",
              );
              return; // Exit early to avoid continuing with the normal flow
            }
          } catch (returnError) {
            console.error(
              "Error processing direct return from order_details:",
              returnError,
            );
            // Continue with normal flow as fallback
          }
        }
      }

      // Extract item information to show to the user
      let itemsList = "";
      let orderItems = [];

      if (
        orderDetailsResponse.success &&
        orderDetailsResponse.order &&
        orderDetailsResponse.order.line_items &&
        orderDetailsResponse.order.line_items.length > 0
      ) {
        orderItems = orderDetailsResponse.order.line_items;

        // Format the items list
        itemsList = "Items in your order:\n\n";
        orderDetailsResponse.order.line_items.forEach((item, index) => {
          itemsList += `${index + 1}. ${item.title} - ${item.quantity} x $${parseFloat(item.price).toFixed(2)}\n`;
        });

        // Show the order items to the user
        this.notifyUser(`For order #${orderIdentifier}\n\n${itemsList}`);
      } else {
        console.log("❌ Could not retrieve detailed item information");
        // Fallback item
        orderItems = [
          {
            id: "default_item",
            title: `Item from order #${orderIdentifier}`,
            quantity: 1,
          },
        ];
      }

      // CRITICAL FIX: Check if the order_details response includes a reason
      // This would happen if the server detected a return_order action with reason
      if (
        !hasReturnReason &&
        (orderDetailsResponse.reason || orderDetailsResponse.returnReason)
      ) {
        console.log(
          "Using reason from order_details response:",
          orderDetailsResponse.reason || orderDetailsResponse.returnReason,
        );
        context.reason =
          orderDetailsResponse.reason || orderDetailsResponse.returnReason;
        hasReturnReason = true;
      }

      // Ask for return reason if not provided
      if (!hasReturnReason) {
        this.notifyUser(
          "What's the reason for your return?\n\n" +
            "1. Wrong size\n" +
            "2. Damaged item\n" +
            "3. Not as described\n" +
            "4. Changed mind\n" +
            "5. Other reason",
        );

        // Store this return request for later processing
        try {
          localStorage.setItem(
            "directReturnPending",
            JSON.stringify({
              order_id: orderIdentifier,
              email: email,
              timestamp: new Date().toISOString(),
              items: orderItems, // Store the items for later use
            }),
          );
        } catch (e) {
          console.error("Error saving pending direct return", e);
        }

        return;
      } else {
        // If reason provided, directly process the return
        this.notifyUser(
          `Processing your return for order #${orderIdentifier} with reason: ${context.reason || context.returnReason}\n\n${itemsList}`,
        );

        // Use the real items if we have them, otherwise use dummy items
        const returnItems = orderItems.map((item) => ({
          lineItemId: item.id,
          quantity: item.quantity || 1,
          reason: context.reason || context.returnReason,
        }));

        // Process the return with real items
        const response = await this.callProxy("return", {
          order_id: orderIdentifier,
          email: email,
          reason: context.reason || context.returnReason,
          returnReason: context.returnReason || context.reason,
          items:
            returnItems.length > 0
              ? returnItems
              : [
                  {
                    lineItemId: "item1",
                    quantity: 1,
                    reason: context.reason || context.returnReason,
                  },
                ],
        });

        console.log("Direct return response:", response);

        if (response.success) {
          this.notifyUser(
            `✅ Your return for order #${orderIdentifier} has been processed successfully!\n\n${itemsList}\n\nYou will receive confirmation via email shortly.`,
          );
        } else {
          this.notifyUser(
            "❌ There was a problem with your return: " +
              (response.error || "Unknown error") +
              "\n\nPlease contact customer support for assistance.",
          );
        }
      }
    } catch (error) {
      console.error("Error handling direct return process:", error);

      // Fallback to simpler flow if the detailed approach fails
      if (!context.reason && !context.returnReason) {
        this.notifyUser(
          `I found your order #${orderIdentifier}. What's the reason for your return?\n\n` +
            "1. Wrong size\n" +
            "2. Damaged item\n" +
            "3. Not as described\n" +
            "4. Changed mind\n" +
            "5. Other reason",
        );

        // Store this return request for later processing
        try {
          localStorage.setItem(
            "directReturnPending",
            JSON.stringify({
              order_id: orderIdentifier,
              email: email,
              timestamp: new Date().toISOString(),
            }),
          );
        } catch (e) {
          console.error("Error saving pending direct return", e);
        }
      } else {
        const returnReason = context.reason || context.returnReason;
        this.notifyUser(
          `Processing your return for order #${orderIdentifier} with reason: ${returnReason}`,
        );

        try {
          const response = await this.callProxy("return", {
            order_id: orderIdentifier,
            email: email,
            reason: returnReason,
            returnReason: context.returnReason || context.reason,
            items: items || [
              { lineItemId: "item1", quantity: 1, reason: returnReason },
            ],
          });

          if (response.success) {
            this.notifyUser(
              `✅ Your return for order #${orderIdentifier} has been processed successfully!`,
            );
          } else {
            this.notifyUser(
              "❌ There was a problem with your return: " +
                (response.error || "Unknown error"),
            );
          }
        } catch (returnError) {
          console.error("Direct return processing error:", returnError);
          this.notifyUser(
            "There was a problem processing your return. Please contact customer support.",
          );
        }
      }
    }
  },

  /**
   * Handle an exchange request
   * @param {Object} context - The context object with order details
   * @returns {Promise} - A promise that resolves when the exchange is processed
   */
  handleExchange: async function (context) {
    console.log("Processing exchange request:", context);

    // Handle different parameter formats (support both email and order_email)
    const context_normalized = { ...context };
    if (!context_normalized.email && context_normalized.order_email) {
      context_normalized.email = context_normalized.order_email;
    }

    const { order_id, order_number, email, items } = context_normalized || {};

    // Check if we have the required information
    if (!order_id && !order_number) {
      this.notifyUser(
        "To process an exchange, I need your order number. Please provide it.",
      );
      return;
    }

    if (!email) {
      this.notifyUser(
        "To verify your identity for the exchange, I need the email address used when placing the order.",
      );
      return;
    }

    // Check if user is logged in
    const isLoggedIn = this.checkUserLoggedIn();
    if (!isLoggedIn) {
      this.notifyUser(
        "You need to be logged into your account to request an exchange. Please log in first.",
      );
      return;
    }

    // If we don't have specific items to exchange, we need to fetch the order first
    if (!items || !items.length) {
      this.notifyUser(
        "I need to know which items you want to exchange. Let me look up your order first.",
      );

      // Try to retrieve order details
      const orderDetails = await this.getOrderDetails(
        order_id || order_number,
        email,
      );
      if (!orderDetails) {
        this.notifyUser(
          "I couldn't find your order details. Please verify your order number and email.",
        );
        return;
      }

      // Ask user which items they want to exchange
      this.promptForExchangeItems(orderDetails);
      return;
    }

    this.notifyUser(
      "I'm processing your exchange request. This may take a moment...",
    );

    // Try to process the exchange through the proxy
    try {
      const response = await this.callProxy("exchange", {
        order_id: order_id || order_number,
        email,
        items,
        reason: context.reason || "Size/color exchange",
      });

      if (response.success) {
        this.notifyUser(
          `✅ Your exchange for order #${order_id || order_number} has been initiated successfully! You should receive a confirmation email with next steps shortly.`,
        );
      } else {
        this.notifyUser(
          `❌ I couldn't process your exchange automatically: ${response.error || "Unknown error"}. Please contact customer support for assistance.`,
        );
      }
    } catch (error) {
      console.error("Exchange processing error:", error);
      this.notifyUser(
        "There was a problem processing your exchange request. Please contact customer support directly for assistance.",
      );
    }
  },

  /**
   * Verify that the order belongs to the user with the given email
   * @param {string} orderNumber - The order ID or number
   * @param {string} email - The email to verify
   * @returns {Promise<boolean>} - True if the order belongs to the user
   */
  verifyOrderOwnership: async function (orderNumber, email) {
    // Check if we have injected customer data
    if (
      window.__VoiceroCustomerData &&
      window.__VoiceroCustomerData.recent_orders
    ) {
      const orders = window.__VoiceroCustomerData.recent_orders;

      // Find the order in the customer data
      const matchingOrder = orders.find(
        (o) =>
          o.order_number === orderNumber ||
          o.name === orderNumber ||
          o.name === `#${orderNumber}`,
      );

      if (matchingOrder) {
        return true;
      }
    }

    // Try to verify via the proxy
    try {
      const response = await this.callProxy("verify_order", {
        order_id: orderNumber,
        email,
      });

      return response.success && response.verified;
    } catch (error) {
      console.error("Order verification error:", error);
      return false;
    }
  },

  /**
   * Get details for a specific order
   * @param {string} orderNumber - The order ID or number
   * @param {string} email - The email associated with the order
   * @returns {Promise<Object>} - The order details
   */
  getOrderDetails: async function (orderNumber, email) {
    console.log("🔍 DEBUG: getOrderDetails called with:", {
      orderNumber,
      email,
    });

    // Check if we have injected customer data
    if (
      window.__VoiceroCustomerData &&
      window.__VoiceroCustomerData.recent_orders
    ) {
      console.log("🔍 DEBUG: Checking recent_orders in __VoiceroCustomerData");
      const orders = window.__VoiceroCustomerData.recent_orders;
      console.log("🔍 DEBUG: Found recent orders:", orders.length);

      // Find the order in the customer data
      const matchingOrder = orders.find(
        (o) =>
          o.order_number === orderNumber ||
          o.name === orderNumber ||
          o.name === `#${orderNumber}`,
      );

      if (matchingOrder) {
        console.log(
          "✅ DEBUG: Found matching order in customer data:",
          matchingOrder.name,
        );
        return matchingOrder;
      }
    }

    // Try to get details via the proxy
    try {
      console.log(
        "🔄 DEBUG: Fetching order details from proxy for order:",
        orderNumber,
      );
      const response = await this.callProxy("order_details", {
        order_id: orderNumber,
        email,
      });

      console.log("📦 DEBUG: Proxy response for order details:", response);

      if (!response.success) {
        console.error("❌ DEBUG: Order lookup failed:", response.error);
        this.notifyUser(
          `Error looking up your order: ${response.error || "Unknown error"}`,
        );
        return null;
      }

      if (response.success && response.order) {
        console.log(
          "✅ DEBUG: Successfully retrieved order details from proxy",
        );

        // Additional check for line items
        if (
          !response.order.line_items ||
          response.order.line_items.length === 0
        ) {
          console.error("⚠️ DEBUG: Order found but contains no line items");
          this.notifyUser(
            "Your order was found, but it doesn't contain any returnable items. If you believe this is an error, please contact customer support.",
          );
          return null;
        }

        return response.order;
      }

      return null;
    } catch (error) {
      console.error("❌ DEBUG: Error in getOrderDetails:", error);
      this.notifyUser(
        `There was a problem retrieving your order details: ${error.message || "Unknown error"}`,
      );
      return null;
    }
  },

  /**
   * Check if the user is currently logged in
   * @returns {boolean} - True if the user is logged in
   */
  checkUserLoggedIn: function () {
    // Try different ways to check if user is logged in

    // Method 1: VoiceroUserData
    if (window.VoiceroUserData && window.VoiceroUserData.isLoggedIn) {
      return true;
    }

    // Method 2: Customer data injection
    if (window.__VoiceroCustomerData && window.__VoiceroCustomerData.id) {
      return true;
    }

    // Method 3: Shopify customer object
    if (
      window.Shopify &&
      window.Shopify.customer &&
      window.Shopify.customer.id
    ) {
      return true;
    }

    // Method 4: Check for login-specific elements on the page
    const accountLinks = document.querySelectorAll('a[href*="/account"]');
    const logoutLinks = document.querySelectorAll('a[href*="/logout"]');

    if (accountLinks.length > 0 && logoutLinks.length > 0) {
      return true;
    }

    return false;
  },

  /**
   * Display a user interface to select items for return
   * @param {Object} orderDetails - The order details including line items
   */
  promptForReturnItems: function (orderDetails) {
    let message = "";

    console.log("🔍 Formatting order items for return prompt:", orderDetails);

    if (orderDetails.line_items && orderDetails.line_items.length > 0) {
      message +=
        `For order #${orderDetails.order_number || orderDetails.name || ""}:\n\n` +
        `Items available for return:\n\n`;

      orderDetails.line_items.forEach((item, index) => {
        const price = parseFloat(item.price || 0).toFixed(2);
        const quantity = item.quantity || 1;
        const title = item.title || "Item " + (index + 1);

        message += `${index + 1}. ${title} - ${quantity} × $${price}\n`;
      });

      message +=
        "\nPlease reply with the item numbers you want to return (e.g., '1, 2' or 'all').";

      // Special case - if there's only one item, make it clearer
      if (orderDetails.line_items.length === 1) {
        message +=
          "\nIf you want to return this item, simply reply with '1' or 'yes'.";
      }
    } else {
      message =
        `I couldn't find any returnable items in order #${orderDetails.order_number || orderDetails.name || ""}.` +
        " If you believe this is an error, please contact customer support for assistance.";
    }

    this.notifyUser(message);
  },

  /**
   * Display a user interface to select items for exchange
   * @param {Object} orderDetails - The order details including line items
   */
  promptForExchangeItems: function (orderDetails) {
    let message = "";

    if (orderDetails.line_items && orderDetails.line_items.length > 0) {
      message +=
        "Please select which items you'd like to exchange from order #" +
        orderDetails.order_number +
        ":\n\n";

      orderDetails.line_items.forEach((item, index) => {
        message += `${index + 1}. ${item.title} - ${item.quantity} x $${parseFloat(item.price).toFixed(2)}\n`;
      });

      message +=
        "\nPlease reply with the item numbers and what you'd like to exchange them for (size, color, etc).";
    } else {
      message =
        "I couldn't find any items in this order. Please contact customer support for assistance.";
    }

    this.notifyUser(message);
  },

  /**
   * Make a call to the proxy with the specified action and data
   * @param {string} action - The action to perform (refund, cancel, return, exchange)
   * @param {Object} data - The data for the action
   * @returns {Promise<Object>} - The response from the proxy
   * @private
   */
  callProxy: async function (action, data) {
    // Add the action to the data
    const payload = {
      action,
      ...data,
    };

    // Add shop domain and timestamp
    if (window.Shopify && window.Shopify.shop) {
      payload.shop = window.Shopify.shop;
    }
    payload.timestamp = new Date().toISOString();

    // Construct the URL for the proxy
    const url = this._buildUrl();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.config.defaultHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Proxy request failed: ${response.status} ${errorText}`,
        );
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error(`Error calling proxy for ${action}:`, error);
      throw error;
    }
  },

  /**
   * Show a notification to the user
   * @param {string} message - The message to display
   */
  notifyUser: function (message) {
    // Try VoiceroText first
    if (window.VoiceroText && window.VoiceroText.addMessage) {
      window.VoiceroText.addMessage(message, "ai");
      return;
    }

    // Try VoiceroVoice next
    if (window.VoiceroVoice && window.VoiceroVoice.addMessage) {
      window.VoiceroVoice.addMessage(message, "ai");
      return;
    }

    // Fallback to console and alert
    console.log("User notification:", message);
    alert(message);
  },

  /**
   * Build the URL for the proxy
   * @returns {string} - The complete URL
   * @private
   */
  _buildUrl: function () {
    // Get the current origin to use as base for relative URLs
    const base = window.location.origin;

    // Handle both absolute and relative URLs
    let fullUrl;
    if (this.config.proxyUrl.startsWith("http")) {
      // Already an absolute URL
      fullUrl = this.config.proxyUrl;
    } else {
      // Relative URL, prepend the origin
      fullUrl = `${base}${this.config.proxyUrl}`;
    }

    return fullUrl;
  },

  /**
   * Check for any pending returns that were saved from cancelled orders
   * @returns {Object|null} - Pending return order details if found
   */
  checkPendingReturns: function () {
    try {
      const pendingReturnJson = localStorage.getItem("pendingReturnOrder");
      if (!pendingReturnJson) return null;

      const pendingReturn = JSON.parse(pendingReturnJson);

      // Check if the pending return is still relevant (within 30 days)
      const savedDate = new Date(pendingReturn.timestamp);
      const now = new Date();
      const daysDiff = Math.floor((now - savedDate) / (1000 * 60 * 60 * 24));

      if (daysDiff > 30) {
        // Too old, clear it
        localStorage.removeItem("pendingReturnOrder");
        return null;
      }

      return pendingReturn;
    } catch (e) {
      console.error("Error checking pending returns", e);
      return null;
    }
  },

  /**
   * Suggest a return for a pending order that was previously unfulfilled
   */
  suggestPendingReturn: function () {
    const pendingReturn = this.checkPendingReturns();
    if (!pendingReturn) return false;

    const message = `I noticed you previously tried to cancel order #${pendingReturn.order_number}. 
    
If you've received this order now and would like to return it, I can help you initiate the return process. Would you like to proceed with a return request?`;

    this.notifyUser(message);
    return true;
  },
};

// Global message interceptor - will catch ANY formatted messages with return action
window.addEventListener("message", function (event) {
  // Check if this is coming from our app
  if (event.source === window) {
    try {
      // Try to parse the data if it's a string
      const data =
        typeof event.data === "string" ? JSON.parse(event.data) : event.data;

      // Look for return_order action pattern
      if (data && data.action === "return_order" && data.action_context) {
        console.log("Return order postMessage intercepted:", data);

        // Get the return reason from any possible location
        const returnReason =
          data.returnReason ||
          data.reason ||
          (data.action_context && data.action_context.returnReason) ||
          (data.action_context && data.action_context.reason);

        console.log("Return reason from message:", returnReason);

        // Wait for VoiceroReturnHandler to be ready
        setTimeout(function () {
          if (window.VoiceroReturnHandler) {
            window.VoiceroReturnHandler.handleReturn({
              order_id: data.action_context.order_id,
              email:
                data.action_context.order_email || data.action_context.email,
              reason: returnReason || "Customer request",
              returnReason: returnReason || "Customer request",
            });
          }
        }, 500);
      }

      // Also look for direct formatted response pattern
      if (
        data &&
        typeof data === "object" &&
        data.formatted &&
        data.formatted.action === "return_order"
      ) {
        console.log("Formatted return order intercepted:", data.formatted);

        // Get return reason from any possible location
        const returnReason =
          data.formatted.reason ||
          data.formatted.returnReason ||
          (data.formatted.action_context &&
            data.formatted.action_context.reason) ||
          (data.formatted.action_context &&
            data.formatted.action_context.returnReason) ||
          "Customer request";

        console.log("Return reason from formatted message:", returnReason);

        setTimeout(function () {
          if (window.VoiceroReturnHandler) {
            window.VoiceroReturnHandler.handleReturn({
              order_id: data.formatted.action_context.order_id,
              email:
                data.formatted.action_context.order_email ||
                data.formatted.action_context.email,
              reason: returnReason,
              returnReason: returnReason,
            });
          }
        }, 500);
      }
    } catch (e) {
      // Ignore parsing errors for non-JSON messages
    }
  }
});

// Export as global
window.VoiceroReturnHandler = VoiceroReturnHandler;

// Direct action interceptor to catch return_order actions
// Add this before the DOMContentLoaded event
if (!window.originalHandleAction && window.handleAction) {
  // Store the original function
  window.originalHandleAction = window.handleAction;

  // Replace with our intercepting version
  window.handleAction = function (action, data) {
    console.log("Action intercepted:", action, data);

    // Check if this is a return action
    if (action === "return_order" && data) {
      console.log("Return order action intercepted:", data);

      // Normalize the data
      const returnContext = {
        order_id: data.order_id,
        email: data.order_email || data.email,
        reason: data.reason || "Customer request",
      };

      // Call our handler
      if (window.VoiceroReturnHandler) {
        window.VoiceroReturnHandler.handleReturn(returnContext);
        return true; // Signal that we handled it
      }
    }

    // Pass through to original handler
    return window.originalHandleAction(action, data);
  };
}

// Initialize on load
document.addEventListener("DOMContentLoaded", function () {
  if (window.VoiceroReturnHandler) {
    window.VoiceroReturnHandler.init();

    // Listen for messages that might be responses to our return suggestions
    if (window.VoiceroText) {
      window.VoiceroText.addEventListener("message", function (event) {
        if (event.detail && event.detail.role === "user") {
          const message = event.detail.content.toLowerCase();

          // Check for pending direct return (emergency fix)
          let pendingDirectReturn = null;
          try {
            const pendingReturnJSON = localStorage.getItem(
              "directReturnPending",
            );
            if (pendingReturnJSON) {
              pendingDirectReturn = JSON.parse(pendingReturnJSON);
              console.log(
                "📣 Found pending direct return:",
                pendingDirectReturn,
              );
            }
          } catch (e) {
            console.error("Error checking for pending direct return", e);
          }

          // Check if this is a response with return reason
          if (pendingDirectReturn) {
            console.log(
              "🔍 Checking if message contains return reason:",
              message,
            );

            // Check for common return reasons or numbers (1-5)
            let reason = null;

            if (
              message.match(/1|wrong size|size|doesn't fit|too (small|large)/i)
            ) {
              reason = "WRONG_SIZE";
            } else if (message.match(/2|damaged|broken|defective/i)) {
              reason = "DAMAGED";
            } else if (
              message.match(/3|not as described|different|false advertising/i)
            ) {
              reason = "NOT_AS_DESCRIBED";
            } else if (message.match(/4|changed mind|don't want|return/i)) {
              reason = "CUSTOMER_CHANGED_MIND";
            } else if (message.match(/5|other/i)) {
              reason = "OTHER";
            }

            if (reason) {
              console.log("✅ Detected return reason:", reason);

              // Clear the pending return
              localStorage.removeItem("directReturnPending");

              // Get the stored items if available
              const items = pendingDirectReturn.items || [];
              let itemsList = "";

              // Format items list if we have items
              if (items && items.length > 0) {
                itemsList = "\n\nItems being returned:\n";
                items.forEach((item, index) => {
                  itemsList += `${index + 1}. ${item.title} - ${item.quantity || 1} ${item.quantity > 1 ? "items" : "item"}\n`;
                });
              }

              // Process the return with the detected reason
              window.VoiceroReturnHandler.notifyUser(
                "Processing your return with reason: " + reason + itemsList,
              );

              // Create items for return based on stored items or use a default
              const returnItems =
                items.length > 0
                  ? items.map((item) => ({
                      lineItemId: item.id,
                      quantity: item.quantity || 1,
                      reason: reason,
                    }))
                  : [{ quantity: 1, reason: reason }];

              // Create a simple item for return
              window.VoiceroReturnHandler.handleReturn({
                order_id: pendingDirectReturn.order_id,
                email: pendingDirectReturn.email,
                reason: reason,
                returnReason: reason, // Add returnReason for consistency
                items: returnItems,
              });
            }
          }

          const pendingReturn =
            window.VoiceroReturnHandler.checkPendingReturns();

          // Check if this might be a response to our return suggestion
          if (
            pendingReturn &&
            (message.includes("yes") ||
              message.includes("return") ||
              message.includes("proceed"))
          ) {
            // Clear the pending return first
            localStorage.removeItem("pendingReturnOrder");

            // Start the return process with the saved details
            window.VoiceroReturnHandler.handleReturn({
              order_id: pendingReturn.order_number,
              email: pendingReturn.email,
              reason: "Failed cancellation - item already fulfilled",
            });
          }
        }
      });
    }

    // CRITICAL FIX: Connect AI response to return handler
    document.addEventListener("ai_response", function (event) {
      const response = event.detail;
      console.log("AI response received:", response);

      // Check if this is a return_order action with context
      if (
        response &&
        response.action === "return_order" &&
        response.action_context
      ) {
        console.log(
          "Return order action detected, context:",
          response.action_context,
        );

        // Extract return reason from any possible location
        const returnReason =
          response.reason ||
          response.returnReason ||
          (response.action_context && response.action_context.reason) ||
          (response.action_context && response.action_context.returnReason) ||
          "Customer request";

        console.log("Return reason from AI response:", returnReason);

        // Map action_context to the format expected by handleReturn
        const returnContext = {
          order_id: response.action_context.order_id,
          email:
            response.action_context.order_email ||
            response.action_context.email,
          reason: returnReason,
          returnReason: returnReason,
        };

        // Call the return handler
        window.VoiceroReturnHandler.handleReturn(returnContext);
      }
    });

    // Also intercept formatted responses that might come in a different event
    document.addEventListener("formatted_response", function (event) {
      const response = event.detail;
      if (
        response &&
        response.action === "return_order" &&
        response.action_context
      ) {
        console.log("Return order action detected from formatted response");

        // Extract return reason from any possible location
        const returnReason =
          response.reason ||
          response.returnReason ||
          (response.action_context && response.action_context.reason) ||
          (response.action_context && response.action_context.returnReason) ||
          "Customer request";

        console.log("Return reason from formatted response:", returnReason);

        const returnContext = {
          order_id: response.action_context.order_id,
          email:
            response.action_context.order_email ||
            response.action_context.email,
          reason: returnReason,
          returnReason: returnReason,
        };

        window.VoiceroReturnHandler.handleReturn(returnContext);
      }
    });
  }
});
