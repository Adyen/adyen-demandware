/* eslint-disable global-require */

let req;
let res;
let placeOrder;

beforeEach(() => {
  const { checkoutServices } = require('../../index');
  placeOrder = checkoutServices.placeOrder;

  jest.clearAllMocks();
  res = { getViewData: jest.fn(), json: jest.fn() };
  req = {
    session: { privacyCache: { get: jest.fn(), set: jest.fn() } },
    locale: { id: 'NL' },
    currentCustomer: {addressBook: true},
  };
});

afterEach(() => {
  jest.resetModules();
});

describe('Place Order', () => {
  it('should return error when basket is empty', () => {
    const BasketMgr = require('dw/order/BasketMgr');
    BasketMgr.getCurrentBasket.mockImplementation(() => false);
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should go to next middleware if payment instrument is not Adyen', () => {
    const next = jest.fn();
    const BasketMgr = require('dw/order/BasketMgr');
    BasketMgr.toArray.mockReturnValue([
      {
        paymentMethod: 'mocked_example',
      },
    ]);
    placeOrder.call({ emit: jest.fn() }, req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.getViewData).toHaveBeenCalledTimes(0);
  });
  it('should complete if viewData contains csrfError', () => {
    const emit = jest.fn();
    res.getViewData.mockImplementation(() => ({ csrfError: true }));
    placeOrder.call({ emit }, req, res, jest.fn());
    expect(emit.mock.calls).toMatchSnapshot();
  });
  it('should return error if privacy cache detect fraud', () => {
    req.session.privacyCache.get.mockImplementation(() => true);
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if order validation status is error', () => {
    const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    hooksHelper.mockImplementation(() => ({
      error: true,
      message: 'mocked_order_validation_message',
    }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if shipping address is empty', () => {
    const BasketMgr = require('dw/order/BasketMgr');
    BasketMgr.getDefaultShipment.mockImplementation(() => ({
      shippingAddress: null,
    }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if billing address is empty', () => {
    const BasketMgr = require('dw/order/BasketMgr');
    BasketMgr.getBillingAddress.mockImplementation(() => false);
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if calculated payment total has error', () => {
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    COHelpers.calculatePaymentTransaction.mockImplementation(() => ({
      error: true,
    }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if created order is empty', () => {
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    COHelpers.createOrder.mockImplementation(() => null);
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if there is error on payment handle', () => {
    const adyenHelpers = require('*/cartridge/scripts/checkout/adyenHelpers');
    adyenHelpers.handlePayments.mockImplementation(() => ({ error: true }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should handle threeDS2', () => {
    const adyenHelpers = require('*/cartridge/scripts/checkout/adyenHelpers');
    adyenHelpers.handlePayments.mockImplementation(() => ({
      threeDS2: true,
      resultCode: 'mocked_threeDS2_resultCode',
      action: 'mocked_action',
    }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should redirect with authorize3d', () => {
    const adyenHelpers = require('*/cartridge/scripts/checkout/adyenHelpers');
    adyenHelpers.handlePayments.mockImplementation(() => ({
      authorized3d: true,
      redirectObject: {
        data: { MD: 'mocked_MD', PaReq: 'mocked_PaReq' },
        url: 'mocked_url',
      },
      orderNo: 'mocked_orderNo',
    }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should redirect without authorize3d', () => {
    const adyenHelpers = require('*/cartridge/scripts/checkout/adyenHelpers');
    adyenHelpers.handlePayments.mockImplementation(() => ({
      authorized3d: false,
      redirectObject: true,
      orderNo: 'mocked_orderNo',
    }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if fraudDetection status returns "fail"', () => {
    const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    hooksHelper.mockImplementation(() => ({
      status: 'fail',
      errorCode: 'mocked_fraud_fail',
    }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should fail if placeOrder has error', () => {
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    COHelpers.placeOrder.mockImplementation(() => ({ error: true }));
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(res.json.mock.calls).toMatchSnapshot();
  });
  it('should return json response', () => {
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    placeOrder.call({ emit: jest.fn() }, req, res, jest.fn());
    expect(COHelpers.sendConfirmationEmail).toBeCalledTimes(1);
    expect(res.json.mock.calls).toMatchSnapshot();
  });
});
