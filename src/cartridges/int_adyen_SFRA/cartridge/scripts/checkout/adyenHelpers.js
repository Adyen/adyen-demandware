const Transaction = require('dw/system/Transaction');
const OrderMgr = require('dw/order/OrderMgr');
const { getPayments } = require('./utils/index');

/**
 * handles the payment authorization for each payment instrument
 * @param {dw.order.Order} order - the order object
 * @param {string} orderNumber - The order number for the order
 * @returns {Object} an error object
 */
function handlePayments(order, orderNumber) {
  if (order.totalNetPrice === 0.0) {
    return {};
  }

  if (order.paymentInstruments.length) {
    return getPayments(order, orderNumber);
  }

  Transaction.wrap(() => {
    OrderMgr.failOrder(order, true);
  });
  return { error: true };
}

module.exports = {
  handlePayments,
};
