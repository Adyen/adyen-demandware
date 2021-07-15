export const savePaymentDetails = jest.fn();
export const getAdyenEnvironment = jest.fn(() => 'TEST');
export const getAdyenHash = jest.fn((str, str2) => `${str} __ ${str2}`);
export const getLoadingContext = jest.fn(() => 'mocked_loading_context');
export const getCreditCardInstallments = jest.fn(() => true);
export const getCurrencyValueForApi = jest.fn(() => ({
    value: 1000,
}));
export const getPaypalMerchantID = jest.fn(() => 'mocked_paypal_merchant_id');
export const getAmazonMerchantID = jest.fn(() => 'mocked_amazon_merchant_id');
export const getAmazonStoreID = jest.fn(() => 'mocked_amazon_store_id');
export const getAmazonPublicKeyID = jest.fn(() => 'mocked_amazon_public_key_id');
export const getAdyenClientKey = jest.fn(() => 'mocked_client_key');
export const getGoogleMerchantID = jest.fn(() => 'mocked_google_merchant_id');
export const getAdyenCardholderNameEnabled = jest.fn(() => true);
export const getAdyenPayPalIntent = jest.fn(() => 'mocked_intent');
export const getAdyenMerchantAccount = jest.fn(() => 'mocked_merchant_account');
export const getAdyenGivingEnabled = jest.fn(() => true);
export const isAdyenGivingAvailable = jest.fn(() => true);
export const getDonationAmounts = jest.fn(() => [10, 20, 30]);
export const getAdyenGivingCharityName = jest.fn(() => 'mocked_charity_name');
export const getAdyenGivingCharityWebsite = jest.fn(
  () => 'mocked_charity_website',
);
export const getAdyenGivingCharityDescription = jest.fn(
  () => 'mocked_charity_description',
);
export const getAdyenGivingBackgroundUrl = jest.fn(
  () => 'mocked_background_url',
);
export const getAdyenGivingLogoUrl = jest.fn(() => 'mocked_logo_url');
export const getAdyenCartridgeEnabled = jest.fn(() => true);
export const getCardToken = jest.fn(() => 'mocked_token');
export const getSFCCCardType = jest.fn(() => 'mocked_cardType');
export const createAdyenCheckoutResponse = jest.fn(() => ({isFinal: true, isSuccessful: false}));
