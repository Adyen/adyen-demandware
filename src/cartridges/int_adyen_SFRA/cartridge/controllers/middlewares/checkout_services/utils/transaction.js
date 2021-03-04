const Resource = require('dw/web/Resource');
const Transaction = require('dw/system/Transaction');
const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
const { checkForErrors } = require('../helpers/index');

const handleTransaction = (currentBasket, { res, req }, emit) => {
  const calculatePaymentTransaction = () => {
    const calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(
      currentBasket,
    );
    if (calculatedPaymentTransactionTotal.error) {
      res.json({
        error: true,
        errorMessage: Resource.msg('error.technical', 'checkout', null),
      });
      emit('route:Complete');
    }
    return !calculatedPaymentTransactionTotal.error;
  };

  const hasError = checkForErrors(currentBasket, res, req, emit);
  if (hasError) {
    return false;
  }

  // Calculate the basket
  Transaction.wrap(() => {
    basketCalculationHelpers.calculateTotals(currentBasket);
  });

  return calculatePaymentTransaction();
};

module.exports = handleTransaction;
