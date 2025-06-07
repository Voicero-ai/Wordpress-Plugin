<?php
// includes/page-settings.php
if ( ! defined('ABSPATH') ) {
    exit;
}

/**
 * Renders the "Settings" tab.
 * Here you can let the admin save the access key, toggle features, etc.
 */
function voicero_render_settings_page() {
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Voicero AI Settings', 'voicero-ai' ); ?></h1>
        <?php settings_errors( 'voicero_messages' ); ?>

        <?php
        $saved_key = voicero_get_access_key();
        ?>

        <div class="card voicero-card" style="max-width: 800px; margin-top: 20px;">
            <h2><?php esc_html_e('Connection Status', 'voicero-ai'); ?></h2>
            
            <?php if ($saved_key): ?>
                <div class="notice notice-success inline" style="margin: 10px 0;">
                    <p><strong><?php esc_html_e('Connected!', 'voicero-ai'); ?></strong> <?php esc_html_e('Your website is connected to Voicero AI.', 'voicero-ai'); ?></p>
                </div>
                
                <p><?php esc_html_e('Your AI assistant is actively helping your visitors. You can clear the connection if you want to disconnect from the service.', 'voicero-ai'); ?></p>
                
                <button type="button" id="clear-connection" class="button button-secondary">
                    <?php esc_html_e('Clear Connection', 'voicero-ai'); ?>
                </button>
            <?php else: ?>
                <div class="notice notice-warning inline" style="margin: 10px 0;">
                    <p><strong><?php esc_html_e('Not Connected', 'voicero-ai'); ?></strong> <?php esc_html_e('Your website is not connected to Voicero AI.', 'voicero-ai'); ?></p>
                </div>
                
                <p><?php esc_html_e('Please go to the main Voicero AI page to connect your website.', 'voicero-ai'); ?></p>
                
                <a href="<?php echo esc_url(admin_url('admin.php?page=voicero-ai-admin')); ?>" class="button button-primary">
                    <?php esc_html_e('Go to Connection Page', 'voicero-ai'); ?>
                </a>
            <?php endif; ?>
        </div>

        <!-- Website Information Section -->
        <div class="card voicero-card" style="max-width: 800px; margin-top: 20px;">
            <div class="voicero-card-header">
                <h2><?php esc_html_e('Website Information', 'voicero-ai'); ?></h2>
                <button type="button" class="button button-secondary voicero-edit-button" data-section="website">
                    <?php esc_html_e('Edit', 'voicero-ai'); ?>
                </button>
            </div>
            
            <div class="voicero-section-content" id="website-info-view">
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Status:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value">
                        <span class="voicero-status-active"><?php esc_html_e('Active', 'voicero-ai'); ?></span>
                        <button type="button" id="toggle-status" class="button button-secondary voicero-small-button">
                            <?php esc_html_e('Deactivate', 'voicero-ai'); ?>
                        </button>
                    </div>
                </div>
                
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Website Name:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value" id="website-name-display">Is117a nj</div>
                </div>
                
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Website URL:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value" id="website-url-display">https://is117a-nj.myshopify.com</div>
                </div>
                
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Custom Instructions:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value" id="custom-instructions-display">
                        <em><?php esc_html_e('No custom instructions set', 'voicero-ai'); ?></em>
                    </div>
                </div>
            </div>
            
            <div class="voicero-section-edit hidden" id="website-info-edit">
                <form id="website-info-form">
                    <div class="voicero-field-group">
                        <label for="website-name"><?php esc_html_e('Website Name:', 'voicero-ai'); ?></label>
                        <input type="text" id="website-name" name="website-name" value="Is117a nj" class="regular-text">
                    </div>
                    
                    <div class="voicero-field-group">
                        <label for="website-url"><?php esc_html_e('Website URL:', 'voicero-ai'); ?></label>
                        <input type="url" id="website-url" name="website-url" value="https://is117a-nj.myshopify.com" class="regular-text">
                    </div>
                    
                    <div class="voicero-field-group">
                        <label for="custom-instructions"><?php esc_html_e('Custom Instructions:', 'voicero-ai'); ?></label>
                        <textarea id="custom-instructions" name="custom-instructions" rows="4" class="large-text"></textarea>
                        <p class="description"><?php esc_html_e('Add special instructions for how your AI assistant should behave or respond.', 'voicero-ai'); ?></p>
                    </div>
                    
                    <div class="voicero-form-actions">
                        <button type="button" class="button button-secondary voicero-cancel-button" data-section="website">
                            <?php esc_html_e('Cancel', 'voicero-ai'); ?>
                        </button>
                        <button type="submit" class="button button-primary">
                            <?php esc_html_e('Save Changes', 'voicero-ai'); ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- User Settings Section -->
        <div class="card voicero-card" style="max-width: 800px; margin-top: 20px;">
            <div class="voicero-card-header">
                <h2><?php esc_html_e('User Settings', 'voicero-ai'); ?></h2>
                <button type="button" class="button button-secondary voicero-edit-button" data-section="user">
                    <?php esc_html_e('Edit', 'voicero-ai'); ?>
                </button>
            </div>
            
            <div class="voicero-section-content" id="user-settings-view">
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Name:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value" id="user-name-display">Voicero Shopify Testing</div>
                </div>
                
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Username:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value" id="username-display">tester</div>
                </div>
                
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Email:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value" id="email-display"></div>
                </div>
            </div>
            
            <div class="voicero-section-edit hidden" id="user-settings-edit">
                <form id="user-settings-form">
                    <div class="voicero-field-group">
                        <label for="user-name"><?php esc_html_e('Name:', 'voicero-ai'); ?></label>
                        <input type="text" id="user-name" name="user-name" value="Voicero Shopify Testing" class="regular-text">
                    </div>
                    
                    <div class="voicero-field-group">
                        <label for="username"><?php esc_html_e('Username:', 'voicero-ai'); ?></label>
                        <input type="text" id="username" name="username" value="tester" class="regular-text">
                    </div>
                    
                    <div class="voicero-field-group">
                        <label for="email"><?php esc_html_e('Email:', 'voicero-ai'); ?></label>
                        <input type="email" id="email" name="email" value="" class="regular-text">
                    </div>
                    
                    <div class="voicero-form-actions">
                        <button type="button" class="button button-secondary voicero-cancel-button" data-section="user">
                            <?php esc_html_e('Cancel', 'voicero-ai'); ?>
                        </button>
                        <button type="submit" class="button button-primary">
                            <?php esc_html_e('Save Changes', 'voicero-ai'); ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- AI Auto Features Section -->
        <div class="card voicero-card" style="max-width: 800px; margin-top: 20px;">
            <div class="voicero-card-header">
                <h2><?php esc_html_e('AI Auto Features', 'voicero-ai'); ?></h2>
                <button type="button" class="button button-secondary voicero-edit-button" data-section="ai-features">
                    <?php esc_html_e('Edit', 'voicero-ai'); ?>
                </button>
            </div>
            
            <div class="voicero-section-content" id="ai-features-view">
                <p><?php esc_html_e('Control which automated actions your AI assistant can perform. Disabling certain features may limit functionality.', 'voicero-ai'); ?></p>
                
                <div class="voicero-warning-notice">
                    <span class="dashicons dashicons-warning"></span>
                    <p><?php esc_html_e('Disabling these features will significantly reduce the effectiveness of your AI assistant.', 'voicero-ai'); ?></p>
                </div>
                
                <h3><?php esc_html_e('Critical Features', 'voicero-ai'); ?></h3>
                <ul class="voicero-features-list">
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to automatically redirect users to relevant pages', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to scroll to relevant sections on the page', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to highlight important elements on the page', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to click buttons and links on behalf of users', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to automatically fill forms for users', 'voicero-ai'); ?>
                    </li>
                </ul>
                
                <h3><?php esc_html_e('Order Features', 'voicero-ai'); ?></h3>
                <ul class="voicero-features-list">
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to help users cancel orders', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to help users return products', 'voicero-ai'); ?>
                        <span class="voicero-coming-soon"><?php esc_html_e('Coming Soon', 'voicero-ai'); ?></span>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to help users exchange products', 'voicero-ai'); ?>
                        <span class="voicero-coming-soon"><?php esc_html_e('Coming Soon', 'voicero-ai'); ?></span>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to help users track their orders', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to fetch and display user order history', 'voicero-ai'); ?>
                    </li>
                </ul>
                
                <h3><?php esc_html_e('User Data Features', 'voicero-ai'); ?></h3>
                <ul class="voicero-features-list">
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to help users update their account information', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to help users log out', 'voicero-ai'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to help users log in', 'voicero-ai'); ?>
                    </li>
                </ul>
                
                <h3><?php esc_html_e('Content Generation Features', 'voicero-ai'); ?></h3>
                <ul class="voicero-features-list">
                    <li>
                        <span class="dashicons dashicons-yes"></span> 
                        <?php esc_html_e('Allow AI to generate images for users', 'voicero-ai'); ?>
                        <span class="voicero-coming-soon"><?php esc_html_e('Coming Soon', 'voicero-ai'); ?></span>
                    </li>
                </ul>
            </div>
            
            <div class="voicero-section-edit hidden" id="ai-features-edit">
                <form id="ai-features-form">
                    <p><?php esc_html_e('Control which automated actions your AI assistant can perform. Disabling certain features may limit functionality.', 'voicero-ai'); ?></p>
                    
                    <div class="voicero-warning-notice">
                        <span class="dashicons dashicons-warning"></span>
                        <p><?php esc_html_e('Disabling these features will significantly reduce the effectiveness of your AI assistant.', 'voicero-ai'); ?></p>
                    </div>
                    
                    <h3><?php esc_html_e('Critical Features', 'voicero-ai'); ?></h3>
                    <div class="voicero-feature-toggles">
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_redirect" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to automatically redirect users to relevant pages', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_scroll" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to scroll to relevant sections on the page', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_highlight" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to highlight important elements on the page', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_click" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to click buttons and links on behalf of users', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_forms" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to automatically fill forms for users', 'voicero-ai'); ?></span>
                        </label>
                    </div>
                    
                    <h3><?php esc_html_e('Order Features', 'voicero-ai'); ?></h3>
                    <div class="voicero-feature-toggles">
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_cancel_orders" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to help users cancel orders', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle voicero-disabled">
                            <input type="checkbox" name="ai_return_products" value="1" checked disabled>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label">
                                <?php esc_html_e('Allow AI to help users return products', 'voicero-ai'); ?>
                                <span class="voicero-coming-soon"><?php esc_html_e('Coming Soon', 'voicero-ai'); ?></span>
                            </span>
                        </label>
                        
                        <label class="voicero-toggle voicero-disabled">
                            <input type="checkbox" name="ai_exchange_products" value="1" checked disabled>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label">
                                <?php esc_html_e('Allow AI to help users exchange products', 'voicero-ai'); ?>
                                <span class="voicero-coming-soon"><?php esc_html_e('Coming Soon', 'voicero-ai'); ?></span>
                            </span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_track_orders" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to help users track their orders', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_order_history" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to fetch and display user order history', 'voicero-ai'); ?></span>
                        </label>
                    </div>
                    
                    <h3><?php esc_html_e('User Data Features', 'voicero-ai'); ?></h3>
                    <div class="voicero-feature-toggles">
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_update_account" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to help users update their account information', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_logout" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to help users log out', 'voicero-ai'); ?></span>
                        </label>
                        
                        <label class="voicero-toggle">
                            <input type="checkbox" name="ai_login" value="1" checked>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label"><?php esc_html_e('Allow AI to help users log in', 'voicero-ai'); ?></span>
                        </label>
                    </div>
                    
                    <h3><?php esc_html_e('Content Generation Features', 'voicero-ai'); ?></h3>
                    <div class="voicero-feature-toggles">
                        <label class="voicero-toggle voicero-disabled">
                            <input type="checkbox" name="ai_generate_images" value="1" checked disabled>
                            <span class="voicero-toggle-slider"></span>
                            <span class="voicero-toggle-label">
                                <?php esc_html_e('Allow AI to generate images for users', 'voicero-ai'); ?>
                                <span class="voicero-coming-soon"><?php esc_html_e('Coming Soon', 'voicero-ai'); ?></span>
                            </span>
                        </label>
                    </div>
                    
                    <div class="voicero-form-actions">
                        <button type="button" class="button button-secondary voicero-cancel-button" data-section="ai-features">
                            <?php esc_html_e('Cancel', 'voicero-ai'); ?>
                        </button>
                        <button type="submit" class="button button-primary">
                            <?php esc_html_e('Save Changes', 'voicero-ai'); ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- Subscription Information Section -->
        <div class="card voicero-card" style="max-width: 800px; margin-top: 20px;">
            <div class="voicero-card-header">
                <h2><?php esc_html_e('Subscription Information', 'voicero-ai'); ?></h2>
            </div>
            
            <div class="voicero-section-content">
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Current Plan:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value">
                        <span class="voicero-plan-badge">Enterprise</span>
                    </div>
                </div>
                
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Price:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value">$19/month</div>
                </div>
                
                <div class="voicero-field-group">
                    <div class="voicero-field-label"><?php esc_html_e('Last Synced:', 'voicero-ai'); ?></div>
                    <div class="voicero-field-value">5/31/2025, 10:24:40 PM</div>
                </div>
                
                <div class="voicero-subscription-actions" id="subscription-button-container">
                    <a href="<?php 
                        $website_id = get_option('voicero_website_id', ''); 
                        echo esc_url('http://localhost:3000/app/websites/website?id=' . $website_id);
                    ?>" class="button button-primary" target="_blank">
                        <?php esc_html_e('Update Subscription', 'voicero-ai'); ?>
                    </a>
                </div>
            </div>
        </div>

        <?php 
        // Add script to handle the clear connection button
        if ($saved_key): 
        ?>
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            // FIXED: Set the subscription link with proper debugging to ensure it works
            console.log("Setting subscription link...");
            console.log("voiceroConfig:", window.voiceroConfig);
            
            // Force set the link with the correct website ID
            var websiteId = "<?php echo esc_js(get_option('voicero_website_id', '')); ?>";
            console.log("Website ID from PHP:", websiteId);
            
            // Always set the link, using the PHP value directly
            var subscriptionUrl = "http://localhost:3000/app/websites/website?id=" + websiteId;
            console.log("Setting subscription URL to:", subscriptionUrl);
            $('#update-subscription-link').attr('href', subscriptionUrl);
            
            // Clear connection handler
            $('#clear-connection').on('click', function() {
                if (confirm('<?php esc_html_e('Are you sure you want to clear the connection? Your AI assistant will stop working until you reconnect.', 'voicero-ai'); ?>')) {
                    // Create a config object with fallbacks if voiceroConfig isn't defined
                    var config = typeof voiceroConfig !== 'undefined' ? voiceroConfig : {
                        ajaxUrl: '<?php echo esc_url(admin_url('admin-ajax.php')); ?>',
                        nonce: '<?php echo wp_create_nonce('voicero_ajax_nonce'); ?>'
                    };
                    
                    $.ajax({
                        url: config.ajaxUrl,
                        type: 'POST',
                        data: {
                            action: 'voicero_clear_connection',
                            nonce: config.nonce
                        },
                        success: function(response) {
                            if (response.success) {
                                location.reload();
                            } else {
                                alert(response.data.message);
                            }
                        },
                        error: function() {
                            alert('<?php esc_html_e('An error occurred. Please try again.', 'voicero-ai'); ?>');
                        }
                    });
                }
            });
        });
        </script>
        <?php endif; ?>
        
        <!-- Include the JS file -->
        <script type="text/javascript" src="<?php echo esc_url(plugin_dir_url(__FILE__) . '../assets/js/admin/voicero-settings.js'); ?>"></script>
        
        <!-- Add inline CSS for the settings page -->
        <style type="text/css">
            .voicero-card {
                border-radius: 5px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                padding: 20px;
            }
            
            .voicero-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                border-bottom: 1px solid #eee;
                padding-bottom: 10px;
            }
            
            .voicero-card-header h2 {
                margin: 0;
            }
            
            .voicero-field-group {
                display: flex;
                margin-bottom: 15px;
            }
            
            .voicero-field-label {
                font-weight: 600;
                width: 150px;
                flex-shrink: 0;
            }
            
            .voicero-field-value {
                flex-grow: 1;
            }
            
            .voicero-status-active {
                color: #46b450;
                font-weight: 600;
                margin-right: 10px;
            }
            
            .voicero-small-button {
                padding: 0 5px;
                height: 24px;
                line-height: 22px;
            }
            
            .voicero-warning-notice {
                background-color: #fff8e5;
                border-left: 4px solid #ffb900;
                padding: 10px 15px;
                margin: 10px 0;
                display: flex;
                align-items: center;
            }
            
            .voicero-warning-notice span.dashicons {
                color: #ffb900;
                margin-right: 10px;
                font-size: 20px;
            }
            
            .voicero-warning-notice p {
                margin: 0;
            }
            
            .voicero-features-list {
                margin: 0;
                padding: 0;
                list-style: none;
            }
            
            .voicero-features-list li {
                padding: 5px 0;
                display: flex;
                align-items: center;
            }
            
            .voicero-features-list .dashicons {
                color: #46b450;
                margin-right: 10px;
            }
            
            .voicero-coming-soon {
                background-color: #f0f0f1;
                color: #50575e;
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 3px;
                margin-left: 10px;
            }
            
            .voicero-plan-badge {
                background-color: #2271b1;
                color: white;
                padding: 3px 8px;
                border-radius: 3px;
                font-weight: 600;
            }
            
            .voicero-subscription-actions {
                margin-top: 20px;
            }
            
            .voicero-section-edit {
                margin-top: 20px;
            }
            
            .voicero-form-actions {
                margin-top: 20px;
                text-align: right;
            }
            
            .voicero-toggle {
                position: relative;
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                cursor: pointer;
            }
            
            .voicero-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .voicero-toggle-slider {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
                background-color: #ccc;
                border-radius: 34px;
                margin-right: 15px;
                flex-shrink: 0;
            }
            
            .voicero-toggle-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            
            .voicero-toggle input:checked + .voicero-toggle-slider {
                background-color: #2271b1;
            }
            
            .voicero-toggle input:checked + .voicero-toggle-slider:before {
                transform: translateX(20px);
            }
            
            .voicero-toggle.voicero-disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }
            
            .voicero-feature-toggles {
                margin-bottom: 20px;
            }
            
            .hidden {
                display: none;
            }
        </style>
    </div>
    <?php
}
