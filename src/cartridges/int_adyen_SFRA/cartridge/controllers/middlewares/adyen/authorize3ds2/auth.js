const OrderMgr = require('dw/order/OrderMgr');
const constants = require('*/cartridge/adyenConstants/constants');
const handlePaymentsDetailsCall = require('./payment');
const { toggle3DS2Error } = require('./errorHandler');

function contains3ds2Action({ req }) {
  return (
    ['IdentifyShopper', 'ChallengeShopper'].indexOf(req.form.resultCode) !==
      -1 || req.form.challengeResult
  );
}

function handle3DS2Authentication(options) {
  const { req } = options;
  const order = OrderMgr.getOrder(req.form.merchantReference);
  const paymentInstrument = order.getPaymentInstruments(
    constants.METHOD_CREDIT_CARD,
  )[0];
  const paymentDetailsRequest = {
    paymentData: paymentInstrument.custom.adyenPaymentData,
    details: JSON.parse(req.form.stateData).details,
  };
  return handlePaymentsDetailsCall(
    paymentDetailsRequest,
    order,
    paymentInstrument,
    options,
  );
}

function createAuthorization(options) {
  const is3DS2 = contains3ds2Action(options);
  return is3DS2 ? handle3DS2Authentication(options) : toggle3DS2Error(options);
}

module.exports = createAuthorization;
