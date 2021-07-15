const server = require('server');
const Resource = require('dw/web/Resource');
const CustomerMgr = require('dw/customer/CustomerMgr');
const Transaction = require('dw/system/Transaction');
const URLUtils = require('dw/web/URLUtils');
const AdyenHelper = require('*/cartridge/scripts/util/adyenHelper');
const adyenZeroAuth = require('*/cartridge/scripts/adyenZeroAuth');
const constants = require('*/cartridge/adyenConstants/constants');
const accountHelpers = require('*/cartridge/scripts/helpers/accountHelpers');
const { updateSavedCards } = require('*/cartridge/scripts/updateSavedCards');

function containsValidResultCode(req) {
  return (
    [
      'Authorised',
      'IdentifyShopper',
      'ChallengeShopper',
      'RedirectShopper',
    ].indexOf(req.resultCode) !== -1
  );
}

function createPaymentInstrument(customer) {
  let paymentInstrument;
  const paymentForm = server.forms.getForm('creditCard');
  const wallet = customer.getProfile().getWallet();
  Transaction.wrap(() => {
    paymentInstrument = wallet.createPaymentInstrument(
      constants.METHOD_ADYEN_COMPONENT,
    );
    paymentInstrument.custom.adyenPaymentData =
      paymentForm.adyenStateData.value;
  });

  return paymentInstrument;
}

function getResponseBody(action) {
  return {
    success: true,
    redirectUrl: URLUtils.url('PaymentInstruments-List').toString(),
    ...(action && { redirectAction: action }),
  };
}

function savePayment(req, res, next) {
  if (!AdyenHelper.getAdyenCartridgeEnabled()) {
    return next();
  }

  const customer = CustomerMgr.getCustomerByCustomerNumber(
    req.currentCustomer.profile.customerNo,
  );

  Transaction.begin();
  const zeroAuthResult = adyenZeroAuth.zeroAuthPayment(
    customer,
    createPaymentInstrument(customer),
  );

  if (zeroAuthResult.error || !containsValidResultCode(zeroAuthResult)) {
    Transaction.rollback();
    res.json({
      success: false,
      error: [Resource.msg('error.card.information.error', 'creditCard', null)],
    });
    return this.emit('route:Complete', req, res);
  }

  Transaction.commit();

  updateSavedCards({
    CurrentCustomer: req.currentCustomer.raw,
  });

  // Send account edited email
  accountHelpers.sendAccountEditedEmail(customer.profile);

  res.json(getResponseBody(zeroAuthResult.action));
  return this.emit('route:Complete', req, res);
}

module.exports = savePayment;
