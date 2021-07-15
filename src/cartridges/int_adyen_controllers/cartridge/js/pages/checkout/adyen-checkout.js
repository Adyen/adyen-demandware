require('./bundle');
require('./adyen-giving');
require('./amazon');

var qrCodeMethods = ['swish', 'wechatpayQR', 'bcmc_mobile', 'pix'];
var maskedCardNumber;
var MASKED_CC_PREFIX = '************';
var selectedMethod;
var componentsObj = {};
var checkoutConfiguration;
var paymentMethodsResponse;
var checkout;
var formErrorsExist;
var isValid;
var paypalTerminatedEarly = false;
/**
 * @function
 * @description Initializes Adyen Secured Fields  Billing events
 */
function initializeBillingEvents() {
  $('#billing-submit').on('click', function () {
    var isAdyenPOS = document.querySelector('.payment-method-options :checked').value
        === 'AdyenPOS';
    var isAdyen = document.querySelector('.payment-method-options :checked').value === 'AdyenComponent';
    if (isAdyenPOS) {
      document.querySelector(
          '#dwfrm_adyPaydata_terminalId',
      ).value = document.querySelector('#terminalList').value;
      return true;
    }
    if (isAdyen) {
      var adyenPaymentMethod = document.querySelector(
          '#adyenPaymentMethodName',
      );
      var paymentMethodLabel = document.querySelector(`#lb_${selectedMethod}`)
          .innerHTML;
      adyenPaymentMethod.value = paymentMethodLabel;
      validateComponents();
      return showValidation();
    }
  });

  if (window.getPaymentMethodsResponse) {
    paymentMethodsResponse = window.getPaymentMethodsResponse;
    checkoutConfiguration = window.Configuration;
    checkoutConfiguration.onChange = function (state /* , component */) {
      var type = state.data.paymentMethod.type;
      isValid = state.isValid;
      if (!componentsObj[type]) {
        componentsObj[type] = {};
      }
      componentsObj[type].isValid = isValid;
      componentsObj[type].stateData = state.data;
    };
    checkoutConfiguration.showPayButton = false;
    checkoutConfiguration.paymentMethodsConfiguration = {
      card: {
        enableStoreDetails: showStoreDetails,
        onBrand: function (brandObject) {
          $('#cardType').val(brandObject.brand);
        },
        onFieldValid: function (data) {
          if (data.endDigits) {
            maskedCardNumber = MASKED_CC_PREFIX + data.endDigits;
            $('#cardNumber').val(maskedCardNumber);
          }
        },
        onChange: function (state) {
          isValid = state.isValid;
          var componentName = state.data.paymentMethod.storedPaymentMethodId
            ? `storedCard${state.data.paymentMethod.storedPaymentMethodId}`
            : state.data.paymentMethod.type;
          if (componentName === selectedMethod || selectedMethod === 'bcmc') {
            $('#browserInfo').val(JSON.stringify(state.data.browserInfo));
            componentsObj[selectedMethod].isValid = isValid;
            componentsObj[selectedMethod].stateData = state.data;
          }
        },
      },
      boletobancario: {
        personalDetailsRequired: true, // turn personalDetails section on/off
        billingAddressRequired: false, // turn billingAddress section on/off
        showEmailAddress: false, // allow shopper to specify their email address
      },
      paywithgoogle: {
        environment: window.Configuration.environment,
        onSubmit: () => {
          assignPaymentMethodValue();
          document.querySelector('#billing-submit').disabled = false;
          document.querySelector('#billing-submit').click();
        },
        configuration: {
          gatewayMerchantId: window.merchantAccount,
        },
        showPayButton: true,
        buttonColor: 'white',
      },
      paypal: {
        environment: window.Configuration.environment,
        intent: window.paypalIntent,
        showPayButton: true,
        onClick: (data, actions) => {
          if(paypalTerminatedEarly) {
            paymentFromComponent({
              cancelTransaction: true,
              merchantReference: document.querySelector('#merchantReference').value,
            });
            paypalTerminatedEarly = false;
            return actions.resolve();
          }
          paypalTerminatedEarly = true;
          $('#dwfrm_billing').trigger('submit');
          if (formErrorsExist) {
            paypalTerminatedEarly = false;
            return actions.reject();
          }
        },
        onSubmit: (state, component) => {
          assignPaymentMethodValue();
          paymentFromComponent(state.data, component);
          document.querySelector('#adyenStateData').value = JSON.stringify(
              state.data,
          );
        },
        onCancel: (data, component) => {
          paypalTerminatedEarly = false;
          paymentFromComponent({
            cancelTransaction: true,
            merchantReference: document.querySelector('#merchantReference').value, }, component);
        },
        onError: (/* error, component */) => {
          paypalTerminatedEarly = false;
          $('#dwfrm_billing').trigger('submit');
        },
        onAdditionalDetails: (state /* , component */) => {
          paypalTerminatedEarly = false;
          document.querySelector('#paymentFromComponentStateData').value = JSON.stringify(
              state.data,
          );
          $('#dwfrm_billing').trigger('submit');
        },
      },
      mbway: {
        showPayButton: true,
        onSubmit: (state, component) => {
          $('#dwfrm_billing').trigger('submit');
          assignPaymentMethodValue();
          if (formErrorsExist) {
            return false;
          }
          document.getElementById('component_mbway').querySelector('button').disabled = true;
          paymentFromComponent(state.data, component);
          document.querySelector('#adyenStateData').value = JSON.stringify(
              state.data,
          );
        },
        onError: (/* error, component */) => {
          $('#dwfrm_billing').trigger('submit');
        },
        onAdditionalDetails: (state /* , component */) => {
          document.querySelector('#paymentFromComponentStateData').value = JSON.stringify(
              state.data,
          );
          $('#dwfrm_billing').trigger('submit');
        },
      },
      swish: getQRCodeConfig(),
      bcmc_mobile: getQRCodeConfig(),
      wechatpayQR: getQRCodeConfig(),
      pix: getQRCodeConfig(),
      amazonpay: getAmazonpayConfig(),
      afterpay_default: {
        visibility: {
          personalDetails: 'editable',
          billingAddress: 'hidden',
          deliveryAddress: 'hidden',
        },
        data: {
          personalDetails: {
            firstName: document.querySelector(
              '#dwfrm_billing_billingAddress_addressFields_firstName',
            ).value,
            lastName: document.querySelector(
                '#dwfrm_billing_billingAddress_addressFields_lastName',
            ).value,
            telephoneNumber: document.querySelector(
               '#dwfrm_billing_billingAddress_addressFields_phone',
            ).value,
            shopperEmail: document.querySelector(
               '#dwfrm_billing_billingAddress_email_emailAddress',
            ).value,
          },
        },
      },
      facilypay_3x: {
        visibility: {
          personalDetails: 'editable',
          billingAddress: 'hidden',
          deliveryAddress: 'hidden',
        },
        data: {
          personalDetails: {
            firstName: document.querySelector(
                '#dwfrm_billing_billingAddress_addressFields_firstName',
            ).value,
            lastName: document.querySelector(
                '#dwfrm_billing_billingAddress_addressFields_lastName',
            ).value,
            telephoneNumber: document.querySelector(
                '#dwfrm_billing_billingAddress_addressFields_phone',
            ).value,
            shopperEmail: document.querySelector(
                '#dwfrm_billing_billingAddress_email_emailAddress',
            ).value,
          },
        },
      },
      ratepay: {
        visibility: {
          personalDetails: 'editable',
          billingAddress: 'hidden',
          deliveryAddress: 'hidden',
        }
      }
    };
    if (window.installments) {
      try {
        var installments = JSON.parse(window.installments);
        checkoutConfiguration.paymentMethodsConfiguration.card.installments = installments;
      } catch (e) {} // eslint-disable-line no-empty
    }
    if (
      window.googleMerchantID !== 'null' &&
      window.Configuration.environment === 'live'
    ) {
      checkoutConfiguration.paymentMethodsConfiguration.paywithgoogle.configuration.merchantIdentifier =
        window.googleMerchantID;
    }
    if (window.paypalMerchantID !== 'null') {
      checkoutConfiguration.paymentMethodsConfiguration.paypal.merchantId =
        window.paypalMerchantID;
    }
    if(window.cardholderNameBool !== 'null') {
      checkoutConfiguration.paymentMethodsConfiguration.card.hasHolderName = true;
      checkoutConfiguration.paymentMethodsConfiguration.card.holderNameRequired = true;
    }
    renderGenericComponent();
  }
}

/**
 * @function
 * @description Initializes Adyen Checkout My Account events
 */
function initializeAccountEvents() {
  checkoutConfiguration = window.Configuration;
  checkout = new AdyenCheckout(checkoutConfiguration);
  var newCard = document.getElementById('newCard');
  var adyenStateData;
  var isValid = false;
  var node = checkout
    .create('card', {
      hasHolderName: true,
      holderNameRequired: true,
      onChange: function (state) {
        adyenStateData = state.data;
        isValid = state.isValid;
      },
    })
    .mount(newCard);

  $('#applyBtn').on('click', function () {
    if (!isValid) {
      node.showValidation();
      return false;
    }
    document.querySelector('#adyenStateData').value = JSON.stringify(
      adyenStateData,
    );
  });
}

function assignPaymentMethodValue() {
  var adyenPaymentMethod = document.querySelector('#adyenPaymentMethodName');
  adyenPaymentMethod.value = document.querySelector(
    `#lb_${selectedMethod}`,
  ).innerHTML;
}

/**
 * To avoid re-rendering components twice, unmounts existing components from payment methods list
 */
function unmountComponents() {
  var promises = Object.entries(componentsObj).map(function ([key, val]) {
    delete componentsObj[key];
    return resolveUnmount(key, val);
  });
  return Promise.all(promises);
}

function resolveUnmount(key, val) {
  try {
    return Promise.resolve(val.node.unmount(`component_${key}`));
  } catch (e) {
    // try/catch block for val.unmount
    return Promise.resolve(false);
  }
}

function displaySelectedMethod(type) {
  selectedMethod = type;
  resetPaymentMethod();
  if (['paypal', 'paywithgoogle', 'mbway', 'amazonpay', ...qrCodeMethods].indexOf(type) > -1) {
    document.querySelector('#billing-submit').disabled = true;
  } else {
    document.querySelector('#billing-submit').disabled = false;
  }
  document
    .querySelector(`#component_${type}`)
    .setAttribute('style', 'display:block');
}

function resetPaymentMethod() {
  $('.additionalFields').hide();
}

function showValidation() {
  if (componentsObj[selectedMethod] && !componentsObj[selectedMethod].isValid) {
    componentsObj[selectedMethod].node.showValidation();
    return false;
  }
  return true;
}

/**
 * Assigns stateData value to the hidden stateData input field
 * so it's sent to the backend for processing
 */
function validateComponents() {
  var stateData;
  if (
    componentsObj[selectedMethod] &&
    componentsObj[selectedMethod].stateData
  ) {
    stateData = componentsObj[selectedMethod].stateData;
  } else {
    stateData = { paymentMethod: { type: selectedMethod } };
  }

  document.querySelector('#adyenStateData').value = JSON.stringify(stateData);
}

/**
 * Contains fallback components for payment methods that don't have an Adyen web component yet
 */
function getFallback(paymentMethod) {
  var fallback = { };
  return fallback[paymentMethod];
}

/**
 * checks if payment method is blocked and returns a boolean accordingly
 */
function isMethodTypeBlocked(methodType) {
  var blockedMethods = [
    'bcmc_mobile_QR',
    'applepay',
    'cup',
    'wechatpay',
    'wechatpay_pos',
    'wechatpaySdk',
    'wechatpayQr',
  ];
  return blockedMethods.includes(methodType);
}

/**
 * Calls getPaymenMethods and then renders the retrieved payment methods (including card component)
 */
async function renderGenericComponent() {
  if (Object.keys(componentsObj).length) {
    await unmountComponents();
  }
  var paymentMethod;
  var i;
  checkoutConfiguration.paymentMethodsResponse =
    paymentMethodsResponse.adyenPaymentMethods;
  var paymentMethods = paymentMethodsResponse.adyenPaymentMethods;
  if (paymentMethodsResponse.amount) {
    checkoutConfiguration.amount = paymentMethodsResponse.amount;
    checkoutConfiguration.paymentMethodsConfiguration.paypal.amount = paymentMethodsResponse.amount;
    checkoutConfiguration.paymentMethodsConfiguration.amazonpay.amount =
        paymentMethodsResponse.amount;
  }
  if (paymentMethodsResponse.countryCode) {
    checkoutConfiguration.countryCode = paymentMethodsResponse.countryCode;
  }
  checkout = new AdyenCheckout(checkoutConfiguration);
  document.querySelector('#paymentMethodsList').innerHTML = '';

  if (paymentMethods.storedPaymentMethods) {
    for (
      i = 0;
      i < checkout.paymentMethodsResponse.storedPaymentMethods.length;
      i++
    ) {
      paymentMethod = checkout.paymentMethodsResponse.storedPaymentMethods[i];
      if (paymentMethod.supportedShopperInteractions.includes('Ecommerce')) {
        renderPaymentMethod(
          paymentMethod,
          true,
          paymentMethodsResponse.ImagePath,
        );
      }
    }
  }

  paymentMethods.paymentMethods.forEach((pm) => {
    !isMethodTypeBlocked(pm.type) &&
      renderPaymentMethod(pm, false, paymentMethodsResponse.ImagePath);
  });

  var firstPaymentMethod = document.querySelector(
    'input[type=radio][name=brandCode]',
  );
  firstPaymentMethod.checked = true;
  displaySelectedMethod(firstPaymentMethod.value);
}

function renderPaymentMethod(paymentMethod, storedPaymentMethodBool, path) {
  var paymentMethodsUI = document.querySelector('#paymentMethodsList');
  var li = document.createElement('li');
  var paymentMethodID = storedPaymentMethodBool
    ? `storedCard${paymentMethod.id}`
    : paymentMethod.type;
  var isSchemeNotStored =
    paymentMethod.type === 'scheme' && !storedPaymentMethodBool;
  var paymentMethodImage = storedPaymentMethodBool
    ? `${path}${paymentMethod.brand}.png`
    : `${path}${paymentMethod.type}.png`;
  var cardImage = `${path}card.png`;
  var imagePath = isSchemeNotStored ? cardImage : paymentMethodImage;
  var label = storedPaymentMethodBool
    ? `${paymentMethod.name} ${MASKED_CC_PREFIX}${paymentMethod.lastFour}`
    : `${paymentMethod.name}`;
  var liContents = `
                              <input name="brandCode" type="radio" value="${paymentMethodID}" id="rb_${paymentMethodID}">
                              <img class="paymentMethod_img" src="${imagePath}" ></img>
                              <label id="lb_${paymentMethodID}" for="rb_${paymentMethodID}" style="float: none; width: 100%; display: inline; text-align: inherit">${label}</label>
                             `;
  var container = document.createElement('div');

  li.innerHTML = liContents;
  li.classList.add('paymentMethod');

  var node = renderCheckoutComponent(
    storedPaymentMethodBool,
    checkout,
    paymentMethod,
    container,
    paymentMethodID,
  );

  container.classList.add('additionalFields');
  container.setAttribute('id', `component_${paymentMethodID}`);
  container.setAttribute('style', 'display:none');

  li.append(container);
  paymentMethodsUI.append(li);

  if (paymentMethod.type !== 'paywithgoogle') {
    node && node.mount(container);
  } else {
    node
      .isAvailable()
      .then(() => {
        node.mount(container);
      })
      .catch(() => {}); // eslint-disable-line no-empty
  }

  var input = document.querySelector(`#rb_${paymentMethodID}`);
  input.onchange = async function (event) {
    if (
        document.querySelector('.adyen-checkout__qr-loader') &&
        qrCodeMethods.indexOf(selectedMethod) > -1 ||
        paypalTerminatedEarly
    ) {
      paypalTerminatedEarly = false;
      paymentFromComponent({
        cancelTransaction: true,
        merchantReference: document.querySelector('#merchantReference').value,
      });
    }

    displaySelectedMethod(event.target.value);
  };

  if (paymentMethodID === 'giropay') {
    container.innerHTML = '';
  }

  if (componentsObj[paymentMethodID] && !container.childNodes[0] && ['bcmc', 'scheme'].indexOf(paymentMethodID) === -1) {
    componentsObj[paymentMethodID].isValid = true;
  }
}

function renderCheckoutComponent(
  storedPaymentMethodBool,
  checkout,
  paymentMethod,
  container,
  paymentMethodID,
) {
  if (storedPaymentMethodBool) {
    return createCheckoutComponent(
      checkout,
      paymentMethod,
      container,
      paymentMethodID,
    );
  }
  var fallback = getFallback(paymentMethod.type);
  if (fallback) {
    var template = document.createElement('template');
    template.innerHTML = fallback;
    container.append(template.content);
    return;
  }
  return createCheckoutComponent(
    checkout,
    paymentMethod,
    container,
    paymentMethodID,
  );
}

function createCheckoutComponent(
  checkout,
  paymentMethod,
  container,
  paymentMethodID,
) {
  try {
    var node = checkout.create(paymentMethod.type, paymentMethod);
    if (!componentsObj[paymentMethodID]) {
      componentsObj[paymentMethodID] = {};
    }
    componentsObj[paymentMethodID].node = node;
    return node;
  } catch (e) {} // eslint-disable-line no-empty
  return false;
}

/**
 * Makes an ajax call to the controller function PaymentFromComponent.
 * Used by certain payment methods like paypal
 */
function paymentFromComponent(data, component) {
  $.ajax({
    url: window.paymentFromComponentURL,
    type: 'post',
    data: JSON.stringify(data),
    contentType: 'application/; charset=utf-8',
    success: function (data) {
      if (data.result && data.result.orderNo && data.result.orderToken) {
        document.querySelector('#orderToken').value = data.result.orderToken;
        document.querySelector('#merchantReference').value = data.result.orderNo;
      }
      if (
        data.result &&
        data.result.fullResponse &&
        data.result.fullResponse.action
      ) {
        component.handleAction(data.result.fullResponse.action);
      } else {
        document.querySelector('#paymentFromComponentStateData').value = JSON.stringify(
          'null',
        );
        $('#dwfrm_billing').trigger('submit');
      }
    },
  }).fail(function (/* xhr, textStatus */) {});
}

$('#dwfrm_billing').submit(function (e) {
  if (
      ['paypal', 'mbway', 'amazonpay', ...qrCodeMethods].indexOf(selectedMethod) > -1 &&
    !document.querySelector('#paymentFromComponentStateData').value
  ) {
    e.preventDefault();
    var form = $(this);
    var url = form.attr('action');

    $.ajax({
      type: 'POST',
      url: url,
      data: form.serialize(),
      async: false,
      success: function (data) {
        formErrorsExist = data.fieldErrors;
      },
    });
  }
});

function getQRCodeConfig() {
  return {
    showPayButton: true,
    onSubmit: (state, component) => {
      $('#dwfrm_billing').trigger('submit');
      if (formErrorsExist) {
        return;
      }

      assignPaymentMethodValue();
      document.querySelector('#adyenStateData').value = JSON.stringify(
          state.data,
      );

      paymentFromComponent(state.data, component);
    },
    onAdditionalDetails: (state /* , component */) => {
      document.querySelector('#paymentFromComponentStateData').value = JSON.stringify(
          state.data,
      );
      $('#dwfrm_billing').trigger('submit');
    },
  };
}

function getAmazonpayConfig() {
  return {
    showPayButton: true,
    productType: 'PayAndShip',
    checkoutMode: 'ProcessOrder',
    returnUrl: window.returnURL,
    addressDetails: {
      name: paymentMethodsResponse.shippingAddress.firstName
      + ' ' + paymentMethodsResponse.shippingAddress.lastName,
      addressLine1: paymentMethodsResponse.shippingAddress.address1,
      city:  paymentMethodsResponse.shippingAddress.city,
      stateOrRegion: paymentMethodsResponse.shippingAddress.city,
      postalCode:  paymentMethodsResponse.shippingAddress.postalCode,
      countryCode: paymentMethodsResponse.shippingAddress.country,
      phoneNumber: paymentMethodsResponse.shippingAddress.phone,
    },
    configuration: {
      merchantId: window.amazonMerchantID,
      storeId: window.amazonStoreID,
      publicKeyId: window.amazonPublicKeyID,
    },
    onClick: (resolve, reject) => {
      $('#dwfrm_billing').trigger('submit');
      if (formErrorsExist) {
        reject();
      } else {
        assignPaymentMethodValue();
        resolve();
      }
    },
    onError: () => {},
  };
}

/**
 * @function
 * @description Initializes Adyen CSE billing events
 */

exports.initBilling = function () {
  initializeBillingEvents();
};

exports.initAccount = function () {
  initializeAccountEvents();
};

exports.renderGenericComponent = function () {
  renderGenericComponent();
};
