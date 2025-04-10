<?php
/**
 * Plugin Name: Voicero.AI
 * Description: Connect your site to an AI Salesman. It answers questions, guides users, and boosts sales.
 * Version: 1.0
 * Author: Voicero.AI
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */


if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

// Register activation hook to flush rewrite rules
register_activation_hook(__FILE__, 'voicero_activate_plugin');

// Activation function to flush rewrite rules
function voicero_activate_plugin() {
    // Ensure the REST API is properly initialized
    do_action('rest_api_init');
    // Flush rewrite rules to ensure endpoints work
    flush_rewrite_rules();
    // Log activation
    error_log('Voicero plugin activated - rewrite rules flushed');
}

// Define the API base URL
define('AI_WEBSITE_API_URL', 'http://localhost:3000/api');

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

// Add action to flush rewrite rules
add_action('wp_ajax_voicero_flush_rules', 'voicero_flush_rules');
function voicero_flush_rules() {
    // Verify user has admin capabilities
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Permission denied']);
        return;
    }
    
    // Flush rewrite rules
    flush_rewrite_rules();
    
    // Reinitialize REST API
    do_action('rest_api_init');
    
    wp_send_json_success(['message' => 'Rewrite rules flushed successfully']);
}

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

// Add new AJAX handlers for training steps
add_action('wp_ajax_ai_website_train_page', 'ai_website_train_page');
add_action('wp_ajax_ai_website_train_post', 'ai_website_train_post');
add_action('wp_ajax_ai_website_train_product', 'ai_website_train_product');
add_action('wp_ajax_ai_website_train_general', 'ai_website_train_general');

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
        // 1. Sync the content
        $data = collect_wordpress_data();

        $sync_response = wp_remote_post(AI_WEBSITE_API_URL . '/wordpress/sync', [
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

        $response_code = wp_remote_retrieve_response_code($sync_response);
        if ($response_code !== 200) {
            wp_send_json_error([
                'message' => 'Sync failed: Server returned ' . $response_code,
                'code' => $response_code,
                'stage' => 'sync',
                'progress' => 0,
                'body' => wp_remote_retrieve_body($sync_response)
            ]);
        }


        // Return success after sync is complete
        wp_send_json_success([
            'message' => 'Content sync completed, ready for vectorization...',
            'stage' => 'sync',
            'progress' => 17, // Updated progress
            'complete' => false,
            'details' => [
                'sync' => json_decode(wp_remote_retrieve_body($sync_response), true)
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

    $vectorize_response = wp_remote_post(AI_WEBSITE_API_URL . '/wordpress/vectorize', [
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
            'progress' => 17 // Keep progress at previous step
        ]);
    }
    
    $response_code = wp_remote_retrieve_response_code($vectorize_response);
    if ($response_code !== 200) {
         wp_send_json_error([
            'message' => 'Vectorization failed: Server returned ' . $response_code,
            'code' => $response_code,
            'stage' => 'vectorize',
            'progress' => 17,
            'body' => wp_remote_retrieve_body($vectorize_response)
        ]);
    }

    wp_send_json_success([
        'message' => 'Vectorization completed, setting up assistant...',
        'stage' => 'vectorize',
        'progress' => 34, // Updated progress
        'complete' => false,
        'details' => json_decode(wp_remote_retrieve_body($vectorize_response), true)
    ]);
}

// Add new endpoint for assistant setup
function ai_website_setup_assistant() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $assistant_response = wp_remote_post(AI_WEBSITE_API_URL . '/wordpress/assistant', [
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
            'progress' => 34 // Keep progress at previous step
        ]);
    }
    
    $response_code = wp_remote_retrieve_response_code($assistant_response);
    $body = wp_remote_retrieve_body($assistant_response);
    
    if ($response_code !== 200) {
         wp_send_json_error([
            'message' => 'Assistant setup failed: Server returned ' . $response_code,
            'code' => $response_code,
            'stage' => 'assistant',
            'progress' => 34,
            'body' => $body
        ]);
    }

    $data = json_decode($body, true);
     if (json_last_error() !== JSON_ERROR_NONE || !$data) {
        wp_send_json_error([
            'message' => 'Invalid response from assistant setup',
            'code' => 'invalid_json',
            'stage' => 'assistant',
            'progress' => 34
        ]);
    }

    wp_send_json_success([
        'message' => 'Assistant setup complete, preparing individual training...',
        'stage' => 'assistant',
        'progress' => 50, // Updated progress
        'complete' => false,
        'data' => $data // Pass the response data back to JS
    ]);
}

// Training Endpoints (Page, Post, Product, General)
function ai_website_train_page() {
    _handle_training_request('page', 'pageId');
}
function ai_website_train_post() {
    _handle_training_request('post', 'postId');
}
function ai_website_train_product() {
    _handle_training_request('product', 'productId');
}
function ai_website_train_general() {
    _handle_training_request('general');
}

// Helper for training requests
function _handle_training_request($type, $id_key = null) {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');

    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $api_url = AI_WEBSITE_API_URL . '/wordpress/train/' . $type;
    $request_body = [];
    
    // Add required parameters to the body based on type
    if ($type === 'general') {
        // For general training, we only need websiteId
        if (isset($_POST['websiteId'])) {
            $request_body['websiteId'] = sanitize_text_field($_POST['websiteId']);
        } else {
            wp_send_json_error(['message' => "Missing required parameter: websiteId"]);
            return;
        }
    } else {
        // For content-specific training, we need both wpId and websiteId
        // 1. Check for content ID (for our internal reference only)
        if ($id_key && isset($_POST[$id_key])) {
            // We don't need to send the page/post/product ID to the API
            // $request_body[$id_key] = sanitize_text_field($_POST[$id_key]);
        } elseif ($id_key) {
            wp_send_json_error(['message' => "Missing required parameter: $id_key"]);
            return;
        }
        
        // 2. Add wpId - required for content-specific training
        if (isset($_POST['wpId'])) {
            $request_body['wpId'] = sanitize_text_field($_POST['wpId']);
        } else {
            wp_send_json_error(['message' => "Missing required parameter: wpId"]);
            return;
        }
        
        // 3. Add websiteId - required for all types
        if (isset($_POST['websiteId'])) {
            $request_body['websiteId'] = sanitize_text_field($_POST['websiteId']);
        } else {
            wp_send_json_error(['message' => "Missing required parameter: websiteId"]);
            return;
        }
    }

    // Set a longer timeout for general training
    $timeout = ($type === 'general') ? 180 : 60; // 3 minutes for general, 1 minute for others

    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($request_body),
        'timeout' => $timeout, // Use the dynamic timeout
        'sslverify' => false
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => ucfirst($type) . ' training failed: ' . $response->get_error_message(),
            'code' => $response->get_error_code(),
            'type' => $type
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        wp_send_json_error([
            'message' => ucfirst($type) . ' training failed: Server returned ' . $response_code,
            'code' => $response_code,
            'body' => $body,
            'type' => $type
        ]);
    }

    wp_send_json_success([
        'message' => ucfirst($type) . ' training successful.',
        'type' => $type,
        'details' => json_decode($body, true)
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
            'metadata' => $metadata
        ];
    }

    // Get Custom Fields for Posts and Products
    foreach ($posts as $post) {
        $custom_fields = get_post_custom($post->ID);
        foreach ($custom_fields as $key => $values) {
            if (strpos($key, '_') !== 0) { // Skip private meta
                $data['customFields'][] = [
                    'postId' => $post->ID,
                    'metaKey' => $key,
                    'metaValue' => $values[0],
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
                    'metaValue' => $values[0],
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
        const savedAccessKey = '<?php echo esc_js($saved_key); ?>'; // Get saved key for JS

        // Handle sync form submission
        $('#sync-form').on('submit', function(e) {
            e.preventDefault();
            const syncButton = $('#sync-button');
            const syncStatusContainer = $('#sync-status'); 

            // Reset initial state
            syncButton.prop('disabled', true);

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

            const progressBar = $('#sync-progress-bar');
            const progressPercentage = $('#sync-progress-percentage');
            const progressText = $('#sync-progress-text');

            function updateProgress(percentage, text, isError = false) {
                const p = Math.min(100, Math.max(0, Math.round(percentage))); // Clamp between 0 and 100
                progressBar.css('width', p + '%');
                progressPercentage.text(p + '%');
                progressText.text(text);
                
                if (isError) {
                    progressBar.css('background-color', '#d63638'); // Red for error
                    progressPercentage.css('color', '#fff'); 
                } else {
                     progressBar.css('background-color', '#0073aa'); // Blue for progress/success
                     progressPercentage.css('color', p < 40 ? '#333' : '#fff'); 
                }
            }

            updateProgress(5, '⏳ Syncing content...'); 

            try {
                let assistantData = null; // To store assistant response
                let websiteId = null; // Declare websiteId at a higher scope level

                // Step 1: Initial Sync (to 17%)
                $.post(ajaxurl, { action: 'ai_website_sync_content', nonce: nonce })
                .then(function(response) {
                    if (!response.success) throw new Error(response.data.message || "Sync failed");
                    updateProgress(response.data.progress || 17, '⏳ Vectorizing content...');
                    // Step 2: Vectorization (to 34%)
                    return $.post(ajaxurl, { action: 'ai_website_vectorize_content', nonce: nonce });
                })
                .then(function(response) {
                    if (!response.success) throw new Error(response.data.message || "Vectorization failed");
                    updateProgress(response.data.progress || 34, '⏳ Setting up assistant...');
                    // Step 3: Assistant Setup (to 50%)
                    return $.post(ajaxurl, { action: 'ai_website_setup_assistant', nonce: nonce });
                })
                .then(function(response) {
                    if (!response.success) throw new Error(response.data.message || "Assistant setup failed");
                    updateProgress(response.data.progress || 50, '⏳ Preparing content training...');
                    assistantData = response.data.data; // Store the content IDs
                    
                    // Store websiteId at the higher scope
                    if (assistantData && assistantData.websiteId) {
                        websiteId = assistantData.websiteId;
                    } else {
                        console.warn("No websiteId found in assistant response");
                        // Try to use the first content item's websiteId as fallback
                        if (assistantData && assistantData.content && 
                            assistantData.content.pages && assistantData.content.pages.length > 0) {
                            websiteId = assistantData.content.pages[0].websiteId;
                        }
                        // If still no websiteId, we'll need to handle that error case
                        if (!websiteId) {
                            throw new Error("No websiteId available for training");
                        }
                    }
                    
                    // --- Step 4: All Training (50% to 100%) ---
                    if (!assistantData || !assistantData.content) {
                         console.warn("No content data received from assistant setup, skipping content training.");
                         // Even if no content items, we still need to do general training
                    }
                    
                    const trainingPromises = [];
                    const pages = assistantData && assistantData.content ? (assistantData.content.pages || []) : [];
                    const posts = assistantData && assistantData.content ? (assistantData.content.posts || []) : [];
                    const products = assistantData && assistantData.content ? (assistantData.content.products || []) : [];
                    
                    // Calculate total items including general training which we'll do last
                    const totalItems = pages.length + posts.length + products.length + 1; // +1 for general training
                    let completedItems = 0;
                    const progressRange = 50; // 100 - 50 = 50% range for all training calls
                    
                    updateProgress(50, `⏳ Starting training for ${totalItems} items...`);

                    // Create promises for pages
                    pages.forEach(page => {
                        const promise = $.post(ajaxurl, { 
                            action: 'ai_website_train_page', 
                            nonce: nonce,
                            pageId: page.id, // Keep for our reference
                            wpId: page.id, // This is the actual WordPress ID
                            websiteId: websiteId // Website ID from higher scope
                        }).then(() => {
                             completedItems++;
                             const currentProgress = 50 + (completedItems / totalItems) * progressRange;
                             updateProgress(currentProgress, `⏳ Training content (${completedItems}/${totalItems})...`);
                        });
                        trainingPromises.push(promise);
                    });

                    // Create promises for posts
                    posts.forEach(post => {
                         const promise = $.post(ajaxurl, { 
                             action: 'ai_website_train_post', 
                             nonce: nonce,
                             postId: post.id, // Keep for our reference
                             wpId: post.id, // This is the actual WordPress ID
                             websiteId: websiteId // Website ID from higher scope
                         }).then(() => {
                             completedItems++;
                             const currentProgress = 50 + (completedItems / totalItems) * progressRange;
                             updateProgress(currentProgress, `⏳ Training content (${completedItems}/${totalItems})...`);
                         });
                         trainingPromises.push(promise);
                    });
                    
                    // Create promises for products
                    products.forEach(product => {
                         const promise = $.post(ajaxurl, { 
                             action: 'ai_website_train_product', 
                             nonce: nonce,
                             productId: product.id, // Keep for our reference
                             wpId: product.id, // This is the actual WordPress ID
                             websiteId: websiteId // Website ID from higher scope
                         }).then(() => {
                             completedItems++;
                             const currentProgress = 50 + (completedItems / totalItems) * progressRange;
                             updateProgress(currentProgress, `⏳ Training content (${completedItems}/${totalItems})...`);
                         });
                         trainingPromises.push(promise);
                    });

                    // Always add general training as the last item in our training set
                    // This ensures it runs after all individual items are trained
                    trainingPromises.push(
                        // Create a promise for general training
                        $.post(ajaxurl, { 
                            action: 'ai_website_train_general', 
                            nonce: nonce,
                            websiteId: websiteId // Website ID from higher scope
                        }).then(() => {
                            completedItems++;
                            const currentProgress = 50 + (completedItems / totalItems) * progressRange;
                            updateProgress(currentProgress, `⏳ Finalizing training (${completedItems}/${totalItems})...`);
                            // Should be at 100% now
                            if (completedItems === totalItems) {
                                updateProgress(100, '✅ Sync & Training Complete!');
                            }
                        })
                    );

                    // Wait for all training calls to complete (including general)
                    return Promise.all(trainingPromises);
                })
                .then(function() {
                    // All training is complete (both individual and general)
                    // Update website info after completion
                    setTimeout(() => {
                        loadWebsiteInfo();
                    }, 1500);
                })
                .catch(function(error) {
                    // General Error handling for the entire chain
                    console.error("Sync/Training process failed:", error);
                    const currentProgress = parseFloat(progressBar.css('width')) / progressBar.parent().width() * 100;
                    updateProgress(currentProgress, `❌ Error: ${error.message}`, true); 
                })
                .always(function() {
                    // Re-enable button regardless of success or failure
                    syncButton.prop('disabled', false);
                });
            } catch (error) {
                // Catch synchronous errors (should be rare)
                syncButton.prop('disabled', false);
                updateProgress(0, `❌ Error: ${error.message}`, true);
            }
        });

        function loadWebsiteInfo() {
            const container = $('#website-info-container');
            
            $.get(ajaxurl, {
                action: 'ai_website_get_info',
                nonce: nonce
            })
            .done(function(response) {
                if (!response || !response.success) {
                     let errorMsg = 'Failed to load website info';
                     if(response && response.data && response.data.message) {
                         errorMsg = response.data.message;
                     } else if (response && response.data && response.data.body) {
                         try {
                            const body = JSON.parse(response.data.body);
                            errorMsg = body.message || errorMsg;
                         } catch(e) {}
                     }
                     throw new Error(errorMsg);
                }

                const website = response.data; // The API returns website data directly under 'data'
                
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

                    // Handle first sync button click in modal (uses the main sync logic)
                    $('#first-sync-button').on('click', function() {
                        const $modalContent = $(this).closest('.notice');
                         $('#first-time-modal').fadeOut(); // Close modal immediately
                         $('#sync-button').trigger('click'); // Trigger the main sync button
                    });
                }

                // Regular website info display code...
                const html = `
                    <table class="widefat">
                        <tbody>
                            <tr>
                                <th>Website Name</th>
                                <td>
                                    ${website.name || 'Unnamed Site'}
                                    
                                </td>
                            </tr>
                            <tr>
                                <th>URL</th>
                                <td>${website.url || 'Not set'}</td>
                            </tr>
                            <tr>
                                <th>Plan</th>
                                <td>${website.plan || 'Free'}</td>
                            </tr>
                            ${website.color ? `
                            <tr>
                                <th>Color</th>
                                <td style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 24px; height: 24px; border-radius: 4px; background-color: ${website.color}; border: 1px solid #ddd;"></div>
                                    <code style="font-size: 13px; padding: 4px 8px; background: #f0f0f1; border-radius: 3px;">${website.color}</code>
                                </td>
                            </tr>
                            ` : ''}
                            <tr>
                                <th>Status</th>
                                <td>
                                    <span class="button button-small ${website.active ? 'button-primary' : 'button-secondary'}">
                                        ${website.active ? 'Active' : 'Inactive'}
                                    </span>
                                    <button class="button button-small toggle-status-btn" 
                                            data-website-id="${website.id || ''}" 
                                            data-access-key="${savedAccessKey}"
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
                           
                        </tbody>
                    </table>

                    <div style="margin-top: 20px; display: flex; gap: 10px; align-items: center;">
                        <a href="http://localhost:3000/app/websites/website?id=${website.id || ''}" target="_blank" class="button button-primary">
                            Open Dashboard
                        </a>
                        <button class="button toggle-status-btn" 
                                data-website-id="${website.id || ''}"
                                data-access-key="${savedAccessKey}"
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
        if (savedAccessKey) {
            loadWebsiteInfo();
        }

        // If there was an error on page load, show the connect button prominently
        if ($('#website-info-container .notice-error').length > 0) {
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
            
            fetch( '<?php echo AI_WEBSITE_API_URL; ?>' + '/websites/toggle-status', {
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
                alert('Failed to toggle website status: ' + error.message + '. Please try again.');
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
                // error_log("Access key being used: " + substr($key, 0, 10) + "..."); // Be careful logging keys
            ?>';
            // console.log("Access key loaded:", ACCESS_KEY.substring(0, 10) + "..."); // Debug log
            
            // Expose config globally (or use a more structured approach if needed)
             window.aiWebsiteConfig = {
                accessKey: ACCESS_KEY,
                apiUrl: '<?php echo esc_js(AI_WEBSITE_API_URL); ?>',
                ajaxUrl: '<?php echo esc_js(admin_url('admin-ajax.php')); ?>',
                nonce: '<?php echo esc_js(wp_create_nonce('ai_website_frontend_nonce')); ?>', // Frontend nonce
                adminNonce: nonce // Admin nonce already defined above
             };
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
    // error_log('REST API initialized from My First Plugin');
});

// Force-enable the REST API if something else is blocking it
add_action('init', function() {
    remove_filter('rest_authentication_errors', 'restrict_rest_api');
    add_filter('rest_enabled', '__return_true');
    add_filter('rest_jsonp_enabled', '__return_true');
});

/**
 * Add secure proxy endpoint for Voicero API
 * This keeps the access key server-side only
 */
add_action('rest_api_init', function() {
    register_rest_route('voicero/v1', '/connect', [
        'methods'  => 'GET',
        'callback' => 'voicero_connect_proxy',
        'permission_callback' => '__return_true'
    ]);

    // New session endpoint proxy that handles both GET and POST
    register_rest_route('voicero/v1', '/session', [
        'methods'  => ['GET', 'POST'],
        'callback' => 'voicero_session_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Alternative endpoint without nested path
    register_rest_route('voicero/v1', '/window_state', [
        'methods'  => ['POST'],
        'callback' => 'voicero_window_state_proxy',
        'permission_callback' => '__return_true'
    ]);
});

function voicero_connect_proxy() {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Make the API request with the key (server-side)
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
        error_log('Voicero proxy connect error: ' . $response->get_error_message());
        return new WP_REST_Response([
            'error' => 'Connection failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Proxy for the /session endpoint
 * Handles both GET and POST requests
 */
function voicero_session_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Determine if it's a GET or POST request
    $method = $request->get_method();
    $endpoint = AI_WEBSITE_API_URL . '/session';
    
    // Handle GET request
    if ($method === 'GET') {
        $params = $request->get_query_params();
        $website_id = isset($params['websiteId']) ? $params['websiteId'] : '';
        
        if (empty($website_id)) {
            return new WP_REST_Response(['error' => 'Website ID is required'], 400);
        }
        
        $endpoint .= '?websiteId=' . urlencode($website_id);
        
        $response = wp_remote_get($endpoint, [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'timeout' => 30,
            'sslverify' => false // Only for local development
        ]);
    } 
    // Handle POST request
    else if ($method === 'POST') {
        // Get the request body and pass it through to the API
        $body = $request->get_body();
        
        $response = wp_remote_post($endpoint, [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => $body,
            'timeout' => 30,
            'sslverify' => false // Only for local development
        ]);
    }
    
    if (is_wp_error($response)) {
        error_log('Voicero proxy session error: ' . $response->get_error_message());
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Proxy for the /session/window endpoint
 * Handles window state updates
 */
function voicero_window_state_proxy($request) {
    // Debug incoming request
    error_log('Window state proxy called with request: ' . print_r($request->get_params(), true));
    
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the request body
    $body = $request->get_body();
    error_log('Request body: ' . $body);
    
    // Decode the body to validate it has the required fields
    $decoded_body = json_decode($body, true);
    if (!isset($decoded_body['sessionId']) || !isset($decoded_body['windowState'])) {
        error_log('Invalid request: Missing sessionId or windowState');
        return new WP_REST_Response(['error' => 'Session ID and window state are required'], 400);
    }
    
    // Ensure session ID is a properly formatted string
    $session_id = trim($decoded_body['sessionId']);
    if (empty($session_id)) {
        error_log('Invalid request: Empty sessionId');
        return new WP_REST_Response(['error' => 'Valid Session ID is required'], 400);
    }
    
    error_log('Processing update for session ID: ' . $session_id);
    
    // Construct the API endpoint
    $endpoint = AI_WEBSITE_API_URL . '/session/windows';
    error_log('Making request to: ' . $endpoint);
    
    // Make the PATCH request with the key (server-side)
    $response = wp_remote_request($endpoint, [
        'method' => 'PATCH', // Explicitly use PATCH method for updating
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => $body, // Keep the original body format
        'timeout' => 30,
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
        error_log('Voicero proxy window state error: ' . $response->get_error_message());
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Debug response
    error_log('API response code: ' . $status_code);
    error_log('API response body: ' . $response_body);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

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
        $origin = $_SERVER['HTTP_ORIGIN'];
        // Add allowed origins here if needed, otherwise '*' might be okay for development
        $allowed_origins = ['http://localhost:3000', 'http://localhost:5173']; // Add frontend dev server if different
        if (in_array($origin, $allowed_origins) || $origin === get_site_url()) { // Allow own origin
             header("Access-Control-Allow-Origin: {$origin}");
        header('Access-Control-Allow-Credentials: true');
    } else {
            // Potentially restrict to known origins in production
            header("Access-Control-Allow-Origin: *"); // More permissive for dev
        }
    } else {
        header("Access-Control-Allow-Origin: *"); // Fallback
    }
    
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE"); // Allow common methods
    header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With"); // Allow common headers
    
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
            $origin = $_SERVER['HTTP_ORIGIN'];
            $allowed_origins = ['http://localhost:3000', 'http://localhost:5173']; 
             if (in_array($origin, $allowed_origins) || $origin === get_site_url()) {
                 header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Credentials: true');
            } else {
                 header("Access-Control-Allow-Origin: *"); 
            }
        } else {
            header("Access-Control-Allow-Origin: *");
        }
        
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With"); // Added X-WP-Nonce
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
    
    // Only add the button if the website is active AND synced
    $saved_key = get_option('ai_website_access_key', '');
    $is_active = false; // Default
    $is_synced = false; // Default

    if ($saved_key) {
        // We need to fetch the status - this is tricky without duplicating the API call.
        // Simplification: Assume if key exists, we *might* add the button,
        // JS will handle showing/hiding based on actual fetched status later.
        // Or better: Check a transient or option set during sync/activation.
        // For now, let's just enqueue scripts regardless and let JS decide to show the button.
    }

    ?>

   

    <!-- Main container for Voicero app -->
    <div id="voicero-app-container" data-hook="<?php echo esc_attr($hook); ?>"></div>
    <?php
    voicero_debug_log('Voicero container added to the page');
}

// Add to both wp_body_open and wp_footer for maximum compatibility
add_action('wp_body_open', 'my_first_plugin_add_toggle_button');
add_action('wp_footer', 'my_first_plugin_add_toggle_button', 999);

// Add this near the top of the file after the header
function ai_website_get_access_key() {
    return get_option('ai_website_access_key', '');
}

// Add this to make the access key and API URL available to frontend scripts
function ai_website_enqueue_scripts() {
    voicero_debug_log('Enqueueing Voicero AI scripts');
    
    // Only enqueue on the frontend, not in admin
    if (!is_admin()) {
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
            // Removed accessKey for security - now using server-side proxy
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
}
add_action('wp_enqueue_scripts', 'ai_website_enqueue_scripts');

// Add AJAX handler for frontend access AND admin access
add_action('wp_ajax_nopriv_ai_website_get_info', 'ai_website_get_info'); // For logged-out users (frontend)
add_action('wp_ajax_ai_website_get_info', 'ai_website_get_info'); // For logged-in users (admin and frontend)

function ai_website_get_info() {
    // Determine if it's an admin or frontend request and check appropriate nonce
    $nonce_to_check = '';
    $action = '';

    if (defined('DOING_AJAX') && DOING_AJAX) {
        $action = isset($_REQUEST['action']) ? sanitize_key($_REQUEST['action']) : '';
        $nonce_value = isset($_REQUEST['nonce']) ? sanitize_text_field($_REQUEST['nonce']) : '';

        if (is_admin()) { // Check if context is admin area
            $nonce_to_check = 'ai_website_ajax_nonce'; // Admin nonce
             if (!check_ajax_referer($nonce_to_check, 'nonce', false)) {
                 wp_send_json_error(['message' => 'Invalid admin nonce']);
                 return;
             }
        } else { // Assume frontend context
             $nonce_to_check = 'ai_website_frontend_nonce'; // Frontend nonce
             if (!check_ajax_referer($nonce_to_check, 'nonce', false)) {
                 wp_send_json_error(['message' => 'Invalid frontend nonce']);
                 return;
             }
        }
    } else {
        // Not an AJAX request? Should not happen for this endpoint.
        wp_send_json_error(['message' => 'Invalid request type']);
        return;
    }
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        // Send different errors depending on context maybe?
        // For now, same error.
        wp_send_json_error(['message' => 'No access key configured for this site.']);
    }

    $response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Keep false for local dev
    ]);

    if (is_wp_error($response)) {
         error_log('AI Website Get Info Error (WP_Error): ' . $response->get_error_message());
        wp_send_json_error([
            'message' => 'Connection failed: ' . $response->get_error_message()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        error_log('AI Website Get Info Error (API): Code ' . $response_code . ' Body: ' . $body);
        wp_send_json_error([
            'message' => 'Server returned error: ' . $response_code,
            'body' => $body // Avoid sending full body to frontend in prod
        ]);
    }

    $data = json_decode($body, true);
    // The /connect endpoint returns { website: {...} }
    if (!$data || !isset($data['website'])) {
        error_log('AI Website Get Info Error: Invalid response body: ' . $body);
        wp_send_json_error([
            'message' => 'Invalid response structure from server.'
        ]);
    }

    // Return just the website data
    wp_send_json_success($data['website']);
}

function ai_website_clear_connection() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Permission denied']);
        return;
    }
    delete_option('ai_website_access_key');
    // Optionally: delete other related options or transients
    wp_send_json_success(['message' => 'Connection cleared successfully']);
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

/**
 * Proxy for the /session/clear endpoint
 * Creates a new thread and resets welcome flags
 */
function voicero_session_clear_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the request body
    $body = $request->get_body();
    error_log('Session clear request body: ' . $body);
    
    // Decode the body to validate it has the required fields
    $decoded_body = json_decode($body, true);
    if (!isset($decoded_body['sessionId'])) {
        error_log('Invalid request: Missing sessionId');
        return new WP_REST_Response(['error' => 'Session ID is required'], 400);
    }
    
    // Construct the API endpoint
    $endpoint = AI_WEBSITE_API_URL . '/session/clear';
    error_log('Making request to: ' . $endpoint);
    
    // Make the POST request with the key (server-side)
    $response = wp_remote_request($endpoint, [
        'method' => 'POST',
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => $body, // Keep the original body format
        'timeout' => 30,
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
        error_log('Voicero proxy session clear error: ' . $response->get_error_message());
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Debug response
    error_log('API response code: ' . $status_code);
    error_log('API response body: ' . $response_body);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Proxy for the /chat endpoint
 * Handles text chat messages between client and AI
 */
function voicero_chat_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the request body
    $body = $request->get_body();
    error_log('Chat request body: ' . $body);
    
    // Decode the body to validate it has the required fields
    $decoded_body = json_decode($body, true);
    if (!isset($decoded_body['message'])) {
        error_log('Invalid chat request: Missing message');
        return new WP_REST_Response(['error' => 'Message is required'], 400);
    }
    
    // Make sure type is set to "text"
    $decoded_body['type'] = 'text';
    
    // Re-encode the body with any modifications
    $body = json_encode($decoded_body);
    
    // Construct the API endpoint - Updated to use /wordpress/chat instead of /chat
    $endpoint = AI_WEBSITE_API_URL . '/wordpress/chat';
    error_log('Making chat request to: ' . $endpoint);
    
    // Make the POST request with the key (server-side)
    $response = wp_remote_post($endpoint, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => $body,
        'timeout' => 60, // Longer timeout for chat responses
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
        error_log('Voicero chat proxy error: ' . $response->get_error_message());
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Debug response
    error_log('API response code: ' . $status_code);
    error_log('API response body: ' . $response_body);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

// Register REST API endpoints
add_action('rest_api_init', function() {
    if (!function_exists('register_rest_route')) {
        error_log('REST API functions not available - WordPress REST API may not be enabled');
        return;
    }
    
    error_log('Registering Voicero REST API endpoints');
    
    // Register the window_state endpoint
    register_rest_route('voicero/v1', '/window_state', [
        'methods'  => ['POST'],
        'callback' => 'voicero_window_state_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the connect endpoint
    register_rest_route('voicero/v1', '/connect', [
        'methods'  => 'GET',
        'callback' => 'voicero_connect_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the session endpoint
    register_rest_route('voicero/v1', '/session', [
        'methods'  => ['GET', 'POST'],
        'callback' => 'voicero_session_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the session_clear endpoint
    register_rest_route('voicero/v1', '/session_clear', [
        'methods'  => ['POST'],
        'callback' => 'voicero_session_clear_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the chat endpoint
    register_rest_route('voicero/v1', '/chat', [
        'methods'  => ['POST'],
        'callback' => 'voicero_chat_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    error_log('Voicero REST API endpoints registered successfully');
});
