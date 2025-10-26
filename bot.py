import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ConversationHandler,
    ContextTypes,
    filters
)
from google.cloud import firestore
from datetime import datetime, timedelta
import os
from google.oauth2 import service_account
from telegram.error import BadRequest
from telegram import InputMediaPhoto
import json

# HARDCODED CONFIGURATION
BOT_TOKEN = "8180934284:AAGLOcl-Cfi4r6uoegVkLYV9TG4xRAUkYzs"
ADMIN_TELEGRAM_ID = 6022728957  # Replace with your Telegram ID


# Payment Details
PAYMENT_ACCOUNT = "1507214019"
PAYMENT_BANK = "Access Bank"
PAYMENT_NAME = "David Omolaye Abubakar"

# Load credentials from Railway environment variable
credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

if not credentials_json:
    raise Exception("GOOGLE_APPLICATION_CREDENTIALS environment variable is required")

try:
    # Parse the JSON string into a dictionary
    credentials_dict = json.loads(credentials_json)
    
    # Create credentials from the dictionary
    credentials = service_account.Credentials.from_service_account_info(credentials_dict)
    
    # Initialize Firestore client with explicit project ID
    db = firestore.Client(
        credentials=credentials,
        project=credentials_dict.get('project_id')
    )
    
    print("✅ Firestore connected successfully")
    
except json.JSONDecodeError as e:
    raise Exception(f"Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS: {e}")
except Exception as e:
    raise Exception(f"Failed to initialize Firestore: {e}")

# Conversation states
COLLECT_NAME, COLLECT_EMAIL, COLLECT_HALL, COLLECT_PHONE = range(4)
ADMIN_ADD_NAME, ADMIN_ADD_CATEGORY, ADMIN_ADD_PRICE, ADMIN_ADD_DESC, ADMIN_ADD_IMAGE = range(5, 10)
TRACK_ORDER_INPUT = 10

# Categories
CATEGORIES = ["Ring Sets" "Perfumes" "Chunky Bracelets", "Rings", "Bracelets", "Floral Clips", "Necklaces", "Bags"]

# Logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)


# Helper Functions
def get_user_ref(user_id):
    return db.collection('bloomlyn_users').document(str(user_id))


def get_user_cart(user_id):
    user_doc = get_user_ref(user_id).get()
    if user_doc.exists:
        return user_doc.to_dict().get('cart', [])
    return []


def add_to_cart(user_id, product):
    user_ref = get_user_ref(user_id)
    cart = get_user_cart(user_id)
    cart.append(product)
    user_ref.set({'cart': cart}, merge=True)


def clear_cart(user_id):
    user_ref = get_user_ref(user_id)
    user_ref.set({'cart': []}, merge=True)


def get_products_by_category(category):
    products_ref = db.collection('bloomlyn_products').where('category', '==', category).stream()
    return [{'id': doc.id, **doc.to_dict()} for doc in products_ref]


def get_product_by_id(product_id):
    product_doc = db.collection('bloomlyn_products').document(product_id).get()
    if product_doc.exists:
        return {'id': product_doc.id, **product_doc.to_dict()}
    return None


def create_order(user_id, cart, delivery_details):
    order_ref = db.collection('bloomlyn_orders').document()
    
    # Calculate total correctly using quantity
    total = 0
    for item in cart:
        quantity = item.get('quantity', 1)
        price = item['price']
        item_total = item.get('item_total', price * quantity)
        total += item_total
    
    order_data = {
        'user_id': str(user_id),
        'items': cart,
        'total': total,
        'status': 'pending_confirmation',
        'delivery_details': delivery_details,
        'timestamp': datetime.now(),
        'confirmed_at': None
    }
    
    order_ref.set(order_data)
    return order_ref.id, order_data


def get_order_by_id(order_id):
    order_doc = db.collection('bloomlyn_orders').document(order_id).get()
    if order_doc.exists:
        return {'id': order_doc.id, **order_doc.to_dict()}
    return None


def get_orders_by_phone(phone):
    orders_ref = db.collection('bloomlyn_orders').where('delivery_details.phone', '==', phone).stream()
    return [{'id': doc.id, **doc.to_dict()} for doc in orders_ref]


def calculate_delivery_estimate(confirmed_at):
    if not confirmed_at:
        return "Pending confirmation"
    
    # Convert Firestore timestamp to datetime if needed
    if hasattr(confirmed_at, 'timestamp'):
        confirmed_at = confirmed_at.replace(tzinfo=None)
    
    # Calculate 48 hours from confirmation
    delivery_time = confirmed_at + timedelta(hours=48)
    now = datetime.now()
    
    if now < delivery_time:
        hours_left = int((delivery_time - now).total_seconds() / 3600)
        if hours_left > 24:
            days_left = hours_left // 24
            remaining_hours = hours_left % 24
            return f"Arrives in {days_left} day(s) and {remaining_hours} hour(s)"
        else:
            return f"Arrives in {hours_left} hour(s)"
    else:
        return "Should have arrived"
    

async def no_operation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()  # Just acknowledge the click without doing anything


# START COMMAND 
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user_ref = get_user_ref(user_id)
    
    # Initialize user if not exists
    if not user_ref.get().exists:
        user_ref.set({
            'user_id': str(user_id),
            'cart': [],
            'created_at': datetime.now()
        })
    
    keyboard = [
        [InlineKeyboardButton("Browse Collections", callback_data="browse")],
        [InlineKeyboardButton("My Orders", callback_data="my_orders")],
        [InlineKeyboardButton("🌸 About Bloomlyn", callback_data="about")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    message = (
        "Hey gorgeous🌸\n\n"
        "Welcome to Bloomlyn, your destination for feminine elegance.\n"
        "Tap below to explore our collections"
    )
    
    # Handle both message commands and callback queries with proper error handling
    if update.message:
        # Command from user typing /start
        await update.message.reply_text(message, reply_markup=reply_markup)
    elif update.callback_query:
        # Callback from button click
        query = update.callback_query
        await query.answer()
        
        try:
            # Try to edit the existing message
            await query.edit_message_text(message, reply_markup=reply_markup)
        except BadRequest as e:
            if "no text in the message" in str(e):
                # If editing fails because it's a photo message, delete and send new message
                try:
                    await query.message.delete()
                except Exception as delete_error:
                    logger.warning(f"Could not delete message: {delete_error}")
                await context.bot.send_message(
                    chat_id=update.effective_chat.id,
                    text=message,
                    reply_markup=reply_markup
                )
            else:
                # Re-raise other errors
                raise e
            

async def show_single_product(update: Update, context: ContextTypes.DEFAULT_TYPE, product):
    user_id = update.effective_user.id
    cart = get_user_cart(user_id)
    
    message = (
        f"{product['name']}\n"
        f"₦{product['price']:,}\n\n"
        f"{product.get('description', 'A beautiful piece for you')}"
    )
    
    keyboard = [
        [InlineKeyboardButton("Add to Cart", callback_data=f"add_cart_{product['id']}")],
    ]
    
    # Add cart and browse buttons
    action_buttons = []
    if cart:
        action_buttons.append(InlineKeyboardButton(f"View Cart ({len(cart)})", callback_data="view_cart"))
    action_buttons.append(InlineKeyboardButton("View More", callback_data="browse"))
    keyboard.append(action_buttons)
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Send product image if exists
    image_path = product.get('image_path', '')
    if image_path and os.path.exists(image_path):
        try:
            with open(image_path, 'rb') as photo:
                await update.message.reply_photo(photo=photo, caption=message, reply_markup=reply_markup)
        except Exception as e:
            logger.error(f"Error sending image: {e}")
            await update.message.reply_text(message, reply_markup=reply_markup)
    else:
        await update.message.reply_text(message, reply_markup=reply_markup)



# BROWSE PRODUCTS
async def browse_products(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    # Create 2-column grid for categories
    keyboard = []
    row = []
    for i, cat in enumerate(CATEGORIES):
        row.append(InlineKeyboardButton(cat, callback_data=f"category_{cat}"))
        # Create new row every 2 buttons
        if (i + 1) % 2 == 0:
            keyboard.append(row)
            row = []
    # Add any remaining buttons
    if row:
        keyboard.append(row)
    
    keyboard.append([InlineKeyboardButton("🔙 Back to Menu", callback_data="start")])
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    try:
        await query.edit_message_text("Here's our available products", reply_markup=reply_markup)
    except BadRequest as e:
        if "no text in the message" in str(e):
            # If editing fails because it's a photo message, delete and send new message
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="Here's our available products",
                reply_markup=reply_markup
            )
        else:
            raise e
        


# START CALLBACK (from "Back to Menu" button)
async def start_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    user_ref = get_user_ref(user_id)
    
    # Initialize user if not exists
    if not user_ref.get().exists:
        user_ref.set({
            'user_id': str(user_id),
            'cart': [],
            'created_at': datetime.now()
        })
    
    keyboard = [
        [InlineKeyboardButton("Browse Collections", callback_data="browse")],
        [InlineKeyboardButton("My Orders", callback_data="my_orders")],
        [InlineKeyboardButton("🌸 About Bloomlyn", callback_data="about")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    message = (
        "Hey gorgeous!\n\n"
        "Welcome to Bloomlyn, your destination for feminine elegance.\n"
        "Tap below to explore our collections"
    )
    
    try:
        await query.edit_message_text(message, reply_markup=reply_markup)
    except BadRequest as e:
        if "no text in the message" in str(e):
            # If editing fails because it's a photo message, delete and send new message
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=message,
                reply_markup=reply_markup
            )
        else:
            raise e

# VIEW CATEGORY
async def navigate_products(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    direction = query.data.replace("nav_", "")
    current_index = context.user_data.get('product_index', 0)
    
    if direction == "next":
        context.user_data['product_index'] = current_index + 1
    elif direction == "prev":
        context.user_data['product_index'] = current_index - 1
    
    await show_product(update, context)

# VIEW CATEGORY
async def view_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    category = query.data.replace("category_", "")
    
    # Show loading message that replaces current content
    loading_message = f"⏳ Loading {category}..."
    try:
        await query.edit_message_text(loading_message)
    except BadRequest as e:
        if "no text in the message" in str(e):
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=loading_message
            )
        else:
            raise e
    
    # Fetch products (this is the slow part)
    products = get_products_by_category(category)
    
    if not products:
        keyboard = [[InlineKeyboardButton("Back", callback_data="browse")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        no_products_message = f" No {category} available right now.\nWe're restocking soon!"
        
        try:
            await context.bot.edit_message_text(
                chat_id=update.effective_chat.id,
                message_id=query.message.message_id,
                text=no_products_message,
                reply_markup=reply_markup
            )
        except Exception as e:
            logger.error(f"Error editing message: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=no_products_message,
                reply_markup=reply_markup
            )
        return
    
    # Store products in context for navigation
    context.user_data['current_category'] = category
    context.user_data['category_products'] = products
    context.user_data['product_index'] = 0
    
    # Show the first product (this will replace the loading message)
    await show_product(update, context)


async def show_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    
    products = context.user_data.get('category_products', [])
    index = context.user_data.get('product_index', 0)
    
    if not products or index >= len(products):
        try:
            if query:
                await query.edit_message_text("No products to display")
            else:
                await update.message.reply_text("No products to display")
        except BadRequest as e:
            if "no text in the message" in str(e) and query:
                try:
                    await query.message.delete()
                except Exception as delete_error:
                    logger.warning(f"Could not delete message: {delete_error}")
                await context.bot.send_message(
                    chat_id=update.effective_chat.id,
                    text="No products to display"
                )
        return
    
    product = products[index]
    quantity = context.user_data.get(f'quantity_{product["id"]}', 1)
    item_total = product['price'] * quantity
    
    message = (
        f"{product['name']}\n"
        f"₦{product['price']:,}\n\n"
        f"{product.get('description', 'A beautiful piece for you')}\n\n"
        f"Quantity: {quantity}\n"
        f"Total: ₦{item_total:,}"
    )
    
    keyboard = [
        [
            InlineKeyboardButton("➖", callback_data=f"qty_decrease_{product['id']}"),
            InlineKeyboardButton(f"{quantity}", callback_data="no_op"),
            InlineKeyboardButton("➕", callback_data=f"qty_increase_{product['id']}")
        ],
        [InlineKeyboardButton("🛒 Add to Cart", callback_data=f"add_cart_{product['id']}")],
    ]
    
    nav_buttons = []
    if index > 0:
        nav_buttons.append(InlineKeyboardButton("⬅️ Previous", callback_data="nav_prev"))
    nav_buttons.append(InlineKeyboardButton(f"{index + 1}/{len(products)}", callback_data="no_op"))
    if index < len(products) - 1:
        nav_buttons.append(InlineKeyboardButton("Next ➡️", callback_data="nav_next"))
    
    if nav_buttons:
        keyboard.append(nav_buttons)
    
    keyboard.append([
        InlineKeyboardButton("Collections", callback_data="browse"),
        InlineKeyboardButton("View Cart", callback_data="view_cart")
    ])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    previous_product_id = context.user_data.get('current_product_id')
    is_same_product = (previous_product_id == product['id'])
    context.user_data['current_product_id'] = product['id']
    
    image_path = product.get('image_path', '')
    file_id = product.get('telegram_file_id', '')  # Check if we have cached file_id
    has_valid_image = (file_id or (image_path and os.path.exists(image_path)))
    
    if query:
        if is_same_product:
            if query.message.photo:
                try:
                    await query.edit_message_caption(
                        caption=message,
                        reply_markup=reply_markup
                    )
                    return
                except BadRequest as e:
                    logger.error(f"Error editing caption: {e}")
            else:
                try:
                    await query.edit_message_text(message, reply_markup=reply_markup)
                    return
                except BadRequest as e:
                    logger.error(f"Error editing text: {e}")
        
        # Different product - try edit_message_media with file_id first (FAST!)
        if file_id:
            try:
                media = InputMediaPhoto(media=file_id, caption=message)
                await query.edit_message_media(
                    media=media,
                    reply_markup=reply_markup
                )
                return  # Success! No timeout because we used file_id
            except Exception as e:
                logger.error(f"Error editing media with file_id: {e}")
                # Fall through to delete+send
        
        # Fallback: delete and send new
        if has_valid_image:
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
            
            try:
                # Use file_id if available, otherwise read from disk
                if file_id:
                    sent_message = await context.bot.send_photo(
                        chat_id=update.effective_chat.id,
                        photo=file_id,
                        caption=message,
                        reply_markup=reply_markup
                    )
                else:
                    with open(image_path, 'rb') as photo:
                        sent_message = await context.bot.send_photo(
                            chat_id=update.effective_chat.id,
                            photo=photo,
                            caption=message,
                            reply_markup=reply_markup
                        )
                    
                    # Cache the file_id for next time (IMPORTANT!)
                    if sent_message.photo:
                        new_file_id = sent_message.photo[-1].file_id
                        # Update Firestore with the file_id
                        db.collection('bloomlyn_products').document(product['id']).update({
                            'telegram_file_id': new_file_id
                        })
                        # Update local cache
                        product['telegram_file_id'] = new_file_id
                        
            except Exception as e:
                logger.error(f"Error sending photo: {e}")
                await context.bot.send_message(
                    chat_id=update.effective_chat.id,
                    text=message,
                    reply_markup=reply_markup
                )
        else:
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
            
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=message,
                reply_markup=reply_markup
            )
    else:
        # Initial message
        if has_valid_image:
            try:
                if file_id:
                    await update.message.reply_photo(
                        photo=file_id,
                        caption=message,
                        reply_markup=reply_markup
                    )
                else:
                    with open(image_path, 'rb') as photo:
                        sent_message = await update.message.reply_photo(
                            photo=photo,
                            caption=message,
                            reply_markup=reply_markup
                        )
                    
                    # Cache the file_id
                    if sent_message.photo:
                        new_file_id = sent_message.photo[-1].file_id
                        db.collection('bloomlyn_products').document(product['id']).update({
                            'telegram_file_id': new_file_id
                        })
                        product['telegram_file_id'] = new_file_id
                        
            except Exception as e:
                logger.error(f"Error sending photo: {e}")
                await update.message.reply_text(message, reply_markup=reply_markup)
        else:
            await update.message.reply_text(message, reply_markup=reply_markup)
                


# QUANTITY CONTROLS
async def quantity_increase(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    product_id = query.data.replace("qty_increase_", "")
    
    # Get current quantity (default to 1)
    current_qty = context.user_data.get(f'quantity_{product_id}', 1)
    
    # Increase quantity (max 10 for safety)
    if current_qty < 10:
        context.user_data[f'quantity_{product_id}'] = current_qty + 1
    
    # Refresh the product display
    await show_product(update, context)


async def quantity_decrease(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    product_id = query.data.replace("qty_decrease_", "")
    
    # Get current quantity (default to 1)
    current_qty = context.user_data.get(f'quantity_{product_id}', 1)
    
    # Decrease quantity (min 1)
    if current_qty > 1:
        context.user_data[f'quantity_{product_id}'] = current_qty - 1
    
    # Refresh the product display
    await show_product(update, context)





# ADD TO CART (with quantity support)
async def add_to_cart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    product_id = query.data.replace("add_cart_", "")
    product = get_product_by_id(product_id)
    
    if not product:
        await query.answer("Product not found", show_alert=True)
        return
    
    user_id = update.effective_user.id
    
    # Get quantity for this product (default to 1)
    quantity = context.user_data.get(f'quantity_{product_id}', 1)
    
    # Add product with quantity information
    product_with_qty = {
        **product,
        'quantity': quantity,
        'item_total': product['price'] * quantity
    }
    
    add_to_cart(user_id, product_with_qty)
    
    # Reset quantity for this product
    context.user_data[f'quantity_{product_id}'] = 1
    
    cart = get_user_cart(user_id)
    
    keyboard = [
        [InlineKeyboardButton("🛒 View Cart", callback_data="view_cart")],
        [InlineKeyboardButton("🛍️ Continue Shopping", callback_data="browse")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    message = (
        f"✅ {quantity}x {product['name']} added to your cart!\n\n"
        f"You currently have {len(cart)} item(s) in your cart."
    )
    
    try:
        # Try to edit the message first (works for text messages)
        await query.edit_message_text(message, reply_markup=reply_markup)
    except BadRequest as e:
        if "no text in the message" in str(e):
            # If editing fails because it's a photo message, delete and send new message
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
                # Continue anyway - we'll send the new message
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=message,
                reply_markup=reply_markup
            )
        else:
            # Re-raise other BadRequest errors
            raise e
        



# VIEW CART
async def view_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    cart = get_user_cart(user_id)
    
    if not cart:
        keyboard = [[InlineKeyboardButton("🛍️ Browse Products", callback_data="browse")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        message = "Your cart is empty"
        
        try:
            await query.edit_message_text(message, reply_markup=reply_markup)
        except BadRequest as e:
            if "no text in the message" in str(e):
                try:
                    await query.message.delete()
                except Exception as delete_error:
                    logger.warning(f"Could not delete message: {delete_error}")
                await context.bot.send_message(
                    chat_id=update.effective_chat.id,
                    text=message,
                    reply_markup=reply_markup
                )
            else:
                raise e
        return
    
    message = "🛒 Your Bloomlyn Cart\n\n"
    total = 0
    
    for i, item in enumerate(cart, 1):
        quantity = item.get('quantity', 1)
        price = item['price']
        item_total = item.get('item_total', price * quantity)
        
        message += f"{i}. {item['name']}\n"
        message += f"   ₦{price:,} × {quantity} = ₦{item_total:,}\n\n"
        total += item_total
    
    message += f"Subtotal: ₦{total:,}\n"
    message += "Delivery: FREE\n"
    message += f"Total: ₦{total:,}"
    
    # Action buttons in grid
    keyboard = [
        [InlineKeyboardButton("✅ Checkout", callback_data="checkout")],
        [
            InlineKeyboardButton("🗑️ Clear Cart", callback_data="clear_cart"),
            InlineKeyboardButton("🛍️ Continue Shopping", callback_data="browse")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    try:
        await query.edit_message_text(message, reply_markup=reply_markup)
    except BadRequest as e:
        if "no text in the message" in str(e):
            # If editing fails because it's a photo message, delete and send new message
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=message,
                reply_markup=reply_markup
            )
        else:
            raise e



# CLEAR CART
async def clear_cart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    clear_cart(user_id)
    
    keyboard = [[InlineKeyboardButton("Browse Products", callback_data="browse")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text("Your cart has been cleared", reply_markup=reply_markup)


# CHECKOUT FLOW
async def checkout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    cart = get_user_cart(user_id)
    
    if not cart:
        await query.edit_message_text("Your cart is empty")
        return
    
    context.user_data['checkout_cart'] = cart
    
    await query.edit_message_text(
        "Almost done!\n\n"
        "Please share your delivery details\n\n"
        "First, what's your full name?"
    )
    
    return COLLECT_NAME


async def collect_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['delivery_name'] = update.message.text
    await update.message.reply_text("Great! Now, what's your telegram phone number?")
    return COLLECT_EMAIL


async def collect_email(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['delivery_email'] = update.message.text
    await update.message.reply_text("Perfect! Which hall of residence are you in?")
    return COLLECT_HALL


async def collect_hall(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['delivery_hall'] = update.message.text
    await update.message.reply_text("Last one! What's your room number?")
    return COLLECT_PHONE


async def collect_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['delivery_phone'] = update.message.text
    
    # Get cart and calculate total
    user_id = update.effective_user.id
    cart = context.user_data.get('checkout_cart', [])
    total = 0
    
    # Build order summary message
    order_summary = "📦 YOUR ORDER SUMMARY\n\n"
    for i, item in enumerate(cart, 1):
        quantity = item.get('quantity', 1)
        price = item['price']
        item_total = item.get('item_total', price * quantity)
        
        order_summary += f"{i}. {item['name']}\n"
        order_summary += f"   ₦{price:,} × {quantity} = ₦{item_total:,}\n\n"
        total += item_total
    
    order_summary += f"Subtotal: ₦{total:,}\n"
    order_summary += f"Delivery: FREE\n"
    order_summary += f"Total: ₦{total:,}\n"
    
    # Create order
    delivery_details = {
        'name': context.user_data.get('delivery_name', ''),
        'email': context.user_data.get('delivery_email', ''),
        'hall': context.user_data.get('delivery_hall', ''),
        'phone': context.user_data.get('delivery_phone', '')
    }
    
    order_id, order_data = create_order(user_id, cart, delivery_details)
    
    # Store order_id in context for later use
    context.user_data['current_order_id'] = order_id
    
    order_summary += f"\nOrder ID: {order_id}"
    
    # Payment instructions
    payment_instructions = (
        "\n\n💳 PAYMENT DETAILS\n"
        f"Account Number: {PAYMENT_ACCOUNT}\n"
        f"Bank: {PAYMENT_BANK}\n"
        f"Account Name: {PAYMENT_NAME}\n\n"
        "📝 Use the Order ID as transfer reference when transferring."
        "\nAfter making the payment, click the button below."
    )
    
    full_message = order_summary + payment_instructions
    
    keyboard = [[InlineKeyboardButton("✅ Payment Done", callback_data="payment_done")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(full_message, reply_markup=reply_markup)
    return ConversationHandler.END


# PAYMENT CONFIRMATION
async def payment_done(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    cart = context.user_data.get('checkout_cart', [])
    order_id = context.user_data.get('current_order_id', '')
    
    if not order_id:
        # If order_id wasn't stored, create order now
        delivery_details = {
            'name': context.user_data.get('delivery_name', ''),
            'email': context.user_data.get('delivery_email', ''),
            'hall': context.user_data.get('delivery_hall', ''),
            'phone': context.user_data.get('delivery_phone', '')
        }
        order_id, order_data = create_order(user_id, cart, delivery_details)
    
    # Build order summary for customer confirmation
    total = 0
    
    order_summary = "✅ ORDER PLACED SUCCESSFULLY!\n\n"
    order_summary += "Your Order:\n"
    for i, item in enumerate(cart, 1):
        quantity = item.get('quantity', 1)
        price = item['price']
        item_total = item.get('item_total', price * quantity)
        
        order_summary += f"{i}. {item['name']}\n"
        order_summary += f"   ₦{price:,} × {quantity} = ₦{item_total:,}\n\n"
        total += item_total
    
    order_summary += f"Subtotal: ₦{total:,}\n"
    order_summary += f"Delivery: FREE\n"
    order_summary += f"Total Paid: ₦{total:,}\n"
    order_summary += f"\nOrder ID: {order_id}"
    order_summary += "\n\nPlease wait as we confirm your payment and process your order, you can contact us @chat_bloomlyn for any inquiries. Thank you for shopping with Bloomlyn🌸"
    
    clear_cart(user_id)
    
    # Send confirmation to customer
    try:
        await query.edit_message_text(order_summary)
    except BadRequest as e:
        if "no text in the message" in str(e):
            try:
                await query.message.delete()
            except Exception as delete_error:
                logger.warning(f"Could not delete message: {delete_error}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=order_summary
            )
        else:
            raise e
    
    # Notify admin with detailed order summary
    delivery_details = {
        'name': context.user_data.get('delivery_name', ''),
        'email': context.user_data.get('delivery_email', ''),
        'hall': context.user_data.get('delivery_hall', ''),
        'phone': context.user_data.get('delivery_phone', '')
    }
    
    admin_message = (
        "🔔 NEW ORDER RECEIVED\n\n"
        f"Order ID: {order_id}\n"
        f"Customer: {delivery_details['name']}\n"
        f"Phone: {delivery_details['phone']}\n"
        f"Hall: {delivery_details['hall']}\n"
        f"Email: {delivery_details['email']}\n\n"
        "📦 Order Items:\n"
    )
    
    for item in cart:
        quantity = item.get('quantity', 1)
        price = item['price']
        item_total = item.get('item_total', price * quantity)
        admin_message += f"• {item['name']}\n"
        admin_message += f"  ₦{price:,} × {quantity} = ₦{item_total:,}\n\n"
    
    admin_message += f"💰 Total: ₦{total:,}\n"
    admin_message += f"\nOrder ID: {order_id}"
    
    keyboard = [[InlineKeyboardButton("✅ Confirm Order", callback_data=f"confirm_order_{order_id}")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    try:
        await context.bot.send_message(
            chat_id=ADMIN_TELEGRAM_ID,
            text=admin_message,
            reply_markup=reply_markup
        )
    except Exception as e:
        logger.error(f"Failed to notify admin: {e}")


# CONFIRM ORDER (ADMIN)
async def confirm_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    order_id = query.data.replace("confirm_order_", "")
    order_ref = db.collection('bloomlyn_orders').document(order_id)
    
    order_ref.update({
        'status': 'confirmed',
        'confirmed_at': datetime.now()
    })
    
    order = get_order_by_id(order_id)
    user_id = order['user_id']
    
    await query.edit_message_text(f"✅ Order {order_id} has been confirmed")
    
    # Calculate total
    total = 0
    
    # Build detailed order confirmation for customer
    order_summary = (
        "🎉 YOUR ORDER HAS BEEN CONFIRMED!\n\n"
        f"Order ID: {order_id}\n\n"
        "Your Order:\n"
    )
    
    for i, item in enumerate(order['items'], 1):
        quantity = item.get('quantity', 1)
        price = item['price']
        item_total = item.get('item_total', price * quantity)
        
        order_summary += f"{i}. {item['name']}\n"
        order_summary += f"   ₦{price:,} × {quantity} = ₦{item_total:,}\n\n"
        total += item_total
    
    order_summary += f"- Total Paid: ₦{total:,}\n"
    order_summary += "\nYour order will be delivered to you within 24 - 48 hours."
    order_summary += "\n\nWe'll contact you on the phone number you provided for delivery updates."
    order_summary += "\nJoin our telegram channel @bloomlyn_store for new products updates."
    order_summary += "\n\nThank you for shopping with Bloomlyn🌸"
    
    # Notify customer with order summary
    try:
        await context.bot.send_message(
            chat_id=int(user_id),
            text=order_summary
        )
    except Exception as e:
        logger.error(f"Failed to notify customer: {e}")

# MY ORDERS
async def my_orders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    orders_ref = db.collection('bloomlyn_orders').where('user_id', '==', str(user_id)).stream()
    orders = [{'id': doc.id, **doc.to_dict()} for doc in orders_ref]
    
    if not orders:
        keyboard = [[InlineKeyboardButton("🛍️ Browse Products", callback_data="browse")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text("You haven't placed any orders yet", reply_markup=reply_markup)
        return
    
    message = "📦 Your Orders\n\n"
    
    for order in orders[-5:]:  # Show last 5 orders
        status_emoji = "⏳" if order['status'] == 'pending_confirmation' else "✅"
        message += f"{status_emoji} Order {order['id'][:8]}... - ₦{order['total']:,}\n"
        message += f"Status: {order['status'].replace('_', ' ').title()}\n\n"
    
    # Two-column layout for buttons
    keyboard = [
        [
            InlineKeyboardButton("📊 Track Order", callback_data="track_order"),
            InlineKeyboardButton("🏠 Main Menu", callback_data="start")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(message, reply_markup=reply_markup)


async def track_order_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        "Please enter your Order ID or phone number to track your order.\nSend it now:"
    )
    return TRACK_ORDER_INPUT

async def track_order_process(update: Update, context: ContextTypes.DEFAULT_TYPE):
    search_term = update.message.text.strip()
    
    # Try as order ID first
    order = get_order_by_id(search_term)
    
    # If not found, try as phone number
    if not order:
        orders = get_orders_by_phone(search_term)
        if orders:
            order = orders[-1]  # Get most recent order
    
    if not order:
        keyboard = [[InlineKeyboardButton("Back to Menu", callback_data="start")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "No order found with that information",
            reply_markup=reply_markup
        )
        return ConversationHandler.END
    
    status = order['status'].replace('_', ' ').title()
    delivery_estimate = calculate_delivery_estimate(order.get('confirmed_at'))
    
    message = (
        f"Order Status: {status}\n\n"
        f"Order ID: {order['id']}\n"
        f"Total: ₦{order['total']:,}\n"
        f"Estimated Delivery: {delivery_estimate}"
    )
    
    keyboard = [[InlineKeyboardButton("Back to Menu", callback_data="start")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(message, reply_markup=reply_markup)
    return ConversationHandler.END


# ABOUT BLOOMLYN
async def about(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    message = (
    "At Bloomlyn, we believe that beauty is found in the quiet moments, "
    "in the details that complete your look.\n\n"
    "Our curated collection of earrings, bags, clips, and bracelets "
    "brings an air of refined elegance to your every day."
 )

    
    keyboard = [[InlineKeyboardButton("Back to Menu", callback_data="start")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(message, reply_markup=reply_markup)


# ADMIN PANEL
async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    
    if user_id != ADMIN_TELEGRAM_ID:
        await update.message.reply_text("Unauthorized access")
        return
    
    keyboard = [
        [InlineKeyboardButton("View Orders", callback_data="admin_orders")],
        [InlineKeyboardButton("Add Product", callback_data="admin_add_product")],
        [InlineKeyboardButton("View Products", callback_data="admin_view_products")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text("Admin Panel", reply_markup=reply_markup)


# ADMIN VIEW ORDERS
async def admin_view_orders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("All Orders", callback_data="admin_orders_all")],
        [InlineKeyboardButton("Pending", callback_data="admin_orders_pending_confirmation")],
        [InlineKeyboardButton("Confirmed", callback_data="admin_orders_confirmed")],
        [InlineKeyboardButton("Back", callback_data="admin_back")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text("Filter Orders", reply_markup=reply_markup)


async def admin_filter_orders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    status = query.data.replace("admin_orders_", "")
    
    if status == "all":
        orders_ref = db.collection('bloomlyn_orders').stream()
    else:
        orders_ref = db.collection('bloomlyn_orders').where('status', '==', status).stream()
    
    orders = [{'id': doc.id, **doc.to_dict()} for doc in orders_ref]
    
    if not orders:
        await query.edit_message_text("No orders found")
        return
    
    message = f"Orders ({status.replace('_', ' ').title()})\n\n"
    
    for order in orders[-10:]:  # Show last 10
        message += f"ID: {order['id'][:8]}...\n"
        message += f"Customer: {order['delivery_details']['name']}\n"
        message += f"Total: ₦{order['total']:,}\n"
        message += f"Status: {order['status']}\n\n"
    
    keyboard = [[InlineKeyboardButton("Back", callback_data="admin_orders")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(message, reply_markup=reply_markup)


# ADMIN ADD PRODUCT
async def admin_add_product_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    await query.edit_message_text("What's the product name?")
    return ADMIN_ADD_NAME


async def admin_add_product_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['new_product_name'] = update.message.text
    
    keyboard = [[InlineKeyboardButton(cat, callback_data=f"admin_cat_{cat}")] for cat in CATEGORIES]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text("Select a category:", reply_markup=reply_markup)
    return ADMIN_ADD_CATEGORY


async def admin_add_product_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    category = query.data.replace("admin_cat_", "")
    context.user_data['new_product_category'] = category
    
    await query.edit_message_text("What's the price? (numbers only)")
    return ADMIN_ADD_PRICE


async def admin_add_product_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        price = int(update.message.text)
        context.user_data['new_product_price'] = price
        await update.message.reply_text("Add a description:")
        return ADMIN_ADD_DESC
    except ValueError:
        await update.message.reply_text("Please enter a valid number")
        return ADMIN_ADD_PRICE


async def admin_add_product_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['new_product_desc'] = update.message.text
    await update.message.reply_text(
        "Send the product image (or type 'skip' if no image)\n\n"
        "Make sure the image is saved in your images folder first"
    )
    return ADMIN_ADD_IMAGE


async def admin_add_product_image(update: Update, context: ContextTypes.DEFAULT_TYPE):
    image_path = ""
    
    if update.message.text and update.message.text.lower() != 'skip':
        image_path = update.message.text
    
    # Create product
    product_data = {
        'name': context.user_data['new_product_name'],
        'category': context.user_data['new_product_category'],
        'price': context.user_data['new_product_price'],
        'description': context.user_data['new_product_desc'],
        'image_path': image_path,
        'created_at': datetime.now()
    }
    
    db.collection('bloomlyn_products').add(product_data)
    
    await update.message.reply_text(
        f"Product '{product_data['name']}' added successfully!"
    )
    
    return ConversationHandler.END


# ADMIN VIEW PRODUCTS
async def admin_view_products(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    products_ref = db.collection('bloomlyn_products').stream()
    products = [{'id': doc.id, **doc.to_dict()} for doc in products_ref]
    
    if not products:
        await query.edit_message_text("No products available")
        return
    
    message = "All Products\n\n"
    
    for product in products:
        message += f"{product['name']} - ₦{product['price']:,}\n"
        message += f"Category: {product['category']}\n"
        message += f"ID: {product['id']}\n\n"
    
    keyboard = [[InlineKeyboardButton("Back", callback_data="admin_back")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(message, reply_markup=reply_markup)


async def admin_back(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("View Orders", callback_data="admin_orders")],
        [InlineKeyboardButton("Add Product", callback_data="admin_add_product")],
        [InlineKeyboardButton("View Products", callback_data="admin_view_products")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text("Admin Panel", reply_markup=reply_markup)


# CANCEL HANDLER
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Operation cancelled")
    return ConversationHandler.END


# MAIN
def main():
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("admin", admin_panel))
    
    # Checkout conversation
    checkout_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(checkout, pattern="^checkout$")],
        states={
            COLLECT_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, collect_name)],
            COLLECT_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, collect_email)],
            COLLECT_HALL: [MessageHandler(filters.TEXT & ~filters.COMMAND, collect_hall)],
            COLLECT_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, collect_phone)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    
    # Track order conversation
    track_order_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(track_order_start, pattern="^track_order$")],
        states={
            TRACK_ORDER_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, track_order_process)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    
    # Admin add product conversation
    admin_add_product_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(admin_add_product_start, pattern="^admin_add_product$")],
        states={
            ADMIN_ADD_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_add_product_name)],
            ADMIN_ADD_CATEGORY: [CallbackQueryHandler(admin_add_product_category, pattern="^admin_cat_")],
            ADMIN_ADD_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_add_product_price)],
            ADMIN_ADD_DESC: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_add_product_desc)],
            ADMIN_ADD_IMAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_add_product_image)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    
    # Add all handlers
    application.add_handler(checkout_handler)
    application.add_handler(track_order_handler)
    application.add_handler(admin_add_product_handler)
    
    # Callback query handlers
    application.add_handler(CallbackQueryHandler(browse_products, pattern="^browse$"))
    application.add_handler(CallbackQueryHandler(view_category, pattern="^category_"))
    application.add_handler(CallbackQueryHandler(navigate_products, pattern="^nav_"))
    application.add_handler(CallbackQueryHandler(quantity_increase, pattern="^qty_increase_"))
    application.add_handler(CallbackQueryHandler(quantity_decrease, pattern="^qty_decrease_"))
    application.add_handler(CallbackQueryHandler(add_to_cart_callback, pattern="^add_cart_"))
    application.add_handler(CallbackQueryHandler(view_cart, pattern="^view_cart$"))
    application.add_handler(CallbackQueryHandler(clear_cart_callback, pattern="^clear_cart$"))
    application.add_handler(CallbackQueryHandler(payment_done, pattern="^payment_done$"))
    application.add_handler(CallbackQueryHandler(confirm_order, pattern="^confirm_order_"))
    application.add_handler(CallbackQueryHandler(my_orders, pattern="^my_orders$"))
    application.add_handler(CallbackQueryHandler(about, pattern="^about$"))
    application.add_handler(CallbackQueryHandler(start, pattern="^start$"))
    application.add_handler(CallbackQueryHandler(no_operation, pattern="^no_op$"))
    application.add_handler(CallbackQueryHandler(start_callback, pattern="^start$"))
    
    # Admin handlers
    application.add_handler(CallbackQueryHandler(admin_view_orders, pattern="^admin_orders$"))
    application.add_handler(CallbackQueryHandler(admin_filter_orders, pattern="^admin_orders_"))
    application.add_handler(CallbackQueryHandler(admin_view_products, pattern="^admin_view_products$"))
    application.add_handler(CallbackQueryHandler(admin_back, pattern="^admin_back$"))
    
    # Run bot
    print("Bloomlyn Bot is running...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()