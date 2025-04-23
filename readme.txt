=== Voicero.AI ===
Contributors: voiceroai
Tags: ai, chatbot, assistant, ecommerce, conversion
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Voicero AI is a smart AI chat plugin that turns visitors into customers by answering questions and guiding them to buy.


== Description ==
Voicero.AI connects your site to a fully autonomous AI Salesman. It answers customer questions, builds trust, handles objections, and guides users to purchase, all automatically. Boost conversions and make your site feel alive.


== Installation ==
1. Upload the plugin files to the `/wp-content/plugins/voiceroai` directory, or install it directly through the WordPress plugin repository.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Open the **Voicero.AI** admin menu in the dashboard.
4. Connect your account using your 64-character access key or by clicking the one-click connect button.
5. Start the syncing process by clicking the Sync Now button at the bottom.
6. Click the activate button once the training of your AI is finished.

== Frequently Asked Questions ==

= Do I need a Voicero.AI account? =
Yes. You must sign up at voicero.ai to receive your access key and manage your AI assistant. The account starts free and will auto connect you with one button click.

= Will this affect my site's performance? =
No. Voicero.AI is fully asynchronous and optimized to avoid blocking your frontend or admin experience.

= Does this work with WooCommerce? =
Yes. Voicero.AI supports syncing and training on your products, including reviews, categories, and tags.

= Can I customize how the assistant talks? =
Yes. Customization is handled in your Voicero.AI dashboard after connection.

== Screenshots ==
1. AI Salesman widget active on a live website, engaging a visitor.
2. WordPress admin panel interface showing sync and training options.

== Changelog ==
= 1.0 =
* Initial public release.
* Connects your WordPress site to Voicero.AI via a secure access key.
* Enables content syncing, vectorization, and AI training.
* Supports WooCommerce, posts, pages, products, and custom metadata.
* Includes REST API endpoints for advanced integrations.

== Upgrade Notice ==
= 1.0 =
This is the first public version of Voicero.AI — connect, sync, and start boosting your conversions today.

=== Voicero.AI ===
Contributors: voiceroai
Tags: ai, chatbot, assistant, ecommerce, sales, conversion, automation
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

== Description ==
Voicero.AI connects your site to a fully autonomous AI Salesman. It answers customer questions, builds trust, handles objections, and guides users to purchase, all automatically. Boost conversions and make your site feel alive.

== Installation ==
1. Upload the plugin files to the `/wp-content/plugins/voiceroai` directory, or install it directly through the WordPress plugin repository.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Open the **Voicero.AI** admin menu in the dashboard.
4. Connect your account using your 64-character access key or by clicking the one-click connect button.
5. Start the syncing process by clicking the Sync Now button at the bottom.
6. Click the activate button once the training of your AI is finished.

== Frequently Asked Questions ==

= Do I need a Voicero.AI account? =
Yes. You must sign up at voicero.ai to receive your access key and manage your AI assistant. The account starts free and will auto connect you with one button click.

= Will this affect my site's performance? =
No. Voicero.AI is fully asynchronous and optimized to avoid blocking your frontend or admin experience.

= Does this work with WooCommerce? =
Yes. Voicero.AI supports syncing and training on your products, including reviews, categories, and tags.

= Can I customize how the assistant talks? =
Yes. Customization is handled in your Voicero.AI dashboard after connection.

== Screenshots ==
1. AI Salesman widget active on a live website, engaging a visitor.
2. WordPress admin panel interface showing sync and training options.

== Changelog ==
= 1.0 =
* Initial public release.
* Connects your WordPress site to Voicero.AI via a secure access key.
* Enables content syncing, vectorization, and AI training.
* Supports WooCommerce, posts, pages, products, and custom metadata.
* Includes REST API endpoints for advanced integrations.

== Upgrade Notice ==
= 1.0 =
This is the first public version of Voicero.AI — connect, sync, and start boosting your conversions today.

== Assets Source ==

The JavaScript and CSS shipped in `assets/` are already in human-readable form.
You can inspect every line here:

https://github.com/Voicero-ai/Wordpress-Plugin

There is no additional build step—what you see in that repo under `assets/`  
is exactly what runs on the site.

== External Services ==

This plugin relies on the Voicero.ai external API to power all of its AI features:

1. **Site Connection & Status**  
   - **Endpoint:**  
     - `https://www.voicero.ai/api/connect` — validate and retrieve your website record.  
     - `https://www.voicero.ai/api/toggle-status` — activate or deactivate your site’s chat assistant.  
   - **Data Sent:** your Voicero access key, and on toggle-status calls your `websiteId`.  
   - **When:**  
     - On admin “Save & Connect” to link the plugin to your Voicero account.  
     - On admin “Activate/Deactivate” button clicks in the dashboard.

2. **Content Sync & Training**  
   - **Endpoints:**  
     - `https://www.voicero.ai/api/wordpress/sync` — send your site’s content payload (posts, pages, products, metadata) for indexing.  
     - `https://www.voicero.ai/api/wordpress/vectorize` — request vector embeddings for that content.  
     - `https://www.voicero.ai/api/wordpress/assistant` — set up your AI assistant after content is vectorized.  
     - `https://www.voicero.ai/api/wordpress/train/page`  
     - `https://www.voicero.ai/api/wordpress/train/post`  
     - `https://www.voicero.ai/api/wordpress/train/product`  
       (each `/train/...` sends a single content item’s `wpId` plus `websiteId` to train on that entity)  
   - **Data Sent:**  
     - **Sync:** your entire site content (title, body, excerpts, taxonomy, custom fields).  
     - **Vectorize & Assistant:** no additional data beyond your `websiteId`.  
     - **Train:** individual content IDs (`wpId`) and `websiteId`.  
   - **When:** whenever you click **Sync Content Now** in the WP admin.

3. **Front-end Chat & Speech**  
   - **Endpoints:**  
     - `https://www.voicero.ai/api/wordpress/chat` — send visitor messages plus `pageData` (URL, full text, buttons, forms, images) to generate responses.  
     - `https://www.voicero.ai/api/whisper` — send an uploaded audio file for speech-to-text transcription.  
     - `https://www.voicero.ai/api/tts` — sends answer response from chat to turn into a voice response   
   - **Data Sent:**  
     - Chat: user’s text message and contextual page data.  
     - Whisper: raw audio blob recorded by the visitor.  
   - **When:**  
     - Chat calls fire whenever a visitor submits a message in the on-site chat widget.  
     - Whisper calls fire whenever a visitor records and submits voice input.

4. **Service Provider**  
   - **Name:** Voicero.ai  
   - **Terms of Service:** https://www.voicero.ai/terms  
   - **Privacy Policy:**  https://www.voicero.ai/privacy

