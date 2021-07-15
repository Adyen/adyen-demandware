const Resource = require('dw/web/Resource');
const URLUtils = require('dw/web/URLUtils');
const OrderMgr = require('dw/order/OrderMgr');
const BasketMgr = require('dw/order/BasketMgr');
// eslint-disable-next-line no-unused-vars
const Site = require('dw/system/Site');
const Status = require('dw/system/Status');
const Transaction = require('dw/system/Transaction');
const PaymentMgr = require('dw/order/PaymentMgr');
const CSRFProtection = require('dw/web/CSRFProtection');

/* Script Modules */
const app = require('app_storefront_controllers/cartridge/scripts/app');
const guard = require('app_storefront_controllers/cartridge/scripts/guard');
const AdyenHelper = require('*/cartridge/scripts/util/adyenHelper');

const OrderModel = app.getModel('Order');
const Logger = require('dw/system/Logger');
const constants = require('*/cartridge/adyenConstants/constants');

const EXTERNAL_PLATFORM_VERSION = 'SiteGenesis';
/**
 * Controller for all storefront processes.
 *
 * @module controllers/Adyen
 */

/**
 * Called by Adyen to update status of payments. It should always display [accepted] when finished.
 */
function notify() {
  const checkAuth = require('*/cartridge/scripts/checkNotificationAuth');

  const status = checkAuth.check(request);
  if (!status) {
    app.getView().render('adyen/error');
    return {};
  }

  const handleNotify = require('*/cartridge/scripts/handleNotify');

  Transaction.begin();
  const notificationResult = handleNotify.notifyHttpParameterMap(
    request.httpParameterMap,
  );

  if (notificationResult.success) {
    Transaction.commit();
    app.getView().render('notify');
  } else {
    app
      .getView({
        errorMessage: notificationResult.errorMessage,
      })
      .render('/notifyError');
    Transaction.rollback();
  }
}

/**
 * Redirect to Adyen after saving order etc.
 */
function redirect(order, redirectUrl) {
  response.redirect(redirectUrl);
}

/**
 * Show confirmation after return from Adyen
 */
function showConfirmation() {
  try {
    const orderNumber = request.httpParameterMap.get('merchantReference')
      .stringValue;
    const orderToken = request.httpParameterMap.get('orderToken')
        .stringValue;
    const order = OrderMgr.getOrder(orderNumber, orderToken);
    const paymentInstruments = order.getPaymentInstruments(
      constants.METHOD_ADYEN_COMPONENT,
    );
    let adyenPaymentInstrument;
    let paymentData;

    const instrumentsIter = paymentInstruments.iterator();
    while (instrumentsIter.hasNext()) {
      adyenPaymentInstrument = instrumentsIter.next();
      paymentData = adyenPaymentInstrument.custom.adyenPaymentData;
    }

    // redirect to payment/details
    const adyenCheckout = require('*/cartridge/scripts/adyenCheckout');
    const requestObject = {
      details: getDetails(),
      paymentData,
    };
    const result = adyenCheckout.doPaymentsDetailsCall(requestObject);
    clearAdyenData(adyenPaymentInstrument);
    if (result.invalidRequest) {
      Logger.getLogger('Adyen').error('Invalid /payments/details call');
      return response.redirect(URLUtils.httpHome());
    }
    const merchantRefOrder = OrderMgr.getOrder(result.merchantReference, orderToken);

    const paymentInstrument = merchantRefOrder.getPaymentInstruments(
        constants.METHOD_ADYEN_COMPONENT,
    )[0];
    if (
      ['Authorised', 'Pending', 'Received', 'PresentToShopper'].indexOf(
        result.resultCode,
      ) > -1
    ) {
      if (
        result.resultCode === 'Received' &&
        result.paymentMethod.indexOf('alipay_hk') > -1
      ) {
        Transaction.wrap(() => {
          OrderMgr.failOrder(merchantRefOrder, true);
        });
        Logger.getLogger('Adyen').error(
          `Did not complete Alipay transaction, result: ${JSON.stringify(
            result,
          )}`,
        );
        const errorStatus = new dw.system.Status(
          dw.system.Status.ERROR,
          'confirm.error.declined',
        );

        app.getController('COSummary').Start({
          PlaceOrderError: errorStatus,
        });
        return {};
      }

      Transaction.wrap(() => {
        AdyenHelper.savePaymentDetails(paymentInstrument, merchantRefOrder, result);
      });
      OrderModel.submit(merchantRefOrder);
      clearForms();
      return app.getController('COSummary').ShowConfirmation(merchantRefOrder);
    }
    // fail order
    Transaction.wrap(() => {
      OrderMgr.failOrder(merchantRefOrder, true);
    });
    Logger.getLogger('Adyen').error(
      `Payment failed, result: ${JSON.stringify(result)}`,
    );

    // should be assingned by previous calls or not
    const errorStatus = new dw.system.Status(
      dw.system.Status.ERROR,
      'confirm.error.declined',
    );

    app.getController('COSummary').Start({
      PlaceOrderError: errorStatus,
    });
  } catch (e) {
    Logger.getLogger('Adyen').error(
      `Could not verify showConfirmation: ${
        e.message
      } more details: ${e.toString()} in ${e.fileName}:${e.lineNumber}`,
    );
  }
  return {};
}

function getDetails() {
  const { redirectResult, payload } = request.httpParameterMap;
  return {
    ...(redirectResult.value && { redirectResult: redirectResult.value }),
    ...(payload.value && { payload: payload.value }),
  };
}

/**
 * Make a payment from inside a component (used by paypal)
 */
function paymentFromComponent() {
  if (
      request.httpParameterMap
          .getRequestBodyAsString()
          .indexOf('cancelTransaction') > -1
  ) {
    const merchantReference = JSON.parse(request.httpParameterMap.getRequestBodyAsString()).merchantReference;
    Logger.getLogger('Adyen').error(
        `Shopper cancelled paymentFromComponent transaction for order ${merchantReference}`,
    );
    return;
  } else {
    const adyenRemovePreviousPI = require('*/cartridge/scripts/adyenRemovePreviousPI');

    const currentBasket = BasketMgr.getCurrentBasket();
    const adyenCheckout = require('*/cartridge/scripts/adyenCheckout');
    let paymentInstrument;
    let order;

    Transaction.wrap(() => {
      const result = adyenRemovePreviousPI.removePaymentInstruments(
          currentBasket,
      );
      if (result.error) {
        return result;
      }
      const stateDataStr = request.httpParameterMap.getRequestBodyAsString();

      paymentInstrument = currentBasket.createPaymentInstrument(
          constants.METHOD_ADYEN_COMPONENT,
          currentBasket.totalGrossPrice,
      );
      const {paymentProcessor} = PaymentMgr.getPaymentMethod(
          paymentInstrument.paymentMethod,
      );
      paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
      paymentInstrument.custom.adyenPaymentData = stateDataStr;
      try {
        paymentInstrument.custom.adyenPaymentMethod = JSON.parse(
            stateDataStr,
        ).paymentMethod.type;
      } catch (e) {
        // Error parsing paymentMethod
      }
    });
    order = OrderMgr.createOrder(currentBasket);

    Transaction.begin();
    const result = adyenCheckout.createPaymentRequest({
      Order: order,
      PaymentInstrument: paymentInstrument,
    });
    result.orderNo = order.orderNo;
    result.orderToken = order.getOrderToken();

    Transaction.commit();
    const responseUtils = require('*/cartridge/scripts/util/Response');
    responseUtils.renderJSON({result});
  }
}

/**
 * Show confirmation for payments completed from component directly e.g. paypal, QRcode, ..
 */
function showConfirmationPaymentFromComponent() {
  const paymentInformation = app.getForm('adyPaydata');
  const orderNumber = paymentInformation.get('merchantReference').value();
  const orderToken = paymentInformation.get('orderToken').value();
  const result = paymentInformation.get('result').value();
  const order = OrderMgr.getOrder(orderNumber, orderToken);
  const paymentInstruments = order.getPaymentInstruments(
    constants.METHOD_ADYEN_COMPONENT,
  );
  let adyenPaymentInstrument;

  const instrumentsIter = paymentInstruments.iterator();
  while (instrumentsIter.hasNext()) {
    adyenPaymentInstrument = instrumentsIter.next();
  }

  const stateData = JSON.parse(
    paymentInformation.get('paymentFromComponentStateData').value(),
  );

  let finalResult;

  const hasStateData = stateData && stateData.details && stateData.paymentData;
  if (!hasStateData) {
    if (result && JSON.stringify(result).indexOf('amazonpay') > -1) {
      finalResult = JSON.parse(result);
    } else {
      // The billing step is fulfilled, but order will be failed
      app.getForm('billing').object.fulfilled.value = true;
      // fail order if no stateData available
      Transaction.wrap(() => {
        OrderMgr.failOrder(order, true);
      });
      app.getController('COBilling').Start();

      return {};
    }
  }
  const { details } = stateData;
  const { paymentData } = stateData;

  // redirect to payment/details
  const adyenCheckout = require('*/cartridge/scripts/adyenCheckout');
  const requestObject = {
    details,
    paymentData,
  };

  const paymentProcessor = PaymentMgr.getPaymentMethod(
    adyenPaymentInstrument.getPaymentMethod(),
  ).getPaymentProcessor();

  Transaction.wrap(() => {
    adyenPaymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
    adyenPaymentInstrument.custom.adyenPaymentData = null;
  });

  finalResult = finalResult || adyenCheckout.doPaymentsDetailsCall(requestObject);

  if (['Authorised', 'Pending', 'Received'].indexOf(finalResult.resultCode) > -1) {
    Transaction.wrap(() => {
      AdyenHelper.savePaymentDetails(adyenPaymentInstrument, order, finalResult);
    });
    OrderModel.submit(order);
    clearForms();
    app.getController('COSummary').ShowConfirmation(order);
    return {};
  }
  // fail order
  Transaction.wrap(() => {
    OrderMgr.failOrder(order, true);
  });
  // should be assingned by previous calls or not
  const errorStatus = new dw.system.Status(
    dw.system.Status.ERROR,
    'confirm.error.declined',
  );

  app.getController('COSummary').Start({
    PlaceOrderError: errorStatus,
  });
  return {};
}

/**
 * Complete a donation through adyenGiving
 */
function donate() {
  const adyenGiving = require('*/cartridge/scripts/adyenGiving');
  const responseUtils = require('*/cartridge/scripts/util/Response');
  let req;
  try {
    req = JSON.parse(request.httpParameterMap.getRequestBodyAsString());
  } catch (e) {
    Logger.getLogger('Adyen').error(e);
  }

  const { pspReference } = req;
  const { orderNo } = req;
  const donationAmount = {
    value: req.amountValue,
    currency: req.amountCurrency,
  };
  const donationResult = adyenGiving.donate(
    orderNo,
    donationAmount,
    pspReference,
  );

  responseUtils.renderJSON({ response: donationResult.response });
}

/**
 * Separated order confirm for Credit cards and APM's.
 */
function orderConfirm(orderNo) {
  let order = null;
  if (orderNo) {
    order = OrderMgr.getOrder(orderNo);
  }
  if (!order) {
    app.getController('Error').Start();
    return {};
  }
  app.getController('COSummary').ShowConfirmation(order);
}

/**
 * Make a request to Adyen to get payment methods based on countryCode. Called from COBilling-Start
 */
function getPaymentMethods(cart, customer) {
  const Locale = require('dw/util/Locale');
  let countryCode = Locale.getLocale(request.getLocale()).country;
  const currentBasket = BasketMgr.getCurrentBasket();
  if (
    currentBasket.getShipments().length > 0 &&
    currentBasket.getShipments()[0].shippingAddress
  ) {
    countryCode = currentBasket
      .getShipments()[0]
      .shippingAddress.getCountryCode()
      .value.toUpperCase();
  }
  const adyenTerminalApi = require('*/cartridge/scripts/adyenTerminalApi');
  const PaymentMgr = require('dw/order/PaymentMgr');
  const getPaymentMethods = require('*/cartridge/scripts/adyenGetPaymentMethods');
  const response = getPaymentMethods.getMethods(
    cart.object,
    customer,
    countryCode,
  );
  const paymentMethodDescriptions = response.paymentMethods.map((method) => ({
    brandCode: method.type,
    description: Resource.msg(`hpp.description.${method.type}`, 'hpp', ''),
  }));
  const adyenURL = `${AdyenHelper.getLoadingContext()}images/logos/medium/`;

  let connectedTerminals = {};
  if (PaymentMgr.getPaymentMethod(constants.METHOD_ADYEN_POS).isActive()) {
    try {
      const connectedTerminalsResponse = adyenTerminalApi.getTerminals()
        .response;
      if (connectedTerminalsResponse) {
        connectedTerminals = JSON.parse(connectedTerminalsResponse);
      }
    } catch (e) {
      // Error parsing terminal response
    }
  }

  const currency = currentBasket.getTotalGrossPrice().currencyCode;
  const paymentAmount = currentBasket.getTotalGrossPrice().isAvailable()
      ? AdyenHelper.getCurrencyValueForApi(currentBasket.getTotalGrossPrice())
      : new dw.value.Money(1000, currency);

  const shippingForm = session.forms.singleshipping;
  const shippingAddress = {
    firstName:  shippingForm.shippingAddress.addressFields.firstName.value,
    lastName:  shippingForm.shippingAddress.addressFields.lastName.value,
    address1:  shippingForm.shippingAddress.addressFields.address1.value,
    city:  shippingForm.shippingAddress.addressFields.city.value,
    country:  shippingForm.shippingAddress.addressFields.country.value,
    phone:  shippingForm.shippingAddress.addressFields.phone.value,
    postalCode:  shippingForm.shippingAddress.addressFields.postal.value,
  };
  const jsonResponse = {
    adyenPaymentMethods: response,
    adyenConnectedTerminals: connectedTerminals,
    ImagePath: adyenURL,
    AdyenDescriptions: paymentMethodDescriptions,
    amount: { value: paymentAmount.value, currency: currency },
    countryCode: countryCode,
    shippingAddress:shippingAddress,
  };

  return jsonResponse;
}

function redirect3ds2() {
  const clientKey = AdyenHelper.getAdyenClientKey();
  const environment = AdyenHelper.getAdyenEnvironment().toLowerCase();
  const locale = request.getLocale();

  const orderNo = request.httpParameterMap.get('merchantReference').stringValue;
  const orderToken = request.httpParameterMap.get('orderToken').stringValue;
  const order = OrderMgr.getOrder(orderNo, orderToken);
  const paymentInstrument = order.getPaymentInstruments(
      constants.METHOD_ADYEN_COMPONENT,
  )[0];
  const action = paymentInstrument.custom.adyenAction;
  Transaction.wrap(function () {
    paymentInstrument.custom.adyenAction = null;
  });

  app
    .getView({
      locale,
      clientKey,
      environment,
      resultCode: request.httpParameterMap.get('resultCode').stringValue,
      action: action,
      merchantReference: orderNo,
      orderToken: orderToken,
      ContinueURL: URLUtils.https(
        'Adyen-Authorize3DS2',
          'merchantReference',
          orderNo,
          'orderToken',
          orderToken,
),
    })
    .render('/threeds2/adyen3ds2');
}

/**
 * Make second call to /payments/details with IdentifyShopper or ChallengeShopper token
 *
 * @returns rendering template or error
 */
function authorize3ds2() {
  if (!CSRFProtection.validateRequest()) {
    Logger.getLogger('Adyen').error(
      `CSRF Mismatch for order ${
        request.httpParameterMap.get('merchantReference').stringValue
      }`,
    );
    response.redirect(URLUtils.httpHome());
    return;
  }
  try {
    Transaction.begin();
    const adyenCheckout = require('*/cartridge/scripts/adyenCheckout');
    const orderNo = request.httpParameterMap.get('merchantReference')
      .stringValue;
    const orderToken = request.httpParameterMap.get('orderToken')
        .stringValue;
    const order = OrderMgr.getOrder(orderNo, orderToken);
    const paymentInstrument = order.getPaymentInstruments(
      constants.METHOD_ADYEN_COMPONENT,
    )[0];

    let details = {};

    if (
        ['IdentifyShopper', 'ChallengeShopper'].indexOf(request.httpParameterMap.get('resultCode').stringValue) !== -1
        || request.httpParameterMap.get('challengeResult').stringValue
    ) {
      details = JSON.parse(request.httpParameterMap.get(
          'stateData',
      ).stringValue).details;
    } else {
      Logger.getLogger('Adyen').error('paymentDetails 3DS2 not available');
      Transaction.wrap(() => {
        OrderMgr.failOrder(order, true);
      });
      app.getController('COSummary').Start({
        PlaceOrderError: new Status(Status.ERROR, 'confirm.error.declined', ''),
      });
      return {};
    }

    const paymentDetailsRequest = {
      paymentData: paymentInstrument.custom.adyenPaymentData,
      details,
    };

    const result = adyenCheckout.doPaymentsDetailsCall(paymentDetailsRequest);
    if (result.invalidRequest) {
      Logger.getLogger('Adyen').error(`Invalid request for order ${orderNo}`);
      clearAdyenData(paymentInstrument);
      return response.redirect(URLUtils.httpHome());
    }
    const resultOrderNo = result.merchantReference || orderNo;
    const resultOrder = OrderMgr.getOrder(resultOrderNo, orderToken);
    if (!result.action && (result.error || result.resultCode !== 'Authorised')) {
      // Payment failed
      Transaction.wrap(() => {
        OrderMgr.failOrder(resultOrder, true);
        paymentInstrument.custom.adyenPaymentData = null;
      });
      app.getController('COSummary').Start({
        PlaceOrderError: new Status(Status.ERROR, 'confirm.error.declined', ''),
      });
      return {};
    }
    if (result.action) {
      app
        .getView({
          ContinueURL: URLUtils.https(
            'Adyen-Redirect3DS2',
            'merchantReference',
            resultOrderNo,
            'utm_nooverride',
            '1',
          ),
          action: JSON.stringify(result.action),
          merchantReference: resultOrderNo,
          orderToken: orderToken,
        })
        .render('/threeds2/adyen3ds2');
      return {};
    }

    resultOrder.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
    resultOrder.setExportStatus(dw.order.Order.EXPORT_STATUS_READY);
    paymentInstrument.custom.adyenPaymentData = null;
    AdyenHelper.savePaymentDetails(paymentInstrument, resultOrder, result);
    Transaction.commit();

    OrderModel.submit(resultOrder);
    clearForms();
    app.getController('COSummary').ShowConfirmation(resultOrder);
  } catch (e) {
    Logger.getLogger('Adyen').error(
      `Could not complete authorize3ds2: ${
        e.message
      } more details: ${e.toString()} in ${e.fileName}:${e.lineNumber}`,
    );
  }
  return {};
}

/**
 * Make /payments/details call to 3d verification system to complete authorization
 *
 * @returns rendering template or error
 */
function authorizeWithForm() {
  try {
    const MD = request.httpParameterMap.get('MD').stringValue;
    const PaRes = request.httpParameterMap.get('PaRes').stringValue;
    const orderNo = request.httpParameterMap.get('merchantReference')
      .stringValue;
    const orderToken = request.httpParameterMap.get('orderToken')
        .stringValue;
    let order = OrderMgr.getOrder(orderNo, orderToken);
    const paymentInstrument = order.getPaymentInstruments(
      constants.METHOD_ADYEN_COMPONENT,
    )[0];

    clearCustomSessionFields();
    // compare the MD from Adyen's payments response with the one from the issuer
    if (paymentInstrument.custom.adyenMD !== MD) {
      clearAdyenData(paymentInstrument);
      Logger.getLogger('Adyen').error(`Incorrect MD for order ${orderNo}`);
      return response.redirect(URLUtils.httpHome());
    }
    Transaction.begin();
    const adyenCheckout = require('*/cartridge/scripts/adyenCheckout');
    const jsonRequest = {
      paymentData: paymentInstrument.custom.adyenPaymentData,
      details: {
        MD,
        PaRes,
      },
    };

    const result = adyenCheckout.doPaymentsDetailsCall(jsonRequest);
    if (result.invalidRequest) {
      Logger.getLogger('Adyen').error(`Invalid request for order ${orderNo}`);
      return response.redirect(URLUtils.httpHome());
    }

    if (result.error || result.resultCode !== 'Authorised') {
      Transaction.rollback();
      clearAdyenData(paymentInstrument);
      Transaction.wrap(() => {
        OrderMgr.failOrder(order, true);
      });
      app.getController('COSummary').Start({
        PlaceOrderError: new Status(Status.ERROR, 'confirm.error.declined', ''),
      });
      return {};
    }
    order = OrderMgr.getOrder(result.merchantReference, orderToken);
    order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
    order.setExportStatus(dw.order.Order.EXPORT_STATUS_READY);
    clearAdyenData(paymentInstrument);
    AdyenHelper.savePaymentDetails(paymentInstrument, order, result);
    Transaction.commit();

    OrderModel.submit(order);
    clearForms();
    app.getController('COSummary').ShowConfirmation(order);
  } catch (e) {
    Logger.getLogger('Adyen').error(
      `Could not verify authorizeWithForm: ${
        e.message
      } more details: ${e.toString()} in ${e.fileName}:${e.lineNumber}`,
    );
  }
  return {};
}

/**
 * Clear system session data
 */
function clearAdyenData(paymentInstrument) {
  Transaction.wrap(() => {
    paymentInstrument.custom.adyenPaymentData = null;
    paymentInstrument.custom.adyenMD = null;
  });
}

/**
 * Clear system session data
 */
function clearForms() {
  // Clears all forms used in the checkout process.
  session.forms.singleshipping.clearFormElement();
  session.forms.multishipping.clearFormElement();
  session.forms.billing.clearFormElement();

  clearCustomSessionFields();
}

/**
 * Clear custom session data
 */
function clearCustomSessionFields() {
  // Clears all fields used in the 3d secure payment.
  session.privacy.adyenResponse = null;
  session.privacy.paymentMethod = null;
  session.privacy.orderNo = null;
  session.privacy.adyenBrandCode = null;
  session.privacy.adyenIssuerID = null;
}

function getExternalPlatformVersion() {
  return EXTERNAL_PLATFORM_VERSION;
}

exports.Authorize3DS2 = guard.ensure(['https', 'post'], authorize3ds2);

exports.Redirect3DS2 = guard.ensure(['https', 'post'], redirect3ds2);

exports.AuthorizeWithForm = guard.ensure(['https', 'post'], authorizeWithForm);

exports.Notify = guard.ensure(['post'], notify);

exports.Redirect = redirect;

exports.ShowConfirmation = guard.httpsGet(showConfirmation);

exports.ShowConfirmationPaymentFromComponent = guard.ensure(
  ['https'],
  showConfirmationPaymentFromComponent,
);

exports.OrderConfirm = guard.httpsGet(orderConfirm);

exports.GetPaymentMethods = getPaymentMethods;

exports.getExternalPlatformVersion = getExternalPlatformVersion();

exports.PaymentFromComponent = guard.ensure(
  ['https', 'post'],
    paymentFromComponent,
);

exports.Donate = guard.ensure(['https', 'post'], donate);
