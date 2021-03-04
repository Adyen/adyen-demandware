const Resource = require('dw/web/Resource');
const URLUtils = require('dw/web/URLUtils');
const Transaction = require('dw/system/Transaction');
const constants = require('*/cartridge/adyenConstants/constants');
const adyenHelpers = require('*/cartridge/scripts/checkout/adyenHelpers');

function handlePaymentAuthorization(order, { res }, emit) {
  const handleRedirectResult = (handlePaymentResult) => {
    if (handlePaymentResult.threeDS2) {
      const paymentInstrument = order.getPaymentInstruments(
        constants.METHOD_CREDIT_CARD,
      )[0];
      Transaction.wrap(() => {
        paymentInstrument.custom.adyenAction = handlePaymentResult.action;
      });
      res.json({
        error: false,
        order,
        continueUrl: URLUtils.url(
          'Adyen-Adyen3DS2',
          'resultCode',
          handlePaymentResult.resultCode,
          'orderNo',
          order.orderNo,
        ).toString(),
      });
      emit('route:Complete');
      return false;
    }

    if (handlePaymentResult.redirectObject) {
      // If authorized3d, then redirectObject from credit card, hence it is 3D Secure
      if (handlePaymentResult.authorized3d) {
        const paymentInstrument = order.getPaymentInstruments(
          constants.METHOD_CREDIT_CARD,
        )[0];
        Transaction.wrap(() => {
          paymentInstrument.custom.adyenMD =
            handlePaymentResult.redirectObject.data.MD;
        });
        res.json({
          error: false,
          continueUrl: URLUtils.url(
            'Adyen-Adyen3D',
            'IssuerURL',
            handlePaymentResult.redirectObject.url,
            'PaRequest',
            handlePaymentResult.redirectObject.data.PaReq,
            'MD',
            handlePaymentResult.redirectObject.data.MD,
            'merchantReference',
            handlePaymentResult.orderNo,
            'signature',
            handlePaymentResult.signature,
          ).toString(),
        });
        emit('route:Complete');
        return false;
      }
      Transaction.wrap(() => {
        paymentInstrument.custom.adyenRedirectURL =
          handlePaymentResult.redirectObject.url;
      });
      res.json({
        error: false,
        continueUrl: URLUtils.url(
          'Adyen-Redirect',
          'merchantReference',
          handlePaymentResult.orderNo,
          'signature',
          handlePaymentResult.signature,
        ).toString(),
      });
      emit('route:Complete');
      return false;
    }

    return true;
  };

  // Handles payment authorization
  const handlePaymentResult = adyenHelpers.handlePayments(order, order.orderNo);
  if (handlePaymentResult.error) {
    res.json({
      error: true,
      errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null),
    });
    emit('route:Complete');
    return false;
  }

  return handleRedirectResult(handlePaymentResult);
}

module.exports = handlePaymentAuthorization;
