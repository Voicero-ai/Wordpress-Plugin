jQuery(document).ready(function ($) {
  // Add toggle functionality
  $(".connection-details-toggle button").on("click", function () {
    const $toggle = $(this).parent();
    const $details = $(".connection-details");
    const isVisible = $details.is(":visible");

    $details.slideToggle();
    $toggle.toggleClass("active");
    $(this).html(`
            <span class="dashicons dashicons-arrow-${
              isVisible ? "down" : "up"
            }-alt2"></span>
            ${isVisible ? "Show" : "Hide"} Connection Details
        `);
  });

  // Check if WordPress shows expired message - only once
  const bodyText = $("body").text();
  if (
    bodyText.includes("link you followed has expired") &&
    window.location.search.includes("access_key")
  ) {
    // Only refresh if we came from an access_key URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("access_key");
    window.location.replace(newUrl.toString()); // Use replace instead of href
    return;
  }

  // Add a flag to localStorage when clearing connection
  $("#clear-connection").on("click", function () {
    if (confirm("Are you sure you want to clear the connection?")) {
      localStorage.setItem("connection_cleared", "true");

      // Make AJAX call to clear the connection
      $.post(voiceroAdminConfig.ajaxUrl, {
        action: "voicero_clear_connection",
        nonce: voiceroAdminConfig.nonce,
      }).then(function () {
        // Clear the form and reload
        $("#access_key").val("");
        window.location.reload();
      });
    }
  });

  // Check for access key in URL - but only if we haven't just cleared
  const urlParams = new URLSearchParams(window.location.search);
  const accessKey = urlParams.get("access_key");
  const wasCleared = localStorage.getItem("connection_cleared") === "true";

  if (accessKey && !wasCleared) {
    // Just fill the form
    $("#access_key").val(accessKey);

    // Clean the URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("access_key");
    window.history.replaceState({}, "", newUrl.toString());
  }

  // Clear the flag after handling
  localStorage.removeItem("connection_cleared");

  // Handle sync form submission
  $("#sync-form").on("submit", function (e) {
    // Stop form from submitting normally
    e.preventDefault();
    e.stopPropagation();

    const syncButton = $("#sync-button");
    const syncStatusContainer = $("#sync-status");

    // Check if plan is inactive
    const plan = $("th:contains('Plan')").next().text().trim();
    if (plan === "Inactive") {
      syncStatusContainer.html(`
        <div class="notice notice-error inline">
          <p>⚠️ Please upgrade to a paid plan to sync content.</p>
        </div>
      `);
      return false;
    }

    // Reset initial state
    syncButton.prop("disabled", true);

    // Create progress bar and status text elements
    syncStatusContainer.html(`
            <div id="sync-progress-bar-container" style="width: 100%; background-color: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 5px; height: 24px; position: relative; margin-top: 15px;">
                <div id="sync-progress-bar" style="width: 0%; height: 100%; background-color: #0073aa; transition: width 0.3s ease;"></div>
                <div id="sync-progress-percentage" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; line-height: 24px; text-align: center; color: #fff; font-weight: bold; text-shadow: 1px 1px 1px rgba(0,0,0,0.2);">
                    0%
                </div>
            </div>
            <div id="sync-progress-text" style="font-style: italic; text-align: center;">Initiating sync...</div>
            <div id="sync-warning" style="margin-top: 10px; padding: 8px; background-color: #f0f6fc; border-left: 4px solid #2271b1; color: #1d2327; font-size: 13px; text-align: left;">
                <p><strong>⚠️ Important:</strong> Please do not close this page during training. You can leave the page and do other things while the training is happening. This process could take up to 20 minutes to complete depending on the size of your website.</p>
            </div>
        `);

    const progressBar = $("#sync-progress-bar");
    const progressPercentage = $("#sync-progress-percentage");
    const progressText = $("#sync-progress-text");

    function updateProgress(percentage, text, isError = false) {
      const p = Math.min(100, Math.max(0, Math.round(percentage))); // Clamp between 0 and 100
      progressBar.css("width", p + "%");
      progressPercentage.text(p + "%");
      progressText.text(text);

      if (isError) {
        progressBar.css("background-color", "#d63638"); // Red for error
        progressPercentage.css("color", "#fff");
      } else {
        progressBar.css("background-color", "#0073aa"); // Blue for progress/success
        progressPercentage.css("color", p < 40 ? "#333" : "#fff");
      }
    }

    updateProgress(5, "⏳ Syncing content...");

    try {
      let assistantData = null; // To store assistant response
      let websiteId = null; // Declare websiteId at a higher scope level

      // Step 1: Initial Sync (to 17%)
      $.post(voiceroAdminConfig.ajaxUrl, {
        action: "voicero_sync_content",
        nonce: voiceroAdminConfig.nonce,
      })
        .then(function (response) {
          if (!response.success)
            throw new Error(response.data.message || "Sync failed");
          updateProgress(
            response.data.progress || 17,
            "⏳ Vectorizing content..."
          );
          // Step 2: Vectorization (to 34%)
          return $.post(voiceroAdminConfig.ajaxUrl, {
            action: "voicero_vectorize_content",
            nonce: voiceroAdminConfig.nonce,
          });
        })
        .then(function (response) {
          if (!response.success)
            throw new Error(response.data.message || "Vectorization failed");
          updateProgress(
            response.data.progress || 34,
            "⏳ Setting up assistant..."
          );
          // Step 3: Assistant Setup (to 50%)
          return $.post(voiceroAdminConfig.ajaxUrl, {
            action: "voicero_setup_assistant",
            nonce: voiceroAdminConfig.nonce,
          });
        })
        .then(function (response) {
          if (!response.success)
            throw new Error(response.data.message || "Assistant setup failed");
          updateProgress(
            response.data.progress || 50,
            "⏳ Preparing content training..."
          );
          assistantData = response.data.data; // Store the content IDs

          // Store websiteId at the higher scope
          if (assistantData && assistantData.websiteId) {
            websiteId = assistantData.websiteId;
          } else {
            // Try to use the first content item's websiteId as fallback
            if (
              assistantData &&
              assistantData.content &&
              assistantData.content.pages &&
              assistantData.content.pages.length > 0
            ) {
              websiteId = assistantData.content.pages[0].websiteId;
            }
            // If still no websiteId, we'll need to handle that error case
            if (!websiteId) {
              throw new Error("No websiteId available for training");
            }
          }

          // --- Step 4: All Training (50% to 100%) ---
          if (!assistantData || !assistantData.content) {
            // Even if no content items, we still need to do general training
          }

          // Prepare training data
          const pages =
            assistantData && assistantData.content
              ? assistantData.content.pages || []
              : [];
          const posts =
            assistantData && assistantData.content
              ? assistantData.content.posts || []
              : [];
          const products =
            assistantData && assistantData.content
              ? assistantData.content.products || []
              : [];

          // Calculate total items including general training which we'll do last
          const totalItems = pages.length + posts.length + products.length + 1; // +1 for general training
          updateProgress(50, `⏳ Preparing to train ${totalItems} items...`);

          // Build combined array of all items to train
          const allItems = [
            ...pages.map((item) => ({ type: "page", wpId: item.id })),
            ...posts.map((item) => ({ type: "post", wpId: item.id })),
            ...products.map((item) => ({ type: "product", wpId: item.id })),
            { type: "general" }, // Add general training as the last item
          ];

          // Process all items in a single batch request
          return $.post(voiceroAdminConfig.ajaxUrl, {
            action: "voicero_batch_train",
            nonce: voiceroAdminConfig.nonce,
            websiteId: websiteId,
            batch_data: JSON.stringify(allItems),
          });
        })
        .then(function (response) {
          if (!response.success)
            throw new Error(response.data.message || "Batch training failed");
          // Training requests have been initiated
          updateProgress(
            60,
            "⏳ Training requests initiated. Monitoring progress..."
          );

          // Show explanation about background processing
          $("#sync-warning").html(`
                    <p><strong>ℹ️ Training In Progress:</strong> All training requests have been initiated and 
                    are now processing. This can take several minutes to complete depending on the 
                    size of your website. Progress will be tracked below.</p>
                    <div id="training-status-container">
                        <p id="training-status">Status: <span>Processing...</span></p>
                        <div id="training-progress-container" style="width: 100%; background-color: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 10px 0; height: 24px; position: relative;">
                            <div id="training-progress-bar" style="width: 0%; height: 100%; background-color: #0073aa; transition: width 0.3s ease;"></div>
                            <div id="training-progress-text" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; line-height: 24px; text-align: center; color: #fff; font-weight: bold; text-shadow: 1px 1px 1px rgba(0,0,0,0.2);">
                                0%
                            </div>
                        </div>
                    </div>
                `);

          // Poll for status updates
          let pollingInterval = setInterval(function () {
            $.post(voiceroAdminConfig.ajaxUrl, {
              action: "voicero_get_training_status",
              nonce: voiceroAdminConfig.nonce,
            })
              .done(function (response) {
                if (response.success) {
                  const { in_progress, total_items, completed_items, status } =
                    response.data;
                  // compute percentage 0–100
                  const pct = total_items
                    ? Math.round((completed_items / total_items) * 100)
                    : 100;

                  // update the progress bar
                  $("#training-progress-bar").css("width", pct + "%");
                  $("#training-progress-text").text(pct + "%");
                  $("#training-status span").text(
                    status === "completed" ? "Completed" : "Processing..."
                  );

                  // update the overall sync progress (scale 60→100%)
                  const overall = 60 + pct * 0.4;
                  updateProgress(
                    overall,
                    `⏳ Training: ${status || "Processing..."}`
                  );

                  // when done...
                  if (!in_progress || status === "completed") {
                    clearInterval(pollingInterval);
                    updateProgress(100, "✅ Training completed successfully!");
                    syncButton.prop("disabled", false);

                    // Update notification
                    $("#sync-warning").html(`
                      <p><strong>✅ Training Complete:</strong> Your website content has been successfully trained. 
                      The AI assistant now has up-to-date knowledge about your website content.</p>
                    `);

                    // Update website info after training completes
                    setTimeout(loadWebsiteInfo, 1500);
                  }
                }
              })
              .fail(function () {
                // On failure, just keep polling - we might have a temporary network issue
              });
          }, 5000); // Poll every 5 seconds

          // After 10 minutes, stop polling regardless
          setTimeout(function () {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              $("#training-status span").html(
                '<span style="color: grey;">Check back later - status updates stopped</span>'
              );
            }
          }, 600000); // 10 minutes max
        })
        .catch(function (error) {
          // Handle errors
          const message = error.message || "An unknown error occurred";
          updateProgress(0, `❌ Error: ${message}`, true);
          syncButton.prop("disabled", false);
          //   // console.error("Sync error:", error);
        });
    } catch (e) {
      updateProgress(
        0,
        `❌ Error: ${e.message || "An unknown error occurred"}`,
        true
      );
      syncButton.prop("disabled", false);
      //  // console.error("Sync error:", e);
    }
  });

  // Also add a direct click handler as backup
  $(document).on("click", "#sync-button", function (e) {
    e.preventDefault();
    e.stopPropagation();

    // If this is inside a form, submit the form via jQuery instead
    if ($(this).closest("form").length) {
      $(this).closest("form").trigger("submit");
    }

    return false;
  });

  // Function to load website info
  function loadWebsiteInfo() {
    const $container = $("#website-info-container");

    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out")), 10000); // 10 second timeout
    });

    // Show loading state
    $container.html(`
      <div class="spinner is-active" style="float: none;"></div>
      <p>Loading website information...</p>
    `);

    // Race between the actual request and the timeout
    Promise.race([
      $.post(voiceroAdminConfig.ajaxUrl, {
        action: "voicero_get_info",
        nonce: voiceroAdminConfig.nonce,
      }),
      timeoutPromise,
    ])
      .then(function (response) {
        if (!response.success) {
          throw new Error(
            response.data?.message || "Failed to load website info"
          );
        }
        const data = response.data;
        console.log("Initial website data:", data);

        // Get detailed website data if we have an ID
        if (data.id) {
          fetchDetailedWebsiteData(data.id);
        }

        // Format last sync date
        let lastSyncDate = "Never";
        if (data.lastSyncDate) {
          const date = new Date(data.lastSyncDate);
          lastSyncDate = date.toLocaleString();
        }

        // Format last training date
        let lastTrainingDate = "Never";
        if (data.lastTrainingDate) {
          const date = new Date(data.lastTrainingDate);
          lastTrainingDate = date.toLocaleString();
        }

        // Format plan details
        const plan = data.plan || "Inactive";
        let queryLimit = 0;
        let isUnlimited = false;

        // Set query limit based on plan type
        switch (plan.toLowerCase()) {
          case "starter":
            queryLimit = 1000;
            break;
          case "enterprise":
            isUnlimited = true;
            queryLimit = Infinity; // For calculation purposes
            break;
          default:
            queryLimit = 0; // Inactive or unknown plan
        }

        const isSubscribed = data.isSubscribed === true;

        // Format website name
        const name = data.name || window.location.hostname;

        // Build HTML for website info using the new dashboard design - fixed full width layout
        let html = `
          <div class="wrap" style="max-width: 100%; padding: 0; margin: 0;">
            <h2 class="wp-heading-inline" style="margin-top: 0;">Dashboard</h2>
            <p class="description">Manage your AI-powered shopping assistant</p>
            
            <div style="text-align: right; margin: 15px 0;">
              <a href="http://localhost:3000/app/websites/website?id=${
                data.id || ""
              }" target="_blank" class="button button-primary open-control-panel">
                <span class="dashicons dashicons-external" style="margin-right: 5px;"></span>
                Open Control Panel
              </a>
            </div>
            
            <!-- Customer Contacts -->
            <div class="card" style="margin-bottom: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;">
              <div style="padding: 16px 20px; border-bottom: 1px solid #eee;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 500;">Customer Contacts</h2>
                <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Messages from your store visitors</p>
              </div>
              <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                  <div style="background: #fff9c4; color: #806600; border-radius: 20px; padding: 5px 12px; font-size: 13px; font-weight: 500;">
                    ${data.unreadMessages || 1} unread message${
          data.unreadMessages !== 1 ? "s" : ""
        }
                  </div>
                  <a href="http://localhost:3000/app/contacts" class="button button-secondary">
                    <span class="dashicons dashicons-visibility" style="margin-right: 5px;"></span>
                    View Contacts
                  </a>
                </div>
                
                <!-- Contact List -->
                <div style="margin-bottom: 20px;">
                  <div style="display: flex; align-items: center; padding: 15px; border-radius: 6px; background: #f0f6fc; margin-bottom: 15px;">
                    <div style="color: ${
                      data.active ? "#46b450" : "#d63638"
                    }; margin-right: 15px;">
                      <span class="dashicons ${
                        data.active ? "dashicons-yes-alt" : "dashicons-no-alt"
                      }"></span>
                    </div>
                    <div style="flex: 1;">
                      <h3 style="margin: 0 0 5px; font-size: 16px; font-weight: 500;">${name}</h3>
                      <a href="${
                        data.url || "#"
                      }" style="color: #0073aa; text-decoration: none; font-size: 13px;">${
          data.url || "https://" + name
        }</a>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; 
                        background: ${data.active ? "#edf7ed" : "#fbeaea"}; 
                        color: ${data.active ? "#1e7e34" : "#d63638"};
                        border: 1px solid ${
                          data.active ? "#c3e6cb" : "#f5c6cb"
                        };">
                        ${data.active ? "Active" : "Inactive"}
                      </span>
                      <button class="button button-small toggle-status-btn" 
                              data-website-id="${data.id || ""}" 
                              ${!data.lastSyncedAt ? "disabled" : ""}>
                        ${data.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                  
                  <!-- Contact Details -->
                  <div style="margin-top: 20px;">
                    <table class="widefat" style="border: none; box-shadow: none; background: #f9f9f9; width: 100%;">
                      <tr>
                        <th style="width: 30%; text-align: left;">Plan Type</th>
                        <td>${plan}</td>
                      </tr>
                      <tr>
                        <th style="width: 30%; text-align: left;">Monthly Queries</th>
                        <td>${
                          isUnlimited
                            ? `${data.monthlyQueries || 0} / Unlimited`
                            : `${data.monthlyQueries || 0} / ${queryLimit}`
                        }</td>
                      </tr>
                      <tr>
                        <th style="width: 30%; text-align: left;">Last Synced</th>
                        <td>${
                          data.lastSyncedAt
                            ? new Date(data.lastSyncedAt).toLocaleString()
                            : "Never"
                        }</td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Conversation Analytics -->
            <div class="card" style="margin-bottom: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;">
              <div style="padding: 16px 20px; border-bottom: 1px solid #eee;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 500;">Conversation Analytics</h2>
                <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Insights into how customers interact with your AI assistant</p>
              </div>
              <div style="padding: 20px;">
                <div style="text-align: right; margin-bottom: 15px;">
                  <button class="button refresh-data-btn">
                    <span class="dashicons dashicons-update" style="margin-right: 5px;"></span>
                    Refresh Data
                  </button>
                </div>
                
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; margin: 0 -10px;">
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #e3f2fd; color: #0277bd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-randomize"></span>
                    </div>
                    <div class="analytics-redirects" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.stats?.totalRedirects ||
                      data.globalStats?.totalAiRedirects ||
                      0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Total Redirects</div>
                  </div>
                  
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #e8f5e9; color: #2e7d32; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-chart-bar"></span>
                    </div>
                    <div class="analytics-redirect-rate" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.stats?.redirectRate || "0%"
                    }</div>
                    <div style="color: #666; font-size: 13px;">Redirect Rate %</div>
                  </div>
                  
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #f3e5f5; color: #7b1fa2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-format-chat"></span>
                    </div>
                    <div class="analytics-text-chats" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.globalStats?.totalTextChats || 0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Text Chats</div>
                  </div>
                  
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #ede7f6; color: #512da8; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-microphone"></span>
                    </div>
                    <div class="analytics-voice-chats" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.globalStats?.totalVoiceChats || 0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Voice Chats</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Action Statistics -->
            <div class="card" style="margin-bottom: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;">
              <div style="padding: 16px 20px; border-bottom: 1px solid #eee;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 500;">Action Statistics</h2>
                <p style="margin: 4px 0 0; color: #666; font-size: 14px;">How customers are interacting with your AI assistant</p>
              </div>
              <div style="padding: 20px;">
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; margin: 0 -10px;">
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #e3f2fd; color: #0277bd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-randomize"></span>
                    </div>
                    <div class="action-redirects" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.stats?.aiRedirects ||
                      data.globalStats?.totalAiRedirects ||
                      0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Redirects</div>
                  </div>
                  
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #e8f5e9; color: #2e7d32; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-cart"></span>
                    </div>
                    <div class="action-purchases" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.stats?.aiPurchases ||
                      data.globalStats?.totalAiPurchases ||
                      0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Purchases</div>
                  </div>
                  
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #e0f2f1; color: #00796b; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-admin-links"></span>
                    </div>
                    <div class="action-clicks" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.stats?.aiClicks ||
                      data.globalStats?.totalAiClicks ||
                      0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Clicks</div>
                  </div>
                  
                  <div style="flex: 1; min-width: 150px; text-align: center; padding: 20px 10px; margin: 0 10px 20px; background: #f9f9f9; border-radius: 8px;">
                    <div style="width: 40px; height: 40px; background: #fff8e1; color: #ff8f00; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                      <span class="dashicons dashicons-editor-alignleft"></span>
                    </div>
                    <div class="action-scrolls" style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">${
                      data.stats?.aiScrolls ||
                      data.globalStats?.totalAiScrolls ||
                      0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Scrolls</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Content Overview -->
            <div class="card" style="margin-bottom: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;">
              <div style="padding: 16px 20px; border-bottom: 1px solid #eee;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 500;">Content Overview</h2>
                <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Your store's AI-ready content</p>
              </div>
              <div style="padding: 20px;">
                <div style="text-align: right; margin-bottom: 15px;">
                  <button class="button sync-content-btn" id="sync-button">
                    <span class="dashicons dashicons-update" style="margin-right: 5px;"></span>
                    Sync Content
                  </button>
                </div>
                
                <!-- Content Type Tabs - Only 3 buttons -->
                <div style="display: flex; flex-wrap: wrap; margin: 0 -10px 20px;">
                  <div class="content-tab active" data-content-type="products" style="flex: 1; min-width: 120px; text-align: center; padding: 15px 10px; margin: 0 10px 15px; background: #e8eaf6; border-radius: 8px; cursor: pointer;">
                    <div style="width: 40px; height: 40px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; color: #333;">
                      <span class="dashicons dashicons-cart"></span>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;">${
                      data.content?.products?.length || 0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Products</div>
                  </div>
                  
                  <div class="content-tab" data-content-type="pages" style="flex: 1; min-width: 120px; text-align: center; padding: 15px 10px; margin: 0 10px 15px; background: #f9f9f9; border-radius: 8px; cursor: pointer;">
                    <div style="width: 40px; height: 40px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; color: #333;">
                      <span class="dashicons dashicons-admin-page"></span>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;">${
                      data.content?.pages?.length || 0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Pages</div>
                  </div>
                  
                  <div class="content-tab" data-content-type="posts" style="flex: 1; min-width: 120px; text-align: center; padding: 15px 10px; margin: 0 10px 15px; background: #f9f9f9; border-radius: 8px; cursor: pointer;">
                    <div style="width: 40px; height: 40px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; color: #333;">
                      <span class="dashicons dashicons-admin-post"></span>
                    </div>
                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;">${
                      data.content?.blogPosts?.length || 0
                    }</div>
                    <div style="color: #666; font-size: 13px;">Blog Posts</div>
                  </div>
                </div>
                
                <!-- Content List - Default shows Products -->
                <div id="content-display" style="margin-top: 30px;">
                  <!-- Products List (default view) -->
                  <div id="products-content" class="content-section active">
                    <div class="spinner is-active" style="float: none; margin: 0 auto; display: block;"></div>
                    <p style="text-align: center;">Loading products...</p>
                  </div>
                  
                  <!-- Pages List (hidden by default) -->
                  <div id="pages-content" class="content-section" style="display: none;">
                    <div class="spinner is-active" style="float: none; margin: 0 auto; display: block;"></div>
                    <p style="text-align: center;">Loading pages...</p>
                  </div>
                  
                  <!-- Blog Posts List (hidden by default) -->
                  <div id="posts-content" class="content-section" style="display: none;">
                    <div class="spinner is-active" style="float: none; margin: 0 auto; display: block;"></div>
                    <p style="text-align: center;">Loading blog posts...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

        // Insert the HTML
        $container.html(html);

        // Add click handlers for content tabs
        $(document).on("click", ".content-tab", function () {
          // Remove active class from all tabs
          $(".content-tab").removeClass("active").css("background", "#f9f9f9");
          // Add active class to clicked tab
          $(this).addClass("active").css("background", "#e8eaf6");

          // Hide all content sections
          $(".content-section").hide();
          // Show the content section corresponding to the clicked tab
          const contentType = $(this).data("content-type");
          $("#" + contentType + "-content").show();
        });

        // Now fetch the detailed website data if needed
        if (data.id) {
          // Detailed data is now being handled in the rest of the UI
        }
      })
      .catch(function (error) {
        console.error("Error loading website info:", error);
        $container.html(`
        <div class="notice notice-error inline">
          <p>Error loading website information: ${error.message}</p>
          <p>Please try refreshing the page. If the problem persists, contact support.</p>
        </div>
      `);
      });
  }

  // Function to fetch detailed website data
  function fetchDetailedWebsiteData(websiteId) {
    if (!websiteId) {
      console.error("No website ID provided for detailed data fetch");
      return;
    }

    console.log("Fetching detailed website data for ID:", websiteId);

    // Use the existing AJAX endpoint instead of REST API
    $.ajax({
      url: voiceroAdminConfig.ajaxUrl,
      method: "POST",
      data: {
        action: "voicero_websites_get",
        nonce: voiceroAdminConfig.nonce,
        id: websiteId,
      },
    })
      .done(function (response) {
        console.log("Detailed website data:", response);

        // Here we can update the UI with the detailed data
        if (response.success && response.data) {
          updateContentDisplay(response.data);
        }
      })
      .fail(function (error) {
        console.error("Failed to fetch detailed website data:", error);
      });
  }

  // Function to update content displays with detailed data
  function updateContentDisplay(detailedData) {
    if (!detailedData || !detailedData.content) return;

    const content = detailedData.content;

    // Update Products section
    if (content.products && content.products.length > 0) {
      let productsHtml = "";
      content.products.forEach((product) => {
        // Truncate description to make it readable
        const shortDesc = product.description
          ? product.description.length > 150
            ? product.description.substring(0, 150) + "..."
            : product.description
          : "No description available";

        productsHtml += `
          <div style="display: flex; padding: 15px; border-bottom: 1px solid #eee;">
            <div style="margin-right: 15px; width: 40px; height: 40px; background: #f0f0f0; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span class="dashicons dashicons-cart"></span>
            </div>
            <div style="flex: 1; overflow-wrap: break-word; word-wrap: break-word;">
              <h4 style="margin: 0 0 8px; font-size: 15px; font-weight: 500;">${
                product.title || "Untitled Product"
              }</h4>
              <p style="color: #666; margin: 0 0 8px; font-size: 13px;">${shortDesc}</p>
              ${
                product.handle
                  ? `
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                  <span style="background: #f0f0f0; color: #333; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${product.handle}</span>
                </div>
              `
                  : ""
              }
            </div>
            <div style="display: flex; align-items: center; margin-left: 15px;">
              <a href="${
                product.url || "#"
              }" target="_blank" class="button button-small">View</a>
            </div>
          </div>
        `;
      });

      $("#products-content").html(productsHtml || "<p>No products found.</p>");
      $(
        '.content-tab[data-content-type="products"] div:first-of-type + div'
      ).text(content.products.length);
    }

    // Update Pages section
    if (content.pages && content.pages.length > 0) {
      let pagesHtml = "";
      content.pages.forEach((page) => {
        // Extract a short description from content
        const shortContent = page.content
          ? page.content.length > 150
            ? page.content.substring(0, 150) + "..."
            : page.content
          : "No content available";

        pagesHtml += `
          <div style="display: flex; padding: 15px; border-bottom: 1px solid #eee;">
            <div style="margin-right: 15px; width: 40px; height: 40px; background: #f0f0f0; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span class="dashicons dashicons-admin-page"></span>
            </div>
            <div style="flex: 1; overflow-wrap: break-word; word-wrap: break-word;">
              <h4 style="margin: 0 0 8px; font-size: 15px; font-weight: 500;">${
                page.title || "Untitled Page"
              }</h4>
              <p style="color: #666; margin: 0 0 8px; font-size: 13px;">${shortContent}</p>
            </div>
            <div style="display: flex; align-items: center; margin-left: 15px;">
              <a href="${
                page.url || "#"
              }" target="_blank" class="button button-small">View</a>
            </div>
          </div>
        `;
      });

      $("#pages-content").html(pagesHtml || "<p>No pages found.</p>");
      $('.content-tab[data-content-type="pages"] div:first-of-type + div').text(
        content.pages.length
      );
    }

    // Update Blog Posts section
    if (content.blogPosts && content.blogPosts.length > 0) {
      let postsHtml = "";
      content.blogPosts.forEach((post) => {
        // Extract a short description from content
        const shortContent = post.content
          ? post.content.length > 150
            ? post.content.substring(0, 150) + "..."
            : post.content
          : "No content available";

        postsHtml += `
          <div style="display: flex; padding: 15px; border-bottom: 1px solid #eee;">
            <div style="margin-right: 15px; width: 40px; height: 40px; background: #f0f0f0; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span class="dashicons dashicons-admin-post"></span>
            </div>
            <div style="flex: 1; overflow-wrap: break-word; word-wrap: break-word;">
              <h4 style="margin: 0 0 8px; font-size: 15px; font-weight: 500;">${
                post.title || "Untitled Post"
              }</h4>
              <p style="color: #666; margin: 0 0 8px; font-size: 13px;">${shortContent}</p>
            </div>
            <div style="display: flex; align-items: center; margin-left: 15px;">
              <a href="${
                post.url || "#"
              }" target="_blank" class="button button-small">View</a>
            </div>
          </div>
        `;
      });

      $("#posts-content").html(postsHtml || "<p>No blog posts found.</p>");
      $('.content-tab[data-content-type="posts"] div:first-of-type + div').text(
        content.blogPosts.length
      );
    }

    // Update other stats from the data
    if (detailedData.stats) {
      // Update statistics
      if (detailedData.stats.totalRedirects !== undefined) {
        $(".analytics-redirects").text(detailedData.stats.totalRedirects);
      }

      if (detailedData.stats.redirectRate !== undefined) {
        $(".analytics-redirect-rate").text(
          detailedData.stats.redirectRate + "%"
        );
      }

      if (detailedData.stats.totalTextChats !== undefined) {
        $(".analytics-text-chats").text(detailedData.stats.totalTextChats);
      }

      if (detailedData.stats.totalVoiceChats !== undefined) {
        $(".analytics-voice-chats").text(detailedData.stats.totalVoiceChats);
      }

      // Action statistics
      if (detailedData.stats.aiRedirects !== undefined) {
        $(".action-redirects").text(detailedData.stats.aiRedirects);
      }

      if (detailedData.stats.aiPurchases !== undefined) {
        $(".action-purchases").text(detailedData.stats.aiPurchases);
      }

      if (detailedData.stats.aiClicks !== undefined) {
        $(".action-clicks").text(detailedData.stats.aiClicks);
      }

      if (detailedData.stats.aiScrolls !== undefined) {
        $(".action-scrolls").text(detailedData.stats.aiScrolls);
      }
    }
  }

  // Load website info when page loads
  loadWebsiteInfo();

  // Update the click handler for toggle status button
  $(document).on("click", ".toggle-status-btn", function () {
    const websiteId = $(this).data("website-id");
    const $button = $(this);

    if (!websiteId) {
      alert("Could not identify website. Please try refreshing the page.");
      return;
    }

    // Disable button during request
    $button.prop("disabled", true);

    const apiUrl = voiceroConfig.apiUrl || "http://localhost:3000/api";

    fetch(apiUrl + "/websites/toggle-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        websiteId: websiteId || undefined,
        accessKey: voiceroAdminConfig.accessKey || undefined,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        // Refresh the page to show updated status
        window.location.reload();
      })
      .catch((error) => {
        alert(
          "Failed to toggle website status: " +
            error.message +
            ". Please try again."
        );
      })
      .finally(() => {
        $button.prop("disabled", false);
      });
  });

  // Add script to detect nav height and position button
  function updateNavbarPositioning() {
    // Find the navigation element - checking common WordPress nav classes/IDs
    const nav = document.querySelector(
      "header, " + // Try header first
        "#masthead, " + // Common WordPress header ID
        ".site-header, " + // Common header class
        "nav.navbar, " + // Bootstrap navbar
        "nav.main-navigation, " + // Common nav classes
        ".nav-primary, " +
        "#site-navigation, " +
        ".site-navigation"
    );

    if (nav) {
      const navRect = nav.getBoundingClientRect();
      const navBottom = Math.max(navRect.bottom, 32); // Minimum 32px from top

      // Set the custom property for positioning
      document.documentElement.style.setProperty(
        "--nav-bottom",
        navBottom + "px"
      );
    }
  }

  // Run on load
  updateNavbarPositioning();

  // Run on resize
  window.addEventListener("resize", updateNavbarPositioning);

  // Run after a short delay to catch any dynamic header changes
  setTimeout(updateNavbarPositioning, 500);

  // Function to handle content type section toggling
  $(document).on("click", ".content-type-header", function () {
    $(this).next(".content-type-items").slideToggle();
    $(this)
      .find(".toggle-icon")
      .toggleClass("dashicons-arrow-down dashicons-arrow-up");
  });

  // Function to display content statistics with expandable sections
  function displayContentStatistics(detailedData) {
    const $container = $("#website-detailed-info");

    // Add section after the analytics cards
    let contentHtml = `
      <div class="card" style="margin-top: 20px; background: white; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="padding: 15px 20px; border-bottom: 1px solid #eee;">
          <h3 style="margin: 0; font-size: 16px;">Content Statistics</h3>
          <p style="margin: 5px 0 0; color: #666; font-size: 13px;">Click on a content type to view details</p>
        </div>
        <div style="padding: 20px;">
    `;

    // Pages section
    if (
      detailedData.content &&
      detailedData.content.pages &&
      detailedData.content.pages.length > 0
    ) {
      const pages = detailedData.content.pages;
      contentHtml += `
        <div class="content-type-section" style="margin-bottom: 15px;">
          <div class="content-type-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f0f0f1; cursor: pointer; border-radius: 4px;">
            <h4 style="margin: 0; font-size: 15px;">Pages (${pages.length})</h4>
            <span class="toggle-icon dashicons dashicons-arrow-down"></span>
          </div>
          <div class="content-type-items" style="display: none; padding: 10px; border: 1px solid #eee; border-top: none; margin-bottom: 10px;">
            <table class="widefat" style="border: none;">
              <thead>
                <tr>
                  <th style="width: 60%;">Title</th>
                  <th style="width: 20%;">URL</th>
                  <th style="width: 20%;">Redirects</th>
                </tr>
              </thead>
              <tbody>
      `;

      pages.forEach((page) => {
        contentHtml += `
          <tr>
            <td>${page.title || "Untitled"}</td>
            <td><a href="${
              page.url
            }" target="_blank" class="button button-small">View</a></td>
            <td>${page.aiRedirects || 0}</td>
          </tr>
        `;
      });

      contentHtml += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Products section
    if (
      detailedData.content &&
      detailedData.content.products &&
      detailedData.content.products.length > 0
    ) {
      const products = detailedData.content.products;
      contentHtml += `
        <div class="content-type-section" style="margin-bottom: 15px;">
          <div class="content-type-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f0f0f1; cursor: pointer; border-radius: 4px;">
            <h4 style="margin: 0; font-size: 15px;">Products (${products.length})</h4>
            <span class="toggle-icon dashicons dashicons-arrow-down"></span>
          </div>
          <div class="content-type-items" style="display: none; padding: 10px; border: 1px solid #eee; border-top: none; margin-bottom: 10px;">
            <table class="widefat" style="border: none;">
              <thead>
                <tr>
                  <th style="width: 40%;">Title</th>
                  <th style="width: 40%;">Description</th>
                  <th style="width: 10%;">URL</th>
                  <th style="width: 10%;">Redirects</th>
                </tr>
              </thead>
              <tbody>
      `;

      products.forEach((product) => {
        // Truncate description to 100 characters
        const shortDesc = product.description
          ? product.description.length > 100
            ? product.description.substring(0, 100) + "..."
            : product.description
          : "";

        contentHtml += `
          <tr>
            <td>${product.title || "Untitled"}</td>
            <td>${shortDesc}</td>
            <td><a href="${
              product.url
            }" target="_blank" class="button button-small">View</a></td>
            <td>${product.aiRedirects || 0}</td>
          </tr>
        `;
      });

      contentHtml += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Blog Posts section
    if (
      detailedData.content &&
      detailedData.content.blogPosts &&
      detailedData.content.blogPosts.length > 0
    ) {
      const posts = detailedData.content.blogPosts;
      contentHtml += `
        <div class="content-type-section" style="margin-bottom: 15px;">
          <div class="content-type-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f0f0f1; cursor: pointer; border-radius: 4px;">
            <h4 style="margin: 0; font-size: 15px;">Blog Posts (${posts.length})</h4>
            <span class="toggle-icon dashicons dashicons-arrow-down"></span>
          </div>
          <div class="content-type-items" style="display: none; padding: 10px; border: 1px solid #eee; border-top: none; margin-bottom: 10px;">
            <table class="widefat" style="border: none;">
              <thead>
                <tr>
                  <th style="width: 50%;">Title</th>
                  <th style="width: 30%;">URL</th>
                  <th style="width: 20%;">Redirects</th>
                </tr>
              </thead>
              <tbody>
      `;

      posts.forEach((post) => {
        contentHtml += `
          <tr>
            <td>${post.title || "Untitled"}</td>
            <td><a href="${
              post.url
            }" target="_blank" class="button button-small">View</a></td>
            <td>${post.aiRedirects || 0}</td>
          </tr>
        `;
      });

      contentHtml += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Collections section
    if (
      detailedData.content &&
      detailedData.content.collections &&
      detailedData.content.collections.length > 0
    ) {
      const collections = detailedData.content.collections;
      contentHtml += `
        <div class="content-type-section" style="margin-bottom: 15px;">
          <div class="content-type-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f0f0f1; cursor: pointer; border-radius: 4px;">
            <h4 style="margin: 0; font-size: 15px;">Collections (${collections.length})</h4>
            <span class="toggle-icon dashicons dashicons-arrow-down"></span>
          </div>
          <div class="content-type-items" style="display: none; padding: 10px; border: 1px solid #eee; border-top: none; margin-bottom: 10px;">
            <table class="widefat" style="border: none;">
              <thead>
                <tr>
                  <th style="width: 40%;">Title</th>
                  <th style="width: 40%;">Description</th>
                  <th style="width: 20%;">Redirects</th>
                </tr>
              </thead>
              <tbody>
      `;

      collections.forEach((collection) => {
        const shortDesc = collection.description
          ? collection.description.length > 100
            ? collection.description.substring(0, 100) + "..."
            : collection.description
          : "";

        contentHtml += `
          <tr>
            <td>${collection.title || "Untitled"}</td>
            <td>${shortDesc}</td>
            <td>${collection.aiRedirects || 0}</td>
          </tr>
        `;
      });

      contentHtml += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    contentHtml += `
        </div>
      </div>
    `;

    return contentHtml;
  }
});
