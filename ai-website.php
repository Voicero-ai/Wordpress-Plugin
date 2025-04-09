<?php
/**
 * Plugin Name: Voicero.AI
 * Description: A plugin that can connect your whole website to an AI Salesman to boost your sales. Increase your conversion rate by 10x with our AI that will answer all user questions and put them on the path to purchase.
 * Version: 0.0.2
 * Author: Voicero.AI
 */

if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

// Define the API base URL
define('AI_WEBSITE_API_URL', 'http://localhost:3000');

// Define a debug function to log messages to the error log
function voicero_debug_log($message, $data = null) {
    if (defined('WP_DEBUG') && WP_DEBUG) {
        if (is_array($data) || is_object($data)) {
            error_log('VOICERO DEBUG: ' . $message . ' - ' . print_r($data, true));
        } else {
            error_log('VOICERO DEBUG: ' . $message . ($data !== null ? ' - ' . $data : ''));
        }
    }
}

// Add AJAX endpoint to get debug info for troubleshooting
add_action('wp_ajax_voicero_debug_info', 'voicero_debug_info');
add_action('wp_ajax_nopriv_voicero_debug_info', 'voicero_debug_info');

function voicero_debug_info() {
    $response = array(
        'wp_version' => get_bloginfo('version'),
        'php_version' => phpversion(),
        'theme' => wp_get_theme()->get('Name'),
        'plugins' => array(),
        'access_key' => !empty(get_option('ai_website_access_key', '')),
        'script_handles' => array(),
        'hooks' => array(
            'wp_body_open' => has_action('wp_body_open'),
            'wp_footer' => has_action('wp_footer')
        )
    );
    
    // Get active plugins
    $active_plugins = get_option('active_plugins');
    foreach ($active_plugins as $plugin) {
        $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin);
        $response['plugins'][] = array(
            'name' => $plugin_data['Name'],
            'version' => $plugin_data['Version']
        );
    }
    
    // Check if scripts are properly registered
    global $wp_scripts;
    $voicero_scripts = array('voicero-core-js', 'voicero-text-js', 'voicero-voice-js');
    foreach ($voicero_scripts as $handle) {
        $response['script_handles'][$handle] = isset($wp_scripts->registered[$handle]);
    }
    
    wp_send_json_success($response);
}

/* ------------------------------------------------------------------------
   1. ADMIN PAGE TO DISPLAY CONNECTION INTERFACE
------------------------------------------------------------------------ */
add_action('admin_menu', 'ai_website_add_admin_page');
function ai_website_add_admin_page() {
    add_menu_page(
        'Voicero.AI',         // Page <title>
        'Voicero.AI',         // Menu label
        'manage_options',     // Capability required
        'ai-website-admin',   // Menu slug (unique ID)
        'ai_website_render_admin_page', // Callback that renders the page
        'dashicons-analytics',// Icon (dashicons)
        100                   // Position in the menu
    );
}

// Add AJAX handlers for the admin page
add_action('wp_ajax_ai_website_check_connection', 'ai_website_check_connection');
add_action('wp_ajax_ai_website_sync_content', 'ai_website_sync_content');
add_action('wp_ajax_ai_website_vectorize_content', 'ai_website_vectorize_content');
add_action('wp_ajax_ai_website_setup_assistant', 'ai_website_setup_assistant');
add_action('wp_ajax_ai_website_clear_connection', 'ai_website_clear_connection');

function ai_website_check_connection() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    if (is_wp_error($response)) {
        error_log('AI Website connection error: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => 'Connection failed: ' . $response->get_error_message(),
            'code' => $response->get_error_code()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        error_log('AI Website API error: ' . $body);
        wp_send_json_error([
            'message' => 'Server returned error: ' . $response_code,
            'code' => $response_code,
            'body' => $body
        ]);
    }

    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error([
            'message' => 'Invalid response from server',
            'code' => 'invalid_json'
        ]);
    }

    wp_send_json_success($data);
}

function ai_website_sync_content() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    try {
        // 1. First sync the content
        $data = collect_wordpress_data();
        $sync_response = wp_remote_post('http://localhost:3000/api/wordpress/sync', [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => json_encode($data),
            'timeout' => 120,
            'sslverify' => false
        ]);

        if (is_wp_error($sync_response)) {
            wp_send_json_error([
                'message' => 'Sync failed: ' . $sync_response->get_error_message(),
                'code' => $sync_response->get_error_code(),
                'stage' => 'sync',
                'progress' => 0
            ]);
        }

        // 2. Then vectorize the content
        $vectorize_response = wp_remote_post('http://localhost:3000/api/wordpress/vectorize', [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'timeout' => 120,
            'sslverify' => false
        ]);

        if (is_wp_error($vectorize_response)) {
            wp_send_json_error([
                'message' => 'Vectorization failed: ' . $vectorize_response->get_error_message(),
                'code' => $vectorize_response->get_error_code(),
                'stage' => 'vectorize',
                'progress' => 33
            ]);
        }

        // 3. Finally set up the assistant
        $assistant_response = wp_remote_post('http://localhost:3000/api/wordpress/assistant', [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'timeout' => 120,
            'sslverify' => false
        ]);

        if (is_wp_error($assistant_response)) {
            wp_send_json_error([
                'message' => 'Assistant setup failed: ' . $assistant_response->get_error_message(),
                'code' => $assistant_response->get_error_code(),
                'stage' => 'assistant',
                'progress' => 66
            ]);
        }

        // All operations successful
        wp_send_json_success([
            'message' => 'All operations completed successfully!',
            'stage' => 'complete',
            'progress' => 100,
            'complete' => true,
            'details' => [
                'sync' => json_decode(wp_remote_retrieve_body($sync_response), true),
                'vectorize' => json_decode(wp_remote_retrieve_body($vectorize_response), true),
                'assistant' => json_decode(wp_remote_retrieve_body($assistant_response), true)
            ]
        ]);

    } catch (Exception $e) {
        wp_send_json_error([
            'message' => 'Operation failed: ' . $e->getMessage(),
            'stage' => 'unknown',
            'progress' => 0
        ]);
    }
}

// Add new endpoint for vectorization
function ai_website_vectorize_content() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $vectorize_response = wp_remote_post('http://localhost:3000/api/wordpress/vectorize', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 120,
        'sslverify' => false
    ]);

    if (is_wp_error($vectorize_response)) {
        wp_send_json_error([
            'message' => 'Vectorization failed: ' . $vectorize_response->get_error_message(),
            'code' => $vectorize_response->get_error_code(),
            'stage' => 'vectorize',
            'progress' => 33
        ]);
    }

    wp_send_json_success([
        'message' => 'Vectorization completed, setting up assistant...',
        'stage' => 'vectorize',
        'progress' => 66,
        'complete' => false
    ]);
}

// Add new endpoint for assistant setup
function ai_website_setup_assistant() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $assistant_response = wp_remote_post('http://localhost:3000/api/wordpress/assistant', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 120,
        'sslverify' => false
    ]);

    if (is_wp_error($assistant_response)) {
        wp_send_json_error([
            'message' => 'Assistant setup failed: ' . $assistant_response->get_error_message(),
            'code' => $assistant_response->get_error_code(),
            'stage' => 'assistant',
            'progress' => 66
        ]);
    }

    wp_send_json_success([
        'message' => 'All operations completed successfully!',
        'stage' => 'complete',
        'progress' => 100,
        'complete' => true
    ]);
}

// Register the new AJAX actions
add_action('wp_ajax_ai_website_vectorize_content', 'ai_website_vectorize_content');
add_action('wp_ajax_ai_website_setup_assistant', 'ai_website_setup_assistant');

// Helper function to collect WordPress data
function collect_wordpress_data() {
    $data = [
        'posts' => [],
        'pages' => [],
        'products' => [],
        'categories' => [],
        'tags' => [],
        'comments' => [],
        'reviews' => [],
        'authors' => [],
        'media' => [],
        'customFields' => [],
        'productCategories' => [],
        'productTags' => []
    ];

    // Get Posts
    $posts = get_posts([
        'post_type' => 'post',
        'post_status' => 'publish',
        'numberposts' => -1
    ]);

    // Get Authors (Users with relevant roles)
    $authors = get_users([
        'role__in' => ['administrator', 'editor', 'author', 'contributor'],
    ]);

    foreach ($authors as $author) {
        $data['authors'][] = [
            'id' => $author->ID,
            'name' => $author->display_name,
            'email' => $author->user_email,
            'url' => $author->user_url,
            'bio' => get_user_meta($author->ID, 'description', true),
            'avatarUrl' => get_avatar_url($author->ID)
        ];
    }

    // Get Media
    $media_items = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'posts_per_page' => -1
    ]);

    foreach ($media_items as $media) {
        $metadata = wp_get_attachment_metadata($media->ID);
        $data['media'][] = [
            'id' => $media->ID,
            'title' => $media->post_title,
            'url' => wp_get_attachment_url($media->ID),
            'alt' => get_post_meta($media->ID, '_wp_attachment_image_alt', true),
            'description' => $media->post_content,
            'caption' => $media->post_excerpt,
            'mimeType' => $media->post_mime_type,
            'metadata' => $metadata ? $metadata : new stdClass(),
            'createdAt' => $media->post_date,
            'updatedAt' => $media->post_modified
        ];
    }

    // Get Custom Fields for Posts and Products
    foreach ($posts as $post) {
        $custom_fields = get_post_meta($post->ID);
        foreach ($custom_fields as $key => $values) {
            if (strpos($key, '_') !== 0) { // Skip private meta
                $data['customFields'][] = [
                    'postId' => $post->ID,
                    'metaKey' => $key,
                    'metaValue' => maybe_serialize($values[0]),
                    'postType' => 'post'
                ];
            }
        }
    }

    // Get Product Categories
    $product_categories = get_terms([
        'taxonomy' => 'product_cat',
        'hide_empty' => false
    ]);

    if (!is_wp_error($product_categories)) {
        foreach ($product_categories as $category) {
            $thumbnail_id = get_term_meta($category->term_id, 'thumbnail_id', true);
            $image_url = $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : '';
            
            $data['productCategories'][] = [
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'description' => wp_strip_all_tags($category->description),
                'parent' => $category->parent,
                'count' => $category->count,
                'imageUrl' => $image_url
            ];
        }
    }

    // Get Product Tags
    $product_tags = get_terms([
        'taxonomy' => 'product_tag',
        'hide_empty' => false
    ]);

    if (!is_wp_error($product_tags)) {
        foreach ($product_tags as $tag) {
            $data['productTags'][] = [
                'id' => $tag->term_id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'description' => wp_strip_all_tags($tag->description),
                'count' => $tag->count
            ];
        }
    }

    // Get Custom Fields for Products
    $products = get_posts([
        'post_type' => 'product',
        'post_status' => 'publish',
        'numberposts' => -1
    ]);

    foreach ($products as $product) {
        $custom_fields = get_post_meta($product->ID);
        foreach ($custom_fields as $key => $values) {
            if (strpos($key, '_') !== 0) { // Skip private meta
                $data['customFields'][] = [
                    'postId' => $product->ID,
                    'metaKey' => $key,
                    'metaValue' => maybe_serialize($values[0]),
                    'postType' => 'product'
                ];
            }
        }
    }

    // Get Comments
    foreach ($posts as $post) {
        $comments = get_comments([
            'post_id' => $post->ID,
            'status' => 'approve'
        ]);

        foreach ($comments as $comment) {
            $data['comments'][] = [
                'id' => $comment->comment_ID,
                'post_id' => $post->ID,
                'author' => $comment->comment_author,
                'author_email' => $comment->comment_author_email,
                'content' => wp_strip_all_tags($comment->comment_content),
                'date' => $comment->comment_date,
                'status' => $comment->comment_approved,
                'parent_id' => $comment->comment_parent
            ];
        }

        $data['posts'][] = [
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => $post->post_content,
            'contentStripped' => wp_strip_all_tags($post->post_content),
            'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
            'slug' => $post->post_name,
            'link' => get_permalink($post->ID),
            'author' => get_the_author_meta('display_name', $post->post_author),
            'date' => $post->post_date,
            'categories' => wp_get_post_categories($post->ID, ['fields' => 'names']),
            'tags' => wp_get_post_tags($post->ID, ['fields' => 'names'])
        ];
    }

    // Get Pages
    $pages = get_pages(['post_status' => 'publish']);
    if (!empty($pages)) {
        foreach ($pages as $page) {
            $data['pages'][] = [
                'id' => $page->ID,
                'title' => $page->post_title,
                'content' => $page->post_content,
                'contentStripped' => wp_strip_all_tags($page->post_content),
                'slug' => $page->post_name,
                'link' => get_permalink($page->ID),
                'template' => get_page_template_slug($page->ID),
                'parent' => $page->post_parent,
                'order' => $page->menu_order,
                'lastModified' => $page->post_modified
            ];
        }
    }

    // Get Categories
    $categories = get_categories(['hide_empty' => false]);
    foreach ($categories as $category) {
        $data['categories'][] = [
            'id' => $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => wp_strip_all_tags($category->description)
        ];
    }

    // Get Tags
    $tags = get_tags(['hide_empty' => false]);
    foreach ($tags as $tag) {
        $data['tags'][] = [
            'id' => $tag->term_id,
            'name' => $tag->name,
            'slug' => $tag->slug
        ];
    }

    // Get Products if WooCommerce is active
    if (class_exists('WC_Product_Query')) {
        $products = wc_get_products([
            'status' => 'publish',
            'limit' => -1
        ]);

        foreach ($products as $product) {
            // Get reviews for this product
            $reviews = get_comments([
                'post_id' => $product->get_id(),
                'status' => 'approve',
                'type' => 'review'
            ]);

            foreach ($reviews as $review) {
                $rating = get_comment_meta($review->comment_ID, 'rating', true);
                $verified = get_comment_meta($review->comment_ID, 'verified', true);

                $data['reviews'][] = [
                    'id' => $review->comment_ID,
                    'product_id' => $product->get_id(),
                    'reviewer' => $review->comment_author,
                    'reviewer_email' => $review->comment_author_email,
                    'review' => wp_strip_all_tags($review->comment_content),
                    'rating' => (int)$rating,
                    'date' => $review->comment_date,
                    'verified' => (bool)$verified
                ];
            }

            $data['products'][] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'slug' => $product->get_slug(),
                'description' => wp_strip_all_tags($product->get_description()),
                'short_description' => wp_strip_all_tags($product->get_short_description()),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'stock_quantity' => $product->get_stock_quantity(),
                'link' => get_permalink($product->get_id())
            ];
        }
    }

    return $data;
}

function ai_website_render_admin_page() {
    // Check for access key in URL
    $url_access_key = isset($_GET['access_key']) ? sanitize_text_field($_GET['access_key']) : '';
    
    // Handle form submission
    if (isset($_POST['access_key']) || !empty($url_access_key)) {
        // Don't check nonce if we have a URL access key
        if (!empty($url_access_key) || check_admin_referer('save_access_key_nonce')) {
            $access_key = !empty($_POST['access_key']) ? sanitize_text_field($_POST['access_key']) : $url_access_key;
            
            // Verify the key is valid by making a test request
            $test_response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $access_key,
                    'Content-Type' => 'application/json'
                ],
                'timeout' => 15,
                'sslverify' => false
            ]);

            if (is_wp_error($test_response)) {
                add_settings_error(
                    'ai_website_messages',
                    'connection_error',
                    'Could not connect to AI service. Please check your internet connection and try again.',
                    'error'
                );
            } else {
                $response_code = wp_remote_retrieve_response_code($test_response);
                $response_body = wp_remote_retrieve_body($test_response);
                
                if ($response_code !== 200) {
                    add_settings_error(
                        'ai_website_messages',
                        'connection_error',
                        'Could not validate access key. Please try connecting again.',
                        'error'
                    );
                } else {
                    update_option('ai_website_access_key', $access_key);
                    add_settings_error(
                        'ai_website_messages',
                        'key_updated',
                        'Successfully connected to AI service!',
                        'updated'
                    );
                }
            }
        }
    }

    // Handle manual sync
    if (isset($_POST['sync_content']) && check_admin_referer('sync_content_nonce')) {
        // We'll handle the sync status message in the AJAX response
        add_settings_error(
            'ai_website_messages',
            'sync_started',
            'Content sync initiated...',
            'info'
        );
    }

    // Get saved values
    $saved_key = get_option('ai_website_access_key', '');

    // Get the current site URL
    $site_url = get_site_url();
    $admin_url = admin_url('admin.php?page=ai-website-admin');
    
    // Encode URLs for safe transport
    $encoded_site_url = urlencode($site_url);
    $encoded_admin_url = urlencode($admin_url);
    
    // Generate the connection URL
    $connect_url = "http://localhost:3000/app/connect?site_url={$encoded_site_url}&redirect_url={$encoded_admin_url}";

    // Output the admin interface
    ?>
    <div class="wrap">
        <h1>AI Website Connection</h1>
        
        <?php settings_errors('ai_website_messages'); ?>

        <div class="card" style="max-width: 800px; margin-top: 20px;">
            <h2>Connect Your Website</h2>
            <p>Enter your access key to connect to the AI Website service.</p>

            <form method="post" action="">
                <?php if (empty($url_access_key)) wp_nonce_field('save_access_key_nonce'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="access_key">Access Key</label></th>
                        <td>
                            <div style="display: flex; gap: 10px; align-items: flex-start;">
                                <input type="text" 
                                       id="access_key" 
                                       name="access_key" 
                                       value="<?php echo esc_attr($saved_key); ?>" 
                                       class="regular-text"
                                       placeholder="Enter your 64-character access key"
                                       pattern=".{64,64}"
                                       title="Access key should be exactly 64 characters long">
                                <?php if ($saved_key): ?>
                                    <button type="button" id="clear-connection" class="button button-secondary">
                                        Clear Connection
                                    </button>
                                <?php endif; ?>
                            </div>
                            <p class="description">Your access key should be exactly 64 characters long.</p>
                        </td>
                    </tr>
                </table>
                <p class="submit">
                    <input type="submit" 
                           name="submit" 
                           id="submit" 
                           class="button button-primary" 
                           value="Save & Connect">
                </p>
            </form>

            <?php if (!$saved_key): ?>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <h3>New to Voicero?</h3>
                    <p>Connect your website in one click and create your account.</p>
                    <a href="<?php echo esc_url($connect_url); ?>" class="button button-secondary">
                        Connect with Voicero
                    </a>
                </div>
            <?php endif; ?>
        </div>
       

        <?php if ($saved_key): ?>
            <!-- Website info card -->
            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2>Website Information</h2>
                <div id="website-info-container">
                    <div class="spinner is-active" style="float: none;"></div>
                    <p>Loading website information...</p>
                </div>
                
                <div style="margin-top: 20px;">
                    <form method="post" action="" id="sync-form">
                        <?php wp_nonce_field('sync_content_nonce'); ?>
                        <input type="submit" 
                               name="sync_content" 
                               id="sync-button" 
                               class="button" 
                               value="Sync Content Now">
                        <span id="sync-status" style="margin-left: 10px;"></span>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <style>
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 100000;
    }
    .modal-content {
        position: relative;
        background: #fff;
        width: 90%;
        max-width: 600px;
        margin: 50px auto;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
    .modal-close {
        position: absolute;
        right: 10px;
        top: 10px;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    .modal-close:hover {
        color: #000;
    }
    </style>

    <script>
    jQuery(document).ready(function($) {
        // Add toggle functionality
        $('.connection-details-toggle button').on('click', function() {
            const $toggle = $(this).parent();
            const $details = $('.connection-details');
            const isVisible = $details.is(':visible');
            
            $details.slideToggle();
            $toggle.toggleClass('active');
            $(this).html(`
                <span class="dashicons dashicons-arrow-${isVisible ? 'down' : 'up'}-alt2"></span>
                ${isVisible ? 'Show' : 'Hide'} Connection Details
            `);
        });

        // Check if WordPress shows expired message - only once
        const bodyText = $('body').text();
        if (bodyText.includes('link you followed has expired') && window.location.search.includes('access_key')) {
            // Only refresh if we came from an access_key URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('access_key');
            window.location.replace(newUrl.toString()); // Use replace instead of href
            return;
        }

        // Add a flag to localStorage when clearing connection
        $('#clear-connection').on('click', function() {
            if (confirm('Are you sure you want to clear the connection?')) {
                localStorage.setItem('connection_cleared', 'true');
                
                // Make AJAX call to clear the connection
                $.post(ajaxurl, {
                    action: 'ai_website_clear_connection',
                    nonce: nonce
                })
                .then(function() {
                    // Clear the form and reload
                    $('#access_key').val('');
                    window.location.reload();
                });
            }
        });

        // Check for access key in URL - but only if we haven't just cleared
        const urlParams = new URLSearchParams(window.location.search);
        const accessKey = urlParams.get('access_key');
        const wasCleared = localStorage.getItem('connection_cleared') === 'true';
        
        if (accessKey && !wasCleared) {
            // Just fill the form
            $('#access_key').val(accessKey);
            
            // Clean the URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('access_key');
            window.history.replaceState({}, '', newUrl.toString());
        }

        // Clear the flag after handling
        localStorage.removeItem('connection_cleared');

        const ajaxurl = '<?php echo esc_js(admin_url('admin-ajax.php')); ?>';
        const nonce = '<?php echo esc_js(wp_create_nonce('ai_website_ajax_nonce')); ?>';

        // Handle sync form submission
        $('#sync-form').on('submit', function(e) {
            e.preventDefault();
            const syncButton = $('#sync-button');
            const syncStatus = $('#sync-status');

            // Reset initial state
            syncButton.prop('disabled', true);

            // Create status elements for each step
            syncStatus.html(`
                <div class="sync-steps">
                    <div id="sync-step">⏳ Syncing content...</div>
                    <div id="vectorize-step">Vectorizing content (waiting...)</div>
                    <div id="assistant-step">Setting up assistant (waiting...)</div>
                </div>
            `);

            try {
                // Step 1: Initial Sync
                $.post(ajaxurl, {
                    action: 'ai_website_sync_content',
                    nonce: nonce
                })
                .then(function(response) {
                    if (!response.success) {
                        throw new Error(response.data.message || "Sync failed");
                    }
                    // Update sync step with checkmark
                    $("#sync-step").html("✅ Content synced successfully");

                    // Step 2: Vectorization
                    $("#vectorize-step").html("⏳ Vectorizing content...");
                    return $.post(ajaxurl, {
                        action: 'ai_website_vectorize_content',
                        nonce: nonce
                    });
                })
                .then(function(response) {
                    if (!response.success) {
                        throw new Error(response.data.message || "Vectorization failed");
                    }
                    // Update vectorize step with checkmark
                    $("#vectorize-step").html("✅ Content vectorized successfully");

                    // Step 3: Assistant Setup
                    $("#assistant-step").html("⏳ Setting up assistant...");
                    return $.post(ajaxurl, {
                        action: 'ai_website_setup_assistant',
                        nonce: nonce
                    });
                })
                .then(function(response) {
                    if (!response.success) {
                        throw new Error(response.data.message || "Assistant setup failed");
                    }
                    // Update assistant step with checkmark
                    $("#assistant-step").html("✅ Assistant setup complete");

                    // Update website info after a short delay
                    setTimeout(() => {
                        loadWebsiteInfo();
                    }, 1500);
                })
                .catch(function(error) {
                    // Error handling - mark current step as failed with X
                    console.error("Operation failed:", error);
                    if (!$("#sync-step").text().includes("✅")) {
                        $("#sync-step").html("❌ Sync failed: " + error.message);
                    } else if (!$("#vectorize-step").text().includes("✅")) {
                        $("#vectorize-step").html("❌ Vectorization failed: " + error.message);
                    } else if (!$("#assistant-step").text().includes("✅")) {
                        $("#assistant-step").html("❌ Assistant setup failed: " + error.message);
                    }
                })
                .always(function() {
                    syncButton.prop('disabled', false);
                });
            } catch (error) {
                syncButton.prop('disabled', false);
                syncStatus.html(`<span style="color: #d63638;">✗ Error: ${error.message}</span>`);
            }
        });

        function loadWebsiteInfo() {
            const container = $('#website-info-container');
            
            $.get(ajaxurl, {
                action: 'ai_website_get_info',
                nonce: nonce
            })
            .done(function(response) {
                if (!response.success) {
                    throw new Error(response.data.message || 'Failed to load website info');
                }

                const website = response.data;
                
                // Only show first-time modal if we have a valid website connection
                // AND it has never been synced
                if (website && website.id && !website.lastSyncedAt) {
                    // Show the modal
                    $('#first-time-modal').fadeIn();
                    
                    // Handle modal close
                    $('.modal-close').on('click', function() {
                        $('#first-time-modal').fadeOut();
                    });
                    
                    // Close modal when clicking outside
                    $(window).on('click', function(e) {
                        if ($(e.target).is('#first-time-modal')) {
                            $('#first-time-modal').fadeOut();
                        }
                    });

                    // Handle first sync button click in modal
                    $('#first-sync-button').on('click', function() {
                        const $modalContent = $(this).closest('.notice');
                        
                        // Replace modal content with sync progress
                        $modalContent.html(`
                            <h2 style="margin-top: 0;">🔄 Syncing Your Website</h2>
                            <div class="sync-steps">
                                <div id="sync-step">⏳ Syncing content...</div>
                                <div id="vectorize-step">Vectorizing content (waiting...)</div>
                                <div id="assistant-step">Setting up assistant (waiting...)</div>
                            </div>
                        `);

                        // Trigger the sync process
                        $.post(ajaxurl, {
                            action: 'ai_website_sync_content',
                            nonce: nonce
                        })
                        .then(function(response) {
                            if (!response.success) {
                                throw new Error(response.data.message || "Sync failed");
                            }
                            $("#sync-step").html("✅ Content synced successfully");
                            
                            // Continue with vectorization
                            return $.post(ajaxurl, {
                                action: 'ai_website_vectorize_content',
                                nonce: nonce
                            });
                        })
                        .then(function(response) {
                            if (!response.success) {
                                throw new Error(response.data.message || "Vectorization failed");
                            }
                            $("#vectorize-step").html("✅ Content vectorized successfully");
                            
                            // Finally set up the assistant
                            return $.post(ajaxurl, {
                                action: 'ai_website_setup_assistant',
                                nonce: nonce
                            });
                        })
                        .then(function(response) {
                            if (!response.success) {
                                throw new Error(response.data.message || "Assistant setup failed");
                            }
                            $("#assistant-step").html("✅ Assistant setup complete");
                            
                            // Show success message and close button
                            setTimeout(() => {
                                $modalContent.html(`
                                    <h2 style="margin-top: 0;">✅ Setup Complete!</h2>
                                    <p>Your website is now ready to use AI features.</p>
                                    <button class="button button-primary modal-close">
                                        Get Started
                                    </button>
                                `);
                                
                                // Reload website info in background
                                loadWebsiteInfo();
                            }, 1000);
                        })
                        .catch(function(error) {
                            $modalContent.append(`
                                <div class="notice notice-error">
                                    <p>Error: ${error.message || 'Something went wrong'}</p>
                                </div>
                            `);
                        });
                    });
                }

                // Regular website info display code...
                const html = `
                    <table class="widefat">
                        <tbody>
                            <tr>
                                <th>Website Name</th>
                                <td>${website.name || 'Unnamed Site'}</td>
                            </tr>
                            <tr>
                                <th>URL</th>
                                <td>${website.url || 'Not set'}</td>
                            </tr>
                            <tr>
                                <th>Plan</th>
                                <td>${website.plan || 'Free'}</td>
                            </tr>
                            <tr>
                                <th>Status</th>
                                <td>
                                    <span class="button button-small ${website.active ? 'button-primary' : 'button-secondary'}">
                                        ${website.active ? 'Active' : 'Inactive'}
                                    </span>
                                    <button class="button button-small toggle-status-btn" 
                                            data-website-id="${website.id || ''}" 
                                            data-access-key="${'<?php echo esc_js($saved_key); ?>'}'"
                                            ${!website.lastSyncedAt ? 'disabled title="Please sync your website first"' : ''}>
                                        ${website.active ? 'Deactivate' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <th>Monthly Queries</th>
                                <td>
                                    ${website.monthlyQueries || 0} / ${website.queryLimit || 1000}
                                    <div class="progress-bar" style="
                                        background: #f0f0f1;
                                        height: 10px;
                                        border-radius: 5px;
                                        margin-top: 5px;
                                        overflow: hidden;
                                    ">
                                        <div style="
                                            width: ${((website.monthlyQueries || 0) / (website.queryLimit || 1000)) * 100}%;
                                            background: #2271b1;
                                            height: 100%;
                                            transition: width 0.3s ease;
                                        "></div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th>Last Synced</th>
                                <td>${website.lastSyncedAt ? new Date(website.lastSyncedAt).toLocaleString() : 'Never'}</td>
                            </tr>
                            <tr>
                                <th>Sync Frequency</th>
                                <td>${website.syncFrequency || 'Manual'}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="margin-top: 20px; display: flex; gap: 10px; align-items: center;">
                        <a href="http://localhost:3000/app" target="_blank" class="button button-primary">
                            Open Dashboard
                        </a>
                        <button class="button toggle-status-btn" 
                                data-website-id="${website.id || ''}"
                                data-access-key="${'<?php echo esc_js($saved_key); ?>'}'"
                                ${!website.lastSyncedAt ? 'disabled title="Please sync your website first"' : ''}>
                            ${website.active ? 'Deactivate Plugin' : 'Activate Plugin'}
                        </button>
                        ${!website.lastSyncedAt ? `
                            <span class="description" style="color: #d63638;">
                                ⚠️ Please sync your website before activating the plugin
                            </span>
                        ` : ''}
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
                                    <td>${website._count?.pages || 0}</td>
                                </tr>
                                <tr>
                                    <td>Posts</td>
                                    <td>${website._count?.posts || 0}</td>
                                </tr>
                                <tr>
                                    <td>Products</td>
                                    <td>${website._count?.products || 0}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
                container.html(html);
            })
            .fail(function(xhr, status, error) {
                container.html(`
                    <div class="notice notice-error">
                        <p>Connection Error: ${error || 'Failed to connect to server'}</p>
                        <p>Status: ${status}</p>
                        <p>Please check your internet connection and try again.</p>
                    </div>
                `);
            });
        }

        // Load website info on page load if we have an access key
        if ('<?php echo esc_js($saved_key); ?>') {
            loadWebsiteInfo();
        }

        // If there was an error, show the connect button prominently
        if ($('.notice-error').length > 0) {
            $('.button-secondary').addClass('button-primary').css({
                'margin-top': '10px',
                'font-weight': 'bold'
            });
        }

        // Update the click handler for toggle status button
        $(document).on('click', '.toggle-status-btn', function() {
            const websiteId = $(this).data('website-id');
            const accessKey = $(this).data('access-key');
            const $button = $(this);
            
            if (!websiteId && !accessKey) {
                console.error('No website ID or access key available');
                alert('Could not identify website. Please try refreshing the page.');
                return;
            }
            
            // Disable button during request
            $button.prop('disabled', true);
            
            fetch('http://localhost:3000/api/websites/toggle-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    websiteId: websiteId || undefined,
                    accessKey: accessKey || undefined
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                // Refresh the page to show updated status
                window.location.reload();
            })
            .catch(error => {
                console.error('Error toggling status:', error);
                alert('Failed to toggle website status. Please try again.');
            })
            .finally(() => {
                $button.prop('disabled', false);
            });
        });

        // Update where we output the ACCESS_KEY constant
        document.addEventListener("DOMContentLoaded", async () => {
            // Add this at the top - before any other code
            const ACCESS_KEY = '<?php 
                $key = get_option("ai_website_access_key", "");
                echo esc_js($key); 
                // Debug log the key to PHP error log
                error_log("Access key being used: " . substr($key, 0, 10) . "...");
            ?>';
            console.log("Access key loaded:", ACCESS_KEY.substring(0, 10) + "..."); // Debug log
        });

        // Add script to detect nav height and position button
        function updateNavbarPositioning() {
            // Find the navigation element - checking common WordPress nav classes/IDs
            const nav = document.querySelector(
                'header, ' + // Try header first
                '#masthead, ' + // Common WordPress header ID
                '.site-header, ' + // Common header class
                'nav.navbar, ' + // Bootstrap navbar
                'nav.main-navigation, ' + // Common nav classes
                '.nav-primary, ' +
                '#site-navigation, ' +
                '.site-navigation'
            );
            
            if (nav) {
                const navRect = nav.getBoundingClientRect();
                const navBottom = Math.max(navRect.bottom, 32); // Minimum 32px from top
                
                // Set the custom property for positioning
                document.documentElement.style.setProperty('--nav-bottom', navBottom + 'px');
            }
        }

        // Run on load
        document.addEventListener('DOMContentLoaded', updateNavbarPositioning);
        
        // Run on resize
        window.addEventListener('resize', updateNavbarPositioning);
        
        // Run after a short delay to catch any dynamic header changes
        setTimeout(updateNavbarPositioning, 500);
    });
    </script>
    <?php
}

/* ------------------------------------------------------------------------
   2. REGISTER REST API ENDPOINTS
------------------------------------------------------------------------ */
// Optional debug logs for REST initialization
add_action('rest_api_init', function() {
    error_log('REST API initialized from My First Plugin');
});

// Force-enable the REST API if something else is blocking it
add_action('init', function() {
    remove_filter('rest_authentication_errors', 'restrict_rest_api');
    add_filter('rest_enabled', '__return_true');
    add_filter('rest_jsonp_enabled', '__return_true');
});

/**
 * 2A) /wp-json/my-plugin/v1/test
 *     Quick test that returns {status: "ok"}
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/test', [
        'methods'  => 'GET',
        'callback' => function() {
            return new WP_REST_Response([
                'status'  => 'ok',
                'message' => 'REST API is working'
            ], 200);
        },
        'permission_callback' => '__return_true'
    ]);
});


/**
 * 2F) /wp-json/my-plugin/v1/all-content
 *     Returns all content types in one request
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/all-content', [
        'methods'  => ['GET', 'POST', 'OPTIONS'],
        'callback' => function($request) {
            $response = [
                'posts' => [],
                'pages' => [],
                'products' => [],
                'categories' => [],
                'tags' => [],
                'comments' => [],
                'reviews' => [],
                'authors' => [],
                'media' => [],
                'customFields' => [],
                'productCategories' => [],
                'productTags' => []
            ];

            // Get Authors
            $authors = get_users(['role__in' => ['author', 'editor', 'administrator']]);
            foreach ($authors as $author) {
                $response['authors'][] = [
                    'id' => $author->ID,
                    'name' => $author->display_name,
                    'email' => $author->user_email,
                    'url' => $author->user_url,
                    'bio' => get_user_meta($author->ID, 'description', true),
                    'avatar' => get_avatar_url($author->ID)
                ];
            }

            // Get Media
            $media_items = get_posts([
                'post_type' => 'attachment',
                'post_status' => 'inherit',
                'posts_per_page' => -1
            ]);
            foreach ($media_items as $media) {
                $metadata = wp_get_attachment_metadata($media->ID);
                $response['media'][] = [
                    'id' => $media->ID,
                    'title' => $media->post_title,
                    'url' => wp_get_attachment_url($media->ID),
                    'alt' => get_post_meta($media->ID, '_wp_attachment_image_alt', true),
                    'description' => $media->post_content,
                    'caption' => $media->post_excerpt,
                    'mime_type' => $media->post_mime_type,
                    'metadata' => $metadata
                ];
            }

            // Get Custom Fields (Post Meta)
            $post_types = ['post', 'page', 'product'];
            foreach ($post_types as $post_type) {
                $posts = get_posts([
                    'post_type' => $post_type,
                    'posts_per_page' => -1
                ]);
                foreach ($posts as $post) {
                    $custom_fields = get_post_custom($post->ID);
                    foreach ($custom_fields as $key => $values) {
                        // Skip internal WordPress meta
                        if (strpos($key, '_') === 0) continue;
                        
                        $response['customFields'][] = [
                            'post_id' => $post->ID,
                            'post_type' => $post_type,
                            'meta_key' => $key,
                            'meta_value' => $values[0]
                        ];
                    }
                }
            }

            // Get Product Categories
            if (taxonomy_exists('product_cat')) {
                $product_categories = get_terms([
                    'taxonomy' => 'product_cat',
                    'hide_empty' => false
                ]);
                foreach ($product_categories as $category) {
                    $thumbnail_id = get_term_meta($category->term_id, 'thumbnail_id', true);
                    $response['productCategories'][] = [
                        'id' => $category->term_id,
                        'name' => $category->name,
                        'slug' => $category->slug,
                        'description' => $category->description,
                        'parent' => $category->parent,
                        'count' => $category->count,
                        'image' => $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : null
                    ];
                }
            }

            // Get Product Tags
            if (taxonomy_exists('product_tag')) {
                $product_tags = get_terms([
                    'taxonomy' => 'product_tag',
                    'hide_empty' => false
                ]);
                foreach ($product_tags as $tag) {
                    $response['productTags'][] = [
                        'id' => $tag->term_id,
                        'name' => $tag->name,
                        'slug' => $tag->slug,
                        'description' => $tag->description,
                        'count' => $tag->count
                    ];
                }
            }

            // Get Posts
            $posts = get_posts([
                'post_type' => 'post',
                'post_status' => 'publish',
                'numberposts' => -1
            ]);

            foreach ($posts as $post) {
                // Get comments for this post
                $comments = get_comments([
                    'post_id' => $post->ID,
                    'status' => 'approve'
                ]);

                $formatted_comments = [];
                foreach ($comments as $comment) {
                    $formatted_comments[] = [
                        'id' => $comment->comment_ID,
                        'post_id' => $post->ID,
                        'author' => $comment->comment_author,
                        'author_email' => $comment->comment_author_email,
                        'content' => wp_strip_all_tags($comment->comment_content),
                        'date' => $comment->comment_date,
                        'status' => $comment->comment_approved,
                        'parent_id' => $comment->comment_parent
                    ];
                }

                // Add comments to the main comments array
                $response['comments'] = array_merge($response['comments'], $formatted_comments);

                $response['posts'][] = [
                    'id' => $post->ID,
                    'title' => $post->post_title,
                    'content' => $post->post_content,
                    'contentStripped' => wp_strip_all_tags($post->post_content),
                    'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
                    'slug' => $post->post_name,
                    'link' => get_permalink($post->ID),
                    'author' => get_the_author_meta('display_name', $post->post_author),
                    'date' => $post->post_date,
                    'categories' => wp_get_post_categories($post->ID, ['fields' => 'names']),
                    'tags' => wp_get_post_tags($post->ID, ['fields' => 'names'])
                ];
            }

            // Get Pages
            $pages = get_pages(['post_status' => 'publish']);
            if (!empty($pages)) {
                foreach ($pages as $page) {
                    $response['pages'][] = [
                        'id' => $page->ID,
                        'title' => $page->post_title,
                        'content' => $page->post_content,
                        'contentStripped' => wp_strip_all_tags($page->post_content),
                        'slug' => $page->post_name,
                        'link' => get_permalink($page->ID),
                        'template' => get_page_template_slug($page->ID),
                        'parent' => $page->post_parent,
                        'order' => $page->menu_order,
                        'lastModified' => $page->post_modified
                    ];
                }
            }

            // Get Categories
            $categories = get_categories(['hide_empty' => false]);
            foreach ($categories as $category) {
                $response['categories'][] = [
                    'id' => $category->term_id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'description' => wp_strip_all_tags($category->description)
                ];
            }

            // Get Tags
            $tags = get_tags(['hide_empty' => false]);
            foreach ($tags as $tag) {
                $response['tags'][] = [
                    'id' => $tag->term_id,
                    'name' => $tag->name,
                    'slug' => $tag->slug
                ];
            }

            // Get Products if WooCommerce is active
            if (class_exists('WC_Product_Query')) {
                $products = wc_get_products([
                    'status' => 'publish',
                    'limit' => -1
                ]);

                foreach ($products as $product) {
                    // Get reviews for this product
                    $reviews = get_comments([
                        'post_id' => $product->get_id(),
                        'status' => 'approve',
                        'type' => 'review'
                    ]);

                    $formatted_reviews = [];
                    foreach ($reviews as $review) {
                        $rating = get_comment_meta($review->comment_ID, 'rating', true);
                        $verified = get_comment_meta($review->comment_ID, 'verified', true);

                        $formatted_reviews[] = [
                            'id' => $review->comment_ID,
                            'product_id' => $product->get_id(),
                            'reviewer' => $review->comment_author,
                            'reviewer_email' => $review->comment_author_email,
                            'review' => wp_strip_all_tags($review->comment_content),
                            'rating' => (int)$rating,
                            'date' => $review->comment_date,
                            'verified' => (bool)$verified
                        ];
                    }

                    // Add reviews to the main reviews array
                    $response['reviews'] = array_merge($response['reviews'], $formatted_reviews);

                    $response['products'][] = [
                        'id' => $product->get_id(),
                        'name' => $product->get_name(),
                        'slug' => $product->get_slug(),
                        'description' => wp_strip_all_tags($product->get_description()),
                        'short_description' => wp_strip_all_tags($product->get_short_description()),
                        'price' => $product->get_price(),
                        'regular_price' => $product->get_regular_price(),
                        'sale_price' => $product->get_sale_price(),
                        'stock_quantity' => $product->get_stock_quantity(),
                        'link' => get_permalink($product->get_id())
                    ];
                }
            }

            return new WP_REST_Response($response, 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/* ------------------------------------------------------------------------
   3. CORS HEADERS
------------------------------------------------------------------------ */
add_action('init', function() {
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
        header('Access-Control-Allow-Credentials: true');
    } else {
        header("Access-Control-Allow-Origin: *");
    }
    
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept");
    
    // Handle preflight requests
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        status_header(200);
        exit();
    }
});

// Also add CORS headers to REST API responses
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
            header('Access-Control-Allow-Credentials: true');
        } else {
            header("Access-Control-Allow-Origin: *");
        }
        
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
        header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept");
        header("Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages");
        return $value;
    });
}, 15);


/* ------------------------------------------------------------------------
   5. ADD FRONT-END INTERFACES TO <body>
------------------------------------------------------------------------ */
function my_first_plugin_add_toggle_button() {
    $hook = current_filter(); // Get the current hook being used
    voicero_debug_log('Adding Voicero container via ' . $hook . ' hook');
    
    // Only add a simple container div - the JavaScript will handle the rest
    ?>
    <div id="voicero-app-container" data-hook="<?php echo esc_attr($hook); ?>"></div>
    <?php
    voicero_debug_log('Voicero container added to the page');
}
add_action('wp_body_open', 'my_first_plugin_add_toggle_button');
add_action('wp_footer', 'my_first_plugin_add_toggle_button', 999); // Add to footer as fallback with high priority

// Add this near the top of the file after the header
function ai_website_get_access_key() {
    return get_option('ai_website_access_key', '');
}

// Add this to make the access key and API URL available to frontend scripts
function ai_website_enqueue_scripts() {
    voicero_debug_log('Enqueueing Voicero AI scripts');
    
    // First enqueue the core script
    wp_enqueue_script(
        'voicero-core-js',
        plugin_dir_url(__FILE__) . 'assets/voicero-core.js',
        ['jquery'],
        '1.1',
        true
    );
    
    // Then enqueue the text script with core as dependency
    wp_enqueue_script(
        'voicero-text-js',
        plugin_dir_url(__FILE__) . 'assets/voicero-text.js',
        ['voicero-core-js', 'jquery'],
        '1.1',
        true
    );
    
    // Then enqueue the voice script with core as dependency
    wp_enqueue_script(
        'voicero-voice-js',
        plugin_dir_url(__FILE__) . 'assets/voicero-voice.js',
        ['voicero-core-js', 'jquery'],
        '1.1',
        true
    );

    // Get access key
    $access_key = get_option('ai_website_access_key', '');
    voicero_debug_log('Access key available', !empty($access_key));

    // Pass data to the frontend script
    wp_localize_script('voicero-core-js', 'aiWebsiteConfig', [
        'accessKey' => $access_key,
        'apiUrl' => AI_WEBSITE_API_URL,
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('ai_website_frontend_nonce'),
        'pluginUrl' => plugin_dir_url(__FILE__),
        'debug' => defined('WP_DEBUG') && WP_DEBUG ? true : false
    ]);

    // Also create window.voiceroConfig for backwards compatibility
    wp_add_inline_script('voicero-core-js', 'window.voiceroConfig = window.aiWebsiteConfig;', 'before');

    // Enqueue the stylesheet
    wp_enqueue_style(
        'ai-website-style', 
        plugin_dir_url(__FILE__) . 'assets/style.css', 
        [], 
        '1.1'
    );
    
    voicero_debug_log('Voicero AI scripts enqueued successfully');
}
add_action('wp_enqueue_scripts', 'ai_website_enqueue_scripts');

// Add AJAX handler for frontend access
add_action('wp_ajax_nopriv_ai_website_get_info', 'ai_website_get_info');
add_action('wp_ajax_ai_website_get_info', 'ai_website_get_info');

function ai_website_get_info() {
    // Verify nonce for both admin and frontend
    $is_admin = check_admin_referer('ai_website_ajax_nonce', 'nonce', false); 
    $is_frontend = check_ajax_referer('ai_website_frontend_nonce', 'nonce', false);
    
    if (!$is_admin && !$is_frontend) {
        wp_send_json_error(['message' => 'Invalid nonce']);
    }
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => 'Connection failed: ' . $response->get_error_message()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        wp_send_json_error([
            'message' => 'Server returned error: ' . $response_code,
            'body' => $body
        ]);
    }

    $data = json_decode($body, true);
    if (!$data || !isset($data['website'])) {
        error_log('AI Website response body: ' . $body);
        wp_send_json_error([
            'message' => 'Invalid response from server'
        ]);
    }

    // Return just the website data
    wp_send_json_success($data['website']);
}

function ai_website_clear_connection() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    delete_option('ai_website_access_key');
    wp_send_json_success(['message' => 'Connection cleared']);
}

// Function to add inline debugging script
function voicero_add_inline_debug_script() {
    if (defined('WP_DEBUG') && WP_DEBUG) {
        ?>
        <script>
        (function() {
            console.log('Voicero Debug Script: Checking for elements and scripts');
            
            // Wait for DOM to be fully loaded
            window.addEventListener('DOMContentLoaded', function() {
                // Check if container exists
                const container = document.getElementById('voicero-app-container');
                console.log('Voicero container found:', !!container);
                if (container) {
                    console.log('Voicero container hook:', container.getAttribute('data-hook'));
                }
                
                // Check if scripts are loaded
                console.log('Core script loaded:', typeof window.VoiceroCore !== 'undefined');
                console.log('Text script loaded:', typeof window.VoiceroText !== 'undefined');
                console.log('Voice script loaded:', typeof window.VoiceroVoice !== 'undefined');
                
                // Check for config
                console.log('Config found:', typeof window.aiWebsiteConfig !== 'undefined');
                
                // Run a test after a short delay
                setTimeout(function() {
                    if (window.VoiceroCore) {
                        console.log('VoiceroCore API connected:', window.VoiceroCore.apiConnected);
                        console.log('VoiceroCore API URL:', window.VoiceroCore.apiBaseUrl);
                    }
                }, 2000);
            });
        })();
        </script>
        <?php
    }
}
add_action('wp_footer', 'voicero_add_inline_debug_script', 9999);
