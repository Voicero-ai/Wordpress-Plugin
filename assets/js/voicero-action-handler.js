const VoiceroActionHandler = {
  config: {
    apiBase: "/api",
    endpoints: {
      logout: "/auth/logout",
      subscription: "/subscriptions",
      trackOrder: "/orders/track",
      processReturn: "/orders/return",
      newsletter: "/newsletter/subscribe",
      accountReset: "/account/reset",
      scheduler: "/scheduler",
    },
    defaultHeaders: {
      "Content-Type": "application/json",
    },
    userCredentials: null,
  },

  init: function (userConfig = {}) {
    this.config = {
      ...this.config,
      ...userConfig,
      endpoints: {
        ...this.config.endpoints,
        ...(userConfig.endpoints || {}),
      },
      defaultHeaders: {
        ...this.config.defaultHeaders,
        ...(userConfig.defaultHeaders || {}),
      },
    };

    this.loadCredentials();
    return this;
  },

  saveCredentials: function (credentials) {
    try {
      this.config.userCredentials = credentials;
      localStorage.setItem(
        "voiceroUserCredentials",
        JSON.stringify(credentials)
      );
    } catch (e) {
      // console.warn("Could not save credentials to localStorage:", e);
    }
  },

  loadCredentials: function () {
    try {
      const saved = localStorage.getItem("voiceroUserCredentials");
      if (saved) {
        this.config.userCredentials = JSON.parse(saved);
      }
    } catch (e) {
      // console.warn("Could not load credentials from localStorage:", e);
    }
  },

  clearCredentials: function () {
    try {
      localStorage.removeItem("voiceroUserCredentials");
      this.config.userCredentials = null;
    } catch (e) {
      // console.warn("Could not clear credentials:", e);
    }
  },

  pendingHandler: () => {
    const action = sessionStorage.getItem("pendingAction");
    if (action === "logout") {
      const wpLogoutLink = document.querySelector(
        'a[href*="logout"], a[href*="wp-logout"]'
      );
      const logoutButton = document.querySelector('[button_text="logout"]');

      (wpLogoutLink || logoutButton)?.click();
      sessionStorage.removeItem("pendingAction");
    }
  },

  handle: function (response) {
    if (!response || typeof response !== "object") {
      // console.warn('Invalid response object');
      return;
    }

    const { answer, action, action_context } = response;
    // console.log("==>response", response)
    if (answer) {
      // console.debug("AI Response:", { answer, action, action_context });
    }

    if (!action) {
      // console.warn("No action specified");
      return;
    }

    let targets = [];
    if (Array.isArray(action_context)) {
      targets = action_context;
    } else if (action_context && typeof action_context === "object") {
      targets = [action_context];
    }

    try {
      const handlerName = `handle${this.capitalizeFirstLetter(action)}`;
      if (typeof this[handlerName] !== "function") {
        // console.warn(`No handler for action: ${action}`);
        return;
      }

      if (targets.length > 0) {
        // If we have targets, call handler for each one
        targets.forEach((target) => {
          if (target && typeof target === "object") {
            // console.log("==>target", target);
            this[handlerName](target);
          }
        });
      } else {
        // If no targets, just call the handler with no arguments
        // console.log(`Calling ${handlerName} with no context`);
        this[handlerName]();
      }
    } catch (error) {
      // console.error(`Error handling action ${action}:`, error);
    }
  },

  capitalizeFirstLetter: function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  },

  escapeRegExp: function (string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  },

  getApiUrl: function (endpointKey) {
    if (!this.config.endpoints[endpointKey]) {
      // console.warn(`No endpoint configured for ${endpointKey}`);
      return null;
    }
    return `${this.config.apiBase}${this.config.endpoints[endpointKey]}`;
  },

  findElement: function ({
    selector,
    exact_text,
    button_text,
    role,
    tagName,
    placeholder,
  }) {
    if (selector) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    if (button_text) {
      const interactiveElements = document.querySelectorAll(
        'button, a, input, [role="button"]'
      );

      for (let el of interactiveElements) {
        if (el.textContent.trim().toLowerCase() === button_text.toLowerCase())
          return el;
        if (
          el.tagName === "INPUT" &&
          el.value.trim().toLowerCase() === button_text.toLowerCase()
        )
          return el;
        if (
          el.getAttribute("aria-label")?.toLowerCase() ===
          button_text.toLowerCase()
        )
          return el;
      }
    }

    if (placeholder) {
      const inputs = document.querySelectorAll("input, textarea");
      for (let el of inputs) {
        if (el.placeholder?.toLowerCase().includes(placeholder.toLowerCase()))
          return el;
      }
    }

    if (exact_text) {
      const elements = document.querySelectorAll(tagName || "*");
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
      login:
        'form#loginform, form.login-form, form[action*="login"], form[action*="wp-login"]',
      tracking: 'form.track-order, form#track-order, form[action*="track"]',
      return: 'form.return-form, form#return-form, form[action*="return"]',
      newsletter:
        'form.newsletter-form, form#newsletter, form[action*="subscribe"], form[action*="newsletter"]',
      checkout:
        'form#checkout, form.woocommerce-checkout, form[action*="checkout"]',
      account: 'form#account-form, form.customer-form, form[action*="account"]',
      default: "form",
    };

    return document.querySelector(
      formSelectors[formType] || formSelectors.default
    );
  },

  handleScroll: function (target) {
    const { exact_text, css_selector, offset = 0 } = target || {};

    if (exact_text) {
      const element = this.findElement({ exact_text });
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      // console.warn(`Text not found: "${exact_text}"`, element);
      return;
    }

    if (css_selector) {
      const element = document.querySelector(css_selector);
      if (element) {
        const elementPosition =
          element.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: elementPosition - offset,
          behavior: "smooth",
        });
        return;
      }
      // console.warn(`Element not found with selector: ${css_selector}`);
      return;
    }

    // console.warn("No selector or text provided for scroll", target);
  },

  handleClick: function (target) {
    const element = this.findElement({
      ...target,
      button_text: target.button_text || target.exact_text,
      tagName: 'button, a, input, [role="button"]',
    });

    if (element) {
      try {
        const clickEvent = new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(clickEvent);
        return true;
      } catch (error) {
        // console.error("Error clicking element:", error);
      }
    }

    // console.warn("Click target not found:", target);
    return false;
  },

  handleFill_form: function (target) {
    const { form_id, form_type, input_fields } = target || {};

    if (!input_fields || !Array.isArray(input_fields)) {
      // console.warn("No form fields provided");
      return;
    }

    let form = form_id
      ? document.getElementById(form_id)
      : form_type
      ? this.findForm(form_type)
      : null;

    if (!form && input_fields.length > 0) {
      const firstField = input_fields[0];
      const potentialInput = document.querySelector(
        `[name="${firstField.name}"], [placeholder*="${firstField.placeholder}"], [id="${firstField.id}"]`
      );
      if (potentialInput) form = potentialInput.closest("form");
    }

    input_fields.forEach((field) => {
      const { name, value, placeholder, id } = field;
      if (!name && !placeholder && !id) {
        // console.warn("Invalid field configuration - no identifier:", field);
        return;
      }

      const selector = [
        name && `[name="${name}"]`,
        placeholder && `[placeholder*="${placeholder}"]`,
        id && `#${id}`,
      ]
        .filter(Boolean)
        .join(", ");

      const element = form
        ? form.querySelector(selector)
        : document.querySelector(selector);

      if (!element) {
        // console.warn(`Form element not found:`, field);
        return;
      }

      if (element.tagName === "SELECT") {
        element.value = value;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA"
      ) {
        if (element.type === "checkbox" || element.type === "radio") {
          element.checked = Boolean(value);
        } else {
          element.value = value;
        }
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    if (form && target.auto_submit !== false) {
      setTimeout(() => {
        form.dispatchEvent(new Event("submit", { bubbles: true }));
      }, 100);
    }
  },

  handleHighlight_text: function (target) {
    const {
      selector,
      exact_text,
      color = "#f9f900",
      scroll = true,
      offset = 50,
    } = target || {};

    // 1. Remove all previous highlights first
    document.querySelectorAll('[style*="background-color"]').forEach((el) => {
      if (
        el.style.backgroundColor === color ||
        el.style.backgroundColor === "rgb(249, 249, 0)"
      ) {
        el.style.backgroundColor = "";
        // Remove span wrappers we added
        if (
          el.tagName === "SPAN" &&
          el.hasAttribute("style") &&
          el.parentNode
        ) {
          el.replaceWith(el.textContent);
        }
      }
    });

    let firstHighlightedElement = null;

    // 2. Handle selector-based highlighting
    if (selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.style.backgroundColor = color;
        if (!firstHighlightedElement) firstHighlightedElement = el;
      });
    }
    // 3. Handle exact text highlighting (case-insensitive)
    else if (exact_text) {
      const regex = new RegExp(this.escapeRegExp(exact_text), "gi");
      // Select all elements that might contain text nodes
      const elements = document.querySelectorAll(
        "p, span, div, li, td, h1, h2, h3, h4, h5, h6"
      );

      // Function to process text nodes
      const highlightTextNodes = (node) => {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
          const text = node.nodeValue;
          let match;
          let lastIndex = 0;
          const fragment = document.createDocumentFragment();

          while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
              fragment.appendChild(
                document.createTextNode(text.substring(lastIndex, match.index))
              );
            }

            // Add highlighted match
            const span = document.createElement("span");
            span.style.backgroundColor = color;
            span.appendChild(document.createTextNode(match[0]));
            fragment.appendChild(span);

            lastIndex = regex.lastIndex;

            // Track first highlighted element for scrolling
            if (!firstHighlightedElement) {
              firstHighlightedElement = span;
            }
          }

          // Add remaining text after last match
          if (lastIndex < text.length) {
            fragment.appendChild(
              document.createTextNode(text.substring(lastIndex))
            );
          }

          // Replace the original text node with our fragment
          if (fragment.childNodes.length > 0) {
            node.parentNode.replaceChild(fragment, node);
          }
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          node.offsetParent !== null &&
          getComputedStyle(node).display !== "none" &&
          !["SCRIPT", "STYLE", "TITLE", "A", "LINK"].includes(node.tagName)
        ) {
          // Process child nodes recursively
          Array.from(node.childNodes).forEach(highlightTextNodes);
        }
      };

      // Process each element
      elements.forEach((el) => {
        if (
          el.offsetParent === null ||
          getComputedStyle(el).display === "none"
        ) {
          return;
        }
        highlightTextNodes(el);
      });
    } else {
      // console.warn("No selector or text provided for highlight");
      return;
    }

    // 4. Scroll to first highlighted element if requested
    if (scroll && firstHighlightedElement) {
      const elementPosition =
        firstHighlightedElement.getBoundingClientRect().top +
        window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
    }
  },

  // handleLogin: async function(target) {
  //     const { username, password, remember = true } = target || {};
  handleLogin: async function (target) {
    // Extract username and password from the new target structure
    const inputFields = (target?.input_fields || []).reduce((acc, field) => {
      acc[field.name] = field.value;
      return acc;
    }, {});

    const { username, password } = inputFields;
    const remember = true;
    if (!username || !password) {
      // console.warn("Username and password required for login");
      return;
    }

    // try WordPress default login form
    const loginForm = document.querySelector(
      'form#loginform, form.login-form, form[action*="wp-login.php"]'
    );
    if (loginForm) {
      const usernameField = loginForm.querySelector(
        'input[name="log"], input[name="username"], input[type="text"][name*="user"]'
      );
      const passwordField = loginForm.querySelector(
        'input[name="pwd"], input[name="password"], input[type="password"]'
      );
      const rememberField = loginForm.querySelector('input[name="rememberme"]');

      if (usernameField && passwordField) {
        usernameField.value = username;
        passwordField.value = password;
        if (rememberField) rememberField.checked = remember;

        // Trigger change events
        usernameField.dispatchEvent(new Event("input", { bubbles: true }));
        passwordField.dispatchEvent(new Event("input", { bubbles: true }));

        // Submit the form
        loginForm.submit();
        return;
      }
    }

    // Fallback to WordPress REST API if available
    try {
      // Standard WordPress REST API login endpoint
      const apiUrl = "/wp-json/jwt-auth/v1/token";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          // Store the authentication token
          localStorage.setItem("wordpress_token", data.token);
          //    // console.log("Login successful via API");
          window.location.reload();
          return;
        }
      }

      const adminAjaxUrl = "/wp-admin/admin-ajax.php";

      const ajaxResponse = await fetch(adminAjaxUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `action=my_login_action&username=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`,
      });

      const result = await ajaxResponse.json();

      if (result.success) {
        //   // console.log("Login successful via admin-ajax");
        window.location.reload();
        return;
      }

      // console.warn("Login failed:", result.data?.message);
    } catch (error) {
      // console.error("Login error:", error);

      // Avoid this in production
      window.location.href = `/wp-login.php?log=${encodeURIComponent(
        username
      )}&pwd=${encodeURIComponent(password)}&rememberme=${
        remember ? "forever" : ""
      }`;
    }
  },

  handleLogout: function () {
    this.clearCredentials();

    const logoutLink = document.querySelector(
      'a[href*="logout"], a[href*="wp-logout"]'
    );
    if (logoutLink) {
      logoutLink.click();
      return;
    }

    // Store the pending action in sessionStorage
    sessionStorage.setItem("pendingAction", "logout");
    window.location.href = "/my-account";
  },

  handleNewsletter_signup: async function (target) {
    let email, firstname, lastname, phone;
    let formId;
    let autoSubmit = true;

    if (target && target.form_id && target.input_fields) {
      formId = target.form_id;
      target.input_fields.forEach((field) => {
        if (field.name === "email") email = field.value;
        if (field.name === "firstname") firstname = field.value;
        if (field.name === "lastname") lastname = field.value;
        if (field.name === "phone") phone = field.value;
      });
      if (typeof target.auto_submit !== "undefined") {
        autoSubmit = target.auto_submit;
      }
    } else {
      ({ email, firstname, lastname, phone } = target || {});
    }

    if (!email) {
      // console.warn("Email required for newsletter signup");
      return;
    }

    let newsletterForm;
    if (formId) {
      newsletterForm = document.getElementById(formId);
    }
    if (!newsletterForm) {
      newsletterForm = this.findForm("newsletter");
    }

    if (newsletterForm) {
      const emailField = newsletterForm.querySelector(
        'input[type="email"], input[name="email"], [aria-label*="email"], [placeholder*="email"]'
      );
      const firstNameField = newsletterForm.querySelector(
        'input[name="firstname"], input[name="fname"], [aria-label*="first name"], [placeholder*="first name"]'
      );
      const lastNameField = newsletterForm.querySelector(
        'input[name="lastname"], input[name="lname"], [aria-label*="last name"], [placeholder*="last name"]'
      );
      const phoneField = newsletterForm.querySelector(
        'input[type="tel"], input[name="phone"], [aria-label*="phone"], [placeholder*="phone"]'
      );

      // Fill fields if found
      if (emailField) {
        emailField.value = email;
        emailField.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (firstNameField && firstname) {
        firstNameField.value = firstname;
        firstNameField.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (lastNameField && lastname) {
        lastNameField.value = lastname;
        lastNameField.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (phoneField && phone) {
        phoneField.value = phone;
        phoneField.dispatchEvent(new Event("input", { bubbles: true }));
      }

      // Submit if autoSubmit is true (default)
      if (autoSubmit) {
        setTimeout(() => {
          const submitEvent = new Event("submit", {
            bubbles: true,
            cancelable: true,
          });
          newsletterForm.dispatchEvent(submitEvent);
          if (!submitEvent.defaultPrevented) {
            newsletterForm.submit();
          }
        }, 100);
      }

      return;
    }

    // API fallback
    const newsletterUrl = this.getApiUrl("newsletter");
    if (!newsletterUrl) return;

    try {
      const response = await fetch(newsletterUrl, {
        method: "POST",
        headers: this.config.defaultHeaders,
        body: JSON.stringify({ email, firstname, lastname, phone }),
      });

      const data = await response.json();
      if (window.VoiceroText?.addMessage) {
        if (data.success) {
          window.VoiceroText.addMessage(
            "Thank you for subscribing to our newsletter!"
          );
        } else {
          window.VoiceroText.addMessage(
            data.message || "Newsletter signup failed"
          );
        }
      }
    } catch (error) {
      // console.error("Newsletter signup error:", error);
      if (window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage("Failed to complete newsletter signup");
      }
    }
  },

  handleAccount_reset: async function (target) {
    const { email } = target || {};
    if (!email) {
      // console.warn("Email required for account reset");
      return;
    }

    const accountForm = this.findForm("account");
    if (accountForm) {
      const emailField = accountForm.querySelector(
        'input[type="email"], input[name="email"]'
      );
      if (emailField) {
        emailField.value = email;
        accountForm.dispatchEvent(new Event("submit", { bubbles: true }));
        return;
      }
    }

    const accountResetUrl = this.getApiUrl("accountReset");
    if (!accountResetUrl) return;

    try {
      const response = await fetch(accountResetUrl, {
        method: "POST",
        headers: this.config.defaultHeaders,
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (data.success && window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(
          "Password reset instructions have been sent to your email."
        );
      } else if (!data.success) {
        // console.warn("Account reset failed:", data.message);
      }
    } catch (error) {
      // console.error("Account reset error:", error);
    }
  },

  handleStart_subscription: function (target) {
    this.handleSubscriptionAction(target, "start");
  },

  handleStop_subscription: function (target) {
    this.handleSubscriptionAction(target, "stop");
  },

  handleSubscriptionAction: async function (target, action) {
    const { subscription_id, product_id, plan_id } = target || {};

    if (!subscription_id && !product_id && !plan_id) {
      // console.warn("No subscription, product or plan ID provided");
      return;
    }

    const buttonSelector =
      action === "start"
        ? `button[data-product-id="${product_id}"], button.subscribe-button`
        : `button[data-subscription-id="${subscription_id}"], button.cancel-subscription`;

    const button = document.querySelector(buttonSelector);
    if (button) {
      button.click();
      return;
    }

    const subscriptionUrl = this.getApiUrl("subscription");
    if (!subscriptionUrl) return;

    try {
      const response = await fetch(subscriptionUrl, {
        method: "POST",
        headers: this.config.defaultHeaders,
        body: JSON.stringify({ action, subscription_id, product_id, plan_id }),
      });

      const data = await response.json();
      if (data.success) {
        //  // console.log(`Subscription ${action} successful`);
        window.location.reload();
      } else {
        // console.warn(`Subscription ${action} failed:`, data.message);
      }
    } catch (error) {
      // console.error(`Subscription ${action} error:`, error);
    }
  },

  handlePurchase: async function (target) {
    const {
      product_id,
      product_name,
      button_text = "Add to cart",
      quantity = 1,
    } = target || {};

    if (!product_id && !product_name) {
      // console.warn("No product identifier provided for purchase");
      if (window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage("Please specify a product to purchase");
      }
      return;
    }

    // 1. Find product by name if no ID provided
    if (product_name && !product_id) {
      const productElements = Array.from(
        document.querySelectorAll(
          'a[href*="/product/"], a[href*="/shop/"], .woocommerce-loop-product__link, .product-item-link'
        )
      );

      const productElement = productElements.find((el) => {
        const titleEl =
          el.querySelector(
            "h2, .product-title, .woocommerce-loop-product__title"
          ) || el;
        return titleEl.textContent.trim().includes(product_name);
      });

      if (productElement) {
        try {
          // Prevent default navigation
          productElement.addEventListener(
            "click",
            async function (e) {
              e.preventDefault();
              const productUrl = this.href;

              // Show loading message
              if (window.VoiceroText?.addMessage) {
                window.VoiceroText.addMessage(
                  `Adding ${product_name} to cart...`
                );
              }

              // Fetch product page
              const response = await fetch(productUrl);
              const html = await response.text();
              const parser = new DOMParser();
              const productDoc = parser.parseFromString(html, "text/html");

              // Multiple methods to get product ID
              let productId;

              // Method 1: From form input
              const addToCartInput = productDoc.querySelector(
                'input[name="add-to-cart"]'
              );
              if (addToCartInput) {
                // productId = addToCartInput.value;
              }

              // Method 2: From data attribute
              if (!productId) {
                const productContainer =
                  productDoc.querySelector("[data-product_id]");
                if (productContainer) {
                  productId = productContainer.getAttribute("data-product_id");
                }
              }

              // Method 3: From URL
              if (!productId) {
                const idMatch = productUrl.match(/\/(\d+)\/?$/);
                if (idMatch) {
                  productId = idMatch[1];
                }
              }

              // Method 4: From product body class
              if (!productId) {
                const bodyClasses =
                  productDoc.body.className.match(/postid-(\d+)/);
                if (bodyClasses) {
                  productId = bodyClasses[1];
                }
              }

              if (!productId) {
                throw new Error(
                  "Could not determine product ID. Please try again or use the product ID directly."
                );
              }

              // Prepare form data
              const form = productDoc.querySelector("form.cart");
              const formData = form ? new FormData(form) : new FormData();
              formData.set("add-to-cart", productId);
              formData.set("quantity", quantity);

              const cartResponse = await fetch("?wc-ajax=add_to_cart", {
                method: "POST",
                body: formData,
                headers: {
                  Accept: "application/json",
                },
              });

              let result;
              try {
                // First try to parse as JSON
                result = await cartResponse.json();
              } catch (jsonError) {
                // If JSON parsing fails, check for HTML response
                const textResponse = await cartResponse.text();

                // Check if this is a WooCommerce error message
                if (textResponse.includes("woocommerce-error")) {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(textResponse, "text/html");
                  const errorMessage =
                    doc
                      .querySelector(".woocommerce-error")
                      ?.textContent.trim() ||
                    "Failed to add to cart (unknown error)";
                  throw new Error(errorMessage);
                }
                // Check for redirect
                else if (cartResponse.redirected) {
                  result = { success: true, message: "Product added to cart" };
                } else {
                  throw new Error("Invalid server response");
                }
              }

              // Handle WooCommerce responses
              if (result && result.success === false) {
                throw new Error(result.message || "Failed to add to cart");
              }
            },
            { once: true }
          );

          // Trigger the click handler
          productElement.click();
          return;
        } catch (error) {
          // console.error("Purchase error:", error);
          if (window.VoiceroText?.addMessage) {
            window.VoiceroText.addMessage(
              `❌ Failed to add ${product_name} to cart: ${error.message}`
            );
          }
          return;
        }
      }
    }

    // 2. Direct Add to Cart if product_id is available
    try {
      const formData = new FormData();
      formData.append("add-to-cart", product_id);
      formData.append("quantity", quantity);

      const response = await fetch("?wc-ajax=add_to_cart", {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      //  // console.log('Raw response:', responseText);

      if (window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(
          `✅ Added ${quantity} ${product_name || "item"} to cart! ` +
            `<a href="/cart/" style="color: #00ff88;">View Cart</a>`
        );
      }

      // Refresh cart fragments
      if (typeof jQuery !== "undefined" && jQuery.fn.wc_fragments) {
        jQuery(document.body).trigger("wc_fragment_refresh");
      }
    } catch (error) {
      // console.error("Purchase error:", error);
      if (window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(
          `❌ Failed to add item to cart: ${error.message}`
        );
      }
    }
  },

  handleTrack_order: async function (target) {
    const { order_id, email } = target || {};
    if (!order_id || !email) {
      // console.warn("Order ID and email required for tracking");
      if (window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(
          "Please provide both order number and email address"
        );
      }
      return;
    }

    // 1. First try WooCommerce's native order tracking form
    const trackingForm = document.querySelector(
      'form.track_order, form[action*="order-tracking"]'
    );
    if (trackingForm) {
      // ... (same form handling code as before)
      return;
    }

    // 2. Try WooCommerce REST API with proper authentication
    try {
      const consumerKey = "ck_2f2ce7758ff8cb809dae1487c7690a552c80983a"; // Replace with actual key
      const consumerSecret = "cs_2e856a0337497ec950e36354a7fbcccadc3e9bc6"; // Replace with actual secret

      const apiUrl = `/wp-json/wc/v3/orders/${order_id}`;
      const authString = btoa(`${consumerKey}:${consumerSecret}`);

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authString}`,
        },
      });

      if (response.status === 401) {
        throw new Error("Authentication failed - please check API keys");
      }

      if (response.status === 404) {
        throw new Error("Order not found");
      }

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const order = await response.json();

      // Verify email matches
      const orderEmail = order.billing?.email || order.customer?.email;
      if (!orderEmail || orderEmail.toLowerCase() !== email.toLowerCase()) {
        throw new Error("Email doesn't match order records");
      }

      // Format status (e.g., "processing" → "Processing")
      const status =
        order.status.charAt(0).toUpperCase() + order.status.slice(1);

      if (window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(
          `Order #${order_id} status: ${status}\n` +
            `Date: ${new Date(order.date_modified).toLocaleDateString()}\n` +
            `Items: ${order.line_items.length} product(s)`
        );
      }
    } catch (error) {
      // console.error("Order tracking error:", error);
      if (window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(
          `❌ Could not track order #${order_id}: ${error.message}\n` +
            `Please contact support for assistance.`
        );
      }
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
        // console.warn("Order ID and email required for return");
        return;
      }
    }

    const returnForm = this.findForm("return");
    if (returnForm) {
      const orderIdField = returnForm.querySelector(
        'input[name="orderid"], input[name="order_id"]'
      );
      const emailField = returnForm.querySelector(
        'input[type="email"], input[name="email"]'
      );
      const reasonField = returnForm.querySelector(
        'select[name="reason"], textarea[name="reason"]'
      );

      if (orderIdField && emailField) {
        orderIdField.value = order_id;
        emailField.value = email;
        if (reasonField) reasonField.value = reason;

        items.forEach((item) => {
          const itemCheckbox = returnForm.querySelector(
            `input[name="return_items[]"][value="${item.id}"], 
                         input[name="return_items"][value="${item.id}"]`
          );
          if (itemCheckbox) itemCheckbox.checked = true;
        });

        returnForm.dispatchEvent(new Event("submit", { bubbles: true }));
        return;
      }
    }

    const processReturnUrl = this.getApiUrl("processReturn");
    if (!processReturnUrl) return;

    try {
      const response = await fetch(processReturnUrl, {
        method: "POST",
        headers: this.config.defaultHeaders,
        body: JSON.stringify({ order_id, email, reason, items }),
      });

      const data = await response.json();
      if (data.success && window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(
          `Your return for order #${order_id} has been processed.`
        );
      } else if (!data.success) {
        // console.warn("Return processing failed:", data.message);
      }
    } catch (error) {
      // console.error("Return processing error:", error);
    }
  },

  handleScheduler: async function (target) {
    const { action, date, time, event } = target || {};
    if (!action) {
      // console.warn("No action specified for scheduler");
      return;
    }

    const schedulerUrl = this.getApiUrl("scheduler");
    if (!schedulerUrl) return;

    try {
      const response = await fetch(schedulerUrl, {
        method: "POST",
        headers: this.config.defaultHeaders,
        body: JSON.stringify({ action, date, time, event }),
      });

      const data = await response.json();
      if (data.success && window.VoiceroText?.addMessage) {
        window.VoiceroText.addMessage(`Scheduler: ${data.message}`);
      } else if (!data.success) {
        // console.warn("Scheduler action failed:", data.message);
      }
    } catch (error) {
      // console.error("Scheduler error:", error);
    }
  },

  handleRedirect: function (target) {
    let url;
    if (typeof target === "string") {
      url = target;
    } else if (target && typeof target === "object") {
      url = target.url;
    }

    if (!url) {
      // console.warn("No URL provided for redirect");
      return;
    }

    try {
      let finalUrl = url;

      if (url.startsWith("/") && !url.startsWith("//")) {
        finalUrl = window.location.origin + url;
      }

      const urlObj = new URL(finalUrl);

      if (!["http:", "https:"].includes(urlObj.protocol)) {
        // console.warn("Unsupported URL protocol:", urlObj.protocol);
        return;
      }

      window.location.href = finalUrl;
    } catch (e) {
      // console.warn("Invalid URL:", url, e);

      if (url.startsWith("/") && !url.startsWith("//")) {
        try {
          const fallbackUrl = window.location.origin + url;
          new URL(fallbackUrl); // Validate again
          window.location.href = fallbackUrl;
          return;
        } catch (fallbackError) {
          // console.warn("Fallback URL attempt failed:", fallbackUrl, fallbackError);
        }
      }
    }
  },

  handleContact: function (target) {
    // Check if VoiceroContact module is available
    if (
      window.VoiceroContact &&
      typeof window.VoiceroContact.showContactForm === "function"
    ) {
      // Show the contact form below the AI message
      window.VoiceroContact.showContactForm();
    } else {
      console.error("VoiceroContact module not available");

      // Fallback: Display a message that contact form is not available
      if (window.VoiceroText && window.VoiceroText.addMessage) {
        window.VoiceroText.addMessage(
          "I'm sorry, the contact form is not available right now. Please try again later or contact us directly.",
          "ai"
        );
      }
    }
  },
};

window.addEventListener("load", VoiceroActionHandler.pendingHandler);

window.VoiceroActionHandler =
  window.VoiceroActionHandler || VoiceroActionHandler;
