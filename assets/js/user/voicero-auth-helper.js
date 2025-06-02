/**
 * VoiceroAI Authentication Helper
 * Provides more reliable login detection for Shopify storefronts
 */

(function () {
  // Create global namespace for auth helper
  window.VoiceroAuthHelper = {
    isLoggedIn: false,
    customer: null,
    isChecking: false,
    lastCheck: 0,
    cacheTime: 5 * 60 * 1000, // 5 minutes

    /**
     * Check if the user is logged in using multiple methods
     * @returns {Promise<boolean>} Promise resolving to login status
     */
    checkLoginStatus: async function () {
      console.log("VoiceroAuthHelper: Checking login status");

      // Don't check too frequently
      if (this.isChecking) {
        console.log("VoiceroAuthHelper: Already checking login status");
        return this.isLoggedIn;
      }

      const now = Date.now();
      if (now - this.lastCheck < this.cacheTime && this.lastCheck > 0) {
        console.log(
          "VoiceroAuthHelper: Using cached login status:",
          this.isLoggedIn,
        );
        return this.isLoggedIn;
      }

      this.isChecking = true;

      try {
        // Method 1: Check for visible login/logout links in the DOM
        const accountLinks = document.querySelectorAll('a[href*="/account"]');
        const logoutLinks = document.querySelectorAll('a[href*="/logout"]');

        // If there are logout links, user is likely logged in
        if (logoutLinks.length > 0) {
          console.log(
            "VoiceroAuthHelper: Found logout links, user is logged in",
          );
          this.isLoggedIn = true;
          this.isChecking = false;
          this.lastCheck = now;
          return true;
        }

        // Check for account links that don't contain "login" or "register"
        const customerAccountLink = Array.from(accountLinks).find(
          (link) =>
            !link.href.includes("login") && !link.href.includes("register"),
        );

        if (customerAccountLink) {
          console.log(
            "VoiceroAuthHelper: Found account link, user is likely logged in",
          );
          this.isLoggedIn = true;
          this.isChecking = false;
          this.lastCheck = now;
          return true;
        }

        // Method 2: Check cookies for customer session indicators
        const cookies = document.cookie;
        if (
          cookies.includes("_shopify_customer_") ||
          cookies.includes("_secure_session_id")
        ) {
          console.log(
            "VoiceroAuthHelper: Found customer session cookie, user is logged in",
          );
          this.isLoggedIn = true;
          this.isChecking = false;
          this.lastCheck = now;
          return true;
        }

        // Method 3: Try to access customer data via window.Shopify
        if (window.Shopify && window.Shopify.customer) {
          console.log(
            "VoiceroAuthHelper: Found Shopify.customer, user is logged in",
          );
          this.customer = window.Shopify.customer;
          this.isLoggedIn = true;
          this.isChecking = false;
          this.lastCheck = now;
          return true;
        }

        // Method 4: Check if there are customer-specific elements on the page
        const customerGreeting = document.querySelector(
          ".customer-greeting, .customer-name, .account-name",
        );
        if (customerGreeting) {
          console.log(
            "VoiceroAuthHelper: Found customer greeting element, user is likely logged in",
          );
          this.isLoggedIn = true;
          this.isChecking = false;
          this.lastCheck = now;
          return true;
        }

        // If all methods fail, user is probably not logged in
        console.log(
          "VoiceroAuthHelper: No login indicators found, user is likely not logged in",
        );
        this.isLoggedIn = false;
        this.isChecking = false;
        this.lastCheck = now;
        return false;
      } catch (error) {
        console.error("VoiceroAuthHelper: Error checking login status", error);
        this.isChecking = false;
        return this.isLoggedIn; // Return last known state on error
      }
    },

    /**
     * Initialize the auth helper and perform initial check
     */
    init: function () {
      console.log("VoiceroAuthHelper: Initializing");

      // Run an initial check
      this.checkLoginStatus().then((isLoggedIn) => {
        console.log(
          "VoiceroAuthHelper: Initial login check complete, logged in:",
          isLoggedIn,
        );

        // If we find the user is logged in but VoiceroUserData thinks they're not,
        // we'll try to update VoiceroUserData
        if (
          isLoggedIn &&
          window.VoiceroUserData &&
          window.VoiceroUserData.isLoggedIn === false
        ) {
          console.log(
            "VoiceroAuthHelper: Updating VoiceroUserData login status",
          );
          window.VoiceroUserData.isLoggedIn = true;

          // If VoiceroUserData has customer data capabilities, try to update
          if (
            typeof window.VoiceroUserData.sendCustomerDataToApi ===
              "function" &&
            !window.VoiceroUserData.dataSent
          ) {
            window.VoiceroUserData.customer =
              window.VoiceroUserData.customer || {};
            window.VoiceroUserData.customer.logged_in = true;

            console.log(
              "VoiceroAuthHelper: Sending updated customer data to API",
            );
            window.VoiceroUserData.sendCustomerDataToApi({
              customer: window.VoiceroUserData.customer,
              cart: window.VoiceroUserData.cart,
              isLoggedIn: true,
            });
          }
        }
      });
    },
  };

  // Initialize immediately if VoiceroUserData is already loaded
  if (window.VoiceroUserData && window.VoiceroUserData.isInitialized) {
    window.VoiceroAuthHelper.init();
  } else {
    // Otherwise wait for DOMContentLoaded to ensure it's loaded
    document.addEventListener("DOMContentLoaded", function () {
      // Check if VoiceroUserData is ready, if not wait a bit
      if (window.VoiceroUserData && window.VoiceroUserData.isInitialized) {
        window.VoiceroAuthHelper.init();
      } else {
        // Wait a bit for VoiceroUserData to initialize
        setTimeout(function () {
          if (window.VoiceroUserData) {
            window.VoiceroAuthHelper.init();
          }
        }, 1000);
      }
    });
  }
})();
