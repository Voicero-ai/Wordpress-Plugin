<?php
/**
 * Plugin Name: AI-Website
 * Description: Example plugin that shows all pages in JSON on an admin page and sets up custom REST endpoints for AI usage.
 * Version: 1.1
 * Author: Your Name
 */

if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

/* ------------------------------------------------------------------------
   1. ADMIN PAGE TO DISPLAY CONNECTION INTERFACE
------------------------------------------------------------------------ */
add_action('admin_menu', 'ai_website_add_admin_page');
function ai_website_add_admin_page() {
    add_menu_page(
        'AI-Website',         // Page <title>
        'AI-Website',         // Menu label
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

// Define the API base URL
define('AI_WEBSITE_API_URL', 'http://localhost:3000/api');

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

    // First, let's collect all the data we want to sync
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
            'content' => wp_strip_all_tags($post->post_content),
            'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
            'slug' => $post->post_name,
            'link' => get_permalink($post->ID)
        ];
    }

    // Get Pages
    $pages = get_pages(['post_status' => 'publish']);
    foreach ($pages as $page) {
        $data['pages'][] = [
            'id' => $page->ID,
            'title' => $page->post_title,
            'content' => wp_strip_all_tags($page->post_content),
            'slug' => $page->post_name,
            'link' => get_permalink($page->ID)
        ];
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

    // Send the data to the AI Website API
    $response = wp_remote_post(AI_WEBSITE_API_URL . '/sync', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($data),
        'timeout' => 120,
        'sslverify' => false
    ]);

    if (is_wp_error($response)) {
        error_log('AI Website sync error: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => 'Sync failed: ' . $response->get_error_message(),
            'code' => $response->get_error_code()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        error_log('AI Website sync API error: ' . $body);
        wp_send_json_error([
            'message' => 'Server returned error during sync: ' . $response_code,
            'code' => $response_code,
            'body' => $body
        ]);
    }

    $data = json_decode($body, true);
    wp_send_json_success($data);
}

function ai_website_render_admin_page() {
    // Handle form submission
    if (isset($_POST['access_key']) && check_admin_referer('save_access_key_nonce')) {
        $access_key = sanitize_text_field($_POST['access_key']);
        
        // Basic validation of access key format
        if (strlen($access_key) !== 32) {
            add_settings_error(
                'ai_website_messages',
                'key_invalid',
                'Invalid access key format. Please check your key and try again.',
                'error'
            );
        } else {
            update_option('ai_website_access_key', $access_key);
            add_settings_error(
                'ai_website_messages',
                'key_updated',
                'Settings saved successfully! Attempting to connect...',
                'updated'
            );
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

    // Output the admin interface
    ?>
    <div class="wrap">
        <h1>AI Website Connection</h1>
        
        <?php settings_errors('ai_website_messages'); ?>

        <div class="card" style="max-width: 800px; margin-top: 20px;">
            <h2>Connect Your Website</h2>
            <p>Enter your access key to connect to the AI Website service.</p>

            <form method="post" action="">
                <?php wp_nonce_field('save_access_key_nonce'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="access_key">Access Key</label></th>
                        <td>
                            <input type="text" 
                                   id="access_key" 
                                   name="access_key" 
                                   value="<?php echo esc_attr($saved_key); ?>" 
                                   class="regular-text"
                                   placeholder="Enter your 32-character access key"
                                   pattern=".{32,32}"
                                   title="Access key should be exactly 32 characters long">
                            <p class="description">Your access key should be exactly 32 characters long.</p>
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
        </div>

        <?php if ($saved_key): ?>
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
                <div id="sync-progress" style="margin-top: 15px; display: none;">
                    <h4 style="margin-bottom: 10px;">Sync Progress</h4>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-text">0%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <script>
    jQuery(document).ready(function($) {
        const ajaxurl = '<?php echo esc_js(admin_url('admin-ajax.php')); ?>';
        const nonce = '<?php echo esc_js(wp_create_nonce('ai_website_ajax_nonce')); ?>';

        // Add the progress bar HTML
        const syncProgress = $('#sync-progress');
        syncProgress.html(`
            <style>
                .progress-container {
                    margin: 20px 0;
                    background: #f0f0f1;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .progress-bar {
                    width: 0%;
                    height: 24px;
                    background: #2271b1;
                    transition: width 0.3s ease;
                    position: relative;
                }
                .progress-text {
                    position: absolute;
                    width: 100%;
                    text-align: center;
                    color: white;
                    text-shadow: 0 0 2px rgba(0,0,0,0.4);
                    font-weight: bold;
                    line-height: 24px;
                }
            </style>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-text">0%</div>
                </div>
            </div>
        `);

        // Handle sync form submission
        $('#sync-form').on('submit', function(e) {
            e.preventDefault();
            const syncButton = $('#sync-button');
            const syncStatus = $('#sync-status');
            const progressBar = $('.progress-bar');
            const progressText = $('.progress-text');
            
            syncButton.prop('disabled', true);
            syncProgress.show();
            progressBar.css('width', '0%');
            progressText.text('0%');
            syncStatus.html(`<span class="spinner is-active" style="float: none;"></span> Starting sync...`);

            $.post(ajaxurl, {
                action: 'ai_website_sync_content',
                nonce: nonce
            })
            .done(function(response) {
                if (!response.success) {
                    syncStatus.html(`<span style="color: #d63638;">✗ ${response.data.message || 'Sync failed'}</span>`);
                    progressBar.css('width', '100%').css('background', '#d63638');
                    progressText.text('Failed');
                    return;
                }

                // Show completion
                progressBar.css('width', '100%');
                progressText.text('Complete!');
                syncStatus.html(`<span style="color: #00a32a;">✓ Sync completed successfully!</span>`);
                
                // Update website info after a short delay
                setTimeout(() => {
                    loadWebsiteInfo();
                    syncProgress.hide();
                }, 1500);
            })
            .fail(function(xhr, status, error) {
                syncStatus.html(`<span style="color: #d63638;">✗ Connection error: ${error || 'Failed to connect'}</span>`);
                progressBar.css('width', '100%').css('background', '#d63638');
                progressText.text('Failed');
            })
            .always(function() {
                syncButton.prop('disabled', false);
            });
        });

        function loadWebsiteInfo() {
            const container = $('#website-info-container');
            container.html(`
                <div class="spinner is-active" style="float: none;"></div>
                <p>Loading website information...</p>
            `);

            $.post(ajaxurl, {
                action: 'ai_website_check_connection',
                nonce: nonce
            })
            .done(function(response) {
                if (!response.success) {
                    container.html(`
                        <div class="notice notice-error">
                            <p>Error: ${response.data.message || 'Unknown error occurred'}</p>
                            ${response.data.code ? `<p>Error Code: ${response.data.code}</p>` : ''}
                            <p>Please check your access key or contact support if the problem persists.</p>
                        </div>
                    `);
                    return;
                }

                const website = response.data.website;
                const html = `
                    <table class="widefat">
                        <tbody>
                            <tr>
                                <th>Website Name</th>
                                <td>${website.name || website.url}</td>
                            </tr>
                            <tr>
                                <th>URL</th>
                                <td>${website.url}</td>
                            </tr>
                            <tr>
                                <th>Plan</th>
                                <td>${website.plan}</td>
                            </tr>
                            <tr>
                                <th>Status</th>
                                <td>
                                    <span class="button button-small ${website.active ? 'button-primary' : 'button-secondary'}">
                                        ${website.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <th>Monthly Queries</th>
                                <td>
                                    ${website.monthlyQueries} / ${website.queryLimit}
                                    <div class="progress-bar" style="
                                        background: #f0f0f1;
                                        height: 10px;
                                        border-radius: 5px;
                                        margin-top: 5px;
                                        overflow: hidden;
                                    ">
                                        <div style="
                                            width: ${(website.monthlyQueries / website.queryLimit) * 100}%;
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
                                <td>${website.syncFrequency}</td>
                            </tr>
                        </tbody>
                    </table>

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
 * 2E) /wp-json/my-plugin/v1/products
 *     Returns all published WooCommerce products with additional details
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/products', [
        'methods'  => 'GET',
        'callback' => function() {
            if (!class_exists('WC_Product_Query')) {
                return new WP_REST_Response(['error' => 'WooCommerce not installed'], 500);
            }

            // Query WooCommerce products
            $args = [
                'status' => 'publish',
                'limit'  => -1, // Get all products
            ];
            $query = new WC_Product_Query($args);
            $products = $query->get_products();

            $formatted_products = [];
            foreach ($products as $product) {
                // Get product categories
                $categories = wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'names']);
                
                // Get product attributes
                $attributes = [];
                foreach ($product->get_attributes() as $attribute) {
                    $attributes[] = [
                        'name' => wc_attribute_label($attribute->get_name()),
                        'options' => $attribute->get_options(),
                    ];
                }

                $formatted_products[] = [
                    'id'          => $product->get_id(),
                    'title'       => $product->get_name(),
                    'price'       => $product->get_price(),
                    'sale_price'  => $product->get_sale_price(),
                    'regular_price' => $product->get_regular_price(),
                    'content'     => wp_strip_all_tags($product->get_description()),
                    'short_description' => wp_strip_all_tags($product->get_short_description()),
                    'link'        => get_permalink($product->get_id()),
                    'image'       => wp_get_attachment_url($product->get_image_id()),
                    'categories'  => $categories,
                    'attributes'  => $attributes,
                    'sku'         => $product->get_sku(),
                    'stock_status' => $product->get_stock_status(),
                    'in_stock'    => $product->is_in_stock(),
                ];
            }

            return new WP_REST_Response($formatted_products, 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/**
 * 2B) /wp-json/my-plugin/v1/pages
 *     Returns all published pages (with stripped content)
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/pages', [
        'methods'  => 'GET',
        'callback' => function() {
            $all_pages = get_pages(['post_status' => 'publish']);
            $formatted_pages = [];

            foreach ($all_pages as $page) {
                $formatted_pages[] = [
                    'id'      => $page->ID,
                    'title'   => $page->post_title,
                    'content' => wp_strip_all_tags($page->post_content),
                    'link'    => get_permalink($page->ID),
                    'is_home' => ($page->ID == get_option('page_on_front'))
                ];
            }

            return new WP_REST_Response($formatted_pages, 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/**
 * 2C) /wp-json/my-plugin/v1/site-info
 *     Basic site info
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/site-info', [
        'methods'  => 'GET',
        'callback' => function() {
            return new WP_REST_Response([
                'name'           => get_bloginfo('name'),
                'description'    => get_bloginfo('description'),
                'url'            => home_url(),
                'front_page_id'  => get_option('page_on_front'),
                'page_for_posts' => get_option('page_for_posts')
            ], 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/**
 * 2D) /wp-json/my-plugin/v1/posts
 *     Returns all published blog posts
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/posts', [
        'methods'  => 'GET',
        'callback' => function() {
            $posts = get_posts([
                'post_type'   => 'post',
                'post_status' => 'publish',
                'numberposts' => -1
            ]);

            $formatted_posts = [];
            foreach ($posts as $p) {
                $formatted_posts[] = [
                    'id'      => $p->ID,
                    'title'   => $p->post_title,
                    'content' => wp_strip_all_tags($p->post_content),
                    'link'    => get_permalink($p->ID),
                ];
            }

            return new WP_REST_Response($formatted_posts, 200);
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
                    'content' => wp_strip_all_tags($post->post_content),
                    'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
                    'slug' => $post->post_name,
                    'link' => get_permalink($post->ID)
                ];
            }

            // Get Pages
            $pages = get_pages(['post_status' => 'publish']);
            foreach ($pages as $page) {
                $response['pages'][] = [
                    'id' => $page->ID,
                    'title' => $page->post_title,
                    'content' => wp_strip_all_tags($page->post_content),
                    'slug' => $page->post_name,
                    'link' => get_permalink($page->ID)
                ];
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
   4. ENQUEUE ASSETS (script.js & style.css)
------------------------------------------------------------------------ */
function my_first_plugin_enqueue_scripts() {
    // Make sure 'assets/script.js' actually exists in your plugin folder
    wp_enqueue_style('my-first-plugin-style', plugin_dir_url(__FILE__) . 'assets/style.css', [], '1.1');
    wp_enqueue_script('recordrtc', 'https://www.WebRTC-Experiment.com/RecordRTC.js', [], '1.0.0', true);
    wp_enqueue_script(
        'my-first-plugin-script',
        plugin_dir_url(__FILE__) . 'assets/script.js',
        ['recordrtc'],
        '1.1',
        true
    );
}
add_action('wp_enqueue_scripts', 'my_first_plugin_enqueue_scripts');

/* ------------------------------------------------------------------------
   5. ADD FRONT-END INTERFACES TO <body>
------------------------------------------------------------------------ */
function my_first_plugin_add_toggle_button() {
    echo '
    <div id="voice-toggle-container">
        <button id="chat-website-button">Chat with Website</button>
    </div>

    <div id="interaction-chooser">
        <div class="interaction-option voice">
            <img src="' . plugin_dir_url(__FILE__) . 'assets/mic-icon.png" alt="Voice">
            <span>Talk to Website</span>
        </div>
        <div class="interaction-option text">
            <img src="' . plugin_dir_url(__FILE__) . 'assets/keyboard.png" alt="Text">
            <span>Type to Website</span>
        </div>
    </div>

    <!-- Voice Interface -->
    <div id="voice-interface" class="interface-panel">
        <div class="interface-content">
            <button id="close-voice">×</button>
            <div class="voice-status-container">
                <div class="recording-waves">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <div class="ai-speaking-indicator">AI is speaking...</div>
            </div>
            <button id="mic-button" title="Click to start/stop recording">
                <img src="' . plugin_dir_url(__FILE__) . 'assets/mic-icon.png" alt="Microphone">
                <span>Start</span>
            </button>
            <div id="transcript-container">
                <div class="transcript-line">
                    <strong>User:</strong> <span class="transcript-text"></span>
                </div>
                <div class="transcript-line ai-response">
                    <strong>AI:</strong> <span></span>
                </div>
            </div>
        </div>
    </div>

    <!-- Text Interface -->
    <div id="text-interface" class="interface-panel">
        <div class="interface-content">
            <button id="close-text">×</button>
            <div class="chat-container">
                <div id="chat-messages"></div>
                <div class="chat-input-container">
                    <input type="text" id="chat-input" placeholder="Type your message...">
                    <button id="send-message">Send</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Hidden Popup (Content Collection) -->
    <div id="voice-popup">
      <div class="voice-popup-content">
      </div>
    </div>
    ';
}
add_action('wp_body_open', 'my_first_plugin_add_toggle_button');

// Add this near the top of the file after the header
function ai_website_get_access_key() {
    return get_option('ai_website_access_key', '');
}

// Add this to make the access key and API URL available to frontend scripts
function ai_website_enqueue_scripts() {
    wp_enqueue_script('recordrtc', 'https://www.WebRTC-Experiment.com/RecordRTC.js', [], '1.0.0', true);
    wp_enqueue_script(
        'ai-website-script',
        plugin_dir_url(__FILE__) . 'assets/script.js',
        ['jquery', 'recordrtc'],
        '1.1',
        true
    );

    // Pass data to the frontend script
    wp_localize_script('ai-website-script', 'aiWebsiteData', [
        'apiUrl' => AI_WEBSITE_API_URL,
        'accessKey' => ai_website_get_access_key(),
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('ai_website_frontend_nonce')
    ]);

    wp_enqueue_style('ai-website-style', plugin_dir_url(__FILE__) . 'assets/style.css', [], '1.1');
}
add_action('wp_enqueue_scripts', 'ai_website_enqueue_scripts');

// Add AJAX handler for frontend access
add_action('wp_ajax_nopriv_ai_website_get_info', 'ai_website_frontend_get_info');
add_action('wp_ajax_ai_website_get_info', 'ai_website_frontend_get_info');

function ai_website_frontend_get_info() {
    // Verify nonce for both logged-in and non-logged-in users
    check_ajax_referer('ai_website_frontend_nonce', 'nonce');
    
    $access_key = ai_website_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'Website not configured']);
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
        wp_send_json_error([
            'message' => 'Connection failed',
            'error' => $response->get_error_message()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        wp_send_json_error([
            'message' => 'API error',
            'code' => $response_code,
            'response' => $body
        ]);
    }

    $data = json_decode($body, true);
    wp_send_json_success($data);
}
