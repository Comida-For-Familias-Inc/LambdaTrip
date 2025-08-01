# Stripe Migration Guide:

**Current Setup:**
- Firebase Project: `lambdatrip`
- Firebase Extension: Firestore Stripe Payments (Invertase)
- Current Price IDs: 
  - Monthly: `price_1RmJqYH5XBeQjH0rNJPXr83O`
  - Yearly: `price_1RmJtZH5XBeQjH0rTG1mI9JJ`

---

### Current Configuration to Document
- **Products**: LambdaTrip Premium (Monthly/Yearly)
- **Prices**: 
  - Monthly: $9.99/month (`price_1RmJqYH5XBeQjH0rNJPXr83O`)
  - Yearly: $99.99/year (`price_1RmJqYH5XBeQjH0rTG1mI9JJ`)
- **Webhook Endpoint**: Firebase extension webhook
- **Firebase Extension Config**: Current Stripe keys and settings

---

## Step-by-Step Migration Process

### Step 1: Prepare Organization Stripe Account

#### 1.1 Create Products in Organization Account
1. Log into the **organization's Stripe dashboard**
2. Navigate to **Products** → **Add Product**
3. Create the following products:

**Product: LambdaTrip Premium**
- Name: `LambdaTrip Premium`
- Description: `Unlimited landmark analysis and premium features`
- Tax behavior: `Exclusive`

#### 1.2 Create Prices in Organization Account
1. For the LambdaTrip Premium product, create two prices:

**Monthly Price:**
- Price: `$9.99`
- Billing: `Recurring`
- Billing period: `Monthly`
- Currency: `USD`
- **Note the new Price ID** (e.g., `price_org_monthly_123`)

**Yearly Price:**
- Price: `$99.99`
- Billing: `Recurring`
- Billing period: `Yearly`
- Currency: `USD`
- **Note the new Price ID** (e.g., `price_org_yearly_456`)

#### 1.3 Get Organization Stripe API Keys
1. Go to **Developers** → **API Keys**
2. Copy the following keys:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)
3. **Important**: Use a restricted key with these permissions:
   - ✅ Write access: Customers, Checkout Sessions, Customer Portal
   - ✅ Read access: Subscriptions, Prices
   - ❌ No access to other resources

### Step 2: Update Firebase Extension Configuration

#### 2.1 Access Firebase Extension
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your `lambdatrip` project
3. Navigate to **Extensions** → **Firestore Stripe Payments**
4. Click **Manage Extension**

#### 2.2 Update Extension Parameters
1. Click **Edit Extension**
2. Update the following parameters:

```yaml
# Stripe Configuration
stripe.secret_key: "sk_org_..." # New organization secret key
stripe.publishable_key: "pk_org_..." # New organization publishable key

# Optional: Update webhook secret (will be set in Step 3)
stripe.webhook_secret: "whsec_..." # Leave empty for now
```

3. Click **Save and Deploy**
4. Wait for the extension to redeploy (usually 2-3 minutes)

### Step 3: Configure Webhooks in Organization Account

#### 3.1 Create Webhook Endpoint
1. In the **organization's Stripe dashboard**, go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Set the endpoint URL to your Firebase webhook:
   ```
   https://us-central1-lambdatrip.cloudfunctions.net/ext-firestore-stripe-payments-webhookHandler
   ```
4. Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `customer.created`
   - ✅ `customer.updated`

#### 3.2 Get Webhook Secret
1. After creating the webhook, click on it to view details
2. Copy the **Signing secret** (starts with `whsec_`)
3. Go back to Firebase Extension configuration
4. Update `stripe.webhook_secret` with the new webhook secret
5. Save and redeploy the extension

### Step 4: Update Application Code

#### 4.1 Update Price IDs in Payment Page
1. Open `firebase-hosting/public/payment.html`
2. Update the price IDs:

```javascript
// Replace with new organization price IDs
const PRICE_ID_MONTHLY = "price_org_monthly_123"; // New monthly price ID
const PRICE_ID_YEARLY = "price_org_yearly_456";   // New yearly price ID
```

#### 4.2 Update Any Other Stripe References
1. Search your codebase for any hardcoded Stripe references
2. Update customer portal URLs if needed
3. Update any Stripe-related environment variables

### Step 5: Test the Migration

#### 5.1 Test Checkout Flow
1. Open your payment page: `https://lambdatrip.firebaseapp.com/payment`
2. Sign in with a test account
3. Try to purchase a subscription
4. Verify the checkout redirects to Stripe with new organization branding
5. Complete a test payment (use Stripe test cards)

#### 5.2 Test Subscription Management
1. Verify subscription appears in organization Stripe dashboard
2. Test customer portal access
3. Verify Firebase Authentication custom claims are set correctly
4. Test subscription cancellation and updates

#### 5.3 Test Webhook Events
1. Monitor Firebase Functions logs for webhook events
2. Verify customer and subscription data is synced to Firestore
3. Check that premium status is correctly applied in your extension


## 📞 Support Resources

### Firebase Extension Documentation
- [Firestore Stripe Payments Extension](https://extensions.dev/extensions/invertase/firestore-stripe-payments)

### Stripe Resources
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)

### Firebase Resources
- [Firebase Extensions](https://firebase.google.com/docs/extensions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Functions Logs](https://firebase.google.com/docs/functions/logs)

---

*This migration guide is based on the [Firebase Firestore Stripe Payments Extension](https://extensions.dev/extensions/invertase/firestore-stripe-payments) documentation and best practices for Stripe account migration.* 