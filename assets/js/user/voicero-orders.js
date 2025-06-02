/**
 * Shopify Proxy Client
 * A JavaScript client for interacting with the Shopify app proxy.
 */

console.log("🔥 SHOPIFY PROXY CLIENT LOADED 🔥");

// Create global namespace for orders data
window.VoiceroOrdersData = {
  initialized: false,
  isLoading: true,
  orders: null,
  lastFetched: null,
  errors: [],
};

const ShopifyProxyClient = {
  config: {
    proxyUrl: "/apps/proxy",
    defaultHeaders: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    debug: true,
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
      console.log("ShopifyProxyClient initialized with config:", this.config);
    }

    return this;
  },

  /**
   * Make a GET request to the proxy
   * @param {Object} params - URL parameters to include in the request
   * @param {Object} options - Additional fetch options
   * @returns {Promise} - The fetch promise
   */
  get: function (params = {}, options = {}) {
    const url = this._buildUrl(params);

    return this._fetch(url, {
      method: "GET",
      ...options,
    });
  },

  /**
   * Make a POST request to the proxy
   * @param {Object} data - The data to send in the request body
   * @param {Object} params - URL parameters to include in the request
   * @param {Object} options - Additional fetch options
   * @returns {Promise} - The fetch promise
   */
  post: function (data = {}, params = {}, options = {}) {
    const url = this._buildUrl(params);

    return this._fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      ...options,
    });
  },

  /**
   * Fetch orders from the proxy and store them in the global VoiceroOrdersData object
   * @returns {Promise} - A promise that resolves with the orders data
   */
  fetchAndLogOrders: function () {
    console.log("Fetching orders from proxy...");

    // Set loading state
    window.VoiceroOrdersData.isLoading = true;

    return this.get()
      .then((response) => {
        if (response.success && response.orders) {
          console.log("Orders received from proxy:", response.orders);

          // Store in global variable
          window.VoiceroOrdersData.orders = response.orders;
          window.VoiceroOrdersData.lastFetched = new Date().toISOString();
          window.VoiceroOrdersData.initialized = true;
          window.VoiceroOrdersData.isLoading = false;

          // Log each order individually for better visibility
          if (response.orders.edges && response.orders.edges.length > 0) {
            console.log(`Found ${response.orders.edges.length} orders:`);

            // Create an HTML element to display orders if on a page with #orders-container
            this.renderOrdersToDOM(response.orders);

            // Log individual orders
            response.orders.edges.forEach((edge, index) => {
              console.log(`Order ${index + 1}:`, edge.node);
            });
          } else {
            console.log("No orders found or unexpected format");
          }

          return response.orders;
        } else {
          console.error(
            "Error in orders response:",
            response.error || "Unknown error",
          );

          window.VoiceroOrdersData.errors.push({
            time: new Date().toISOString(),
            message: response.error || "Unknown error in orders response",
          });
          window.VoiceroOrdersData.isLoading = false;

          throw new Error(response.error || "Failed to fetch orders");
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

    if (!orders.edges || orders.edges.length === 0) {
      container.innerHTML = "<p>No orders found.</p>";
      return;
    }

    const header = document.createElement("h2");
    header.textContent = `Found ${orders.edges.length} orders from the last 20 days`;
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

    orders.edges.forEach((edge) => {
      const order = edge.node;
      const row = document.createElement("tr");

      // Format date
      const date = new Date(order.createdAt);
      const formattedDate = date.toLocaleDateString();

      // Format customer name
      const customer = order.customer
        ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim()
        : "Anonymous";

      // Format price
      const price = order.totalPriceSet?.shopMoney
        ? `${order.totalPriceSet.shopMoney.currencyCode} ${order.totalPriceSet.shopMoney.amount}`
        : "N/A";

      row.innerHTML = `
        <td>${order.name}</td>
        <td>${formattedDate}</td>
        <td>${customer}</td>
        <td>${price}</td>
        <td>${order.displayFulfillmentStatus}</td>
      `;

      tbody.appendChild(row);
    });

    container.appendChild(table);
  },

  /**
   * Build the URL with query parameters
   * @param {Object} params - The parameters to include in the URL
   * @returns {string} - The complete URL with query parameters
   * @private
   */
  _buildUrl: function (params = {}) {
    // Get the current origin to use as base for relative URLs
    const base = window.location.origin;
    console.log(`Using base URL: ${base}`);

    // Handle both absolute and relative URLs
    let fullUrl;
    if (this.config.proxyUrl.startsWith("http")) {
      // Already an absolute URL
      fullUrl = this.config.proxyUrl;
    } else {
      // Relative URL, prepend the origin
      fullUrl = `${base}${this.config.proxyUrl}`;
    }

    console.log(`Constructed full URL: ${fullUrl}`);
    const url = new URL(fullUrl);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return url.toString();
  },

  /**
   * Make a fetch request with error handling
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise} - A promise that resolves with the parsed response
   * @private
   */
  _fetch: function (url, options = {}) {
    const fetchOptions = {
      ...options,
      headers: {
        ...this.config.defaultHeaders,
        ...(options.headers || {}),
      },
    };

    console.log(`🚀 Attempting to fetch from: ${url}`);
    console.log(`With options:`, fetchOptions);

    return fetch(url, fetchOptions)
      .then((response) => {
        console.log(
          `📡 Response status: ${response.status} ${response.statusText}`,
        );

        if (!response.ok) {
          console.error(
            `⚠️ HTTP Error: ${response.status} ${response.statusText}`,
          );
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        console.log(`Content-Type: ${contentType}`);

        if (contentType && contentType.includes("application/json")) {
          return response.json();
        } else {
          return response.text();
        }
      })
      .then((data) => {
        console.log("✅ Received data:", data);
        return data;
      })
      .catch((error) => {
        console.error("❌ Fetch error:", error);
        // Try to provide more helpful error info
        if (
          error.name === "TypeError" &&
          error.message.includes("Failed to fetch")
        ) {
          console.error(
            "This is likely a network issue, CORS problem, or the server is unavailable",
          );
        }
        throw error;
      });
  },
};

// Make globally available
window.ShopifyProxyClient = window.ShopifyProxyClient || ShopifyProxyClient;

console.log("📢 Setting up ShopifyProxyClient...");

// Initialize with debug mode on to log all requests and responses
ShopifyProxyClient.init({ debug: true });

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

// Try to fetch immediately
console.log("🔄 Attempting immediate fetch...");
ShopifyProxyClient.fetchAndLogOrders()
  .then((orders) => {
    console.log("✅ Immediate fetch successful!");
    ensureOrdersContainer();
  })
  .catch((error) => {
    console.error("❌ Error in immediate fetch:", error);
  });

// Also try with DOMContentLoaded for safety
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔄 DOM loaded, ensuring orders container is ready...");
  ensureOrdersContainer();

  // Check if we already have orders, if not try to fetch again
  if (!window.VoiceroOrdersData.orders) {
    ShopifyProxyClient.fetchAndLogOrders()
      .then((orders) => {
        console.log("✅ DOMContentLoaded fetch successful!");
      })
      .catch((error) => {
        console.error("❌ Error in DOMContentLoaded fetch:", error);
      });
  } else {
    console.log("Using previously loaded orders");
    ShopifyProxyClient.renderOrdersToDOM(window.VoiceroOrdersData.orders);
  }
});
