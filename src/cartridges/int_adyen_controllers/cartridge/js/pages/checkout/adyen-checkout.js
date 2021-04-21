require('./bundle');
require('./adyen-giving');

const { qrCodeMethods } = require('./qrCodeMethods');
let maskedCardNumber;
const MASKED_CC_PREFIX = '************';
let selectedMethod;
const componentsObj = {};
let checkoutConfiguration;
let paymentMethodsResponse;
let checkout;
let formErrorsExist;
let isValid;
let paypalTerminatedEarly = false;
/**
 * @function
 * @description Initializes Adyen Secured Fields  Billing events
 */
function initializeBillingEvents() {
  $('#billing-submit').on('click', () => {
    const isAdyenPOS = document.querySelector(
      '.payment-method-options :checked',
    ).value;
    ('AdyenPOS');
    if (isAdyenPOS) {
      document.querySelector(
        '#dwfrm_adyPaydata_terminalId',
      ).value = document.querySelector('#terminalList').value;
      return true;
    }
    const adyenPaymentMethod = document.querySelector(
      '#adyenPaymentMethodName',
    );
    const paymentMethodLabel = document.querySelector(`#lb_${selectedMethod}`)
      .innerHTML;
    adyenPaymentMethod.value = paymentMethodLabel;

    if(selectedMethod.includes('storedCard')) {
      checkoutConfiguration.paymentMethodsResponse.storedPaymentMethods.forEach(method => {
        if(method.id === selectedMethod.slice(10)) {
          document.querySelector('#cardNumber').value = `${MASKED_CC_PREFIX}${method.lastFour}`;
        }
      })
    }

    validateComponents();

    return showValidation();
  });

  if (window.getPaymentMethodsResponse) {
    paymentMethodsResponse = window.getPaymentMethodsResponse;
    checkoutConfiguration = window.Configuration;
    checkoutConfiguration.onChange = function (state /* , component */) {
      const { type } = state.data.paymentMethod;
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
        onBrand(brandObject) {
          $('#cardType').val(brandObject.brand);
        },
        onFieldValid(data) {
          if (data.endDigits) {
            maskedCardNumber = MASKED_CC_PREFIX + data.endDigits;
            $('#cardNumber').val(maskedCardNumber);
          }
        },
        onChange(state) {
          isValid = state.isValid;
          const componentName = state.data.paymentMethod.storedPaymentMethodId
            ? `storedCard${state.data.paymentMethod.storedPaymentMethodId}`
            : state.data.paymentMethod.type;
          if (componentName === selectedMethod || selectedMethod === 'bcmc') {
            $('#browserInfo').val(JSON.stringify(state.data.browserInfo));
            componentsObj[selectedMethod].isValid = isValid;
            componentsObj[selectedMethod].stateData = state.data;
          }
          if(state.data.paymentMethod.holderName) {
            document.querySelector('#cardOwner').value = state.data.paymentMethod.holderName;
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
    };
    if (window.installments) {
      try {
        const installments = JSON.parse(window.installments);
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
  const newCard = document.getElementById('newCard');
  let adyenStateData;
  let isValid = false;
  const node = checkout
    .create('card', {
      hasHolderName: true,
      holderNameRequired: true,
      onChange(state) {
        adyenStateData = state.data;
        isValid = state.isValid;
      },
    })
    .mount(newCard);

  $('#applyBtn').on('click', () => {
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
  const adyenPaymentMethod = document.querySelector('#adyenPaymentMethodName');
  adyenPaymentMethod.value = document.querySelector(
    `#lb_${selectedMethod}`,
  ).innerHTML;
}

/**
 * To avoid re-rendering components twice, unmounts existing components from payment methods list
 */
function unmountComponents() {
  const promises = Object.entries(componentsObj).map(([key, val]) => {
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
  if (['paypal', 'paywithgoogle', 'mbway', ...qrCodeMethods].indexOf(type) > -1) {
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
  if (selectedMethod === 'ach') {
    let inputs = document.querySelectorAll('#component_ach > input');
    inputs = Object.values(inputs).filter(
      (input) => !(input.value && input.value.length > 0),
    );
    for (let i = 0; i < inputs.length; i++) {
      inputs[i].classList.add('adyen-checkout__input--error');
    }
    if (inputs.length) {
      return false;
    }
  } else if (selectedMethod === 'ratepay') {
    const input = document.querySelector('#dateOfBirthInput');
    if (!(input.value && input.value.length > 0)) {
      input.classList.add('adyen-checkout__input--error');
      return false;
    }
  }
  return true;
}

/**
 * Assigns stateData value to the hidden stateData input field
 * so it's sent to the backend for processing
 */
function validateComponents() {
  if (document.querySelector('#component_ach')) {
    const inputs = document.querySelectorAll('#component_ach > input');
    for (const input of inputs) {
      input.onchange = function () {
        validateCustomInputField(this);
      };
    }
  }
  if (document.querySelector('#dateOfBirthInput')) {
    document.querySelector('#dateOfBirthInput').onchange = function () {
      validateCustomInputField(this);
    };
  }

  let stateData;
  if (
    componentsObj[selectedMethod] &&
    componentsObj[selectedMethod].stateData
  ) {
    stateData = componentsObj[selectedMethod].stateData;
  } else {
    stateData = { paymentMethod: { type: selectedMethod } };
  }

  if (selectedMethod === 'ach') {
    const bankAccount = {
      ownerName: document.querySelector('#bankAccountOwnerNameValue').value,
      bankAccountNumber: document.querySelector('#bankAccountNumberValue')
        .value,
      bankLocationId: document.querySelector('#bankLocationIdValue').value,
    };
    stateData.paymentMethod = {
      ...stateData.paymentMethod,
      bankAccount,
    };
  } else if (selectedMethod === 'ratepay') {
    if (
      document.querySelector('#genderInput').value &&
      document.querySelector('#dateOfBirthInput').value
    ) {
      stateData.shopperName = {
        gender: document.querySelector('#genderInput').value,
      };
      stateData.dateOfBirth = document.querySelector('#dateOfBirthInput').value;
    }
  }
  document.querySelector('#adyenStateData').value = JSON.stringify(stateData);
}

function validateCustomInputField(input) {
  if (input.value === '') {
    input.classList.add('adyen-checkout__input--error');
  } else if (input.value.length > 0) {
    input.classList.remove('adyen-checkout__input--error');
  }
}

/**
 * Contains fallback components for payment methods that don't have an Adyen web component yet
 */
function getFallback(paymentMethod) {
  const ach = `<div id="component_ach">
                    <span class="adyen-checkout__label">Bank Account Owner Name</span>
                    <input type="text" id="bankAccountOwnerNameValue" class="adyen-checkout__input">
                    <span class="adyen-checkout__label">Bank Account Number</span>
                    <input type="text" id="bankAccountNumberValue" class="adyen-checkout__input" maxlength="17" >
                    <span class="adyen-checkout__label">Routing Number</span>
                    <input type="text" id="bankLocationIdValue" class="adyen-checkout__input" maxlength="9" >
                 </div>`;

  const ratepay = `<span class="adyen-checkout__label">Gender</span>
                    <select id="genderInput" class="adyen-checkout__input">
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                    </select>
                    <span class="adyen-checkout__label">Date of birth</span>
                    <input id="dateOfBirthInput" class="adyen-checkout__input" type="date"/>`;

  const fallback = { ach, ratepay };
  return fallback[paymentMethod];
}

/**
 * checks if payment method is blocked and returns a boolean accordingly
 */
function isMethodTypeBlocked(methodType) {
  const blockedMethods = [
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
  let paymentMethod;
  let i;
  checkoutConfiguration.paymentMethodsResponse =
    paymentMethodsResponse.adyenPaymentMethods;
  const paymentMethods = paymentMethodsResponse.adyenPaymentMethods;
  if (paymentMethodsResponse.amount) {
    checkoutConfiguration.amount = paymentMethodsResponse.amount;
    checkoutConfiguration.paymentMethodsConfiguration.paypal.amount = paymentMethodsResponse.amount;
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

  const firstPaymentMethod = document.querySelector(
    'input[type=radio][name=brandCode]',
  );
  firstPaymentMethod.checked = true;
  displaySelectedMethod(firstPaymentMethod.value);
}

function renderPaymentMethod(paymentMethod, storedPaymentMethodBool, path) {
  const paymentMethodsUI = document.querySelector('#paymentMethodsList');
  const li = document.createElement('li');
  const paymentMethodID = storedPaymentMethodBool
    ? `storedCard${paymentMethod.id}`
    : paymentMethod.type;
  const isSchemeNotStored =
    paymentMethod.type === 'scheme' && !storedPaymentMethodBool;
  const paymentMethodImage = storedPaymentMethodBool
    ? `${path}${paymentMethod.brand}.png`
    : `${path}${paymentMethod.type}.png`;
  const cardImage = `${path}card.png`;
  const imagePath = isSchemeNotStored ? cardImage : paymentMethodImage;
  const label = storedPaymentMethodBool
    ? `${paymentMethod.name} ${MASKED_CC_PREFIX}${paymentMethod.lastFour}`
    : `${paymentMethod.name}`;
  const liContents = `
                              <input name="brandCode" type="radio" value="${paymentMethodID}" id="rb_${paymentMethodID}">
                              <img class="paymentMethod_img" src="${imagePath}" ></img>
                              <label id="lb_${paymentMethodID}" for="rb_${paymentMethodID}" style="float: none; width: 100%; display: inline; text-align: inherit">${label}</label>
                             `;
  const container = document.createElement('div');

  li.innerHTML = liContents;
  li.classList.add('paymentMethod');

  const node = renderCheckoutComponent(
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

  const input = document.querySelector(`#rb_${paymentMethodID}`);
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

  if (componentsObj[paymentMethodID] && !container.childNodes[0]) {
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
  const fallback = getFallback(paymentMethod.type);
  if (fallback) {
    const template = document.createElement('template');
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
    const node = checkout.create(paymentMethod.type, paymentMethod);
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
    success(data) {
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
  }).fail((/* xhr, textStatus */) => {});
}

$('#dwfrm_billing').submit(function (e) {
  if (
      ['paypal', 'mbway', ...qrCodeMethods].indexOf(selectedMethod) > -1 &&
    !document.querySelector('#paymentFromComponentStateData').value
  ) {
    e.preventDefault();
    const form = $(this);
    const url = form.attr('action');

    $.ajax({
      type: 'POST',
      url,
      data: form.serialize(),
      async: false,
      success(data) {
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
