/**
 * WooCommerce Orders Client
 * A JavaScript client for interacting with WooCommerce orders via WordPress AJAX.
 */

console.log("🔥 WOOCOMMERCE ORDERS CLIENT LOADED 🔥");

// Create global namespace for orders data
window.VoiceroOrdersData = {
  initialized: false,
  isLoading: true,
  orders: null,
  lastFetched: null,
  errors: [],
};

const WooOrdersClient = {
  config: {
    ajaxUrl:
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig.ajaxUrl
        : "/wp-admin/admin-ajax.php",
    nonce: typeof voiceroConfig !== "undefined" ? voiceroConfig.nonce : "",
    defaultHeaders: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    debug: true,
    storageKey: "voicero_woo_orders",
    orderDays: 30, // Get orders from the last 30 days
  },

  /**
   * Initialize the client with custom configuration
   * @param {Object} userConfig - Custom configuration to override defaults
   * @returns {Object} - The client instance for chaining
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
      console.log("WooOrdersClient initialized with config:", this.config);
    }

    // Try to load data from localStorage first
    this.loadFromLocalStorage();

    return this;
  },

  /**
   * Load orders from localStorage if available
   */
  loadFromLocalStorage: function () {
    try {
      const storedData = localStorage.getItem(this.config.storageKey);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        // Check if data is still valid (not older than 1 day)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        if (
          parsedData.lastFetched &&
          new Date(parsedData.lastFetched) > oneDayAgo
        ) {
          console.log("Loading orders from localStorage:", parsedData);
          window.VoiceroOrdersData.orders = parsedData.orders;
          window.VoiceroOrdersData.lastFetched = parsedData.lastFetched;
          window.VoiceroOrdersData.initialized = true;
          window.VoiceroOrdersData.isLoading = false;

          // Render orders if there's a container
          this.renderOrdersToDOM(parsedData.orders);
          return true;
        } else {
          console.log("Stored orders are too old, fetching fresh data");
        }
      }
    } catch (e) {
      console.error("Error loading from localStorage:", e);
    }
    return false;
  },

  /**
   * Save orders to localStorage
   * @param {Object} orders - The orders data to save
   */
  saveToLocalStorage: function (orders) {
    try {
      const dataToStore = {
        orders: orders,
        lastFetched: new Date().toISOString(),
      };
      localStorage.setItem(this.config.storageKey, JSON.stringify(dataToStore));
      console.log("Orders saved to localStorage");
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  },

  /**
   * Fetch orders from WordPress using AJAX
   * @returns {Promise} - A promise that resolves with the orders data
   */
  fetchAndLogOrders: function () {
    console.log("Fetching orders from WordPress...");

    // Set loading state
    window.VoiceroOrdersData.isLoading = true;

    // Create form data for the AJAX request
    const formData = new FormData();
    formData.append("action", "voicero_get_woo_orders");
    formData.append("nonce", this.config.nonce);
    formData.append("days", this.config.orderDays);

    return fetch(this.config.ajaxUrl, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((response) => {
        if (response.success && response.data) {
          console.log("Orders received from WordPress:", response.data);

          // Store in global variable
          window.VoiceroOrdersData.orders = response.data;
          window.VoiceroOrdersData.lastFetched = new Date().toISOString();
          window.VoiceroOrdersData.initialized = true;
          window.VoiceroOrdersData.isLoading = false;

          // Save to localStorage
          this.saveToLocalStorage(response.data);

          // Create an HTML element to display orders if on a page with #orders-container
          this.renderOrdersToDOM(response.data);

          return response.data;
        } else {
          console.error(
            "Error in orders response:",
            response.data || "Unknown error"
          );

          window.VoiceroOrdersData.errors.push({
            time: new Date().toISOString(),
            message: response.data || "Unknown error in orders response",
          });
          window.VoiceroOrdersData.isLoading = false;

          throw new Error(response.data || "Failed to fetch orders");
        }
      })
      .catch((error) => {
        console.error("Failed to fetch orders:", error);

        window.VoiceroOrdersData.errors.push({
          time: new Date().toISOString(),
          message: error.message || "Failed to fetch orders",
        });
        window.VoiceroOrdersData.isLoading = false;

        throw error;
      });
  },

  /**
   * Render orders to the DOM if a container exists
   * @param {Object} orders - The orders data
   */
  renderOrdersToDOM: function (orders) {
    const container = document.getElementById("orders-container");
    if (!container) return;

    container.innerHTML = "";

    if (!orders || orders.length === 0) {
      container.innerHTML = "<p>No orders found.</p>";
      return;
    }

    const header = document.createElement("h2");
    header.textContent = `Found ${orders.length} orders from the last ${this.config.orderDays} days`;
    container.appendChild(header);

    const table = document.createElement("table");
    table.className = "orders-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Customer</th>
          <th>Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;

    const tbody = table.querySelector("tbody");

    orders.forEach((order) => {
      const row = document.createElement("tr");

      // Format date
      const date = new Date(order.date_created);
      const formattedDate = date.toLocaleDateString();

      // Format customer name
      const customer = order.billing
        ? `${order.billing.first_name || ""} ${
            order.billing.last_name || ""
          }`.trim()
        : "Anonymous";

      // Format price
      const price = `${order.currency} ${order.total}`;

      row.innerHTML = `
        <td>${order.number}</td>
        <td>${formattedDate}</td>
        <td>${customer}</td>
        <td>${price}</td>
        <td>${order.status}</td>
      `;

      tbody.appendChild(row);
    });

    container.appendChild(table);
  },
};

// Make globally available
window.WooOrdersClient = window.WooOrdersClient || WooOrdersClient;

console.log("📢 Setting up WooOrdersClient...");

// Initialize with debug mode on to log all requests and responses
WooOrdersClient.init({ debug: true });

// Create a div for orders if needed
function ensureOrdersContainer() {
  let container = document.getElementById("orders-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "orders-container";
    container.style.cssText =
      "margin: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px;";

    // Add some basic styling for the orders table
    const style = document.createElement("style");
    style.textContent = `
      .orders-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .orders-table th, .orders-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      .orders-table th {
        background-color: #f8f9fa;
        font-weight: 600;
      }
      .orders-table tr:hover {
        background-color: #f1f1f1;
      }
    `;
    document.head.appendChild(style);

    // Try to append to a content area or body
    const content =
      document.querySelector(".content") ||
      document.querySelector("main") ||
      document.body;
    content.appendChild(container);
  }
  return container;
}

// Try to fetch immediately if localStorage doesn't have valid data
console.log("🔄 Attempting immediate fetch or localStorage load...");
if (!WooOrdersClient.loadFromLocalStorage()) {
  WooOrdersClient.fetchAndLogOrders()
    .then((orders) => {
      console.log("✅ Immediate fetch successful!");
      ensureOrdersContainer();
    })
    .catch((error) => {
      console.error("❌ Error in immediate fetch:", error);
    });
} else {
  console.log("✅ Loaded from localStorage successfully!");
  ensureOrdersContainer();
}

// Also try with DOMContentLoaded for safety
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔄 DOM loaded, ensuring orders container is ready...");
  ensureOrdersContainer();

  // Check if we already have orders, if not try to fetch again
  if (!window.VoiceroOrdersData.orders) {
    WooOrdersClient.fetchAndLogOrders()
      .then((orders) => {
        console.log("✅ DOMContentLoaded fetch successful!");
      })
      .catch((error) => {
        console.error("❌ Error in DOMContentLoaded fetch:", error);
      });
  } else {
    console.log("Using previously loaded orders");
    WooOrdersClient.renderOrdersToDOM(window.VoiceroOrdersData.orders);
  }
});
