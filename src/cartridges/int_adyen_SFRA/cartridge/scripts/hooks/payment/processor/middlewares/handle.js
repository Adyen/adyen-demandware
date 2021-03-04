const Transaction = require('dw/system/Transaction');
const AdyenHelper = require('*/cartridge/scripts/util/adyenHelper');
const collections = require('*/cartridge/scripts/util/collections');
const constants = require('*/cartridge/adyenConstants/constants');

function handleCreditCard(paymentInformation, paymentInstrument) {
  const sfccCardType = AdyenHelper.getSFCCCardType(paymentInformation.cardType);
  const tokenID = AdyenHelper.getCardToken(
    paymentInformation.storedPaymentUUID,
    customer,
  );

  const cardNumber =
    paymentInformation.cardNumber ||
    paymentInformation.adyenPaymentMethod.substring(
      paymentInformation.adyenPaymentMethod.indexOf('*'),
    );
  paymentInstrument.setCreditCardNumber(cardNumber);
  paymentInstrument.setCreditCardType(sfccCardType);

  if (tokenID) {
    paymentInstrument.setCreditCardExpirationMonth(
      paymentInformation.expirationMonth.value,
    );
    paymentInstrument.setCreditCardExpirationYear(
      paymentInformation.expirationYear.value,
    );
    paymentInstrument.setCreditCardToken(tokenID);
  }
}

function handle(basket, paymentInformation) {
  const currentBasket = basket;
  const cardErrors = {};
  const serverErrors = [];
  Transaction.wrap(() => {
    collections.forEach(currentBasket.getPaymentInstruments(), (item) => {
      currentBasket.removePaymentInstrument(item);
    });

    const paymentMethod = paymentInformation.isCreditCard
      ? constants.METHOD_CREDIT_CARD
      : constants.METHOD_ADYEN_COMPONENT;

    const paymentInstrument = currentBasket.createPaymentInstrument(
      paymentMethod,
      currentBasket.totalGrossPrice,
    );
    paymentInstrument.custom.adyenPaymentData = paymentInformation.stateData;
    paymentInstrument.custom.adyenPaymentMethod =
      paymentInformation.adyenPaymentMethod;

    if (paymentInformation.isCreditCard) {
      handleCreditCard(paymentInformation, paymentInstrument);
    }
  });

  return { fieldErrors: cardErrors, serverErrors, error: false };
}

module.exports = handle;

// export default Handle;
