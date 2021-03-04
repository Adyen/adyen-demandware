jest.mock('../../helpers/index', () => ({
  checkForErrors: jest.fn(),
}));

const adyenHelpers = require('*/cartridge/scripts/checkout/adyenHelpers');
const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
const handleTransaction = require('../transaction');
const { checkForErrors } = require('../../helpers/index');

let res;
let req;
let emit;
beforeEach(() => {
  jest.clearAllMocks();
  res = { json: jest.fn() };
  req = {};
  emit = jest.fn();
});

describe('Transaction', () => {
  it('should fail if current basket has errors', () => {
    checkForErrors.mockReturnValue(true);
    const isSuccessful = handleTransaction({}, { res, req }, emit);
    expect(isSuccessful).toBeFalsy();
  });
  it('should return json with error details when payment transaction calculation fails', () => {
    checkForErrors.mockReturnValue(false);
    adyenHelpers.validatePayment.mockReturnValue({ error: false });
    COHelpers.calculatePaymentTransaction.mockReturnValue({ error: true });
    const isSuccessful = handleTransaction({}, { res, req }, emit);
    expect(res.json.mock.calls).toMatchSnapshot();
    expect(isSuccessful).toBeFalsy();
  });
  it('should succeed when payment validation and transaction calculation are successful', () => {
    checkForErrors.mockReturnValue(false);
    adyenHelpers.validatePayment.mockReturnValue({ error: false });
    COHelpers.calculatePaymentTransaction.mockReturnValue({ error: false });
    const isSuccessful = handleTransaction(
      'mockedCurrentBasket',
      { res, req },
      emit,
    );
    expect(isSuccessful).toBeTruthy();
    expect(basketCalculationHelpers.calculateTotals).toBeCalledWith(
      'mockedCurrentBasket',
    );
  });
});
