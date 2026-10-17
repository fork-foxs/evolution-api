type Translate = (key: string, options?: { index: number }) => string;

function visibleText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function formatChatwootList(message: any, translate: Translate): string {
  const heading = visibleText(message?.title) || translate('cw.listMessage.options');
  const lines = [`*${heading}*`];
  const description = visibleText(message?.description);
  if (description) lines.push(description);

  let optionCount = 0;
  for (const section of message?.sections ?? []) {
    const sectionTitle = visibleText(section?.title);
    if (sectionTitle && sectionTitle !== heading) {
      lines.push('', `*${sectionTitle}*`);
    }
    for (const row of section?.rows ?? []) {
      optionCount += 1;
      lines.push(
        `${optionCount}. ${visibleText(row?.title) || translate('cw.listMessage.option', { index: optionCount })}`,
      );
      const detail = visibleText(row?.description);
      if (detail) lines.push(`   ${detail}`);
    }
  }
  if (!optionCount) lines.push(translate('cw.listMessage.empty'));

  const footer = visibleText(message?.footerText);
  if (footer) lines.push('', footer);
  return lines.join('\n');
}
