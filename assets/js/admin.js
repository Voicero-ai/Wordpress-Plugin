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
    e.preventDefault();
    const syncButton = $("#sync-button");
    const syncStatusContainer = $("#sync-status");

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
          console.error("Sync error:", error);
        });
    } catch (e) {
      updateProgress(
        0,
        `❌ Error: ${e.message || "An unknown error occurred"}`,
        true
      );
      syncButton.prop("disabled", false);
      console.error("Sync error:", e);
    }
  });

  // Function to load website info
  function loadWebsiteInfo() {
    const $container = $("#website-info-container");

    $.post(voiceroAdminConfig.ajaxUrl, {
      action: "voicero_get_info",
      nonce: voiceroAdminConfig.nonce,
    })
      .done(function (response) {
        if (response.success) {
          const data = response.data;

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
          const plan = data.plan || "Free";
          const queryLimit = data.queryLimit || "N/A";
          const isSubscribed = data.isSubscribed === true;

          // Format website name
          const name = data.name || window.location.hostname;

          // Build HTML for website info
          let html = `
                    <table class="widefat">
                        <tbody>
                            <tr>
                                <th>Website Name</th>
                                <td>
                                    ${name}
                                </td>
                            </tr>
                            <tr>
                                <th>URL</th>
                                <td>${data.url || "Not set"}</td>
                            </tr>
                            <tr>
                                <th>Plan</th>
                                <td>${plan}</td>
                            </tr>
                            ${
                              data.color
                                ? `
                            <tr>
                                <th>Color</th>
                                <td style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 24px; height: 24px; border-radius: 4px; background-color: ${data.color}; border: 1px solid #ddd;"></div>
                                    <code style="font-size: 13px; padding: 4px 8px; background: #f0f0f1; border-radius: 3px;">${data.color}</code>
                                </td>
                            </tr>
                            `
                                : ""
                            }
                            <tr>
                                <th>Status</th>
                                <td>
                                    <span class="button button-small ${
                                      data.active
                                        ? "button-primary"
                                        : "button-secondary"
                                    }">
                                        ${data.active ? "Active" : "Inactive"}
                                    </span>
                                    <button class="button button-small toggle-status-btn" 
                                            data-website-id="${data.id || ""}" 
                                            ${
                                              !data.lastSyncedAt
                                                ? 'disabled title="Please sync your website first"'
                                                : ""
                                            }>
                                        ${
                                          data.active
                                            ? "Deactivate"
                                            : "Activate"
                                        }
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <th>Monthly Queries</th>
                                <td>
                                    ${data.monthlyQueries || 0} / ${
            data.queryLimit || 200
          }
                                    <div class="progress-bar" style="
                                        background: #f0f0f1;
                                        height: 10px;
                                        border-radius: 5px;
                                        margin-top: 5px;
                                        overflow: hidden;
                                    ">
                                        <div style="
                                            width: ${
                                              ((data.monthlyQueries || 0) /
                                                (data.queryLimit || 200)) *
                                              100
                                            }%;
                                            background: #2271b1;
                                            height: 100%;
                                            transition: width 0.3s ease;
                                        "></div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th>Last Synced</th>
                                <td>${
                                  data.lastSyncedAt
                                    ? new Date(
                                        data.lastSyncedAt
                                      ).toLocaleString()
                                    : "Never"
                                }</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="margin-top: 20px; display: flex; gap: 10px; align-items: center;">
                        <a href="http://localhost:3000/app/websites/website?id=${
                          data.id || ""
                        }" target="_blank" class="button button-primary">
                            Open Dashboard
                        </a>
                        <button class="button toggle-status-btn" 
                                data-website-id="${data.id || ""}"
                                ${
                                  !data.lastSyncedAt
                                    ? 'disabled title="Please sync your website first"'
                                    : ""
                                }>
                            ${
                              data.active
                                ? "Deactivate Plugin"
                                : "Activate Plugin"
                            }
                        </button>
                        ${
                          !data.lastSyncedAt
                            ? `
                            <span class="description" style="color: #d63638;">
                                ⚠️ Please sync your website before activating the plugin
                            </span>
                        `
                            : ""
                        }
                    </div>

                    <div style="margin-top: 20px;">
                        <h3>Content Statistics</h3>
                        <table class="widefat">
                            <thead>
                                <tr>
                                    <th>Content Type</th>
                                    <th>Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Pages</td>
                                    <td>${data._count?.pages || 0}</td>
                                </tr>
                                <tr>
                                    <td>Posts</td>
                                    <td>${data._count?.posts || 0}</td>
                                </tr>
                                <tr>
                                    <td>Products</td>
                                    <td>${data._count?.products || 0}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;

          // Insert the HTML
          $container.html(html);

          // Only show first-time modal if we have a valid website connection
          // AND it has never been synced
          if (data && data.id && !data.lastSyncedAt) {
            // Show the modal
            $("#first-time-modal").fadeIn();

            // Handle modal close
            $(".modal-close").on("click", function () {
              $("#first-time-modal").fadeOut();
            });

            // Close modal when clicking outside
            $(window).on("click", function (e) {
              if ($(e.target).is("#first-time-modal")) {
                $("#first-time-modal").fadeOut();
              }
            });

            // Handle first sync button click in modal (uses the main sync logic)
            $("#first-sync-button").on("click", function () {
              const $modalContent = $(this).closest(".notice");
              $("#first-time-modal").fadeOut(); // Close modal immediately
              $("#sync-button").trigger("click"); // Trigger the main sync button
            });
          }
        } else {
          let errorMsg = "Failed to load website info";
          if (response && response.data && response.data.message) {
            errorMsg = response.data.message;
          } else if (response && response.data && response.data.body) {
            try {
              const body = JSON.parse(response.data.body);
              errorMsg = body.message || errorMsg;
            } catch (e) {}
          }

          $container.html(`
                    <div class="notice notice-error inline">
                        <p>Error loading website information: ${errorMsg}</p>
                        <p>Please try refreshing the page.</p>
                    </div>
                `);
        }
      })
      .fail(function (xhr, status, error) {
        $container.html(`
                    <div class="notice notice-error inline">
                        <p>Network error loading website information: ${
                          error || status
                        }</p>
                        <p>Please check your connection and try again.</p>
                    </div>
                `);
      });
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
});
