const OrderMgr = require('dw/order/OrderMgr');
const Logger = require('dw/system/Logger');
const URLUtils = require('dw/web/URLUtils');
const handlePayment = require('./showConfirmationPaymentFromComponent/payment');

function showConfirmationPaymentFromComponent(req, res, next) {
  const options = { req, res, next };
  try {
    const stateData = JSON.parse(req.form.additionalDetailsHidden);
    const { merchantReference } = req.form;
    Logger.getLogger('Adyen').error(
      `MerchantReferenceInShowconfirm = ${merchantReference}`,
    );
    const order = OrderMgr.getOrder(merchantReference);
    return handlePayment(stateData, order, options);
  } catch (e) {
    Logger.getLogger('Adyen').error(
      `Could not verify /payment/details: ${e.toString()} in ${e.fileName}:${
        e.lineNumber
      }`,
    );
    res.redirect(URLUtils.url('Error-ErrorCode', 'err', 'general'));
    return next();
  }
}

module.exports = showConfirmationPaymentFromComponent;
