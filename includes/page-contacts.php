<?php
// includes/page-contacts.php
if ( ! defined('ABSPATH') ) {
    exit;
}

/**
 * Renders the "Contacts" tab.
 * You can list saved contact‐form submissions here, or provide a quick contact form.
 */
function voicero_render_contacts_page() {
    ?>
    <div class="wrap voicero-contacts-page">
        <h1><?php esc_html_e( 'Customer Messages', 'voicero-ai' ); ?></h1>
        <p><?php esc_html_e( 'Manage customer inquiries and support requests', 'voicero-ai' ); ?></p>
        
        <div class="voicero-card">
            <div class="message-center-header">
                <div>
                    <h2 class="message-center-title"><?php esc_html_e( 'Message Center', 'voicero-ai' ); ?></h2>
                    <div class="message-center-subtitle">Is117a nj</div>
                </div>
                <div class="message-center-unread" id="unread-count">1 Unread</div>
            </div>
            
            <div class="message-stats">
                <div class="stat-box">
                    <div class="stat-value" id="total-messages">1</div>
                    <div class="stat-label"><?php esc_html_e( 'Total Messages', 'voicero-ai' ); ?></div>
                </div>
                
                <div class="stat-box">
                    <div class="stat-value" id="unread-messages">1</div>
                    <div class="stat-label"><?php esc_html_e( 'Unread', 'voicero-ai' ); ?></div>
                </div>
                
                <div class="stat-box high-priority">
                    <div class="stat-value" id="high-priority-messages">0</div>
                    <div class="stat-label"><?php esc_html_e( 'High Priority', 'voicero-ai' ); ?></div>
                </div>
                
                <div class="stat-box">
                    <div class="stat-value" id="response-rate">0%</div>
                    <div class="stat-label"><?php esc_html_e( 'Response Rate', 'voicero-ai' ); ?></div>
                </div>
            </div>
        </div>
        
        <div class="voicero-card">
            <div class="messages-header">
                <h2><?php esc_html_e( 'Recent Messages', 'voicero-ai' ); ?></h2>
                <button id="refresh-messages" class="button">
                    <span class="dashicons dashicons-update"></span>
                    <?php esc_html_e( 'Refresh', 'voicero-ai' ); ?>
                </button>
            </div>
            
            <p><?php esc_html_e( 'Customer inquiries and support requests', 'voicero-ai' ); ?></p>
            
            <div class="message-tabs">
                <a href="#" class="tab active" data-filter="all"><?php esc_html_e( 'All Messages', 'voicero-ai' ); ?> <span id="all-count">(1)</span></a>
                <a href="#" class="tab" data-filter="unread"><?php esc_html_e( 'Unread', 'voicero-ai' ); ?> <span id="unread-tab-count">(1)</span></a>
                <a href="#" class="tab" data-filter="read"><?php esc_html_e( 'Read', 'voicero-ai' ); ?> <span id="read-count">(0)</span></a>
            </div>
            
            <div id="messages-container" style="position: relative; min-height: 100px;">
                <!-- Messages will be loaded here via JavaScript -->
                <!-- For development/demo purposes, we'll show a static message initially -->
                <div class="message-item unread" data-id="1">
                    <div class="message-avatar">N</div>
                    <div class="message-content">
                        <div class="message-header">
                            <div class="message-info">
                                <div class="message-email">nolansselby@gmail.com</div>
                                <div class="message-meta">
                                    <span class="new-badge">New</span>
                                    <span class="message-time">5/27/2025, 10:05:05 AM</span>
                                </div>
                            </div>
                            <div class="message-actions">
                                <button class="button mark-read-btn">Mark Read</button>
                                <button class="button reply-btn">Reply</button>
                                <button class="button delete-btn">Delete</button>
                            </div>
                        </div>
                        <div class="message-body">return</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Include the JS file -->
        <script type="text/javascript" src="<?php echo esc_url(plugin_dir_url(__FILE__) . '../assets/js/admin/voicero-contacts.js'); ?>"></script>
    </div>
    <?php
}
