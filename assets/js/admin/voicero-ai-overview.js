/**
 * Voicero AI Overview
 * Handles the AI usage overview functionality
 */

(function ($) {
  "use strict";

  /**
   * Initialize the AI overview page
   */
  function initAIOverviewPage() {
    // Set up refresh data button
    $("#refresh-data-btn").on("click", function () {
      refreshData();
    });

    // Set up view more links for recent queries
    $(".view-more-link").on("click", function (e) {
      e.preventDefault();
      const $queryItem = $(this).closest(".query-item");
      viewConversationDetails($queryItem);
    });

    // Set up view all conversations button
    $("#view-all-conversations").on("click", function (e) {
      e.preventDefault();
      viewAllConversations();
    });

    // Set up manage settings button
    $("#manage-settings-btn").on("click", function () {
      navigateToSettings();
    });

    // First load website info to get the website ID, then load AI history data
    loadWebsiteInfo();
  }

  /**
   * Load website information first, then load AI history
   * Similar to the approach in voicero-settings.js
   */
  function loadWebsiteInfo() {
    // Show loading overlay
    showLoadingIndicator();

    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_nonce").val(),
          };

    console.log("Fetching website information first...");

    // Use jQuery AJAX to get website info
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_get_info",
        nonce: config.nonce,
      },
      success: function (response) {
        if (response.success && response.data) {
          const websiteData = response.data;
          console.log("Website data:", websiteData);

          // Save the website ID to use for AI history
          if (websiteData.id) {
            console.log("Got website ID:", websiteData.id);

            // Now load AI history with the website ID
            loadAIHistory(websiteData.id);
          } else {
            hideLoadingIndicator();
            showErrorMessage(
              "Website ID not found in the response. Please configure your website in the settings."
            );
            console.error("Website ID not found in the response:", websiteData);
          }
        } else {
          hideLoadingIndicator();
          showErrorMessage(
            "Failed to load website information. Please refresh the page and try again."
          );
          console.error("Failed to load website information:", response);
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        hideLoadingIndicator();
        console.error(
          "AJAX error while loading website info:",
          textStatus,
          errorThrown
        );
        console.error("Response:", jqXHR.responseText);
        showErrorMessage(
          "Failed to connect to the server. Please check your internet connection and try again."
        );
      },
    });
  }

  /**
   * Load AI history data from the API
   * @param {string} websiteId - The website ID to use for fetching history
   */
  function loadAIHistory(websiteId) {
    // Show loading indicator if it's not already shown
    if ($("#overview-loading").length === 0) {
      showLoadingIndicator();
    }

    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_nonce").val(),
          };

    console.log("Fetching AI history data for website ID:", websiteId);
    console.log("AJAX URL:", config.ajaxUrl);
    console.log("Nonce:", config.nonce);

    // Use jQuery AJAX just like in voicero-settings.js
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_get_ai_history",
        nonce: config.nonce,
        websiteId: websiteId,
      },
      success: function (response) {
        console.log("AI History API response:", response);
        hideLoadingIndicator();

        if (response.success) {
          // Display the AI history data
          displayAIHistory(response.data);
          console.log("AI History data processed successfully");
        } else {
          const errorMessage =
            response.data?.message ||
            "An error occurred while fetching AI history.";
          console.error("AI History API error:", errorMessage);
          showErrorMessage(errorMessage);
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("AJAX error while loading AI history:");
        console.error("Status:", textStatus);
        console.error("Error:", errorThrown);
        console.error("Response:", jqXHR.responseText);
        console.error("Status code:", jqXHR.status);

        let errorMsg = "An error occurred while fetching AI history.";
        if (jqXHR.responseText) {
          try {
            const responseData = JSON.parse(jqXHR.responseText);
            if (responseData.data && responseData.data.message) {
              errorMsg = responseData.data.message;
            }
          } catch (e) {
            // If we can't parse JSON, just use the raw response text
            if (jqXHR.responseText.length < 100) {
              errorMsg += " " + jqXHR.responseText;
            }
          }
        }

        hideLoadingIndicator();
        showErrorMessage(errorMsg + " (Status: " + jqXHR.status + ")");
      },
      complete: function (jqXHR, textStatus) {
        console.log("AJAX request complete with status:", textStatus);
      },
    });
  }

  /**
   * Display AI history data
   * @param {Object} data - The AI history data
   */
  function displayAIHistory(data) {
    console.log("Displaying AI history data:", data);

    // First, clear any existing static/placeholder content
    $(".analysis-list").empty();
    $(".recent-queries-list").empty();

    // Check if data is empty or has no relevant information
    const hasNoData =
      !data ||
      (data.analysis === null &&
        (!data.threads || data.threads.length === 0) &&
        data.threadCount === 0);

    if (hasNoData) {
      console.log("No AI history data available");

      // Show empty state messages
      $(".analysis-list").html(
        "<li>No AI usage analysis available yet. This will appear after more user interactions.</li>"
      );
      $(".recent-queries-list").html(
        "<div class='empty-state'>No recent conversations found. Conversations will appear here once users start interacting with the AI.</div>"
      );

      // Update stats to show zeros
      $(".usage-amount").text("0");
      $(".stats-grid .stats-value").text("-");

      return;
    }

    // Update analysis section if we have analysis data
    if (data.analysis) {
      console.log("Updating analysis with:", data.analysis);
      updateAnalysisSection(data.analysis);
    } else {
      $(".analysis-list").html(
        "<li>No AI usage analysis available yet. This will appear after more user interactions.</li>"
      );
    }

    // Update recent queries if we have thread data
    if (data.threads && data.threads.length > 0) {
      console.log(
        `Updating UI with ${data.threads.length} conversation threads`
      );
      updateRecentQueries(data.threads);
    } else {
      $(".recent-queries-list").html(
        "<div class='empty-state'>No recent conversations found. Conversations will appear here once users start interacting with the AI.</div>"
      );
    }

    // Update thread count/stats if available
    if (data.threadCount !== undefined) {
      $(".usage-amount").text(data.threadCount);
    } else {
      $(".usage-amount").text("0");
    }

    // Show a success message briefly
    showSuccessMessage("AI history data loaded successfully");
  }

  /**
   * Update the analysis section with the AI-generated analysis
   * @param {string} analysis - The analysis text
   */
  function updateAnalysisSection(analysis) {
    // Handle null or empty analysis
    if (!analysis) {
      $(".analysis-list").html("<li>No analysis data available</li>");
      return;
    }

    // Split the analysis into bullet points
    const bulletPoints = analysis
      .split(/•|\*/)
      .filter((point) => point.trim().length > 0);

    if (bulletPoints.length === 0) {
      $(".analysis-list").html(
        "<li>Analysis data was received but contained no bullet points</li>"
      );
      return;
    }

    // Create HTML for each bullet point
    const analysisHtml = bulletPoints
      .map((point) => `<li>${point.trim()}</li>`)
      .join("");

    // Update the analysis list
    $(".analysis-list").html(analysisHtml);
  }

  /**
   * Update the recent queries section with thread data
   * @param {Array} threads - The thread data
   */
  function updateRecentQueries(threads) {
    // Clear existing queries
    const $container = $(".recent-queries-list");
    $container.empty();

    // Check if threads is empty
    if (!threads || threads.length === 0) {
      $container.html(
        "<div class='empty-state'>No recent conversations found</div>"
      );
      return;
    }

    // Add each thread as a query item
    threads.forEach((thread) => {
      // Find the first user message to use as the query text
      const userMessage =
        thread.messages && thread.messages.find((msg) => msg.role === "user");
      const queryText =
        userMessage && userMessage.content
          ? userMessage.content
          : "No query text available";

      // Format the timestamp
      const timestamp = thread.lastMessageAt
        ? new Date(thread.lastMessageAt).toLocaleString()
        : "Unknown date";

      // Get message count with fallback
      const messageCount = thread.messageCount || thread.messages?.length || 0;

      // Create the query item
      const $queryItem = $(`
        <div class="query-item" data-thread-id="${thread.threadId || ""}">
            <div class="query-content">
                <div class="query-text">${queryText}</div>
                <div class="query-time">${timestamp}</div>
            </div>
            <div class="query-stats">
                <div class="message-count">${messageCount} messages</div>
                <a href="#" class="view-more-link">View More</a>
            </div>
        </div>
      `);

      // Add to container
      $container.append($queryItem);
    });
  }

  /**
   * Refresh data from the API
   */
  function refreshData() {
    // Show loading indicator
    showLoadingIndicator();

    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_nonce").val(),
          };

    console.log("Refreshing AI history data");

    // Use jQuery AJAX just like in voicero-settings.js
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_refresh_ai_stats",
        nonce: config.nonce,
      },
      success: function (response) {
        console.log("AI refresh response:", response);
        hideLoadingIndicator();

        if (response.success) {
          showSuccessMessage("Data refreshed successfully");

          // Reload the page to show updated data
          setTimeout(function () {
            location.reload();
          }, 1000);
        } else {
          const errorMessage =
            response.data?.message ||
            "An error occurred while refreshing data.";
          console.error("AI refresh error:", errorMessage);
          showErrorMessage(errorMessage);
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("AJAX error while refreshing data:");
        console.error("Status:", textStatus);
        console.error("Error:", errorThrown);
        console.error("Response:", jqXHR.responseText);
        console.error("Status code:", jqXHR.status);

        let errorMsg = "An error occurred while refreshing data.";
        if (jqXHR.responseText) {
          try {
            const responseData = JSON.parse(jqXHR.responseText);
            if (responseData.message) {
              errorMsg = responseData.message;
            }
          } catch (e) {
            // If we can't parse JSON, just use the raw response text
            if (jqXHR.responseText.length < 100) {
              errorMsg += " " + jqXHR.responseText;
            }
          }
        }

        hideLoadingIndicator();
        showErrorMessage(errorMsg + " (Status: " + jqXHR.status + ")");
      },
      complete: function (jqXHR, textStatus) {
        console.log("AJAX request complete with status:", textStatus);
      },
    });
  }

  /**
   * View conversation details
   * @param {Object} $queryItem - The query item jQuery object
   */
  function viewConversationDetails($queryItem) {
    const queryText = $queryItem.find(".query-text").text();
    const timestamp = $queryItem.find(".query-time").text();

    // In a real implementation, you would likely open a modal with conversation details
    // For now, we'll just navigate to a hypothetical conversation details page
    window.location.href =
      "admin.php?page=voicero-ai-conversations&query=" +
      encodeURIComponent(queryText) +
      "&time=" +
      encodeURIComponent(timestamp);
  }

  /**
   * View all conversations
   */
  function viewAllConversations() {
    // Navigate to a hypothetical conversations page
    window.location.href = "admin.php?page=voicero-ai-conversations";
  }

  /**
   * Navigate to settings page
   */
  function navigateToSettings() {
    window.location.href = "admin.php?page=voicero-ai-settings";
  }

  /**
   * Show a loading indicator
   */
  function showLoadingIndicator() {
    // Add a loading overlay if it doesn't exist
    if ($("#overview-loading").length === 0) {
      $("body").append(
        '<div id="overview-loading" class="loading-overlay"><span class="spinner is-active"></span><p>Refreshing data...</p></div>'
      );
    }

    // Show the overlay
    $("#overview-loading").fadeIn();
  }

  /**
   * Hide the loading indicator
   */
  function hideLoadingIndicator() {
    // Hide and remove the overlay
    $("#overview-loading").fadeOut(function () {
      $(this).remove();
    });
  }

  /**
   * Show a success message
   * @param {string} message - The success message
   */
  function showSuccessMessage(message) {
    const $notice = $(
      '<div class="notice notice-success is-dismissible"><p>' +
        message +
        "</p></div>"
    );
    $("#voicero-overview-message").html($notice);

    // Auto-dismiss after 5 seconds
    setTimeout(function () {
      $notice.fadeOut(function () {
        $(this).remove();
      });
    }, 5000);
  }

  /**
   * Show an error message
   * @param {string} message - The error message
   */
  function showErrorMessage(message) {
    const $notice = $(
      '<div class="notice notice-error is-dismissible"><p>' +
        message +
        "</p></div>"
    );
    $("#voicero-overview-message").html($notice);
  }

  // Initialize when the DOM is ready
  $(document).ready(function () {
    // Check if we're on the AI overview page
    if ($(".voicero-ai-overview-page").length > 0) {
      initAIOverviewPage();

      // Add CSS for the AI overview page
      addCustomCSS();
    }
  });

  /**
   * Add custom CSS for the AI overview page
   */
  function addCustomCSS() {
    $("head").append(`
            <style>
                /* AI Overview Page Styles */
                .voicero-ai-overview-page {
                    max-width: 800px;
                }
                
                .overview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .back-link {
                    text-decoration: none;
                    color: #2271b1;
                    display: flex;
                    align-items: center;
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .back-link .dashicons {
                    margin-right: 5px;
                }
                
                #refresh-data-btn {
                    display: flex;
                    align-items: center;
                }
                
                #refresh-data-btn .dashicons {
                    margin-right: 5px;
                }
                
                /* Card Styles */
                .voicero-card {
                    background: #fff;
                    border-radius: 5px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                    overflow: hidden;
                }
                
                .voicero-card-header {
                    display: flex;
                    align-items: center;
                    padding: 15px 20px;
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .card-header-icon {
                    margin-right: 15px;
                }
                
                .card-header-icon .dashicons {
                    color: #2271b1;
                    font-size: 20px;
                }
                
                .voicero-card-header h2 {
                    margin: 0;
                    flex-grow: 1;
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .voicero-card-content {
                    padding: 20px;
                }
                
                /* Monthly Query Usage */
                .usage-stats {
                    text-align: center;
                    padding: 10px 0;
                }
                
                .usage-amount {
                    font-size: 24px;
                    font-weight: 600;
                    margin-bottom: 5px;
                }
                
                .usage-description {
                    color: #666;
                    font-style: italic;
                }
                
                /* AI Usage Analysis */
                .analysis-list {
                    margin: 0;
                    padding-left: 20px;
                }
                
                .analysis-list li {
                    margin-bottom: 15px;
                    line-height: 1.5;
                }
                
                .analysis-list li:last-child {
                    margin-bottom: 0;
                }
                
                /* Usage Statistics */
                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                
                .stats-item {
                    display: flex;
                    align-items: flex-start;
                }
                
                .stats-label {
                    font-weight: 600;
                    margin-right: 10px;
                    width: 100px;
                    flex-shrink: 0;
                }
                
                .stats-value {
                    color: #333;
                }
                
                .plan-badge {
                    background-color: #2271b1;
                    color: white;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                /* Recent AI Queries */
                .recent-queries-list {
                    margin-bottom: 20px;
                }
                
                .query-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px solid #f0f0f0;
                }
                
                .query-item:last-child {
                    border-bottom: none;
                }
                
                .query-content {
                    flex-grow: 1;
                    padding-right: 15px;
                }
                
                .query-text {
                    font-weight: 500;
                    margin-bottom: 5px;
                }
                
                .query-time {
                    color: #666;
                    font-size: 12px;
                }
                
                .query-stats {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }
                
                .message-count {
                    background-color: #f0f6fc;
                    padding: 3px 8px;
                    border-radius: 10px;
                    font-size: 12px;
                    color: #2271b1;
                    margin-bottom: 5px;
                }
                
                .view-more-link {
                    font-size: 12px;
                    color: #2271b1;
                    text-decoration: none;
                }
                
                .view-all-container {
                    text-align: center;
                }
                
                /* Website Overview */
                .website-info {
                    display: grid;
                    gap: 15px;
                }
                
                .info-item {
                    display: flex;
                }
                
                .info-label {
                    font-weight: 600;
                    width: 100px;
                    flex-shrink: 0;
                }
                
                .info-value {
                    color: #333;
                }
                
                /* Loading Overlay */
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(255, 255, 255, 0.7);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }
                
                .loading-overlay .spinner {
                    float: none;
                    margin: 0 0 10px 0;
                }
            </style>
        `);
  }
})(jQuery);
