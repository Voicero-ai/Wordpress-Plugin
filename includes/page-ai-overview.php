<?php
// includes/page-ai-overview.php
if ( ! defined('ABSPATH') ) {
    exit;
}

/**
 * Renders the "AI Overview" tab.
 */
function voicero_render_ai_overview_page() {
    // Get website ID and last synced time
    $website_id = get_option('voicero_website_id', '');
    $last_synced = get_option('voicero_last_synced', '5/31/2025, 10:24:40 PM');
    $website_url = get_option('voicero_website_url', 'https://is117a-nj.myshopify.com');
    
    // Default data (for development)
    $total_queries = 1002;
    $query_limit = 'Unlimited';
    $current_plan = 'Enterprise';
    
    // Recent queries sample data
    $recent_queries = [
        [
            'query' => 'Hello how are you?',
            'timestamp' => '5/31/2025 10:46 PM',
            'message_count' => 20
        ],
        [
            'query' => 'how does shipping work?',
            'timestamp' => '5/30/2025 07:43 PM',
            'message_count' => 11
        ],
        [
            'query' => 'create a pcitroe of m',
            'timestamp' => '5/29/2025 12:59 PM',
            'message_count' => 6
        ],
        [
            'query' => 'what blogs do you have?',
            'timestamp' => '5/27/2025 09:39 AM',
            'message_count' => 8
        ],
        [
            'query' => 'I want to contact the company',
            'timestamp' => '5/27/2025 09:19 AM',
            'message_count' => 24
        ],
        [
            'query' => 'what blogs do you have',
            'timestamp' => '5/27/2025 09:12 AM',
            'message_count' => 10
        ],
        [
            'query' => 'what inside my gtr?',
            'timestamp' => '5/27/2025 08:52 AM',
            'message_count' => 8
        ],
        [
            'query' => 'I need to return a product',
            'timestamp' => '5/27/2025 08:35 AM',
            'message_count' => 10
        ],
        [
            'query' => 'hilgihte "All Products"',
            'timestamp' => '5/27/2025 02:16 AM',
            'message_count' => 8
        ],
        [
            'query' => 'tell me about the website',
            'timestamp' => '5/27/2025 01:53 AM',
            'message_count' => 18
        ]
    ];
    
    // AI Usage Analysis
    $usage_analysis = [
        'Customers frequently inquire about Nissan GTR products, including blog content on the car\'s features and specific parts like intake systems and exhaust tips, indicating strong interest in detailed, product-related content and education.',
        'Multiple return and refund requests are present, especially from a single customer with several refunded and fulfilled orders; this highlights potential issues in product satisfaction or order accuracy.',
        'Customers often request help submitting contact forms and navigating to contact/support pages, suggesting the need for a more streamlined, user-friendly support/contact interface.',
        'There\'s repeated interest in shipping details, especially expedited shipping, but some confusion or verification needs (e.g., order tracking requires additional info), indicating a chance to improve clarity and automation in shipping and tracking communications.',
        'Opportunity to enhance user engagement by integrating dynamic product recommendations directly from conversations (e.g., suggesting related products after product inquiries) and simplifying cart and checkout steps, given multiple add-to-cart and checkout interactions.'
    ];
    
    // Try to get real data from the API
    $access_key = get_option('voicero_access_key', '');
    if (!empty($access_key)) {
        // Get website ID
        $website_id = get_option('voicero_website_id', '');
        error_log('AI Overview - Website ID from option: ' . $website_id);
        
        if (empty($website_id)) {
            error_log('Voicero AI: Website ID not configured');
        } else {
            // Validate website ID format (should be a UUID in most cases)
            if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $website_id)) {
                error_log('AI Overview - Website ID may have invalid format: ' . $website_id);
                // Don't fail here, the API will validate
            }
            
            // Prepare request data
            $request_data = [
                'websiteId' => $website_id,
                'type' => 'WordPress'
            ];
            
            // Log the request data for debugging
            error_log('AI Overview page request data: ' . json_encode($request_data));
            
            // Use the configured API base URL for flexibility
            $api_base = defined('VOICERO_API_URL') ? VOICERO_API_URL : 'http://localhost:3000/api';
            $endpoint  = trailingslashit($api_base) . 'aiHistory';
            $response = wp_remote_post($endpoint, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $access_key,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
                'body' => json_encode($request_data),
                'timeout' => 15,
                'sslverify' => false,
            ]);

            if (is_wp_error($response)) {
                error_log('AI Overview page API error: ' . $response->get_error_message());
            } else {
                $code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                
                error_log('AI Overview page API response code: ' . $code);
                error_log('AI Overview page API response body: ' . substr($body, 0, 1000)); // Log first 1000 chars
                
                if ($code === 200) {
                    $api_data = json_decode($body, true);
                    
                    // Proceed with data processing if we have valid JSON
                    if (is_array($api_data)) {
                        if (isset($api_data['total_queries'])) {
                            $total_queries = $api_data['total_queries'];
                        }
                        
                        if (isset($api_data['query_limit'])) {
                            $query_limit = $api_data['query_limit'];
                        }
                        
                        if (isset($api_data['current_plan'])) {
                            $current_plan = $api_data['current_plan'];
                        }
                        
                        if (isset($api_data['threads']) && is_array($api_data['threads'])) {
                            // Format the threads data into the format expected by the page
                            $recent_queries = [];
                            foreach ($api_data['threads'] as $thread) {
                                // Find the first user message to use as the query text
                                $query_text = "No query text available";
                                $message_count = isset($thread['messageCount']) ? $thread['messageCount'] : 0;
                                
                                if (isset($thread['messages']) && is_array($thread['messages'])) {
                                    foreach ($thread['messages'] as $message) {
                                        if (isset($message['role']) && $message['role'] === 'user') {
                                            $query_text = $message['content'];
                                            break;
                                        }
                                    }
                                }
                                
                                // Format timestamp
                                $timestamp = isset($thread['lastMessageAt']) 
                                    ? date('n/j/Y g:i A', strtotime($thread['lastMessageAt'])) 
                                    : date('n/j/Y g:i A');
                                
                                $recent_queries[] = [
                                    'query' => $query_text,
                                    'timestamp' => $timestamp,
                                    'message_count' => $message_count
                                ];
                            }
                        }
                        
                        if (isset($api_data['analysis'])) {
                            // Split the analysis into bullet points
                            $analysis_text = $api_data['analysis'];
                            $usage_analysis = [];
                            
                            // Split by bullet points or numbered lists
                            preg_match_all('/(?:^|\n)(?:\*|\-|\d+\.)\s*(.+)/', $analysis_text, $matches);
                            
                            if (!empty($matches[1])) {
                                $usage_analysis = $matches[1];
                            } else {
                                // If no bullet points found, just use the whole text
                                $usage_analysis = [$analysis_text];
                            }
                        }
                    }
                } else {
                    error_log('AI Overview page API error: Status ' . $code);
                }
            }
        }
    }
    
    ?>
    <div class="wrap voicero-ai-overview-page">
        <div class="overview-header">
            <a href="<?php echo esc_url(admin_url('admin.php?page=voicero-ai-admin')); ?>" class="back-link">
                <span class="dashicons dashicons-arrow-left-alt"></span> 
                <?php esc_html_e('AI Usage Overview', 'voicero-ai'); ?>
            </a>
            <button type="button" id="refresh-data-btn" class="button">
                <span class="dashicons dashicons-update"></span>
                <?php esc_html_e('Refresh Data', 'voicero-ai'); ?>
            </button>
        </div>
        
        <!-- Add hidden nonce field for AJAX -->
        <input type="hidden" id="voicero_nonce" value="<?php echo esc_attr(wp_create_nonce('voicero_ajax_nonce')); ?>" />
        <!-- Expose website ID for JavaScript -->
        <input type="hidden" id="voicero_website_id" value="<?php echo esc_attr($website_id); ?>" />
        
        <div id="voicero-overview-message"></div>     
        
        <!-- AI Usage Analysis Section -->
        <div class="voicero-card">
            <div class="voicero-card-header">
                <div class="card-header-icon">
                    <span class="dashicons dashicons-analytics"></span>
                </div>
                <h2><?php esc_html_e('AI Usage Analysis', 'voicero-ai'); ?></h2>
            </div>
            
            <div class="voicero-card-content">
                <ul class="analysis-list">
                    <?php foreach ($usage_analysis as $analysis_point): ?>
                        <li><?php echo esc_html($analysis_point); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        </div>      
        
        <!-- Recent AI Queries Section -->
        <div class="voicero-card">
            <div class="voicero-card-header">
                <div class="card-header-icon">
                    <span class="dashicons dashicons-admin-comments"></span>
                </div>
                <h2><?php esc_html_e('Recent AI Queries', 'voicero-ai'); ?></h2>
            </div>
            
            <div class="voicero-card-content">
                <div class="recent-queries-list">
                    <?php foreach ($recent_queries as $query): ?>
                        <div class="query-item">
                            <div class="query-content">
                                <div class="query-text"><?php echo esc_html($query['query']); ?></div>
                                <div class="query-time"><?php echo esc_html($query['timestamp']); ?></div>
                            </div>
                            <div class="query-stats">
                                <div class="message-count"><?php echo esc_html($query['message_count']); ?> messages</div>
                                <a href="#" class="view-more-link">View More</a>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
                
                <div class="view-all-container">
                    <a href="#" class="button button-secondary" id="view-all-conversations">
                        <?php esc_html_e('View All Conversations', 'voicero-ai'); ?>
                    </a>
                </div>
            </div>
        </div>      
        
        <!-- Include the JS file -->
        <script type="text/javascript" src="<?php echo esc_url(plugin_dir_url(__FILE__) . '../assets/js/admin/voicero-ai-overview.js'); ?>"></script>
        
        <!-- Add website information section -->
        <div class="voicero-card">
            <div class="voicero-card-header">
                <div class="card-header-icon">
                    <span class="dashicons dashicons-admin-site"></span>
                </div>
                <h2><?php esc_html_e('Website Information', 'voicero-ai'); ?></h2>
            </div>
            
            <div class="voicero-card-content">
                <div class="website-info">
                    <div class="info-item">
                        <div class="info-label"><?php esc_html_e('Name:', 'voicero-ai'); ?></div>
                        <div class="info-value" id="website-name">Loading...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label"><?php esc_html_e('Plan:', 'voicero-ai'); ?></div>
                        <div class="info-value" id="website-plan">Loading...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label"><?php esc_html_e('Queries:', 'voicero-ai'); ?></div>
                        <div class="info-value" id="website-queries">Loading...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label"><?php esc_html_e('Domain:', 'voicero-ai'); ?></div>
                        <div class="info-value" id="website-domain">Loading...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label"><?php esc_html_e('Status:', 'voicero-ai'); ?></div>
                        <div class="info-value" id="website-status">Loading...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php
}

// Add JavaScript to populate website info
add_action('admin_footer', 'voicero_add_website_info_script');

function voicero_add_website_info_script() {
    // Only add the script on the AI overview page
    $screen = get_current_screen();
    if ($screen->id !== 'voicero-ai_page_voicero-ai-overview') {
        return;
    }
    
    // Get website ID
    $website_id = get_option('voicero_website_id', '');
    if (empty($website_id)) {
        return;
    }
    
    // Create a nonce for the AJAX request
    $nonce = wp_create_nonce('voicero_ajax_nonce');
    
    ?>
    <script type="text/javascript">
    jQuery(document).ready(function($) {
        // Load website information
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'voicero_websites_get',
                nonce: '<?php echo esc_js($nonce); ?>',
                id: '<?php echo esc_js($website_id); ?>'
            },
            success: function(response) {
                if (response.success && response.data) {
                    // Update website information
                    $('#website-name').text(response.data.name || 'Alias');
                    $('#website-plan').text(response.data.plan || 'Starter');
                    
                    // Format queries as "used/limit"
                    const queries = response.data.queryCount || 0;
                    const queryLimit = response.data.queryLimit || 1000;
                    $('#website-queries').text(queries + '/' + queryLimit + ' included');
                    
                    // Format domain
                    $('#website-domain').text(response.data.domain || 'http://alias.local');
                    
                    // Format status
                    const status = response.data.active ? 'Active' : 'Inactive';
                    $('#website-status').text(status);
                } else {
                    // Show error in console but don't disrupt the UI
                    console.error('Error loading website data:', response);
                    
                    // Set default values
                    $('#website-name').text('Alias');
                    $('#website-plan').text('Starter');
                    $('#website-queries').text('0/1000 included');
                    $('#website-domain').text('http://alias.local');
                    $('#website-status').text('Active');
                }
            },
            error: function() {
                console.error('Ajax error when loading website data');
                
                // Set default values
                $('#website-name').text('Alias');
                $('#website-plan').text('Starter');
                $('#website-queries').text('0/1000 included');
                $('#website-domain').text('http://alias.local');
                $('#website-status').text('Active');
            }
        });
    });
    </script>
    <?php
}
