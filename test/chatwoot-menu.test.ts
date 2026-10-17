import assert from 'node:assert/strict';
import { test } from 'node:test';
import i18next from 'i18next';

import ar from '../src/utils/translations/ar.json';
import en from '../src/utils/translations/en.json';

import { getInteractiveReply, getReplyContext } from '../src/api/integrations/chatbot/chatwoot/utils/interactive-reply';
import { formatChatwootList } from '../src/api/integrations/chatbot/chatwoot/utils/list-message';

function formatFor(message: unknown, language: string): string {
  const translations = i18next.createInstance();
  translations.init({
    lng: language, fallbackLng: 'en', initImmediate: false,
    resources: {
      ar: { translation: ar }, en: { translation: en },
    },
  });
  return formatChatwootList(message, translations.t);
}

test('Arabic defaults come from translations while menu data comes from the application', () => {
  const content = formatFor({
    description: 'مرحبًا، اختر من القائمة',
    sections: [{ rows: [
      { title: 'إنشاء حساب', rowId: 'create_account' },
      { title: 'إرسال رمز التفعيل', rowId: 'send_activation_code' },
    ] }],
  }, 'ar');
  assert.equal(content, '*الخيارات*\nمرحبًا، اختر من القائمة\n1. إنشاء حساب\n2. إرسال رمز التفعيل');
  assert.doesNotMatch(content, /rowId|create_account|send_activation_code/);
});

test('English defaults use the same formatter without forcing Arabic', () => {
  assert.equal(formatFor({ sections: [{ rows: [{}] }] }, 'en'), '*Options*\n1. Option 1');
  assert.equal(formatFor({}, 'en'), '*Options*\nNo options available.');
});

test('each supported language supplies localized menu defaults', () => {
  assert.equal(formatFor({}, 'ar'), '*الخيارات*\nلا توجد خيارات متاحة.');
  assert.equal(formatFor({}, 'en'), '*Options*\nNo options available.');
});

test('all menu labels and values supplied by the application remain dynamic', () => {
  assert.equal(formatFor({
    title: 'الخدمات المالية', footerText: 'شكرًا لك',
    sections: [{ title: 'الحساب', rows: [{ title: 'الرصيد', description: 'عرض الرصيد المتاح' }] }],
  }, 'en'), '*الخدمات المالية*\n\n*الحساب*\n1. الرصيد\n   عرض الرصيد المتاح\n\nشكرًا لك');
  assert.equal(formatFor({
    title: 'Support', sections: [{ title: 'Tickets', rows: [{ title: 'Open ticket' }, { title: 'Close ticket' }] }],
  }, 'ar'), '*Support*\n\n*Tickets*\n1. Open ticket\n2. Close ticket');
});

test('provided text is never mistaken for a hardcoded default', () => {
  assert.equal(formatFor({ title: 'Options', sections: [{ rows: [{ title: 'Unknown' }] }] }, 'ar'),
    '*Options*\n1. Unknown');
});

test('list selections show Arabic while retaining the exact bot value and reply context', () => {
  const message = { listResponseMessage: {
    title: 'إلغاء حوالة', singleSelectReply: { selectedRowId: 'cancel-remittance' },
    contextInfo: { stanzaId: 'menu-wa-id' },
  } };
  assert.deepEqual(getInteractiveReply(message), {
    type: 'list_reply', title: 'إلغاء حوالة', id: 'cancel-remittance',
  });
  assert.equal(getReplyContext(message)?.stanzaId, 'menu-wa-id');
});

test('button selections retain their labels, values and original message reference', () => {
  const message = { buttonsResponseMessage: {
    selectedDisplayText: 'الرصيد', selectedButtonId: 'check_balance', contextInfo: { stanzaId: 'button-wa-id' },
  } };
  assert.deepEqual(getInteractiveReply(message), { type: 'button_reply', title: 'الرصيد', id: 'check_balance' });
  assert.equal(getReplyContext(message)?.stanzaId, 'button-wa-id');
});

test('template button selections retain their original values', () => {
  assert.deepEqual(getInteractiveReply({ templateButtonReplyMessage: {
    selectedId: 'PUK', selectedDisplayText: 'نسيت كلمة السر',
  } }), { type: 'button_reply', title: 'نسيت كلمة السر', id: 'PUK' });
});

test('missing selection labels fall back to the value without discarding the selection', () => {
  assert.equal(getInteractiveReply({ listResponseMessage: {
    singleSelectReply: { selectedRowId: 'كشف حساب' },
  } })?.title, 'كشف حساب');
});

test('ordinary text and invalid selections remain outside interactive handling', () => {
  assert.equal(getInteractiveReply({ conversation: 'مرحبا' }), null);
  assert.equal(getInteractiveReply({ listResponseMessage: { singleSelectReply: { selectedRowId: '' } } }), null);
});

test('ordinary text replies keep the existing quote context', () => {
  assert.equal(getReplyContext({ extendedTextMessage: { contextInfo: { stanzaId: 'text-id' } } })?.stanzaId, 'text-id');
  assert.equal(getReplyContext({}, { stanzaId: 'outer-id' })?.stanzaId, 'outer-id');
});

test('native quick replies preserve the Arabic label, action ID and quote reference', () => {
  const message = { interactiveResponseMessage: {
    body: { text: 'الرصيد' },
    nativeFlowResponseMessage: {
      name: 'quick_reply', paramsJson: JSON.stringify({ id: 'check_balance', display_text: 'الرصيد' }),
    },
    contextInfo: { stanzaId: 'native-button-id' },
  } };
  assert.deepEqual(getInteractiveReply(message), { type: 'button_reply', id: 'check_balance', title: 'الرصيد' });
  assert.equal(getReplyContext(message)?.stanzaId, 'native-button-id');
});

test('native list replies preserve the selection ID and use the response body as a label', () => {
  assert.deepEqual(getInteractiveReply({ interactiveResponseMessage: {
    body: { text: 'إلغاء حوالة' },
    nativeFlowResponseMessage: { name: 'single_select', paramsJson: JSON.stringify({ id: 'cancel-remittance' }) },
  } }), { type: 'list_reply', id: 'cancel-remittance', title: 'إلغاء حوالة' });
});

test('native replies without labels retain their original machine values', () => {
  assert.deepEqual(getInteractiveReply({ interactiveResponseMessage: {
    nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: JSON.stringify({ id: 'PUK' }) },
  } }), { type: 'button_reply', id: 'PUK', title: 'PUK' });
});

test('malformed native reply JSON does not throw or manufacture a selection', () => {
  assert.equal(getInteractiveReply({ interactiveResponseMessage: {
    nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: '{invalid-json' },
  } }), null);
});

test('native replies without valid selection IDs are rejected', () => {
  for (const params of [null, [], {}, { id: '' }, { id: 123 }, { id: '   ' }]) {
    assert.equal(getInteractiveReply({ interactiveResponseMessage: {
      nativeFlowResponseMessage: { name: 'single_select', paramsJson: JSON.stringify(params) },
    } }), null);
  }
});

test('non-selection native flows do not become bot menu actions', () => {
  assert.equal(getInteractiveReply({ interactiveResponseMessage: {
    nativeFlowResponseMessage: { name: 'payment_info', paramsJson: JSON.stringify({ id: 'transaction-id' }) },
  } }), null);
});

test('empty nested quote context falls back to the outer message reference', () => {
  assert.equal(getReplyContext({ listResponseMessage: { contextInfo: {} } }, { stanzaId: 'outer-id' })?.stanzaId,
    'outer-id');
});

test('empty stanza IDs fall back to a valid top-level reference', () => {
  assert.equal(getReplyContext({
    interactiveResponseMessage: { contextInfo: { stanzaId: '   ' } },
    contextInfo: { stanzaId: 'message-id' },
  }, {})?.stanzaId, 'message-id');
});

test('valid nested quote references take priority over outer references', () => {
  assert.equal(getReplyContext({
    buttonsResponseMessage: { contextInfo: { stanzaId: 'nested-id' } },
  }, { stanzaId: 'outer-id' })?.stanzaId, 'nested-id');
});

test('messages without a valid quote reference return no context', () => {
  assert.equal(getReplyContext({ listResponseMessage: { contextInfo: {} } }, {}), undefined);
});
