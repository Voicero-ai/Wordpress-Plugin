/**
 * VoiceroAI Second Look Module
 * This module examines the current webpage for product URLs and form elements,
 * then sends this data to the API for analysis.
 */

(function (window, document) {
  // DEVELOPMENT MODE - Set to true during local testing, false for production
  const DEVELOPMENT_MODE = false;
  const DEV_API_URL = "https://www.voicero.a";
  const PROD_API_URL = "http://localhost:3000";

  // DEBUG MODE - When true, logs data but doesn't send API requests
  const DEBUG_MODE = false;

  // Create a minimal jQuery-like fallback when jQuery is not available
  const $ =
    window.jQuery ||
    function (selector) {
      // Return a simple object that implements a ready method
      return {
        ready: function (fn) {
          if (document.readyState !== "loading") {
            setTimeout(fn, 0);
          } else {
            document.addEventListener("DOMContentLoaded", fn);
          }
        },
      };
    };

  const VoiceroSecond = {
    isInitialized: false,
    currentUrl: window.location.href,

    // Initialize on page load
    init: function () {
      if (this.isInitialized) return;

      console.log("VoiceroSecond: Initializing Second Look module");
      this.isInitialized = true;

      // Set up global reference
      window.VoiceroSecond = this;

      // Check if we should run analysis (wait for session to load)
      this.checkSessionAndAnalyze();

      // Set up listener for URL changes (for SPAs)
      this.setupUrlChangeListener();
    },

    // Check if the session has threads with messages before analyzing
    checkSessionAndAnalyze: function () {
      try {
        // If VoiceroCore isn't initialized yet, wait a bit
        if (!window.VoiceroCore || !window.VoiceroCore.session) {
          console.log(
            "VoiceroSecond: Waiting for session to be initialized..."
          );
          setTimeout(() => this.checkSessionAndAnalyze(), 2000);
          return;
        }

        // Check if there are threads with messages in the session
        const hasThreadsWithMessages = this.hasActiveConversation();

        if (hasThreadsWithMessages) {
          console.log(
            "VoiceroSecond: Active conversation found, proceeding with analysis"
          );
          // Run analysis when we know there's an active conversation
          this.analyzeCurrentPage();
        } else {
          console.log(
            "VoiceroSecond: No active conversation found, skipping analysis"
          );
        }
      } catch (error) {
        console.error("VoiceroSecond: Error checking session:", error);
      }
    },

    // Check if there are threads with messages in the session
    hasActiveConversation: function () {
      // Make sure we have VoiceroCore with a session
      if (!window.VoiceroCore || !window.VoiceroCore.session) {
        return false;
      }

      const session = window.VoiceroCore.session;

      // Check if threads array exists and has items
      if (
        !session.threads ||
        !Array.isArray(session.threads) ||
        session.threads.length === 0
      ) {
        console.log("VoiceroSecond: No threads found in session");
        return false;
      }

      // Check each thread for messages
      for (const thread of session.threads) {
        // Check if the thread has messages
        if (
          thread.messages &&
          Array.isArray(thread.messages) &&
          thread.messages.length > 0
        ) {
          console.log(
            `VoiceroSecond: Found thread with ${thread.messages.length} messages`
          );
          return true;
        }

        // Alternative: check if there's a count of messages
        if (thread.messageCount && thread.messageCount > 0) {
          console.log(
            `VoiceroSecond: Found thread with messageCount ${thread.messageCount}`
          );
          return true;
        }
      }

      console.log("VoiceroSecond: No threads with messages found");
      return false;
    },

    // Set up a listener to detect URL changes in single-page applications
    setupUrlChangeListener: function () {
      // Check for URL changes every second
      setInterval(() => {
        if (window.location.href !== this.currentUrl) {
          this.currentUrl = window.location.href;
          console.log("VoiceroSecond: URL changed, analyzing page");

          // Only analyze if there's an active conversation
          if (this.hasActiveConversation()) {
            // Wait a moment for the page to update
            setTimeout(() => this.analyzeCurrentPage(), 1000);
          } else {
            console.log(
              "VoiceroSecond: URL changed but no active conversation, skipping analysis"
            );
          }
        }
      }, 1000);
    },

    // Analyze the current page
    analyzeCurrentPage: function () {
      try {
        console.log("VoiceroSecond: Analyzing current page");

        // Collect comprehensive website data
        const websiteData = this.collectWebsiteData();

        // Ensure we have valid data object with defaults for missing properties
        const safeData = websiteData || {};

        // Log detailed page data for debugging with safe access
        console.log("VoiceroSecond: Collected page data details:", {
          url: safeData.url || window.location.href,
          path: safeData.path || "",
          isProductPage: safeData.isProductPage || false,
          formCount:
            safeData.forms && Array.isArray(safeData.forms)
              ? safeData.forms.length
              : 0,
          inputCount:
            safeData.inputs && Array.isArray(safeData.inputs)
              ? safeData.inputs.length
              : 0,
          headings: safeData.headings || {},
          productInfo: safeData.productInfo || {},
        });

        // Check if this is a relevant page to analyze
        if (this.shouldAnalyzePage(websiteData)) {
          console.log("VoiceroSecond: Page is relevant for analysis");
          this.sendDataToApi(websiteData);
        } else {
          console.log(
            "VoiceroSecond: Page not relevant for analysis, skipping"
          );
        }
      } catch (error) {
        console.error("VoiceroSecond: Error analyzing page:", error);
      }
    },

    // Determine if the current page is a product page
    isProductPage: function () {
      const url = window.location.href.toLowerCase();

      // Check URL patterns
      const hasProductInUrl =
        url.includes("/product/") ||
        url.includes("/products/") ||
        url.includes("product=") ||
        url.includes("?p=");

      // Check for product schema markup
      const hasProductSchema =
        document.querySelector('[itemtype*="Product"]') !== null;

      // Check for common product page elements - fixed jQuery-specific selector
      const hasAddToCartButton =
        document.querySelector('[name="add"]') !== null ||
        document.querySelector('[id*="add-to-cart"]') !== null ||
        document.querySelector('[class*="add-to-cart"]') !== null ||
        Array.from(document.querySelectorAll("button")).some((button) =>
          button.textContent.toLowerCase().includes("add to cart")
        );

      // Check for price elements
      const hasPriceElements =
        document.querySelector('[class*="price"]') !== null ||
        document.querySelector('[id*="price"]') !== null ||
        document.querySelector(".price") !== null;

      return (
        hasProductInUrl ||
        hasProductSchema ||
        (hasAddToCartButton && hasPriceElements)
      );
    },

    // Find form elements on the page
    findFormElements: function () {
      try {
        // Get all forms and create an empty array if none found
        const forms = Array.from(document.querySelectorAll("form") || []);

        // If no forms, return empty array immediately
        if (!forms || forms.length === 0) {
          console.log("VoiceroSecond: No forms found on page");
          return [];
        }

        // Filter out forms in headers, navigation, search bars, and footers
        const relevantForms = forms.filter((form) => {
          try {
            // Safety checks for null/undefined form
            if (!form) return false;

            // Check if form is in header, nav, search or footer elements
            const isInHeader = this.isElementInSection(form, [
              "header",
              '[class*="header"]',
              ".site-header",
              "#shopify-section-header",
            ]);
            const isInNav = this.isElementInSection(form, [
              "nav",
              '[class*="nav"]',
              ".navigation",
              ".main-nav",
            ]);
            const isInFooter = this.isElementInSection(form, [
              "footer",
              '[class*="footer"]',
              ".site-footer",
              "#shopify-section-footer",
            ]);

            // Check if form is a search form - with extra null checks
            const isSearchForm =
              (form.classList &&
                typeof form.classList.contains === "function" &&
                form.classList.contains("search")) ||
              (form.id &&
                typeof form.id === "string" &&
                form.id.toLowerCase().includes("search")) ||
              (form.action &&
                typeof form.action === "string" &&
                form.action.toLowerCase().includes("search")) ||
              (form.querySelector &&
                form.querySelector('input[type="search"]') !== null);

            // Log why forms are being excluded
            if (isInHeader || isInNav || isInFooter || isSearchForm) {
              console.log("VoiceroSecond: Excluding form:", {
                id: form.id ? String(form.id) : "(no id)",
                classes: form.className
                  ? String(form.className)
                  : "(no classes)",
                inHeader: isInHeader,
                inNav: isInNav,
                inFooter: isInFooter,
                isSearchForm: isSearchForm,
              });
              return false;
            }

            return true;
          } catch (error) {
            console.error("VoiceroSecond: Error filtering form:", error);
            return false;
          }
        });

        return relevantForms.map((form) => {
          try {
            return {
              id: form.id ? String(form.id) : "",
              action: form.action ? String(form.action) : "",
              method: form.method ? String(form.method) : "",
              classes: form.className ? String(form.className) : "",
              inputCount: form.querySelectorAll
                ? form.querySelectorAll("input").length
                : 0,
              hasSubmitButton:
                (form.querySelector &&
                  form.querySelector('button[type="submit"]') !== null) ||
                (form.querySelector &&
                  form.querySelector('input[type="submit"]') !== null),
            };
          } catch (error) {
            console.error("VoiceroSecond: Error mapping form:", error);
            return {
              id: "",
              error: error.toString(),
            };
          }
        });
      } catch (error) {
        console.error("VoiceroSecond: Error finding form elements:", error);
        return [];
      }
    },

    // Helper to check if element is inside a particular section
    isElementInSection: function (element, sectionSelectors) {
      try {
        if (!element || !sectionSelectors || !Array.isArray(sectionSelectors)) {
          return false;
        }

        let parent = element;
        while (parent && parent !== document.body) {
          for (const selector of sectionSelectors) {
            if (
              parent.matches &&
              typeof parent.matches === "function" &&
              parent.matches(selector)
            ) {
              return true;
            }
            // For older browsers that don't support matches
            if (
              parent.querySelector &&
              typeof parent.querySelector === "function" &&
              parent.querySelector(selector) === parent
            ) {
              return true;
            }
          }
          parent = parent.parentElement;
        }
        return false;
      } catch (error) {
        console.error("VoiceroSecond: Error in isElementInSection:", error);
        return false;
      }
    },

    // Find input elements on the page
    findInputElements: function () {
      try {
        const inputs = Array.from(
          document.querySelectorAll("input, textarea, select") || []
        );

        // If no inputs, return empty array immediately
        if (!inputs || inputs.length === 0) {
          return [];
        }

        // Filter out inputs in headers, navigation, search bars, and footers
        const relevantInputs = inputs.filter((input) => {
          try {
            // Safety checks for null/undefined input
            if (!input) return false;

            // Check if input is in header, nav, search or footer elements
            const isInHeader = this.isElementInSection(input, [
              "header",
              '[class*="header"]',
              ".site-header",
              "#shopify-section-header",
            ]);
            const isInNav = this.isElementInSection(input, [
              "nav",
              '[class*="nav"]',
              ".navigation",
              ".main-nav",
            ]);
            const isInFooter = this.isElementInSection(input, [
              "footer",
              '[class*="footer"]',
              ".site-footer",
              "#shopify-section-footer",
            ]);

            // Check if input is a search input with extra null checks
            const isSearchInput =
              input.type === "search" ||
              (input.id &&
                typeof input.id === "string" &&
                input.id.toLowerCase().includes("search")) ||
              (input.name &&
                typeof input.name === "string" &&
                input.name.toLowerCase().includes("search")) ||
              (input.classList &&
                typeof input.classList.contains === "function" &&
                input.classList.contains("search"));

            return !(isInHeader || isInNav || isInFooter || isSearchInput);
          } catch (error) {
            console.error("VoiceroSecond: Error filtering input:", error);
            return false;
          }
        });

        return relevantInputs.map((input) => {
          try {
            return {
              type: input.type ? String(input.type) : "",
              id: input.id ? String(input.id) : "",
              name: input.name ? String(input.name) : "",
              placeholder: input.placeholder ? String(input.placeholder) : "",
              label: this.findLabelForInput(input),
            };
          } catch (error) {
            console.error("VoiceroSecond: Error mapping input:", error);
            return {
              type: "",
              error: error.toString(),
            };
          }
        });
      } catch (error) {
        console.error("VoiceroSecond: Error finding input elements:", error);
        return [];
      }
    },

    // Find the label associated with an input
    findLabelForInput: function (input) {
      // Check for explicit label
      if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.textContent.trim();
      }

      // Check for parent label
      let el = input;
      while (el && el.tagName !== "LABEL" && el.tagName !== "BODY") {
        el = el.parentElement;
      }

      if (el && el.tagName === "LABEL") {
        return el.textContent.trim();
      }

      return null;
    },

    // Collect metadata from the page
    collectPageMetadata: function () {
      return {
        title: document.title,
        description: this.getMetaContent("description"),
        keywords: this.getMetaContent("keywords"),
        h1: this.getElementText("h1"),
        h2: this.getElementsText("h2", 3), // Get first 3 h2s
        visibleText: this.getVisibleText(),
      };
    },

    // Get content from a meta tag
    getMetaContent: function (name) {
      const metaTag = document.querySelector(`meta[name="${name}"]`);
      return metaTag ? metaTag.getAttribute("content") : null;
    },

    // Get text from an element
    getElementText: function (selector) {
      const element = document.querySelector(selector);
      return element ? element.textContent.trim() : null;
    },

    // Get text from multiple elements
    getElementsText: function (selector, limit) {
      const elements = Array.from(document.querySelectorAll(selector)).slice(
        0,
        limit
      );
      return elements.map((el) => el.textContent.trim());
    },

    // Get visible text from the page (simplified)
    getVisibleText: function () {
      // Get main content area if possible, otherwise body
      const mainContent =
        document.querySelector("main") ||
        document.querySelector("#main") ||
        document.querySelector(".main-content") ||
        document.body;

      let text = mainContent.textContent;
      // Clean up the text
      text = text.replace(/\s+/g, " ").trim();
      // Return full text content
      return text;
    },

    // Collect comprehensive website data
    collectWebsiteData: function () {
      try {
        return {
          // Basic URL and location data
          url: window.location.href,
          fullUrl: window.location.toString(),
          path: window.location.pathname,
          hostname: window.location.hostname,

          // Page content
          title: document.title,
          fullText: this.getVisibleText(),

          // Meta information
          metaTags: this.getAllMetaTags(),

          // Page structure
          headings: this.getAllHeadings(),

          // Product-specific data
          isProductPage: this.isProductPage(),
          productInfo: this.extractProductInfo(),

          // Form and input data
          forms: this.findFormElements(),
          inputs: this.findInputElements(),

          // Navigation context
          links: this.getPageLinks(),

          // Time data
          timestamp: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      } catch (error) {
        console.error("VoiceroSecond: Error collecting website data:", error);
        // Return minimal data if there's an error
        return {
          url: window.location.href,
          error: error.toString(),
          timestamp: new Date().toISOString(),
        };
      }
    },

    // Get all meta tags
    getAllMetaTags: function () {
      const metaTags = Array.from(document.querySelectorAll("meta"));
      return metaTags.map((tag) => {
        const data = {};
        for (const attr of tag.attributes) {
          data[attr.name] = attr.value;
        }
        return data;
      });
    },

    // Get all headings
    getAllHeadings: function () {
      const headings = {};
      ["h1", "h2", "h3"].forEach((tag) => {
        headings[tag] = Array.from(document.querySelectorAll(tag))
          .map((el) => el.textContent.trim())
          .filter((text) => text);
      });
      return headings;
    },

    // Extract product information if available
    extractProductInfo: function () {
      // Default empty product data
      const productData = {
        name: null,
        price: null,
        currency: null,
        description: null,
        images: [],
        sku: null,
        inStock: null,
      };

      // Try to get product data from schema.org markup
      const jsonLdElements = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (const element of jsonLdElements) {
        try {
          const data = JSON.parse(element.textContent);
          if (
            data["@type"] === "Product" ||
            (data["@graph"] &&
              data["@graph"].some((item) => item["@type"] === "Product"))
          ) {
            const product =
              data["@type"] === "Product"
                ? data
                : data["@graph"].find((item) => item["@type"] === "Product");

            if (product) {
              productData.name = product.name || productData.name;

              if (product.offers) {
                const offers = Array.isArray(product.offers)
                  ? product.offers[0]
                  : product.offers;
                productData.price = offers.price || productData.price;
                productData.currency =
                  offers.priceCurrency || productData.currency;
                productData.inStock =
                  offers.availability === "http://schema.org/InStock" ||
                  productData.inStock;
              }

              productData.description =
                product.description || productData.description;
              productData.sku = product.sku || productData.sku;

              if (product.image) {
                productData.images = Array.isArray(product.image)
                  ? product.image
                  : [product.image];
              }
            }
          }
        } catch (e) {
          console.error("Error parsing JSON-LD:", e);
        }
      }

      // Try alternate methods if schema data wasn't found
      if (!productData.name) {
        // Look for common product name elements
        const possibleNameElements = [
          document.querySelector("h1.product-title"),
          document.querySelector("h1.product-name"),
          document.querySelector(".product-single__title"),
          document.querySelector("[data-product-title]"),
          document.querySelector(".product_title"),
        ];

        for (const element of possibleNameElements) {
          if (element && element.textContent.trim()) {
            productData.name = element.textContent.trim();
            break;
          }
        }
      }

      // Look for prices if not found in schema
      if (!productData.price) {
        // Look for common price elements
        const possiblePriceElements = [
          document.querySelector(".product-price"),
          document.querySelector(".price"),
          document.querySelector("[data-product-price]"),
          document.querySelector(".current-price"),
        ];

        for (const element of possiblePriceElements) {
          if (element && element.textContent.trim()) {
            // Extract numbers from the price string
            const priceText = element.textContent.trim();
            const priceMatch = priceText.match(/[\d.,]+/);
            if (priceMatch) {
              productData.price = priceMatch[0].replace(/[^\d.]/g, "");

              // Try to determine currency
              const currencySymbol = priceText.replace(/[\d., ]/g, "")[0];
              if (currencySymbol) {
                const currencyMap = {
                  $: "USD",
                  "€": "EUR",
                  "£": "GBP",
                  "¥": "JPY",
                  "₹": "INR",
                };
                productData.currency =
                  currencyMap[currencySymbol] || currencySymbol;
              }

              break;
            }
          }
        }
      }

      return productData;
    },

    // Get page links
    getPageLinks: function () {
      const links = Array.from(document.querySelectorAll("a[href]"))
        .slice(0, 20) // Limit to first 20 links
        .map((link) => {
          return {
            text: link.textContent.trim(),
            href: link.href,
            isInternal: link.href.includes(window.location.hostname),
          };
        });

      return links;
    },

    // Determine if the page should be analyzed
    shouldAnalyzePage: function (websiteData) {
      try {
        // Ensure we have a valid data object
        if (!websiteData) {
          console.log("VoiceroSecond: No website data available for analysis");
          return false;
        }

        // Log each check individually to see which one is triggering

        // Check if it's a product page - ALWAYS analyze product pages
        const isProductPage = websiteData.isProductPage || false;
        console.log("VoiceroSecond: Is product page?", isProductPage);
        if (isProductPage) {
          console.log("VoiceroSecond: This is a product page - will analyze");
          return true;
        }

        // Check if it has forms with submit buttons (potential checkout or contact forms)
        const forms = websiteData.forms || [];
        const hasFormsWithSubmit =
          Array.isArray(forms) &&
          forms.some((form) => form && form.hasSubmitButton);
        console.log(
          "VoiceroSecond: Has forms with submit buttons?",
          hasFormsWithSubmit
        );

        // Only log forms if there are any
        if (Array.isArray(forms) && forms.length > 0) {
          console.log("VoiceroSecond: Forms found:", forms);
        }

        if (hasFormsWithSubmit) {
          console.log(
            "VoiceroSecond: Found forms with submit buttons - will analyze"
          );
          return true;
        }

        // Check specifically for checkout pages - ALWAYS analyze checkout pages
        const url = (websiteData.url || window.location.href).toLowerCase();
        if (url.includes("checkout") || url.includes("cart")) {
          console.log(
            "VoiceroSecond: This is a checkout/cart page - will analyze"
          );
          return true;
        }

        // We don't need to analyze collection pages without specific forms
        // Search pages are also not relevant unless they have specific product data
        if (
          url.includes("collection") ||
          url.includes("collections") ||
          url.includes("search")
        ) {
          // Unless it has significant number of input fields (for potential filtering)
          const inputs = websiteData.inputs || [];
          const hasMultipleInputs = Array.isArray(inputs) && inputs.length > 3;

          if (!hasMultipleInputs) {
            console.log(
              "VoiceroSecond: This is a collection/search page without significant forms - skipping"
            );
            return false;
          }
        }

        // Check if it has a significant number of input fields
        const inputs = websiteData.inputs || [];
        const hasMultipleInputs = Array.isArray(inputs) && inputs.length > 3;
        console.log(
          "VoiceroSecond: Has multiple inputs?",
          hasMultipleInputs,
          `(found ${Array.isArray(inputs) ? inputs.length : 0})`
        );

        if (Array.isArray(inputs) && inputs.length > 0) {
          console.log("VoiceroSecond: Input fields found:", inputs);
        }

        if (hasMultipleInputs) {
          console.log(
            "VoiceroSecond: Found multiple input fields - will analyze"
          );
          return true;
        }

        console.log(
          "VoiceroSecond: None of the analysis criteria matched for this page - skipping"
        );
        return false;
      } catch (error) {
        console.error(
          "VoiceroSecond: Error determining if page should be analyzed:",
          error
        );
        return false;
      }
    },

    // Send the collected data to the API
    sendDataToApi: function (websiteData) {
      console.log("VoiceroSecond: Sending data to API");

      // Double-check we have an active conversation before sending
      if (!this.hasActiveConversation()) {
        console.log("VoiceroSecond: No active conversation, aborting API call");
        return;
      }

      // Get session ID from VoiceroCore if available
      const sessionId =
        window.VoiceroCore && window.VoiceroCore.sessionId
          ? window.VoiceroCore.sessionId
          : localStorage.getItem("voicero_session_id");

      if (!sessionId) {
        console.warn(
          "VoiceroSecond: No session ID available, cannot send data to API"
        );
        return;
      }

      // TESTING: Force localhost URL for testing
      let apiBaseUrl = DEVELOPMENT_MODE ? DEV_API_URL : PROD_API_URL;

      // Log what VoiceroCore's apiBaseUrl is to debug
      if (window.VoiceroCore) {
        console.log(
          "VoiceroSecond: VoiceroCore.apiBaseUrl =",
          window.VoiceroCore.apiBaseUrl
        );
      }

      // Only use VoiceroCore's URL if we're not in development mode
      // This ensures we always use localhost during testing
      if (
        !DEVELOPMENT_MODE &&
        window.VoiceroCore &&
        window.VoiceroCore.apiBaseUrl
      ) {
        apiBaseUrl = window.VoiceroCore.apiBaseUrl;
      }

      console.log("VoiceroSecond: Using API base URL:", apiBaseUrl);

      const apiUrl = `/wp-json/voicero/v1/wordpress/secondLook`;
      console.log("VoiceroSecond: Full API URL:", apiUrl);

      // Get auth headers from config if available
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(window.voiceroConfig?.getAuthHeaders
          ? window.voiceroConfig.getAuthHeaders()
          : {}),
      };

      // Create the request payload
      const payload = {
        sessionId: sessionId,
        websitePageData: websiteData,
        url: window.location.href,
        textContent: this.getVisibleText(),
        timestamp: new Date().toISOString(),
      };

      console.log("VoiceroSecond: Prepared payload for API", {
        sessionId,
        url: payload.url,
        isProductPage: websiteData.isProductPage,
        textContentLength: payload.textContent.length,
      });

      // In DEBUG_MODE, log but don't send the API request
      if (DEBUG_MODE) {
        console.log("VoiceroSecond: DEBUG MODE - Skipping API request", {
          url: apiUrl,
          method: "POST",
          headers: headers,
          payload: payload,
        });

        // Don't save page data to the thread anymore
        return;
      }

      // Send the request
      fetch(apiUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `API request failed with status ${response.status}`
            );
          }
          return response.json();
        })
        .then((data) => {
          console.log("VoiceroSecond: API response received", data);

          // Store the analysis result for potential future use
          this.latestAnalysis = data;

          // Make the analysis available to other Voicero modules
          if (window.VoiceroCore) {
            window.VoiceroCore.secondLookData = data;
          }

          // Extract the AI message from the response
          let aiMessage = "";
          if (data && data.response && data.response.answer) {
            aiMessage = data.response.answer;
          } else if (typeof data === "string") {
            // Handle case where the response might be a direct string
            aiMessage = data;
          }

          // If we have an AI message, add it to the interfaces and thread
          if (aiMessage) {
            // Add the message to VoiceroText and VoiceroVoice interfaces
            if (window.VoiceroText && window.VoiceroText.addMessage) {
              window.VoiceroText.addMessage(aiMessage, "assistant");
            }

            if (window.VoiceroVoice && window.VoiceroVoice.addMessage) {
              window.VoiceroVoice.addMessage(aiMessage, "assistant");
            }

            // Add the message to the current thread in memory
            if (
              window.VoiceroCore &&
              window.VoiceroCore.session &&
              window.VoiceroCore.session.threads
            ) {
              const threads = window.VoiceroCore.session.threads;
              if (threads.length > 0) {
                const currentThread = threads[0];

                // Create an assistant message object
                const assistantMessage = {
                  id: this.generateUUID(),
                  threadId: currentThread.id,
                  role: "assistant",
                  content: aiMessage,
                  pageUrl: window.location.href,
                  createdAt: new Date().toISOString(),
                };

                // Add the message to the thread
                if (!currentThread.messages) {
                  currentThread.messages = [];
                }

                currentThread.messages.push(assistantMessage);

                // Update lastMessageAt timestamp
                currentThread.lastMessageAt = new Date().toISOString();

                console.log(
                  "VoiceroSecond: Added AI assistant message to thread",
                  {
                    threadId: currentThread.id,
                    messageId: assistantMessage.id,
                  }
                );

                // Force VoiceroCore to update its state to reflect our changes
                if (window.VoiceroCore.updateState) {
                  window.VoiceroCore.updateState();
                }

                // Update the session on the server with this message
                this.updateSessionWithMessage(assistantMessage);
              }
            }
          }

          // Do NOT save page data to the thread
        })
        .catch((error) => {
          console.error("VoiceroSecond: API request failed", error);

          // Do NOT save page data to the thread on error
        });
    },

    // Generate a UUID for messages (needed for message IDs)
    generateUUID: function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      );
    },

    // Update the session with a single message on the server
    updateSessionWithMessage: function (message) {
      try {
        // Only proceed if we have VoiceroCore, a sessionId, and a valid message
        if (!window.VoiceroCore || !window.VoiceroCore.sessionId || !message) {
          return;
        }

        // Get API base URL - use development URL if in dev mode
        const apiBaseUrl = DEVELOPMENT_MODE
          ? DEV_API_URL
          : window.VoiceroCore.apiBaseUrl || PROD_API_URL;

        // Prepare the message API endpoint
        const messageEndpoint = `${apiBaseUrl}/api/session/message`;

        console.log("VoiceroSecond: Updating session with assistant message", {
          endpoint: messageEndpoint,
          sessionId: window.VoiceroCore.sessionId,
          messageId: message.id,
        });

        // Send the message to the API
        fetch(messageEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(window.voiceroConfig?.getAuthHeaders
              ? window.voiceroConfig.getAuthHeaders()
              : {}),
          },
          body: JSON.stringify({
            sessionId: window.VoiceroCore.sessionId,
            message: message,
          }),
        })
          .then((response) => {
            console.log(
              "VoiceroSecond: Assistant message update response status:",
              response.status
            );
            if (!response.ok) {
              throw new Error(
                `Session message update failed: ${response.status}`
              );
            }
            return response.json();
          })
          .then((data) => {
            console.log(
              "VoiceroSecond: Session updated successfully with assistant message",
              data
            );
          })
          .catch((error) => {
            console.error(
              "VoiceroSecond: Error updating session with assistant message:",
              error
            );
          });
      } catch (error) {
        console.error(
          "VoiceroSecond: Error in updateSessionWithMessage:",
          error
        );
      }
    },
  };

  // Initialize on DOM content loaded
  if (typeof $ === "function") {
    $(document).ready(function () {
      VoiceroSecond.init();
    });
  } else {
    // Direct fallback if $ isn't working as expected
    if (document.readyState !== "loading") {
      setTimeout(function () {
        VoiceroSecond.init();
      }, 0);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        VoiceroSecond.init();
      });
    }
  }

  // Also initialize immediately if DOM is already loaded
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(function () {
      VoiceroSecond.init();
    }, 1);
  }

  // Expose global functions
  window.VoiceroSecond = VoiceroSecond;
})(window, document);
