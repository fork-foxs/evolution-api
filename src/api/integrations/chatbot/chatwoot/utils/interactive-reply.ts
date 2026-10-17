export interface InteractiveReply {
  type: 'list_reply' | 'button_reply';
  id: string;
  title: string;
}

export function getInteractiveReply(message: any): InteractiveReply | null {
  const interactive = message?.interactiveResponseMessage;
  const flow = interactive?.nativeFlowResponseMessage;
  if (flow?.name === 'quick_reply' || flow?.name === 'single_select') {
    try {
      const params = JSON.parse(flow.paramsJson);
      const id = params?.id ?? params?.selected_row_id;
      if (typeof id !== 'string' || !id.trim()) return null;

      const title = [params?.display_text, params?.title, interactive?.body?.text].find(
        (value) => typeof value === 'string' && value.trim(),
      );
      return {
        type: flow.name === 'single_select' ? 'list_reply' : 'button_reply',
        id,
        title: title || id,
      };
    } catch {
      // Malformed provider data must not interrupt webhook processing.
      return null;
    }
  }

  const list = message?.listResponseMessage;
  const buttons = message?.buttonsResponseMessage;
  const template = message?.templateButtonReplyMessage;
  const id = list?.singleSelectReply?.selectedRowId ?? buttons?.selectedButtonId ?? template?.selectedId;
  if (typeof id !== 'string' || !id.trim()) return null;

  const title = list?.title ?? buttons?.selectedDisplayText ?? template?.selectedDisplayText;
  return {
    type: list ? 'list_reply' : 'button_reply',
    id,
    title: typeof title === 'string' && title.trim() ? title : id,
  };
}

export function getReplyContext(message: any, contextInfo?: any): any {
  return [
    message?.listResponseMessage?.contextInfo,
    message?.buttonsResponseMessage?.contextInfo,
    message?.templateButtonReplyMessage?.contextInfo,
    message?.interactiveResponseMessage?.contextInfo,
    message?.extendedTextMessage?.contextInfo,
    contextInfo,
    message?.contextInfo,
  ].find((context) => typeof context?.stanzaId === 'string' && context.stanzaId.trim());
}
